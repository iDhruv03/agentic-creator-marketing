import { transaction } from '../db/database';
import { CoreError } from '../core/ids';
import { appendAudit, type ExecutionStatus } from '../core/audit';
import { evaluateGuardrails, createCheckpoint, getCheckpoint, markCheckpointResolved, requireSession, getSession, recordSessionSpend, touchSession, type AgentSession, type Checkpoint } from '../core/governance';
import { getTool, toolDefinitions, type McpToolDefinition } from './tools';
import { updateCampaign } from '../core/campaigns';
import { sendOffer, acceptOffer, counterOffer, declineOffer } from '../core/collaborations';
import { releasePayment } from '../core/payments';

/**
 * The governed executor. Every agent-originated tool call — whether it
 * arrives over MCP stdio, MCP streamable HTTP, the REST playground, or the
 * in-process Claude runner — passes through callTool(), so governance and
 * audit logging cannot be bypassed.
 */
export interface ToolExecutionResult {
  status: ExecutionStatus;
  result?: unknown;
  error?: string;
  checkpoint_id?: string;
  audit_id: string;
  duration_ms: number;
  guardrail_notes?: string;
  rules_evaluated?: string[];
}

export class CmiMcpServer {
  listTools(session?: AgentSession | null): McpToolDefinition[] {
    return toolDefinitions(session ? session.allowed_tools : undefined);
  }

  async callTool(sessionId: string, toolName: string, rawParams: unknown = {}, opts: { run_id?: string | null } = {}): Promise<ToolExecutionResult> {
    const started = Date.now();
    const params = (rawParams && typeof rawParams === 'object' ? rawParams : {}) as Record<string, any>;
    const session = getSession(sessionId);

    if (!session) {
      const audit_id = appendAudit({ actor_type: 'AGENT', actor_id: sessionId, session_id: sessionId, run_id: opts.run_id, tool_name: toolName, parameters: params, execution_status: 'REJECTED_BY_GUARDRAIL', result_summary: `Unknown agent session '${sessionId}'.`, guardrail_notes: 'Session authentication failed.', duration_ms: Date.now() - started });
      return { status: 'REJECTED_BY_GUARDRAIL', error: `Agent session '${sessionId}' not found. Create a session on the Agents page or pass a valid session id.`, audit_id, duration_ms: Date.now() - started };
    }

    let spec;
    try {
      spec = getTool(toolName);
    } catch {
      const audit_id = appendAudit({ actor_type: 'AGENT', actor_id: session.id, actor_name: session.name, session_id: session.id, run_id: opts.run_id, campaign_id: params.campaign_id ?? session.campaign_id, tool_name: toolName, parameters: params, execution_status: 'FAILED', result_summary: `Unknown tool '${toolName}'.`, duration_ms: Date.now() - started });
      return { status: 'FAILED', error: `Unknown tool '${toolName}'.`, audit_id, duration_ms: Date.now() - started };
    }

    // Validate input before governance so blocked calls are still well-formed in the log.
    const parsed = spec.schema.safeParse(params);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
      const audit_id = appendAudit({ actor_type: 'AGENT', actor_id: session.id, actor_name: session.name, session_id: session.id, run_id: opts.run_id, campaign_id: params.campaign_id ?? session.campaign_id, tool_name: toolName, parameters: params, execution_status: 'FAILED', result_summary: `Invalid input: ${issues}`, guardrail_notes: 'Schema validation failed.', duration_ms: Date.now() - started });
      return { status: 'FAILED', error: `Invalid input for ${toolName}: ${issues}`, audit_id, duration_ms: Date.now() - started };
    }
    const input = parsed.data as Record<string, any>;
    const campaignId = input.campaign_id ?? session.campaign_id ?? null;

    const decision = evaluateGuardrails(session, toolName, input);

