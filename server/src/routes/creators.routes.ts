import { Router } from 'express';
import { z } from 'zod';
import { h, parse, qnum, qstr, auditHuman } from './helpers';
import { requireAuth, requireRole } from '../auth/auth';
import { searchCreators, getCreator, rateBenchmark, NICHES } from '../core/marketplace';
import { listCollaborations } from '../core/collaborations';
import { creatorAnalytics } from '../core/analytics';
import { creatorWallet } from '../core/payments';
import { listLedger } from '../core/ledger';
import { execute } from '../db/database';
import { CoreError } from '../core/ids';

export const creatorsRouter = Router();

creatorsRouter.get('/', requireAuth, h((req, res) => {
  const q = req.query;
  const rows = searchCreators({
    query: qstr(q.q), niche: qstr(q.niche), platform: qstr(q.platform), min_followers: qnum(q.min_followers), max_followers: qnum(q.max_followers),
    min_engagement: qnum(q.min_engagement), max_rate: qnum(q.max_rate), rate_type: qstr(q.rate_type) as any, country: qstr(q.country),
    verified_only: q.verified === '1' || q.verified === 'true', sort: qstr(q.sort) as any, limit: qnum(q.limit) ?? 100, campaign_id: qstr(q.campaign_id),
  });
  res.json(rows.map(({ wallet_balance, ...c }) => c));
}));

creatorsRouter.get('/niches', requireAuth, h((_req, res) => res.json(NICHES)));

creatorsRouter.get('/benchmark', requireAuth, h((req, res) => {
  const body = parse(z.object({ follower_count: z.coerce.number().int().positive(), deliverable: z.enum(['post', 'reel', 'video', 'story']), niche: z.string().optional() }), req.query);
  res.json(rateBenchmark(body));
}));

creatorsRouter.get('/:id', requireAuth, h((req, res) => {
  const c = getCreator(req.params.id);
  const collabs = listCollaborations({ creator_id: c.id });
  const isSelf = req.user!.role === 'CREATOR' && req.user!.creator_id === c.id;
  const { wallet_balance, ...pub } = c;
  res.json({ ...pub, ...(isSelf || req.user!.role === 'ADMIN' ? { wallet_balance } : {}), collaborations: collabs, analytics: creatorAnalytics(c.id) });
}));

/** Creator-owned endpoints */
creatorsRouter.get('/me/wallet', requireRole('CREATOR'), h((req, res) => {
  const id = req.user!.creator_id!;
  res.json({ ...creatorWallet(id), ledger: listLedger({ creator_id: id, limit: 200 }), analytics: creatorAnalytics(id) });
}));

const profilePatch = z.object({
  name: z.string().min(1).optional(), bio: z.string().max(600).optional(), location: z.string().optional(), primary_niche: z.string().optional(), secondary_niches: z.array(z.string()).optional(),
  content_tags: z.array(z.string()).optional(), rate_post: z.number().nonnegative().optional(), rate_reel: z.number().nonnegative().optional(), rate_video: z.number().nonnegative().optional(), rate_story: z.number().nonnegative().optional(),
  available: z.boolean().optional(), response_time_hours: z.number().positive().optional(), portfolio: z.array(z.object({ title: z.string(), platform: z.string(), url: z.string(), views: z.number().optional(), brand: z.string().optional() })).optional(),
});

creatorsRouter.patch('/me/profile', requireRole('CREATOR'), h((req, res) => {
  const id = req.user!.creator_id!;
  const patch = parse(profilePatch, req.body);
  const sets: string[] = [];
  const params: any[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) { sets.push(`${k} = ?`); params.push(JSON.stringify(v)); }
    else if (typeof v === 'boolean') { sets.push(`${k} = ?`); params.push(v ? 1 : 0); }
    else { sets.push(`${k} = ?`); params.push(v); }
  }
  if (!sets.length) throw new CoreError('Nothing to update.');
  params.push(id);
  execute(`UPDATE creators SET ${sets.join(', ')} WHERE id = ?`, params);
  auditHuman(req.user, 'update_creator_profile', patch, `Creator profile updated (${Object.keys(patch).join(', ')}).`);
  res.json(getCreator(id));
}));
