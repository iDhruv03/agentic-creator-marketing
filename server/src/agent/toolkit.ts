import { mcpServer, type ToolExecutionResult } from '../mcp/server';
import { appendRunEvent, updateRun, isCancelled } from './runs';
import type { AgentSession } from '../core/governance';

/**
 * Shared agent-side wrapper around the governed executor. Both the Claude
 * runner and the deterministic simulator call tools through here so that
 * run events, counters and cancellation behave identically.
 */
export class AgentToolkit {
  steps = 0;
  checkpoints = 0;
  blocked = 0;
  spend = 0;
  readonly history: { tool: string; input: any; result: ToolExecutionResult }[] = [];

  constructor(public readonly runId: string, public readonly session: AgentSession) {}

  get cancelled(): boolean {
    return isCancelled(this.runId);
  }

  think(text: string): void {
    appendRunEvent(this.runId, 'thinking', { text });
  }

  say(text: string): void {
    appendRunEvent(this.runId, 'text', { text });
  }

  status(text: string): void {
    appendRunEvent(this.runId, 'status', { text });
  }

  async call(tool: string, input: Record<string, unknown>, callId?: string): Promise<ToolExecutionResult> {
    this.steps += 1;
    const id = callId ?? `call_${this.steps}`;
    appendRunEvent(this.runId, 'tool_call', { id, tool, input, step: this.steps });
    const result = await mcpServer.callTool(this.session.id, tool, input, { run_id: this.runId });
    this.history.push({ tool, input, result });

    if (result.status === 'HELD_FOR_APPROVAL') {
      this.checkpoints += 1;
      appendRunEvent(this.runId, 'checkpoint', { id, tool, checkpoint_id: result.checkpoint_id, message: result.error ?? (result.result as any)?.message, guardrail_notes: result.guardrail_notes });
    } else if (result.status === 'REJECTED_BY_GUARDRAIL') {
      this.blocked += 1;
      appendRunEvent(this.runId, 'guardrail', { id, tool, message: result.error, guardrail_notes: result.guardrail_notes, rules: result.rules_evaluated });
    } else if (result.status === 'SUCCESS' && tool === 'send_collaboration_offer') {
      this.spend += Number(input.proposed_rate ?? 0);
    }

    appendRunEvent(this.runId, 'tool_result', {
      id, tool, status: result.status, duration_ms: result.duration_ms, audit_id: result.audit_id,
      result: result.status === 'SUCCESS' ? result.result : { error: result.error, ...(result.result as any ?? {}) },
      guardrail_notes: result.guardrail_notes, rules: result.rules_evaluated, step: this.steps,
    });
    updateRun(this.runId, { steps_count: this.steps, checkpoints_count: this.checkpoints, blocked_count: this.blocked, spend_committed: this.spend });
    // Refresh the session snapshot so ceilings reflect spend from earlier steps.
    const { getSession } = await import('../core/governance');
    const fresh = getSession(this.session.id);
    if (fresh) Object.assign(this.session, fresh);
    return result;
  }

  /** Compact tool result text for the model. */
  static resultText(result: ToolExecutionResult): string {
    if (result.status === 'SUCCESS') return JSON.stringify(result.result ?? {}, null, 1);
    return JSON.stringify({ status: result.status, error: result.error, ...(result.result as any ?? {}), guardrail_notes: result.guardrail_notes }, null, 1);
  }
}
