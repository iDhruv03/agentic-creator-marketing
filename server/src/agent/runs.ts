import { EventEmitter } from 'node:events';
import { queryAll, queryOne, execute, parseJson, nowIso } from '../db/database';
import { newId, notFound } from '../core/ids';
import { bus } from '../realtime/events';

export type RunEventType = 'status' | 'thinking' | 'text' | 'tool_call' | 'tool_result' | 'checkpoint' | 'guardrail' | 'done' | 'error';
export type RunStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type RunMode = 'LLM' | 'SIMULATED';

export interface RunEvent {
  id: string;
  run_id: string;
  seq: number;
  type: RunEventType;
  payload: any;
  created_at: string;
}

export interface AgentRun {
  id: string;
  session_id: string;
  session_name?: string;
  campaign_id: string | null;
  campaign_title?: string | null;
  goal: string;
  mode: RunMode;
  model: string | null;
  status: RunStatus;
  summary: string | null;
  steps_count: number;
  checkpoints_count: number;
  blocked_count: number;
  spend_committed: number;
  input_tokens: number;
  output_tokens: number;
  started_at: string;
  finished_at: string | null;
  events?: RunEvent[];
}

const emitter = new EventEmitter();
emitter.setMaxListeners(500);
const cancelled = new Set<string>();

const RUN_SELECT = `SELECT r.*, s.name as session_name, c.title as campaign_title FROM agent_runs r JOIN agent_sessions s ON s.id = r.session_id LEFT JOIN campaigns c ON c.id = r.campaign_id`;

export function createRun(input: { session_id: string; campaign_id: string | null; goal: string; mode: RunMode; model: string | null }): AgentRun {
  const id = newId('run');
  execute(`INSERT INTO agent_runs (id, session_id, campaign_id, goal, mode, model, status) VALUES (?, ?, ?, ?, ?, ?, 'RUNNING')`, [id, input.session_id, input.campaign_id, input.goal, input.mode, input.model]);
  bus.publish('agent.run', { id, status: 'RUNNING', session_id: input.session_id });
  return getRun(id);
}

export function getRun(id: string, withEvents = false): AgentRun {
  const row = queryOne<any>(`${RUN_SELECT} WHERE r.id = ?`, [id]);
  if (!row) throw notFound('Agent run', id);
  return withEvents ? { ...row, events: listRunEvents(id) } : row;
}

export function listRuns(filter: { session_id?: string; campaign_id?: string; brand_id?: string; limit?: number } = {}): AgentRun[] {
  const where: string[] = [];
  const params: any[] = [];
  if (filter.session_id) { where.push('r.session_id = ?'); params.push(filter.session_id); }
  if (filter.campaign_id) { where.push('r.campaign_id = ?'); params.push(filter.campaign_id); }
  if (filter.brand_id) { where.push('(s.brand_id = ? OR c.brand_id = ?)'); params.push(filter.brand_id, filter.brand_id); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return queryAll(`${RUN_SELECT} ${whereSql} ORDER BY r.started_at DESC LIMIT ?`, [...params, filter.limit ?? 50]);
}

export function listRunEvents(runId: string): RunEvent[] {
  return queryAll<any>(`SELECT * FROM agent_run_events WHERE run_id = ? ORDER BY seq ASC`, [runId]).map((e) => ({ ...e, payload: parseJson(e.payload, {}) }));
}

export function appendRunEvent(runId: string, type: RunEventType, payload: any): RunEvent {
  const seq = (queryOne<{ m: number | null }>(`SELECT MAX(seq) m FROM agent_run_events WHERE run_id = ?`, [runId])?.m ?? 0) + 1;
  const id = newId('evt');
  execute(`INSERT INTO agent_run_events (id, run_id, seq, type, payload) VALUES (?, ?, ?, ?, ?)`, [id, runId, seq, type, JSON.stringify(payload ?? {})]);
  const evt: RunEvent = { id, run_id: runId, seq, type, payload, created_at: nowIso() };
  emitter.emit(runId, evt);
  return evt;
}

export function updateRun(runId: string, patch: Partial<Pick<AgentRun, 'status' | 'summary' | 'steps_count' | 'checkpoints_count' | 'blocked_count' | 'spend_committed' | 'input_tokens' | 'output_tokens' | 'model'>>): AgentRun {
  const sets: string[] = [];
  const params: any[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`); params.push(v as any);
  }
  if (patch.status && patch.status !== 'RUNNING') { sets.push('finished_at = ?'); params.push(nowIso()); }
  if (sets.length) { params.push(runId); execute(`UPDATE agent_runs SET ${sets.join(', ')} WHERE id = ?`, params); }
  const run = getRun(runId);
  if (patch.status) bus.publish('agent.run', { id: runId, status: patch.status, session_id: run.session_id });
  return run;
}

export function subscribeRun(runId: string, listener: (e: RunEvent) => void): () => void {
  emitter.on(runId, listener);
  return () => emitter.off(runId, listener);
}

export function cancelRun(runId: string): void {
  cancelled.add(runId);
}

export function isCancelled(runId: string): boolean {
  return cancelled.has(runId);
}

export function clearCancel(runId: string): void {
  cancelled.delete(runId);
}
