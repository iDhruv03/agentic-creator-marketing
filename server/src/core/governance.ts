import { queryAll, queryOne, execute, parseJson, nowIso } from '../db/database';
import { newId, notFound, CoreError } from './ids';
import { HIGH_VALUE_PAYMENT_THRESHOLD } from './payments';
import { hasAcceptedCollaborations } from './campaigns';
import { bus } from '../realtime/events';
import { notifyCampaignOwners } from './notifications';

/**
 * Governance & Guardrails Engine (paper §9).
 *
 * Four mechanisms:
 *  1. Budget scoping      – per-session spend ceiling + per-collaboration rate ceiling
 *  2. Permission scoping  – role scope → allowed tool list
 *  3. Human checkpoints   – high-impact actions are parked PENDING for a reviewer
 *  4. Immutable audit log – every call is appended (see audit.ts)
 */

export type RoleScope = 'DISCOVERY_ONLY' | 'CAMPAIGN_MANAGER' | 'FULL_OPERATOR';
export type SessionStatus = 'ACTIVE' | 'PAUSED' | 'REVOKED' | 'COMPLETED';

export interface AgentSession {
  id: string;
  name: string;
  brand_id: string | null;
  brand_name?: string | null;
  agency_id: string | null;
  campaign_id: string | null;
  campaign_title?: string | null;
  role_scope: RoleScope;
  allowed_tools: string[];
  budget_ceiling: number;
  rate_ceiling: number;
  spent_amount: number;
  status: SessionStatus;
  model: string;
  instructions: string;
  created_by: string | null;
  created_at: string;
  last_active_at: string | null;
  stats?: { runs: number; tool_calls: number; checkpoints_pending: number; blocked: number };
}

export const SCOPE_TOOLS: Record<RoleScope, string[]> = {
  DISCOVERY_ONLY: ['search_creators', 'get_creator_profile', 'get_rate_benchmark', 'get_campaign_status', 'add_to_shortlist', 'list_audit_logs', 'request_human_approval'],
  CAMPAIGN_MANAGER: ['search_creators', 'get_creator_profile', 'get_rate_benchmark', 'get_campaign_status', 'get_campaign_analytics', 'add_to_shortlist', 'draft_campaign_brief', 'send_collaboration_offer', 'respond_to_counter_offer', 'track_deliverable', 'check_compliance', 'review_deliverable', 'list_audit_logs', 'request_human_approval'],
  FULL_OPERATOR: ['search_creators', 'get_creator_profile', 'get_rate_benchmark', 'get_campaign_status', 'get_campaign_analytics', 'add_to_shortlist', 'draft_campaign_brief', 'send_collaboration_offer', 'respond_to_counter_offer', 'track_deliverable', 'check_compliance', 'review_deliverable', 'release_payment', 'list_audit_logs', 'request_human_approval'],
};

export function mapSession(r: any): AgentSession {
  return { ...r, allowed_tools: parseJson<string[]>(r.allowed_tools, []) };
}

const SESSION_SELECT = `SELECT s.*, b.name as brand_name, c.title as campaign_title FROM agent_sessions s LEFT JOIN brands b ON b.id = s.brand_id LEFT JOIN campaigns c ON c.id = s.campaign_id`;

export function getSession(id: string): AgentSession | null {
  const row = queryOne(`${SESSION_SELECT} WHERE s.id = ?`, [id]);
  return row ? mapSession(row) : null;
}

export function requireSession(id: string): AgentSession {
  const s = getSession(id);
  if (!s) throw notFound('Agent session', id);
  return s;
}

