import { Router } from 'express';
import { h } from './helpers';
import { queryAll, queryOne } from '../db/database';
import { requireAuth, brandScope } from '../auth/auth';
import { campaignFinancials } from '../core/ledger';
import { listCampaigns } from '../core/campaigns';

export const orgsRouter = Router();

orgsRouter.get('/brands', requireAuth, h((req, res) => {
  const scope = brandScope(req.user!);
  const rows = queryAll<any>(`SELECT * FROM brands ORDER BY name`).filter((b) => scope === null || scope.includes(b.id) || req.user!.role === 'CREATOR');
  res.json(rows.map((b) => {
    const campaigns = listCampaigns({ brand_id: b.id });
    const totals = campaigns.reduce((a, c) => ({ budget: a.budget + c.financials.budget, spent: a.spent + c.financials.spent, escrow: a.escrow + c.financials.escrow_locked }), { budget: 0, spent: 0, escrow: 0 });
    return { ...b, campaigns_count: campaigns.length, active_campaigns: campaigns.filter((c) => c.status === 'ACTIVE').length, allocated_budget: totals.budget, spent_budget: totals.spent, escrow_budget: totals.escrow };
  }));
}));

orgsRouter.get('/brands/:id', requireAuth, h((req, res) => {
  const b = queryOne<any>(`SELECT * FROM brands WHERE id = ?`, [req.params.id]);
  if (!b) { res.status(404).json({ error: 'Brand not found' }); return; }
  res.json({ ...b, campaigns: listCampaigns({ brand_id: b.id }) });
}));

orgsRouter.get('/agencies', requireAuth, h((req, res) => {
  const user = req.user!;
  const agencies = queryAll<any>(`SELECT * FROM agencies ORDER BY name`).filter((a) => user.role === 'ADMIN' || a.id === user.agency_id || user.role === 'BRAND');
  res.json(agencies.map((a) => ({
    ...a,
    clients: queryAll<any>(`SELECT b.* FROM agency_brands ab JOIN brands b ON b.id = ab.brand_id WHERE ab.agency_id = ? ORDER BY b.name`, [a.id]).map((b) => {
      const campaigns = listCampaigns({ brand_id: b.id });
      const fin = campaigns.map((c) => campaignFinancials(c.id));
      return { ...b, campaigns_count: campaigns.length, active_campaigns: campaigns.filter((c) => c.status === 'ACTIVE').length, budget: fin.reduce((x, f) => x + f.budget, 0), spent: fin.reduce((x, f) => x + f.spent, 0), escrow: fin.reduce((x, f) => x + f.escrow_locked, 0), pending_checkpoints: campaigns.reduce((x, c) => x + c.stats.pending_checkpoints, 0) };
    }),
  })));
}));
