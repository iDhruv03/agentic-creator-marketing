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
  else if (user.role === 'AGENCY') filter.brand_ids = brandScope(user) ?? [];
  res.json(listLedger(filter));
}));

governanceRouter.get('/ledger/trial-balance', requireRole('BRAND', 'AGENCY'), h((_req, res) => res.json(trialBalance())));

// ---- Audit -----------------------------------------------------------------
governanceRouter.get('/audit', requireAuth, h((req, res) => {
  const q = req.query;
  const scope = brandScope(req.user!);
  let visibility: { campaign_ids: string[]; session_ids: string[] } | undefined;
  if (scope !== null) {
    const ids = scope.length ? scope : ['__none__'];
    const ph = ids.map(() => '?').join(',');
    visibility = {
      campaign_ids: queryAll<{ id: string }>(`SELECT id FROM campaigns WHERE brand_id IN (${ph})`, ids).map((r) => r.id),
      session_ids: queryAll<{ id: string }>(`SELECT id FROM agent_sessions WHERE brand_id IN (${ph})`, ids).map((r) => r.id),
    };
    if (req.user!.role === 'CREATOR') visibility = { campaign_ids: queryAll<{ campaign_id: string }>(`SELECT DISTINCT campaign_id FROM collaborations WHERE creator_id = ?`, [req.user!.creator_id ?? '']).map((r) => r.campaign_id), session_ids: [] };
  }
  const result = listAudit({ campaign_id: qstr(q.campaign_id), session_id: qstr(q.session_id), run_id: qstr(q.run_id), actor_type: qstr(q.actor_type), status: qstr(q.status), tool_name: qstr(q.tool_name), search: qstr(q.q), scope: visibility, limit: qnum(q.limit) ?? 100, offset: qnum(q.offset) ?? 0 });
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