export function listSessions(filter: { brand_id?: string; agency_id?: string; campaign_id?: string } = {}): AgentSession[] {
  const where: string[] = [];
  const params: any[] = [];
  if (filter.brand_id) { where.push('s.brand_id = ?'); params.push(filter.brand_id); }
  if (filter.agency_id) { where.push('(s.agency_id = ? OR s.brand_id IN (SELECT brand_id FROM agency_brands WHERE agency_id = ?))'); params.push(filter.agency_id, filter.agency_id); }
  if (filter.campaign_id) { where.push('s.campaign_id = ?'); params.push(filter.campaign_id); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return queryAll(`${SESSION_SELECT} ${whereSql} ORDER BY s.created_at DESC`, params).map((r) => {
    const s = mapSession(r);
    s.stats = queryOne<any>(
      `SELECT
        (SELECT COUNT(*) FROM agent_runs WHERE session_id = ?) as runs,
        (SELECT COUNT(*) FROM audit_logs WHERE session_id = ?) as tool_calls,
        (SELECT COUNT(*) FROM approval_checkpoints WHERE agent_session_id = ? AND status = 'PENDING') as checkpoints_pending,
        (SELECT COUNT(*) FROM audit_logs WHERE session_id = ? AND execution_status = 'REJECTED_BY_GUARDRAIL') as blocked`,
      [s.id, s.id, s.id, s.id],
    );
    return s;
  });
}

export interface CreateSessionInput {
  id?: string;
  name: string;
  brand_id?: string | null;
  agency_id?: string | null;
  campaign_id?: string | null;
  role_scope: RoleScope;
  allowed_tools?: string[];
  budget_ceiling: number;
  rate_ceiling: number;
  model?: string;
  instructions?: string;
}

export function createSession(input: CreateSessionInput, createdBy: string): AgentSession {
  if (!input.name?.trim()) throw new CoreError('Session name is required.');
  if (!SCOPE_TOOLS[input.role_scope]) throw new CoreError(`Unknown role scope ${input.role_scope}.`);
  if (!(input.budget_ceiling >= 0) || !(input.rate_ceiling >= 0)) throw new CoreError('Ceilings must be non-negative.');
  const allowed = (input.allowed_tools?.length ? input.allowed_tools : SCOPE_TOOLS[input.role_scope]).filter((t) => SCOPE_TOOLS[input.role_scope].includes(t));
  const id = input.id ?? newId('sess');
  execute(
    `INSERT INTO agent_sessions (id, name, brand_id, agency_id, campaign_id, role_scope, allowed_tools, budget_ceiling, rate_ceiling, model, instructions, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.name.trim(), input.brand_id ?? null, input.agency_id ?? null, input.campaign_id ?? null, input.role_scope, JSON.stringify(allowed), input.budget_ceiling, input.rate_ceiling, input.model ?? 'claude-opus-5-5', input.instructions ?? '', createdBy],
  );
  bus.publish('session.updated', { id, action: 'created' });
  return requireSession(id);
}

export function updateSessionStatus(id: string, status: SessionStatus): AgentSession {
  requireSession(id);
  execute(`UPDATE agent_sessions SET status = ? WHERE id = ?`, [status, id]);
  bus.publish('session.updated', { id, action: 'status', status });
  return requireSession(id);
}

export function updateSession(id: string, patch: Partial<CreateSessionInput>): AgentSession {
  const s = requireSession(id);
  const sets: string[] = [];
  const params: any[] = [];
  if (patch.name !== undefined) { sets.push('name = ?'); params.push(patch.name); }
  if (patch.campaign_id !== undefined) { sets.push('campaign_id = ?'); params.push(patch.campaign_id); }
  if (patch.budget_ceiling !== undefined) { sets.push('budget_ceiling = ?'); params.push(patch.budget_ceiling); }
  if (patch.rate_ceiling !== undefined) { sets.push('rate_ceiling = ?'); params.push(patch.rate_ceiling); }
  if (patch.model !== undefined) { sets.push('model = ?'); params.push(patch.model); }
  if (patch.instructions !== undefined) { sets.push('instructions = ?'); params.push(patch.instructions); }
  if (patch.role_scope !== undefined || patch.allowed_tools !== undefined) {
    const scope = patch.role_scope ?? s.role_scope;
    const allowed = (patch.allowed_tools ?? SCOPE_TOOLS[scope]).filter((t) => SCOPE_TOOLS[scope].includes(t));
    sets.push('role_scope = ?', 'allowed_tools = ?'); params.push(scope, JSON.stringify(allowed));
  }
  if (sets.length) { params.push(id); execute(`UPDATE agent_sessions SET ${sets.join(', ')} WHERE id = ?`, params); }
  bus.publish('session.updated', { id, action: 'updated' });
  return requireSession(id);
}

export function recordSessionSpend(id: string, amount: number): void {
  execute(`UPDATE agent_sessions SET spent_amount = spent_amount + ?, last_active_at = ? WHERE id = ?`, [amount, nowIso(), id]);
}

export function touchSession(id: string): void {
  execute(`UPDATE agent_sessions SET last_active_at = ? WHERE id = ?`, [nowIso(), id]);
}

// ---------------------------------------------------------------------------
// Guardrail evaluation
// ---------------------------------------------------------------------------
export type CheckpointAction = 'PAYMENT_ABOVE_THRESHOLD' | 'OUT_OF_BAND_RATE' | 'BRIEF_MODIFICATION' | 'AGENT_ESCALATION' | 'BUDGET_EXCEEDED';

export interface GuardrailDecision {
  allowed: boolean;
  requires_checkpoint: boolean;
  checkpoint?: { action_type: CheckpointAction; risk_level: 'LOW' | 'MEDIUM' | 'HIGH'; amount?: number; justification: string };
  reason?: string;
  guardrail_notes: string;
  rules_evaluated: string[];
}

export function evaluateGuardrails(session: AgentSession, toolName: string, params: any): GuardrailDecision {
  const rules: string[] = [];

  rules.push('session_status');
  if (session.status !== 'ACTIVE') {
    return { allowed: false, requires_checkpoint: false, reason: `Agent session "${session.name}" is ${session.status}; tool calls are suspended.`, guardrail_notes: `Session inactive (${session.status}).`, rules_evaluated: rules };
  }

  rules.push('permission_scope');
  if (!session.allowed_tools.includes(toolName)) {
    return {
      allowed: false,
      requires_checkpoint: false,
      reason: `Permission denied: '${toolName}' is outside the ${session.role_scope} scope granted to this session. Allowed: ${session.allowed_tools.join(', ')}.`,
      guardrail_notes: `Permission scoping violation: ${toolName} not in ${session.role_scope}.`,
      rules_evaluated: rules,
    };
  }

  rules.push('campaign_binding');
  if (session.campaign_id && params?.campaign_id && params.campaign_id !== session.campaign_id) {
    return { allowed: false, requires_checkpoint: false, reason: `This session is bound to campaign ${session.campaign_id}; it cannot act on ${params.campaign_id}.`, guardrail_notes: 'Campaign binding violation.', rules_evaluated: rules };
  }

  if (toolName === 'send_collaboration_offer' || toolName === 'respond_to_counter_offer') {
    const rate = Number(toolName === 'send_collaboration_offer' ? params?.proposed_rate : params?.counter_amount ?? 0) || 0;
    const commits = toolName === 'send_collaboration_offer' || params?.decision === 'ACCEPT' || params?.decision === 'COUNTER';
    if (commits && rate > 0) {
      rules.push('budget_ceiling');
      if (session.spent_amount + rate > session.budget_ceiling) {
        return {
          allowed: false,
          requires_checkpoint: false,
          reason: `Budget ceiling exceeded: committing $${rate.toLocaleString()} would bring session spend to $${(session.spent_amount + rate).toLocaleString()}, above the hard ceiling of $${session.budget_ceiling.toLocaleString()}. Remaining headroom: $${Math.max(0, session.budget_ceiling - session.spent_amount).toLocaleString()}.`,
          guardrail_notes: `Hard budget ceiling breach ($${(session.spent_amount + rate).toLocaleString()} > $${session.budget_ceiling.toLocaleString()}).`,
          rules_evaluated: rules,
        };
      }
      rules.push('rate_ceiling');
      if (rate > session.rate_ceiling) {
        return {
          allowed: false,
          requires_checkpoint: true,
          checkpoint: { action_type: 'OUT_OF_BAND_RATE', risk_level: rate > session.rate_ceiling * 1.5 ? 'HIGH' : 'MEDIUM', amount: rate, justification: `Proposed $${rate.toLocaleString()} exceeds the per-collaboration ceiling of $${session.rate_ceiling.toLocaleString()} authorised for this session.` },
          reason: `Rate $${rate.toLocaleString()} is above the authorised per-collaboration ceiling ($${session.rate_ceiling.toLocaleString()}). Held for human approval.`,
          guardrail_notes: `Checkpoint: OUT_OF_BAND_RATE ($${rate.toLocaleString()} > $${session.rate_ceiling.toLocaleString()}).`,
          rules_evaluated: rules,
        };
      }
    }
  }

  if (toolName === 'release_payment') {
    rules.push('payment_threshold');
    const amount = Number(params?.amount ?? 0);
    // Unknown amount (release remaining escrow) is treated as high impact.
    const effective = amount > 0 ? amount : Number.POSITIVE_INFINITY;
    if (effective > HIGH_VALUE_PAYMENT_THRESHOLD) {
      return {
        allowed: false,
        requires_checkpoint: true,
        checkpoint: { action_type: 'PAYMENT_ABOVE_THRESHOLD', risk_level: 'HIGH', amount: amount > 0 ? amount : undefined, justification: `${amount > 0 ? `Payout of $${amount.toLocaleString()}` : 'Full escrow release'} exceeds the $${HIGH_VALUE_PAYMENT_THRESHOLD.toLocaleString()} autonomous release threshold.` },
        reason: `Payout ${amount > 0 ? `of $${amount.toLocaleString()} ` : ''}exceeds the $${HIGH_VALUE_PAYMENT_THRESHOLD.toLocaleString()} autonomous threshold. Held for human approval.`,
        guardrail_notes: `Checkpoint: PAYMENT_ABOVE_THRESHOLD.`,
        rules_evaluated: rules,
      };
    }
  }

  if (toolName === 'draft_campaign_brief') {
    rules.push('post_acceptance_brief_lock');
    const campaignId = params?.campaign_id ?? session.campaign_id;
    if (campaignId && hasAcceptedCollaborations(campaignId)) {
      return {
        allowed: false,
        requires_checkpoint: true,
        checkpoint: { action_type: 'BRIEF_MODIFICATION', risk_level: 'MEDIUM', justification: 'Creators have already accepted offers on this campaign; changing the brief alters agreed scope.' },
        reason: 'Brief changes after creator acceptance require human approval.',
        guardrail_notes: 'Checkpoint: BRIEF_MODIFICATION (post-acceptance).',
        rules_evaluated: rules,
      };
    }
  }

  return { allowed: true, requires_checkpoint: false, guardrail_notes: `Passed ${rules.length} governance rules (${rules.join(', ')}).`, rules_evaluated: rules };
}

// ---------------------------------------------------------------------------
// Checkpoints
// ---------------------------------------------------------------------------
export interface Checkpoint {
  id: string;
  agent_session_id: string;
  agent_name?: string;
  role_scope?: RoleScope;
  run_id: string | null;
  campaign_id: string | null;
  campaign_title?: string | null;
  brand_id?: string | null;
  action_type: CheckpointAction;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  amount: number | null;
  tool_name: string;
  payload: any;
  justification: string;
  reviewer_notes: string | null;
  resolved_by: string | null;
  executed_result: any;
  created_at: string;
  resolved_at: string | null;
  context?: any;
}

export function createCheckpoint(input: { session: AgentSession; run_id?: string | null; campaign_id?: string | null; action_type: CheckpointAction; risk_level: 'LOW' | 'MEDIUM' | 'HIGH'; amount?: number; tool_name: string; payload: any; justification: string }): Checkpoint {
  const id = newId('chk');
  const campaignId = input.campaign_id ?? input.payload?.campaign_id ?? input.session.campaign_id ?? null;
  execute(
    `INSERT INTO approval_checkpoints (id, agent_session_id, run_id, campaign_id, action_type, risk_level, status, amount, tool_name, payload_json, justification)
     VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?)`,
    [id, input.session.id, input.run_id ?? null, campaignId, input.action_type, input.risk_level, input.amount ?? null, input.tool_name, JSON.stringify(input.payload ?? {}), input.justification],
  );
  bus.publish('checkpoint.created', { id, campaign_id: campaignId, action_type: input.action_type, amount: input.amount ?? null });
  if (campaignId) {
    notifyCampaignOwners(campaignId, { kind: 'CHECKPOINT', title: `Approval needed: ${input.action_type.replace(/_/g, ' ').toLowerCase()}`, body: input.justification, link: `/approvals?checkpoint=${id}` });
  }
  return getCheckpoint(id);
}

const CHK_SELECT = `SELECT chk.*, s.name as agent_name, s.role_scope, c.title as campaign_title, c.brand_id FROM approval_checkpoints chk JOIN agent_sessions s ON s.id = chk.agent_session_id LEFT JOIN campaigns c ON c.id = chk.campaign_id`;

function mapCheckpoint(r: any): Checkpoint {
  const payload = parseJson<any>(r.payload_json, {});
  let context: any = null;
  if (payload?.collaboration_id) {
    context = queryOne(`SELECT col.id, col.status, col.agreed_rate, col.proposed_rate, cr.name as creator_name, cr.handle as creator_handle, cr.avatar_url as creator_avatar FROM collaborations col JOIN creators cr ON cr.id = col.creator_id WHERE col.id = ?`, [payload.collaboration_id]) ?? null;
    if (context && payload.deliverable_id) context.deliverable = queryOne(`SELECT id, deliverable_type, status, content_url, metrics, compliance FROM deliverables WHERE id = ?`, [payload.deliverable_id]) ?? null;
  } else if (payload?.creator_id) {
    context = queryOne(`SELECT id, name as creator_name, handle as creator_handle, avatar_url as creator_avatar, rate_video, rate_reel, rate_post, follower_count, engagement_rate FROM creators WHERE id = ?`, [payload.creator_id]) ?? null;
  }
  return { ...r, payload, executed_result: parseJson(r.executed_result, null), context };
}

export function getCheckpoint(id: string): Checkpoint {
  const row = queryOne(`${CHK_SELECT} WHERE chk.id = ?`, [id]);
  if (!row) throw notFound('Checkpoint', id);
  return mapCheckpoint(row);
}

export function listCheckpoints(filter: { status?: string; campaign_id?: string; brand_id?: string; agency_id?: string; session_id?: string } = {}): Checkpoint[] {
  const where: string[] = [];
  const params: any[] = [];
  if (filter.status) { where.push('chk.status = ?'); params.push(filter.status); }
  if (filter.campaign_id) { where.push('chk.campaign_id = ?'); params.push(filter.campaign_id); }
  if (filter.session_id) { where.push('chk.agent_session_id = ?'); params.push(filter.session_id); }
  if (filter.brand_id) { where.push('(c.brand_id = ? OR s.brand_id = ?)'); params.push(filter.brand_id, filter.brand_id); }
  if (filter.agency_id) { where.push('(c.agency_id = ? OR c.brand_id IN (SELECT brand_id FROM agency_brands WHERE agency_id = ?))'); params.push(filter.agency_id, filter.agency_id); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return queryAll(`${CHK_SELECT} ${whereSql} ORDER BY CASE chk.status WHEN 'PENDING' THEN 0 ELSE 1 END, chk.created_at DESC`, params).map(mapCheckpoint);
}

export function markCheckpointResolved(id: string, decision: 'APPROVED' | 'REJECTED', reviewer: { id: string; notes?: string }, executedResult?: unknown): Checkpoint {
  execute(
    `UPDATE approval_checkpoints SET status = ?, reviewer_notes = ?, resolved_by = ?, resolved_at = ?, executed_result = ? WHERE id = ?`,
    [decision, reviewer.notes ?? null, reviewer.id, nowIso(), executedResult === undefined ? null : JSON.stringify(executedResult), id],
  );
  const chk = getCheckpoint(id);
  bus.publish('checkpoint.resolved', { id, decision, campaign_id: chk.campaign_id });
  return chk;
}
