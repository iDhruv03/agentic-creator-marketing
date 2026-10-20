import { v4 as uuidv4 } from 'uuid';
import { queryOne, execute } from '../db/database';
import { AgentSession, GuardrailDecision } from './types';

// Autonomous threshold above which payouts MUST go to human checkpoint (Section 9)
export const HIGH_VALUE_PAYMENT_THRESHOLD = 1000;

export function getAgentSession(sessionId: string): AgentSession | null {
  const row = queryOne<any>(`SELECT * FROM agent_sessions WHERE id = ?`, [sessionId]);
  if (!row) return null;

  return {
    ...row,
    allowed_tools: JSON.parse(row.allowed_tools || '[]'),
  };
}

export function evaluateGuardrails(
  session: AgentSession,
  toolName: string,
  params: any
): GuardrailDecision {
  // 1. Session status check
  if (session.status !== 'ACTIVE') {
    return {
      allowed: false,
      requires_checkpoint: false,
      reason: `Agent session ${session.id} is ${session.status}. Operations are suspended.`,
      guardrail_notes: 'Agent session inactive.',
    };
  }

  // 2. Permission Scoping (Section 9 of paper)
  if (!session.allowed_tools.includes(toolName)) {
    return {
      allowed: false,
      requires_checkpoint: false,
      reason: `Permission denied: Tool '${toolName}' is not permitted for agent scope '${session.role_scope}'. Allowed tools: ${session.allowed_tools.join(', ')}.`,
      guardrail_notes: `Permission Scoping Violation: Tool ${toolName} requested outside authorized scope.`,
    };
  }

  // 3. Tool-specific guardrails: send_collaboration_offer
  if (toolName === 'send_collaboration_offer') {
    const proposedRate = Number(params.proposed_rate || 0);

    // Hard budget cap check
    if (session.spent_amount + proposedRate > session.budget_ceiling) {
      return {
        allowed: false,
        requires_checkpoint: false,
        reason: `Budget ceiling exceeded: Adding offer of $${proposedRate} would bring session spend to $${session.spent_amount + proposedRate}, exceeding the hard ceiling of $${session.budget_ceiling}.`,
        guardrail_notes: `Hard Budget Ceiling Breach: $${session.spent_amount + proposedRate} > $${session.budget_ceiling}.`,
      };
    }

    // Rate ceiling check (Check if exceeds per-collaboration rate ceiling)
    if (proposedRate > session.rate_ceiling) {
      // Create pending checkpoint for human approval
      const checkpointId = `chk_${uuidv4().substring(0, 8)}`;
      const justification = `Agent proposed rate of $${proposedRate} for creator ${params.creator_id}, which exceeds the authorized per-collaboration ceiling of $${session.rate_ceiling}. Held for human sign-off.`;
      
      execute(
        `INSERT INTO approval_checkpoints (
          id, agent_session_id, campaign_id, action_type, status,
          amount, tool_name, payload_json, justification
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          checkpointId,
          session.id,
          params.campaign_id || session.campaign_id || 'camp_techpulse_earbuds',
          'OUT_OF_BAND_RATE',
          'PENDING',
          proposedRate,
          toolName,
          JSON.stringify(params),
          justification,
        ]
      );

      return {
        allowed: false,
        requires_checkpoint: true,
        checkpoint_id: checkpointId,
        reason: `Offer exceeds per-collaboration rate ceiling ($${session.rate_ceiling}). Intercepted for human-approval checkpoint #${checkpointId}.`,
        guardrail_notes: `Human Checkpoint Triggered: OUT_OF_BAND_RATE on $${proposedRate}.`,
      };
    }
  }

  // 4. Tool-specific guardrails: release_payment (Section 9: High-impact actions)
  if (toolName === 'release_payment') {
    const amount = Number(params.amount || 0);

    if (amount > HIGH_VALUE_PAYMENT_THRESHOLD) {
      const checkpointId = `chk_${uuidv4().substring(0, 8)}`;
      const justification = `High-impact payment release of $${amount} exceeds autonomous release threshold of $${HIGH_VALUE_PAYMENT_THRESHOLD}. Requires brand manager review before escrow transfer.`;

      execute(
        `INSERT INTO approval_checkpoints (
          id, agent_session_id, campaign_id, action_type, status,
          amount, tool_name, payload_json, justification
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          checkpointId,
          session.id,
          params.campaign_id || session.campaign_id || 'camp_techpulse_earbuds',
          'PAYMENT_ABOVE_THRESHOLD',
          'PENDING',
          amount,
          toolName,
          JSON.stringify(params),
          justification,
        ]
      );

      return {
        allowed: false,
        requires_checkpoint: true,
        checkpoint_id: checkpointId,
        reason: `Payment of $${amount} exceeds autonomous threshold of $${HIGH_VALUE_PAYMENT_THRESHOLD}. Intercepted for human approval checkpoint #${checkpointId}.`,
        guardrail_notes: `Human Checkpoint Triggered: PAYMENT_ABOVE_THRESHOLD ($${amount} > $${HIGH_VALUE_PAYMENT_THRESHOLD}).`,
      };
    }
  }

  // All checks passed
  return {
    allowed: true,
    requires_checkpoint: false,
    guardrail_notes: 'All governance rules passed: Budget, rate ceiling, and permission constraints satisfied.',
  };
}

// Immutable audit logging (Section 9 of paper: append-only log)
export function logAuditEntry(entry: {
  actor_type: 'AGENT' | 'HUMAN';
  actor_id: string;
  session_id?: string;
  campaign_id?: string;
  tool_name: string;
  parameters: any;
  execution_status: 'SUCCESS' | 'REJECTED_BY_GUARDRAIL' | 'HELD_FOR_APPROVAL' | 'FAILED';
  result_summary: string;
  guardrail_notes?: string;
  duration_ms: number;
}): string {
  const auditId = `aud_${uuidv4().substring(0, 8)}`;
  execute(
    `INSERT INTO audit_logs (
      id, actor_type, actor_id, session_id, campaign_id,
      tool_name, parameters_json, execution_status, result_summary,
      guardrail_notes, duration_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      auditId,
      entry.actor_type,
      entry.actor_id,
      entry.session_id || null,
      entry.campaign_id || null,
      entry.tool_name,
      JSON.stringify(entry.parameters || {}),
      entry.execution_status,
      entry.result_summary,
      entry.guardrail_notes || '',
      entry.duration_ms,
    ]
  );
  return auditId;
}
