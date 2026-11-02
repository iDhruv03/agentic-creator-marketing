import { Router } from 'express';
import { z } from 'zod';
import { h, parse, qstr, auditHuman } from './helpers';
import { requireAuth, requireRole, brandScope } from '../auth/auth';
import { listSessions, createSession, updateSession, updateSessionStatus, requireSession, SCOPE_TOOLS, getSession } from '../core/governance';
import { mcpServer } from '../mcp/server';
import { toolDefinitions } from '../mcp/tools';
import { startRun, cancelRun, runtimeInfo } from '../agent/service';
import { listRuns, getRun } from '../agent/runs';
import { runEventStream } from '../realtime/sse';
import { CoreError } from '../core/ids';
import { PROTOCOL_VERSION, SERVER_INFO } from '../mcp/protocol';
import { HIGH_VALUE_PAYMENT_THRESHOLD } from '../core/payments';

export const agentsRouter = Router();

function scopeFilter(req: any) {
  const user = req.user;
  if (user.role === 'BRAND') return { brand_id: user.brand_id };
  if (user.role === 'AGENCY') return { agency_id: user.agency_id };
  return {};
}

function assertSessionAccess(req: any, sessionId: string) {
  const s = requireSession(sessionId);
  const scope = brandScope(req.user);
  if (scope !== null && s.brand_id && !scope.includes(s.brand_id)) throw new CoreError('You do not have access to this agent session.', 403, 'FORBIDDEN');
  return s;
}

// ---- Sessions ----------------------------------------------------------------
agentsRouter.get('/sessions', requireRole('BRAND', 'AGENCY'), h((req, res) => res.json(listSessions({ ...scopeFilter(req), campaign_id: qstr(req.query.campaign_id) }))));

agentsRouter.get('/scopes', requireAuth, h((_req, res) => res.json({ scopes: SCOPE_TOOLS, payment_threshold: HIGH_VALUE_PAYMENT_THRESHOLD, runtime: runtimeInfo() })));

agentsRouter.post('/sessions', requireRole('BRAND', 'AGENCY'), h((req, res) => {
  const body = parse(z.object({
    name: z.string().min(2).max(80), brand_id: z.string().optional(), campaign_id: z.string().nullable().optional(), role_scope: z.enum(['DISCOVERY_ONLY', 'CAMPAIGN_MANAGER', 'FULL_OPERATOR']),
    allowed_tools: z.array(z.string()).optional(), budget_ceiling: z.number().nonnegative(), rate_ceiling: z.number().nonnegative(), model: z.string().optional(), instructions: z.string().max(2000).optional(),
  }), req.body);
  const user = req.user!;
  const brandId = body.brand_id ?? user.brand_id ?? null;
  const scope = brandScope(user);
  if (scope !== null && brandId && !scope.includes(brandId)) throw new CoreError('You cannot create sessions for that brand.', 403, 'FORBIDDEN');
  const s = createSession({ ...body, brand_id: brandId, agency_id: user.role === 'AGENCY' ? user.agency_id : null }, user.id);
  auditHuman(user, 'create_agent_session', { name: s.name, role_scope: s.role_scope, budget_ceiling: s.budget_ceiling, rate_ceiling: s.rate_ceiling }, `Agent session "${s.name}" authorised (${s.role_scope}, $${s.budget_ceiling.toLocaleString()} ceiling).`, s.campaign_id);
  res.status(201).json(s);
}));

agentsRouter.get('/sessions/:id', requireRole('BRAND', 'AGENCY'), h((req, res) => {
  const s = assertSessionAccess(req, req.params.id);
  res.json({ ...listSessions({ brand_id: s.brand_id ?? undefined }).find((x) => x.id === s.id) ?? s, runs: listRuns({ session_id: s.id }) });
}));

