import { createHash } from 'node:crypto';
import { queryAll, queryOne, execute, parseJson } from '../db/database';
import { newId } from './ids';
import { bus } from '../realtime/events';

export type ExecutionStatus = 'SUCCESS' | 'REJECTED_BY_GUARDRAIL' | 'HELD_FOR_APPROVAL' | 'FAILED';
export type ActorType = 'HUMAN' | 'AGENT' | 'SYSTEM';

export interface AuditInput {
  actor_type: ActorType;
  actor_id: string;
  actor_name?: string;
  session_id?: string | null;
  run_id?: string | null;
  campaign_id?: string | null;
  tool_name: string;
  parameters?: unknown;
  execution_status: ExecutionStatus;
  result_summary: string;
  guardrail_notes?: string;
  duration_ms?: number;
  /** Seed/backfill only: override the recorded timestamp. */
  timestamp?: string;
}

export interface AuditRecord {
  seq: number;
  id: string;
  timestamp: string;
  actor_type: ActorType;
  actor_id: string;
  actor_name: string | null;
  session_id: string | null;
  run_id: string | null;
  campaign_id: string | null;
  tool_name: string;
  parameters: unknown;
  execution_status: ExecutionStatus;
  result_summary: string;
  guardrail_notes: string;
  duration_ms: number;
  prev_hash: string;
  hash: string;
}

const GENESIS = '0'.repeat(64);

function computeHash(fields: Record<string, unknown>, prevHash: string): string {
  const canonical = JSON.stringify(fields, Object.keys(fields).sort());
  return createHash('sha256').update(prevHash + '|' + canonical).digest('hex');
}

function lastHash(): string {
  const row = queryOne<{ hash: string }>(`SELECT hash FROM audit_logs ORDER BY seq DESC LIMIT 1`);
  return row?.hash ?? GENESIS;
}

/**
 * Append an entry to the immutable audit trail. Each row's hash covers its
 * own content and the previous row's hash, so any tampering breaks the chain.
 */
export function appendAudit(entry: AuditInput): string {
  const id = newId('aud');
  const timestamp = entry.timestamp ?? new Date().toISOString();
  const parameters_json = JSON.stringify(entry.parameters ?? {});
  const prev_hash = lastHash();
  const fields = {
    id,
    timestamp,
    actor_type: entry.actor_type,
    actor_id: entry.actor_id,
    actor_name: entry.actor_name ?? null,
    session_id: entry.session_id ?? null,
    run_id: entry.run_id ?? null,
    campaign_id: entry.campaign_id ?? null,
    tool_name: entry.tool_name,
    parameters_json,
    execution_status: entry.execution_status,
    result_summary: entry.result_summary,
    guardrail_notes: entry.guardrail_notes ?? '',
    duration_ms: Math.round(entry.duration_ms ?? 0),
  };
  const hash = computeHash(fields, prev_hash);

  execute(
    `INSERT INTO audit_logs (id, timestamp, actor_type, actor_id, actor_name, session_id, run_id, campaign_id,
       tool_name, parameters_json, execution_status, result_summary, guardrail_notes, duration_ms, prev_hash, hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      fields.id, fields.timestamp, fields.actor_type, fields.actor_id, fields.actor_name,
      fields.session_id, fields.run_id, fields.campaign_id, fields.tool_name, fields.parameters_json,
      fields.execution_status, fields.result_summary, fields.guardrail_notes, fields.duration_ms,
      prev_hash, hash,
    ],
  );

  bus.publish('audit.appended', { id, tool_name: entry.tool_name, execution_status: entry.execution_status, actor_type: entry.actor_type, campaign_id: entry.campaign_id ?? null });
  return id;
}

function mapRow(r: any): AuditRecord {
  return { ...r, parameters: parseJson(r.parameters_json, {}) };
}

export interface AuditQuery {
  campaign_id?: string;
  session_id?: string;
  run_id?: string;
  actor_type?: string;
  status?: string;
  tool_name?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export function listAudit(q: AuditQuery = {}): { items: AuditRecord[]; total: number } {
  const where: string[] = [];
  const params: any[] = [];
  if (q.campaign_id) { where.push('campaign_id = ?'); params.push(q.campaign_id); }
  if (q.session_id) { where.push('session_id = ?'); params.push(q.session_id); }
  if (q.run_id) { where.push('run_id = ?'); params.push(q.run_id); }
  if (q.actor_type) { where.push('actor_type = ?'); params.push(q.actor_type); }
  if (q.status) { where.push('execution_status = ?'); params.push(q.status); }
  if (q.tool_name) { where.push('tool_name = ?'); params.push(q.tool_name); }
  if (q.search) {
    where.push('(result_summary LIKE ? OR guardrail_notes LIKE ? OR parameters_json LIKE ? OR actor_id LIKE ?)');
    const s = `%${q.search}%`;
    params.push(s, s, s, s);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = queryOne<{ n: number }>(`SELECT COUNT(*) as n FROM audit_logs ${whereSql}`, params)?.n ?? 0;
  const limit = Math.min(Math.max(q.limit ?? 100, 1), 1000);
  const offset = Math.max(q.offset ?? 0, 0);
  const items = queryAll(`SELECT * FROM audit_logs ${whereSql} ORDER BY seq DESC LIMIT ? OFFSET ?`, [...params, limit, offset]).map(mapRow);
  return { items, total };
}

/** Walk the chain from genesis and re-derive every hash. */
export function verifyAuditChain(): { valid: boolean; checked: number; broken_at?: string } {
  const rows = queryAll<any>(`SELECT * FROM audit_logs ORDER BY seq ASC`);
  let prev = GENESIS;
  for (const r of rows) {
    const fields = {
      id: r.id,
      timestamp: r.timestamp,
      actor_type: r.actor_type,
      actor_id: r.actor_id,
      actor_name: r.actor_name,
      session_id: r.session_id,
      run_id: r.run_id,
      campaign_id: r.campaign_id,
      tool_name: r.tool_name,
      parameters_json: r.parameters_json,
      execution_status: r.execution_status,
      result_summary: r.result_summary,
      guardrail_notes: r.guardrail_notes,
      duration_ms: r.duration_ms,
    };
    if (r.prev_hash !== prev || computeHash(fields, prev) !== r.hash) {
      return { valid: false, checked: rows.length, broken_at: r.id };
    }
    prev = r.hash;
  }
  return { valid: true, checked: rows.length };
}

export function auditStats(): { total: number; by_status: Record<string, number>; by_actor: Record<string, number>; by_tool: Record<string, number> } {
  const total = queryOne<{ n: number }>(`SELECT COUNT(*) as n FROM audit_logs`)?.n ?? 0;
  const by_status: Record<string, number> = {};
  for (const r of queryAll<any>(`SELECT execution_status s, COUNT(*) n FROM audit_logs GROUP BY s`)) by_status[r.s] = r.n;
  const by_actor: Record<string, number> = {};
  for (const r of queryAll<any>(`SELECT actor_type s, COUNT(*) n FROM audit_logs GROUP BY s`)) by_actor[r.s] = r.n;
  const by_tool: Record<string, number> = {};
  for (const r of queryAll<any>(`SELECT tool_name s, COUNT(*) n FROM audit_logs GROUP BY s ORDER BY n DESC`)) by_tool[r.s] = r.n;
  return { total, by_status, by_actor, by_tool };
}
