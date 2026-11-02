import { Router } from 'express';
import { z } from 'zod';
import { h, parse, qstr, qnum } from './helpers';
import { requireAuth, requireRole, brandScope } from '../auth/auth';
import { listCheckpoints, getCheckpoint } from '../core/governance';
import { mcpServer } from '../mcp/server';
import { listLedger, trialBalance } from '../core/ledger';
import { listAudit, verifyAuditChain, auditStats } from '../core/audit';
import { CoreError } from '../core/ids';
import { listNotifications, markRead, unreadCount } from '../core/notifications';
import { queryAll } from '../db/database';

export const governanceRouter = Router();

function scopeFilter(req: any): Record<string, any> {
  const user = req.user;
  if (user.role === 'BRAND') return { brand_id: user.brand_id };
  if (user.role === 'AGENCY') return { agency_id: user.agency_id };
  return {};
}

// ---- Checkpoints -----------------------------------------------------------
governanceRouter.get('/checkpoints', requireRole('BRAND', 'AGENCY'), h((req, res) => {
  res.json(listCheckpoints({ ...scopeFilter(req), status: qstr(req.query.status), campaign_id: qstr(req.query.campaign_id), session_id: qstr(req.query.session_id) }));
}));

governanceRouter.get('/checkpoints/:id', requireRole('BRAND', 'AGENCY'), h((req, res) => {
  const chk = getCheckpoint(req.params.id);
  const scope = brandScope(req.user!);
  if (scope !== null && chk.brand_id && !scope.includes(chk.brand_id)) throw new CoreError('Forbidden', 403, 'FORBIDDEN');
  res.json(chk);
}));

governanceRouter.post('/checkpoints/:id/resolve', requireRole('BRAND', 'AGENCY'), h((req, res) => {
  const chk = getCheckpoint(req.params.id);
  const scope = brandScope(req.user!);
  if (scope !== null && chk.brand_id && !scope.includes(chk.brand_id)) throw new CoreError('Forbidden', 403, 'FORBIDDEN');
  const { decision, notes } = parse(z.object({ decision: z.enum(['APPROVED', 'REJECTED']), notes: z.string().max(1000).optional() }), req.body);
  res.json(mcpServer.resolveCheckpoint(chk.id, decision, { id: req.user!.id, name: req.user!.name, notes }));
}));

// ---- Ledger ----------------------------------------------------------------
governanceRouter.get('/ledger', requireAuth, h((req, res) => {
  const user = req.user!;
  const filter: any = { campaign_id: qstr(req.query.campaign_id), collaboration_id: qstr(req.query.collaboration_id), entry_type: qstr(req.query.entry_type), limit: qnum(req.query.limit) };
  if (user.role === 'CREATOR') filter.creator_id = user.creator_id;
  else if (user.role === 'BRAND') filter.brand_id = user.brand_id;
  else if (user.role === 'AGENCY') {
    const scope = brandScope(user);
    const rows = listLedger(filter).filter((r: any) => scope?.includes(r.brand_id));
    res.json(rows); return;
  }
  res.json(listLedger(filter));
}));

governanceRouter.get('/ledger/trial-balance', requireRole('BRAND', 'AGENCY'), h((_req, res) => res.json(trialBalance())));

// ---- Audit -----------------------------------------------------------------
governanceRouter.get('/audit', requireAuth, h((req, res) => {
  const q = req.query;
  const result = listAudit({ campaign_id: qstr(q.campaign_id), session_id: qstr(q.session_id), run_id: qstr(q.run_id), actor_type: qstr(q.actor_type), status: qstr(q.status), tool_name: qstr(q.tool_name), search: qstr(q.q), limit: qnum(q.limit) ?? 100, offset: qnum(q.offset) ?? 0 });
  const scope = brandScope(req.user!);
  if (scope !== null && req.user!.role !== 'CREATOR') {
    // Filter to campaigns in scope; entries without a campaign (session-level) are kept when the session belongs to the scope.
    const campaignIds = new Set<string>(queryAll(`SELECT id FROM campaigns WHERE brand_id IN (${scope.map(() => '?').join(',') || "''"})`, scope).map((r: any) => r.id));
    const sessionIds = new Set<string>(queryAll(`SELECT id FROM agent_sessions WHERE brand_id IN (${scope.map(() => '?').join(',') || "''"})`, scope).map((r: any) => r.id));
    result.items = result.items.filter((i) => (i.campaign_id ? campaignIds.has(i.campaign_id) : i.session_id ? sessionIds.has(i.session_id) : true));
  }
  res.json(result);
}));

governanceRouter.get('/audit/verify', requireAuth, h((_req, res) => res.json({ ...verifyAuditChain(), stats: auditStats() })));

// ---- Notifications ---------------------------------------------------------
function audienceOf(user: any): [any, string] | null {
  if (user.role === 'BRAND' && user.brand_id) return ['BRAND', user.brand_id];
  if (user.role === 'AGENCY' && user.agency_id) return ['AGENCY', user.agency_id];
  if (user.role === 'CREATOR' && user.creator_id) return ['CREATOR', user.creator_id];
  return null;
}

governanceRouter.get('/notifications', requireAuth, h((req, res) => {
  const a = audienceOf(req.user);
  if (!a) { res.json({ items: [], unread: 0 }); return; }
  res.json({ items: listNotifications(a[0], a[1]), unread: unreadCount(a[0], a[1]) });
}));

governanceRouter.post('/notifications/read', requireAuth, h((req, res) => {
  const a = audienceOf(req.user);
  if (!a) { res.json({ changed: 0 }); return; }
  const { ids } = parse(z.object({ ids: z.array(z.string()).optional() }), req.body ?? {});
  res.json({ changed: markRead(a[0], a[1], ids) });
}));