agentsRouter.patch('/sessions/:id', requireRole('BRAND', 'AGENCY'), h((req, res) => {
  assertSessionAccess(req, req.params.id);
  const patch = parse(z.object({ name: z.string().min(2).optional(), campaign_id: z.string().nullable().optional(), role_scope: z.enum(['DISCOVERY_ONLY', 'CAMPAIGN_MANAGER', 'FULL_OPERATOR']).optional(), allowed_tools: z.array(z.string()).optional(), budget_ceiling: z.number().nonnegative().optional(), rate_ceiling: z.number().nonnegative().optional(), model: z.string().optional(), instructions: z.string().optional() }), req.body);
  const s = updateSession(req.params.id, patch);
  auditHuman(req.user, 'update_agent_session', patch, `Agent session "${s.name}" updated (${Object.keys(patch).join(', ')}).`, s.campaign_id);
  res.json(s);
}));

agentsRouter.post('/sessions/:id/status', requireRole('BRAND', 'AGENCY'), h((req, res) => {
  assertSessionAccess(req, req.params.id);
  const { status } = parse(z.object({ status: z.enum(['ACTIVE', 'PAUSED', 'REVOKED', 'COMPLETED']) }), req.body);
  const s = updateSessionStatus(req.params.id, status);
  auditHuman(req.user, 'update_agent_session', { status }, `Agent session "${s.name}" → ${status}.`, s.campaign_id);
  res.json(s);
}));

// ---- Runs -------------------------------------------------------------------
agentsRouter.get('/runs', requireRole('BRAND', 'AGENCY'), h((req, res) => {
  const user = req.user!;
  const scope = brandScope(user);
  const runs = listRuns({ session_id: qstr(req.query.session_id), campaign_id: qstr(req.query.campaign_id), limit: 100 });
  res.json(scope === null ? runs : runs.filter((r) => { const s = getSession(r.session_id); return !s?.brand_id || scope.includes(s.brand_id); }));
}));

agentsRouter.post('/runs', requireRole('BRAND', 'AGENCY'), h((req, res) => {
  const body = parse(z.object({ session_id: z.string(), campaign_id: z.string().nullable().optional(), goal: z.string().max(2000).optional(), mode: z.enum(['LLM', 'SIMULATED', 'AUTO']).optional(), model: z.string().optional() }), req.body);
  assertSessionAccess(req, body.session_id);
  const run = startRun({ ...body, started_by: req.user!.id });
  res.status(202).json(run);
}));

agentsRouter.get('/runs/:id', requireRole('BRAND', 'AGENCY'), h((req, res) => {
  const run = getRun(req.params.id, true);
  assertSessionAccess(req, run.session_id);
  res.json(run);
}));

agentsRouter.get('/runs/:id/stream', requireRole('BRAND', 'AGENCY'), (req, res) => {
  try { assertSessionAccess(req, getRun(req.params.id).session_id); } catch (e: any) { res.status(e.status ?? 404).json({ error: e.message }); return; }
  runEventStream(req, res);
});

agentsRouter.post('/runs/:id/cancel', requireRole('BRAND', 'AGENCY'), h((req, res) => {
  const run = getRun(req.params.id);
  assertSessionAccess(req, run.session_id);
  res.json(cancelRun(run.id));
}));

// ---- MCP discovery & playground --------------------------------------------
agentsRouter.get('/mcp/tools', requireAuth, h((req, res) => {
  const sessionId = qstr(req.query.session_id);
  const session = sessionId ? getSession(sessionId) : null;
  res.json({ protocol: PROTOCOL_VERSION, server: SERVER_INFO, transports: { stdio: 'server/src/mcp/stdio.ts', streamable_http: '/mcp' }, tools: toolDefinitions(session ? session.allowed_tools : undefined), all_tools: toolDefinitions() });
}));

agentsRouter.post('/mcp/call', requireRole('BRAND', 'AGENCY'), h(async (req, res) => {
  const body = parse(z.object({ session_id: z.string(), tool_name: z.string(), params: z.record(z.any()).optional() }), req.body);
  assertSessionAccess(req, body.session_id);
  res.json(await mcpServer.callTool(body.session_id, body.tool_name, body.params ?? {}));
}));