    if (decision.requires_checkpoint && decision.checkpoint) {
      const chk = createCheckpoint({ session, run_id: opts.run_id, campaign_id: campaignId, action_type: decision.checkpoint.action_type, risk_level: decision.checkpoint.risk_level, amount: decision.checkpoint.amount, tool_name: toolName, payload: input, justification: decision.checkpoint.justification });
      touchSession(session.id);
      const audit_id = appendAudit({ actor_type: 'AGENT', actor_id: session.id, actor_name: session.name, session_id: session.id, run_id: opts.run_id, campaign_id: campaignId, tool_name: toolName, parameters: input, execution_status: 'HELD_FOR_APPROVAL', result_summary: decision.reason ?? 'Held for human review.', guardrail_notes: decision.guardrail_notes, duration_ms: Date.now() - started });
      return {
        status: 'HELD_FOR_APPROVAL',
        checkpoint_id: chk.id,
        result: { checkpoint_id: chk.id, status: 'PENDING_HUMAN_APPROVAL', action_type: chk.action_type, message: `${decision.reason} A reviewer will approve or reject checkpoint ${chk.id}; the action has NOT been executed. Continue with other work.` },
        audit_id,
        duration_ms: Date.now() - started,
        guardrail_notes: decision.guardrail_notes,
        rules_evaluated: decision.rules_evaluated,
      };
    }

    if (!decision.allowed) {
      const audit_id = appendAudit({ actor_type: 'AGENT', actor_id: session.id, actor_name: session.name, session_id: session.id, run_id: opts.run_id, campaign_id: campaignId, tool_name: toolName, parameters: input, execution_status: 'REJECTED_BY_GUARDRAIL', result_summary: decision.reason ?? 'Blocked by governance rule.', guardrail_notes: decision.guardrail_notes, duration_ms: Date.now() - started });
      return { status: 'REJECTED_BY_GUARDRAIL', error: decision.reason, audit_id, duration_ms: Date.now() - started, guardrail_notes: decision.guardrail_notes, rules_evaluated: decision.rules_evaluated };
    }

