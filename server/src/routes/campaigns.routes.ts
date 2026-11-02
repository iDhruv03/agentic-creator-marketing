import { Router } from 'express';
import { z } from 'zod';
import { h, parse, qstr, auditHuman } from './helpers';
import { requireAuth, requireRole, brandScope, canAccessCampaign, actorOf } from '../auth/auth';
import { listCampaigns, getCampaign, createCampaign, updateCampaign, transitionCampaign, listShortlist, addToShortlist, reviewShortlist, removeFromShortlist } from '../core/campaigns';
import { listCollaborations } from '../core/collaborations';
import { campaignAnalytics } from '../core/analytics';
import { listLedger } from '../core/ledger';
import { listCheckpoints } from '../core/governance';
import { listAudit } from '../core/audit';
import { listSessions } from '../core/governance';
import { CoreError } from '../core/ids';
import { listRuns } from '../agent/runs';

export const campaignsRouter = Router();

const campaignBody = z.object({
  brand_id: z.string(),
  agency_id: z.string().nullable().optional(),
  title: z.string().min(2).max(120),
  brief: z.string().optional(),
  objectives: z.string().optional(),
  target_niches: z.array(z.string()).optional(),
  target_platforms: z.array(z.enum(['instagram', 'youtube', 'tiktok'])).optional(),
  target_audience: z.string().optional(),
  content_guidelines: z.string().optional(),
  required_deliverables: z.array(z.string()).optional(),
  budget: z.number().nonnegative(),
  rate_band_min: z.number().nonnegative().nullable().optional(),
  rate_band_max: z.number().positive().nullable().optional(),
  status: z.enum(['DRAFT', 'ACTIVE']).optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
});

function guard(req: any, brandId: string) {
  if (!canAccessCampaign(req.user, brandId)) throw new CoreError('You do not have access to this campaign.', 403, 'FORBIDDEN');
}

campaignsRouter.get('/', requireAuth, h((req, res) => {
  const user = req.user!;
  const scope = brandScope(user);
  const filter: any = { status: qstr(req.query.status) };
  if (qstr(req.query.brand_id)) filter.brand_id = req.query.brand_id;
  if (scope !== null) filter.brand_ids = scope.length ? scope : ['__none__'];
  res.json(listCampaigns(filter));
}));

campaignsRouter.post('/', requireRole('BRAND', 'AGENCY'), h((req, res) => {
  const body = parse(campaignBody, req.body);
  guard(req, body.brand_id);
  if (req.user!.role === 'AGENCY') body.agency_id = req.user!.agency_id;
  const c = createCampaign(body, actorOf(req.user!));
  auditHuman(req.user, 'create_campaign', { title: c.title, budget: c.budget }, `Campaign "${c.title}" created with $${c.budget.toLocaleString()} budget.`, c.id);
  res.status(201).json(c);
}));

campaignsRouter.get('/:id', requireAuth, h((req, res) => {
  const c = getCampaign(req.params.id);
  if (req.user!.role !== 'CREATOR') guard(req, c.brand_id);
  res.json({
    ...c,
    shortlist: listShortlist(c.id),
    collaborations: listCollaborations({ campaign_id: c.id }),
    checkpoints: listCheckpoints({ campaign_id: c.id }),
    sessions: listSessions({ campaign_id: c.id }),
    runs: listRuns({ campaign_id: c.id, limit: 10 }),
  });
}));

campaignsRouter.patch('/:id', requireRole('BRAND', 'AGENCY'), h((req, res) => {
  const existing = getCampaign(req.params.id);
  guard(req, existing.brand_id);
  const patch = parse(campaignBody.omit({ brand_id: true, status: true }).partial(), req.body);
  const c = updateCampaign(existing.id, patch, actorOf(req.user!));
  auditHuman(req.user, 'update_campaign', patch, `Campaign "${c.title}" updated (${Object.keys(patch).join(', ')}).`, c.id);
  res.json(c);
}));

campaignsRouter.post('/:id/status', requireRole('BRAND', 'AGENCY'), h((req, res) => {
  const existing = getCampaign(req.params.id);
  guard(req, existing.brand_id);
  const { status } = parse(z.object({ status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']) }), req.body);
  const c = transitionCampaign(existing.id, status, actorOf(req.user!));
  auditHuman(req.user, 'transition_campaign', { status }, `Campaign "${c.title}" → ${status}.`, c.id);
  res.json(c);
}));

campaignsRouter.get('/:id/analytics', requireAuth, h((req, res) => {
  const c = getCampaign(req.params.id);
  if (req.user!.role !== 'CREATOR') guard(req, c.brand_id);
  res.json(campaignAnalytics(c.id));
}));

campaignsRouter.get('/:id/ledger', requireAuth, h((req, res) => {
  const c = getCampaign(req.params.id);
  guard(req, c.brand_id);
  res.json(listLedger({ campaign_id: c.id }));
}));

campaignsRouter.get('/:id/audit', requireAuth, h((req, res) => {
  const c = getCampaign(req.params.id);
  guard(req, c.brand_id);
  res.json(listAudit({ campaign_id: c.id, limit: 200 }));
}));

// Shortlist
campaignsRouter.get('/:id/shortlist', requireAuth, h((req, res) => {
  const c = getCampaign(req.params.id);
  guard(req, c.brand_id);
  res.json(listShortlist(c.id));
}));

campaignsRouter.post('/:id/shortlist', requireRole('BRAND', 'AGENCY'), h((req, res) => {
  const c = getCampaign(req.params.id);
  guard(req, c.brand_id);
  const { creator_id, rationale } = parse(z.object({ creator_id: z.string(), rationale: z.string().optional() }), req.body);
  const entry = addToShortlist(c.id, creator_id, actorOf(req.user!), rationale);
  auditHuman(req.user, 'add_to_shortlist', { creator_id }, `@${entry.creator.handle} shortlisted for "${c.title}".`, c.id);
  res.status(201).json(entry);
}));

campaignsRouter.post('/:id/shortlist/:entryId/review', requireRole('BRAND', 'AGENCY'), h((req, res) => {
  const c = getCampaign(req.params.id);
  guard(req, c.brand_id);
  const { status } = parse(z.object({ status: z.enum(['APPROVED', 'REJECTED']) }), req.body);
  const entry = reviewShortlist(req.params.entryId, status, req.user!.id);
  auditHuman(req.user, 'review_shortlist', { entry_id: entry.id, status }, `Shortlist: @${entry.creator.handle} ${status.toLowerCase()} by reviewer.`, c.id);
  res.json(entry);
}));

campaignsRouter.delete('/:id/shortlist/:entryId', requireRole('BRAND', 'AGENCY'), h((req, res) => {
  const c = getCampaign(req.params.id);
  guard(req, c.brand_id);
  removeFromShortlist(req.params.entryId);
  res.status(204).end();
}));
