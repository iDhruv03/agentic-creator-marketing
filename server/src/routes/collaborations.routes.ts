import { Router } from 'express';
import { z } from 'zod';
import { h, parse, qstr, auditHuman } from './helpers';
import { requireAuth, requireRole, canAccessCampaign } from '../auth/auth';
import { listCollaborations, getCollaboration, sendOffer, counterOffer, acceptOffer, declineOffer, postMessage, submitDeliverable, reviewDeliverable, startWork, runComplianceCheck } from '../core/collaborations';
import { releasePayment } from '../core/payments';
import { getCampaign } from '../core/campaigns';
import { CoreError } from '../core/ids';

export const collaborationsRouter = Router();

function assertAccess(req: any, col: { campaign_id: string; brand_id?: string; creator_id: string }) {
  const user = req.user;
  if (user.role === 'CREATOR') {
    if (user.creator_id !== col.creator_id) throw new CoreError('This collaboration belongs to another creator.', 403, 'FORBIDDEN');
    return;
  }
  const brandId = col.brand_id ?? getCampaign(col.campaign_id).brand_id;
  if (!canAccessCampaign(user, brandId)) throw new CoreError('You do not have access to this collaboration.', 403, 'FORBIDDEN');
}

collaborationsRouter.get('/', requireAuth, h((req, res) => {
  const user = req.user!;
  const filter: any = { status: qstr(req.query.status), campaign_id: qstr(req.query.campaign_id) };
  if (user.role === 'CREATOR') filter.creator_id = user.creator_id;
  else if (user.role === 'BRAND') filter.brand_id = user.brand_id;
  else if (user.role === 'AGENCY') filter.agency_id = user.agency_id;
  res.json(listCollaborations(filter));
}));

collaborationsRouter.post('/', requireRole('BRAND', 'AGENCY'), h((req, res) => {
  const body = parse(z.object({
    campaign_id: z.string(), creator_id: z.string(), proposed_rate: z.number().positive(), deliverables: z.array(z.string()).min(1),
    deadline: z.string().nullable().optional(), terms: z.string().optional(), usage_rights: z.string().optional(), exclusivity_days: z.number().int().nonnegative().optional(), message: z.string().optional(),
  }), req.body);
  const campaign = getCampaign(body.campaign_id);
  if (!canAccessCampaign(req.user!, campaign.brand_id)) throw new CoreError('You do not have access to this campaign.', 403, 'FORBIDDEN');
  const col = sendOffer(body, { type: 'HUMAN', id: req.user!.id, name: req.user!.name });
  auditHuman(req.user, 'send_collaboration_offer', body, `Offer of $${col.proposed_rate.toLocaleString()} sent to @${col.creator_handle} for "${campaign.title}".`, campaign.id);
  res.status(201).json(col);
}));

collaborationsRouter.get('/:id', requireAuth, h((req, res) => {
  const col = getCollaboration(req.params.id);
  assertAccess(req, col);
  res.json(col);
}));

collaborationsRouter.post('/:id/counter', requireAuth, h((req, res) => {
  const col = getCollaboration(req.params.id, false);
  assertAccess(req, col);
  const { amount, message } = parse(z.object({ amount: z.number().positive(), message: z.string().optional() }), req.body);
  const type = req.user!.role === 'CREATOR' ? 'CREATOR' : 'BRAND';
  const out = counterOffer(col.id, amount, message, { type, id: req.user!.id, name: req.user!.name });
  auditHuman(req.user, 'counter_offer', { collaboration_id: col.id, amount }, `${type === 'CREATOR' ? 'Creator' : 'Brand'} countered at $${amount.toLocaleString()} on ${col.id}.`, col.campaign_id);
  res.json(out);
}));

collaborationsRouter.post('/:id/accept', requireAuth, h((req, res) => {
  const col = getCollaboration(req.params.id, false);
  assertAccess(req, col);
  const { message } = parse(z.object({ message: z.string().optional() }), req.body ?? {});
  const type = req.user!.role === 'CREATOR' ? 'CREATOR' : 'BRAND';
  const out = acceptOffer(col.id, { type, id: req.user!.id, name: req.user!.name }, message);
  auditHuman(req.user, 'accept_offer', { collaboration_id: col.id }, `${type === 'CREATOR' ? 'Creator' : 'Brand'} accepted ${col.id} at $${out.agreed_rate?.toLocaleString()}.`, col.campaign_id);
  res.json(out);
}));