    try {
      const result = await transaction(() => spec.handler(input, { session, run_id: opts.run_id }));
      if (toolName === 'send_collaboration_offer') recordSessionSpend(session.id, Number(input.proposed_rate));
      else if (toolName === 'respond_to_counter_offer' && input.decision === 'COUNTER') recordSessionSpend(session.id, 0);
      else touchSession(session.id);
      const summary = (result && typeof result === 'object' && 'message' in (result as any) && typeof (result as any).message === 'string') ? (result as any).message : `${toolName} executed.`;
      const audit_id = appendAudit({ actor_type: 'AGENT', actor_id: session.id, actor_name: session.name, session_id: session.id, run_id: opts.run_id, campaign_id: campaignId, tool_name: toolName, parameters: input, execution_status: 'SUCCESS', result_summary: summary, guardrail_notes: decision.guardrail_notes, duration_ms: Date.now() - started });
      return { status: 'SUCCESS', result, audit_id, duration_ms: Date.now() - started, guardrail_notes: decision.guardrail_notes, rules_evaluated: decision.rules_evaluated };
    } catch (err: any) {
      const message = err instanceof CoreError ? err.message : (err?.message ?? 'Tool execution failed.');
      const audit_id = appendAudit({ actor_type: 'AGENT', actor_id: session.id, actor_name: session.name, session_id: session.id, run_id: opts.run_id, campaign_id: campaignId, tool_name: toolName, parameters: input, execution_status: 'FAILED', result_summary: message, guardrail_notes: 'Runtime failure in Infrastructure Core.', duration_ms: Date.now() - started });
      return { status: 'FAILED', error: message, audit_id, duration_ms: Date.now() - started };
    }
  }

  /**
   * A human resolves a checkpoint. On approval the held action is executed by
   * the core with the reviewer as the actor (the agent never gains the
   * permission itself), and both the decision and the execution are audited.
   */
  resolveCheckpoint(checkpointId: string, decision: 'APPROVED' | 'REJECTED', reviewer: { id: string; name?: string; notes?: string }): Checkpoint {
    const chk = getCheckpoint(checkpointId);
    if (chk.status !== 'PENDING') throw new CoreError(`Checkpoint ${chk.id} is already ${chk.status}.`, 409, 'ALREADY_RESOLVED');
    const session = requireSession(chk.agent_session_id);
    const started = Date.now();

    if (decision === 'REJECTED') {
      const out = markCheckpointResolved(chk.id, 'REJECTED', reviewer);
      appendAudit({ actor_type: 'HUMAN', actor_id: reviewer.id, actor_name: reviewer.name, session_id: session.id, run_id: chk.run_id, campaign_id: chk.campaign_id, tool_name: 'resolve_checkpoint', parameters: { checkpoint_id: chk.id, decision, tool_name: chk.tool_name, amount: chk.amount }, execution_status: 'SUCCESS', result_summary: `Checkpoint ${chk.id} (${chk.action_type}) rejected${reviewer.notes ? `: ${reviewer.notes}` : '.'}`, guardrail_notes: 'Human decision recorded.', duration_ms: Date.now() - started });
      return out;
    }

    let executed: unknown = null;
    let execStatus: ExecutionStatus = 'SUCCESS';
    let summary = '';
    const actor = { type: 'HUMAN' as const, id: reviewer.id, name: reviewer.name ?? 'Reviewer' };
    try {
      executed = transaction(() => {
        const p = chk.payload ?? {};
        switch (chk.tool_name) {
          case 'release_payment': {
            const out = releasePayment({ collaboration_id: p.collaboration_id, deliverable_id: p.deliverable_id, amount: p.amount, note: p.note ?? `Approved via checkpoint ${chk.id}` }, actor);
            return { payment_status: 'RELEASED', amount: out.amount, ledger_entry_id: out.ledger_entry_id, collaboration_status: out.collaboration.status };
          }
          case 'send_collaboration_offer': {
            const col = sendOffer(p, { ...actor, session_id: session.id });
            recordSessionSpend(session.id, Number(p.proposed_rate));
            return { collaboration_id: col.id, status: col.status, proposed_rate: col.proposed_rate };
          }
          case 'respond_to_counter_offer': {
            if (p.decision === 'ACCEPT') { const c = acceptOffer(p.collaboration_id, { type: 'BRAND', id: reviewer.id, name: actor.name }, p.message); return { collaboration_id: c.id, status: c.status, agreed_rate: c.agreed_rate }; }
            if (p.decision === 'COUNTER') { const c = counterOffer(p.collaboration_id, p.counter_amount, p.message, { type: 'BRAND', id: reviewer.id, name: actor.name }); return { collaboration_id: c.id, status: c.status, proposed_rate: c.proposed_rate }; }
            const c = declineOffer(p.collaboration_id, { type: 'BRAND', id: reviewer.id, name: actor.name }, p.message);
            return { collaboration_id: c.id, status: c.status };
          }
          case 'draft_campaign_brief': {
            const { campaign_id, ...patch } = p;
            const c = updateCampaign(campaign_id, patch, actor);
            return { campaign_id: c.id, title: c.title, updated: Object.keys(patch) };
          }
          case 'request_human_approval':
            return { acknowledged: true, guidance: reviewer.notes ?? 'Approved — proceed as proposed.' };
          default:
            return { acknowledged: true };
        }
      });
      summary = `Checkpoint ${chk.id} (${chk.action_type}) approved; ${chk.tool_name} executed on behalf of the agent.`;
    } catch (err: any) {
      execStatus = 'FAILED';
      executed = { error: err?.message ?? 'Execution failed' };
      summary = `Checkpoint ${chk.id} approved but execution failed: ${err?.message}`;
    }

    const out = markCheckpointResolved(chk.id, 'APPROVED', reviewer, executed);
    appendAudit({ actor_type: 'HUMAN', actor_id: reviewer.id, actor_name: reviewer.name, session_id: session.id, run_id: chk.run_id, campaign_id: chk.campaign_id, tool_name: 'resolve_checkpoint', parameters: { checkpoint_id: chk.id, decision, tool_name: chk.tool_name, amount: chk.amount, payload: chk.payload }, execution_status: execStatus, result_summary: summary, guardrail_notes: reviewer.notes ? `Reviewer notes: ${reviewer.notes}` : 'Human approval recorded.', duration_ms: Date.now() - started });
    return out;
  }
}

export const mcpServer = new CmiMcpServer();
