import { getAgentSession, evaluateGuardrails, logAuditEntry } from './guardrails';
import { TOOL_DEFINITIONS, executeTool } from './tools';
import { ToolExecutionResult } from './types';

export class CmiMcpServer {
  /**
   * Returns list of all tools exposed by the MCP server (MCP tools/list)
   */
  public listTools() {
    return TOOL_DEFINITIONS;
  }

  /**
   * Invokes an MCP tool subject to session guardrails, budget limits,
   * human checkpoints, and append-only audit logging.
   */
  public async callTool(
    sessionId: string,
    toolName: string,
    params: any = {}
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    // 1. Resolve agent session
    const session = getAgentSession(sessionId);
    if (!session) {
      const duration = Date.now() - startTime;
      const auditId = logAuditEntry({
        actor_type: 'AGENT',
        actor_id: sessionId,
        tool_name: toolName,
        parameters: params,
        execution_status: 'REJECTED_BY_GUARDRAIL',
        result_summary: `Agent session '${sessionId}' does not exist.`,
        guardrail_notes: 'Authentication / Session failure.',
        duration_ms: duration,
      });

      return {
        status: 'REJECTED_BY_GUARDRAIL',
        error: `Agent session '${sessionId}' not found or invalid.`,
        audit_id: auditId,
        duration_ms: duration,
      };
    }

    // 2. Evaluate Guardrails & Human-in-the-Loop Checkpoints
    const decision = evaluateGuardrails(session, toolName, params);

    // If held for human approval
    if (decision.requires_checkpoint) {
      const duration = Date.now() - startTime;
      const auditId = logAuditEntry({
        actor_type: 'AGENT',
        actor_id: session.id,
        session_id: session.id,
        campaign_id: params.campaign_id || session.campaign_id,
        tool_name: toolName,
        parameters: params,
        execution_status: 'HELD_FOR_APPROVAL',
        result_summary: decision.reason || 'Held for human review.',
        guardrail_notes: decision.guardrail_notes,
        duration_ms: duration,
      });

      return {
        status: 'HELD_FOR_APPROVAL',
        result: {
          checkpoint_id: decision.checkpoint_id,
          message: decision.reason,
          status: 'PENDING_HUMAN_APPROVAL',
        },
        audit_id: auditId,
        duration_ms: duration,
        guardrail_notes: decision.guardrail_notes,
      };
    }

    // If rejected outright by guardrails
    if (!decision.allowed) {
      const duration = Date.now() - startTime;
      const auditId = logAuditEntry({
        actor_type: 'AGENT',
        actor_id: session.id,
        session_id: session.id,
        campaign_id: params.campaign_id || session.campaign_id,
        tool_name: toolName,
        parameters: params,
        execution_status: 'REJECTED_BY_GUARDRAIL',
        result_summary: decision.reason || 'Blocked by guardrail rule.',
        guardrail_notes: decision.guardrail_notes,
        duration_ms: duration,
      });

      return {
        status: 'REJECTED_BY_GUARDRAIL',
        error: decision.reason,
        audit_id: auditId,
        duration_ms: duration,
        guardrail_notes: decision.guardrail_notes,
      };
    }

    // 3. Execute Tool
    try {
      const result = await executeTool(toolName, params, session.id);
      const duration = Date.now() - startTime;

      const summary = typeof result === 'object' && result?.message 
        ? result.message 
        : `Tool ${toolName} executed successfully.`;

      const auditId = logAuditEntry({
        actor_type: 'AGENT',
        actor_id: session.id,
        session_id: session.id,
        campaign_id: params.campaign_id || session.campaign_id,
        tool_name: toolName,
        parameters: params,
        execution_status: 'SUCCESS',
        result_summary: summary,
        guardrail_notes: decision.guardrail_notes,
        duration_ms: duration,
      });

      return {
        status: 'SUCCESS',
        result,
        audit_id: auditId,
        duration_ms: duration,
        guardrail_notes: decision.guardrail_notes,
      };
    } catch (err: any) {
      const duration = Date.now() - startTime;
      const auditId = logAuditEntry({
        actor_type: 'AGENT',
        actor_id: session.id,
        session_id: session.id,
        campaign_id: params.campaign_id || session.campaign_id,
        tool_name: toolName,
        parameters: params,
        execution_status: 'FAILED',
        result_summary: err.message || 'Execution error encountered.',
        guardrail_notes: 'Runtime execution failure.',
        duration_ms: duration,
      });

      return {
        status: 'FAILED',
        error: err.message || 'Tool execution failed',
        audit_id: auditId,
        duration_ms: duration,
      };
    }
  }
}

export const mcpServerInstance = new CmiMcpServer();