collaborationsRouter.post('/:id/decline', requireAuth, h((req, res) => {
  const col = getCollaboration(req.params.id, false);
  assertAccess(req, col);
  const { reason } = parse(z.object({ reason: z.string().optional() }), req.body ?? {});
  const type = req.user!.role === 'CREATOR' ? 'CREATOR' : 'BRAND';
  const out = declineOffer(col.id, { type, id: req.user!.id, name: req.user!.name }, reason);
  auditHuman(req.user, 'decline_offer', { collaboration_id: col.id, reason }, `${col.id} ${out.status.toLowerCase()}; escrow returned.`, col.campaign_id);
  res.json(out);
}));

collaborationsRouter.post('/:id/start', requireRole('CREATOR'), h((req, res) => {
  const col = getCollaboration(req.params.id, false);
  assertAccess(req, col);
  res.json(startWork(col.id, { type: 'CREATOR', id: req.user!.id, name: req.user!.name }));
}));

collaborationsRouter.post('/:id/messages', requireAuth, h((req, res) => {
  const col = getCollaboration(req.params.id, false);
  assertAccess(req, col);
  const { body } = parse(z.object({ body: z.string().min(1).max(2000) }), req.body);
  const type = req.user!.role === 'CREATOR' ? 'CREATOR' : req.user!.role === 'AGENCY' ? 'AGENCY' : 'BRAND';
  res.status(201).json(postMessage(col.id, body, { type, id: req.user!.id, name: req.user!.name }));
}));

collaborationsRouter.post('/:id/compliance-preview', requireAuth, h((req, res) => {
  const col = getCollaboration(req.params.id, false);
  assertAccess(req, col);
  const { caption, content_url, deliverable_type } = parse(z.object({ caption: z.string().default(''), content_url: z.string().default(''), deliverable_type: z.string().optional() }), req.body);
  const campaign = getCampaign(col.campaign_id);
  res.json(runComplianceCheck({ caption, content_url, campaign: { content_guidelines: campaign.content_guidelines, title: campaign.title, brand_name: campaign.brand_name }, deliverable_type: deliverable_type ?? col.deliverables[0]?.deliverable_type ?? 'POST' }));
}));

// Deliverables
collaborationsRouter.post('/:id/deliverables/:deliverableId/submit', requireAuth, h((req, res) => {
  const col = getCollaboration(req.params.id, false);
  assertAccess(req, col);
  const body = parse(z.object({ content_url: z.string().url(), caption: z.string().optional() }), req.body);
  const out = submitDeliverable(req.params.deliverableId, body, { type: 'HUMAN', id: req.user!.id, name: req.user!.name });
  auditHuman(req.user, 'submit_deliverable', { deliverable_id: req.params.deliverableId, content_url: body.content_url }, `Deliverable submitted on ${col.id}; compliance ${out.deliverable.compliance?.passed ? 'passed' : 'flagged'} (${out.deliverable.compliance?.score}%).`, col.campaign_id);
  res.json(out);
}));

collaborationsRouter.post('/:id/deliverables/:deliverableId/review', requireRole('BRAND', 'AGENCY'), h((req, res) => {
  const col = getCollaboration(req.params.id, false);
  assertAccess(req, col);
  const { decision, notes } = parse(z.object({ decision: z.enum(['APPROVED', 'CHANGES_REQUESTED']), notes: z.string().optional() }), req.body);
  const out = reviewDeliverable(req.params.deliverableId, decision, notes, { type: 'HUMAN', id: req.user!.id, name: req.user!.name });
  auditHuman(req.user, 'review_deliverable', { deliverable_id: req.params.deliverableId, decision, notes }, `Deliverable ${decision.toLowerCase().replace('_', ' ')} on ${col.id}.`, col.campaign_id);
  res.json(out);
}));

collaborationsRouter.post('/:id/release-payment', requireRole('BRAND', 'AGENCY'), h((req, res) => {
  const col = getCollaboration(req.params.id, false);
  assertAccess(req, col);
  const body = parse(z.object({ deliverable_id: z.string().nullable().optional(), amount: z.number().positive().optional(), note: z.string().optional() }), req.body ?? {});
  const out = releasePayment({ collaboration_id: col.id, ...body }, { type: 'HUMAN', id: req.user!.id, name: req.user!.name });
  auditHuman(req.user, 'release_payment', { collaboration_id: col.id, ...body }, `Released $${out.amount.toLocaleString()} to @${col.creator_handle}.`, col.campaign_id);
  res.json(out);
}));
