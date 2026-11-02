import { queryAll, queryOne, execute, parseJson, transaction, nowIso } from '../db/database';
import { newId, notFound, CoreError } from './ids';
import { allocateBudget, adjustBudget, campaignFinancials, type CampaignFinancials } from './ledger';
import { getCreator, scoreCreatorForCampaign, type Creator } from './marketplace';
import type { ActorType } from './audit';
import { bus } from '../realtime/events';
import { notifyCampaignOwners } from './notifications';

export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';

export interface Campaign {
  id: string;
  brand_id: string;
  brand_name?: string;
  brand_logo?: string | null;
  agency_id: string | null;
  agency_name?: string | null;
  title: string;
  brief: string;
  objectives: string;
  target_niches: string[];
  target_platforms: string[];
  target_audience: string;
  content_guidelines: string;
  required_deliverables: string[];
  budget: number;
  rate_band_min: number | null;
  rate_band_max: number | null;
  status: CampaignStatus;
  start_date: string | null;
  end_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  financials: CampaignFinancials;
  stats: { collaborations: number; active_collaborations: number; deliverables: number; approved_deliverables: number; pending_checkpoints: number; shortlist: number };
}

const BASE_SELECT = `
  SELECT c.*, b.name as brand_name, b.logo_url as brand_logo, a.name as agency_name
  FROM campaigns c
  JOIN brands b ON b.id = c.brand_id
  LEFT JOIN agencies a ON a.id = c.agency_id`;

export function mapCampaign(r: any): Campaign {
  const stats = queryOne<any>(
    `SELECT
       (SELECT COUNT(*) FROM collaborations WHERE campaign_id = ?) as collaborations,
       (SELECT COUNT(*) FROM collaborations WHERE campaign_id = ? AND status IN ('ACCEPTED','IN_PROGRESS','SUBMITTED','APPROVED')) as active_collaborations,
       (SELECT COUNT(*) FROM deliverables d JOIN collaborations col ON col.id = d.collaboration_id WHERE col.campaign_id = ?) as deliverables,
       (SELECT COUNT(*) FROM deliverables d JOIN collaborations col ON col.id = d.collaboration_id WHERE col.campaign_id = ? AND d.status IN ('APPROVED','PAID')) as approved_deliverables,
       (SELECT COUNT(*) FROM approval_checkpoints WHERE campaign_id = ? AND status = 'PENDING') as pending_checkpoints,
       (SELECT COUNT(*) FROM campaign_shortlist WHERE campaign_id = ?) as shortlist`,
    [r.id, r.id, r.id, r.id, r.id, r.id],
  );
  return {
    ...r,
    target_niches: parseJson<string[]>(r.target_niches, []),
    target_platforms: parseJson<string[]>(r.target_platforms, []),
    required_deliverables: parseJson<string[]>(r.required_deliverables, []),
    financials: campaignFinancials(r.id),
    stats,
  };
}

export function getCampaign(id: string): Campaign {
  const row = queryOne(`${BASE_SELECT} WHERE c.id = ?`, [id]);
  if (!row) throw notFound('Campaign', id);
  return mapCampaign(row);
}

export function listCampaigns(filter: { brand_id?: string; agency_id?: string; brand_ids?: string[]; status?: string } = {}): Campaign[] {
  const where: string[] = [];
  const params: any[] = [];
  if (filter.brand_id) { where.push('c.brand_id = ?'); params.push(filter.brand_id); }
  if (filter.agency_id) { where.push('(c.agency_id = ? OR c.brand_id IN (SELECT brand_id FROM agency_brands WHERE agency_id = ?))'); params.push(filter.agency_id, filter.agency_id); }
  if (filter.brand_ids?.length) { where.push(`c.brand_id IN (${filter.brand_ids.map(() => '?').join(',')})`); params.push(...filter.brand_ids); }
  if (filter.status) { where.push('c.status = ?'); params.push(filter.status); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return queryAll(`${BASE_SELECT} ${whereSql} ORDER BY c.created_at DESC`, params).map(mapCampaign);
}

export interface CreateCampaignInput {
  id?: string;
  created_at?: string;
  brand_id: string;
  agency_id?: string | null;
  title: string;
  brief?: string;
  objectives?: string;
  target_niches?: string[];
  target_platforms?: string[];
  target_audience?: string;
  content_guidelines?: string;
  required_deliverables?: string[];
  budget: number;
  rate_band_min?: number | null;
  rate_band_max?: number | null;
  status?: CampaignStatus;
  start_date?: string | null;
  end_date?: string | null;
}

export function createCampaign(input: CreateCampaignInput, actor: { type: ActorType; id: string }): Campaign {
  if (!input.title?.trim()) throw new CoreError('Campaign title is required.');
  if (!(input.budget >= 0)) throw new CoreError('Budget must be a non-negative number.');
  if (!queryOne(`SELECT id FROM brands WHERE id = ?`, [input.brand_id])) throw notFound('Brand', input.brand_id);

  const id = input.id ?? newId('camp');
  const createdAt = input.created_at ?? nowIso();
  return transaction(() => {
    execute(
      `INSERT INTO campaigns (id, brand_id, agency_id, title, brief, objectives, target_niches, target_platforms, target_audience,
         content_guidelines, required_deliverables, budget, rate_band_min, rate_band_max, status, start_date, end_date, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, input.brand_id, input.agency_id ?? null, input.title.trim(), input.brief ?? '', input.objectives ?? '',
        JSON.stringify(input.target_niches ?? []), JSON.stringify(input.target_platforms ?? []), input.target_audience ?? '',
        input.content_guidelines ?? '', JSON.stringify(input.required_deliverables ?? []), input.budget,
        input.rate_band_min ?? null, input.rate_band_max ?? null, input.status ?? 'DRAFT', input.start_date ?? null, input.end_date ?? null, actor.id, createdAt, createdAt,
      ],
    );
    if (input.budget > 0) {
      allocateBudget({ campaign_id: id, brand_id: input.brand_id, amount: input.budget, actor_type: actor.type, actor_id: actor.id, note: `Initial budget for "${input.title.trim()}"` });
    }
    bus.publish('campaign.updated', { id, action: 'created' });
    return getCampaign(id);
  });
}

export type UpdateCampaignInput = Partial<Omit<CreateCampaignInput, 'brand_id' | 'id' | 'created_at'>>;

export function updateCampaign(id: string, patch: UpdateCampaignInput, actor: { type: ActorType; id: string }): Campaign {
  const existing = getCampaign(id);
  const sets: string[] = [];
  const params: any[] = [];
  const simple: (keyof UpdateCampaignInput)[] = ['title', 'brief', 'objectives', 'target_audience', 'content_guidelines', 'rate_band_min', 'rate_band_max', 'start_date', 'end_date', 'agency_id'];
  for (const k of simple) {
    if (patch[k] !== undefined) { sets.push(`${k} = ?`); params.push(patch[k] as any); }
  }
  for (const k of ['target_niches', 'target_platforms', 'required_deliverables'] as const) {
    if (patch[k] !== undefined) { sets.push(`${k} = ?`); params.push(JSON.stringify(patch[k])); }
  }
  return transaction(() => {
    if (patch.budget !== undefined && patch.budget !== existing.budget) {
      const delta = patch.budget - existing.budget;
      if (delta < 0 && existing.financials.available + delta < 0) {
        throw new CoreError(`Cannot reduce budget below committed spend ($${existing.financials.committed.toLocaleString()}).`, 409, 'BUDGET_BELOW_COMMITTED');
      }
      sets.push('budget = ?'); params.push(patch.budget);
      adjustBudget({ campaign_id: id, brand_id: existing.brand_id, delta, actor_type: actor.type, actor_id: actor.id });
    }
    if (patch.status !== undefined && patch.status !== existing.status) {
      sets.push('status = ?'); params.push(patch.status);
    }
    if (sets.length) {
      sets.push('updated_at = ?'); params.push(nowIso());
      params.push(id);
      execute(`UPDATE campaigns SET ${sets.join(', ')} WHERE id = ?`, params);
    }
    bus.publish('campaign.updated', { id, action: 'updated' });
    return getCampaign(id);
  });
}

const TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  DRAFT: ['ACTIVE', 'ARCHIVED'],
  ACTIVE: ['PAUSED', 'COMPLETED'],
  PAUSED: ['ACTIVE', 'COMPLETED', 'ARCHIVED'],
  COMPLETED: ['ARCHIVED'],
  ARCHIVED: [],
};

export function transitionCampaign(id: string, status: CampaignStatus, actor: { type: ActorType; id: string }): Campaign {
  const c = getCampaign(id);
  if (!TRANSITIONS[c.status].includes(status)) {
    throw new CoreError(`Cannot move campaign from ${c.status} to ${status}.`, 409, 'INVALID_TRANSITION');
  }
  if (status === 'ACTIVE' && c.budget <= 0) throw new CoreError('Set a budget before activating the campaign.', 409, 'NO_BUDGET');
  execute(`UPDATE campaigns SET status = ?, updated_at = ? WHERE id = ?`, [status, nowIso(), id]);
  bus.publish('campaign.updated', { id, action: 'status', status });
  notifyCampaignOwners(id, { kind: 'INFO', title: `Campaign ${status.toLowerCase()}`, body: `"${c.title}" is now ${status.toLowerCase()}.`, link: `/campaigns/${id}` });
  return getCampaign(id);
}

/** Has any creator accepted an offer on this campaign? (Brief edits after this are high-impact.) */
export function hasAcceptedCollaborations(campaignId: string): boolean {
  return (queryOne<{ n: number }>(
    `SELECT COUNT(*) n FROM collaborations WHERE campaign_id = ? AND status IN ('ACCEPTED','IN_PROGRESS','SUBMITTED','APPROVED','COMPLETED')`,
    [campaignId],
  )?.n ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Shortlist
// ---------------------------------------------------------------------------
export interface ShortlistEntry {
  id: string;
  campaign_id: string;
  creator_id: string;
  match_score: number;
  rationale: string;
  status: 'SUGGESTED' | 'APPROVED' | 'REJECTED';
  added_by: string;
  actor_id: string | null;
  created_at: string;
  creator: Creator;
}

export function listShortlist(campaignId: string): ShortlistEntry[] {
  return queryAll<any>(`SELECT * FROM campaign_shortlist WHERE campaign_id = ? ORDER BY match_score DESC, created_at ASC`, [campaignId]).map((r) => ({ ...r, creator: getCreator(r.creator_id) }));
}

export function addToShortlist(campaignId: string, creatorId: string, actor: { type: ActorType; id: string }, rationale?: string): ShortlistEntry {
  const campaign = getCampaign(campaignId);
  const creator = getCreator(creatorId);
  const scoring = scoreCreatorForCampaign(creator, {
    target_niches: campaign.target_niches, target_platforms: campaign.target_platforms, target_audience: campaign.target_audience,
    rate_band_min: campaign.rate_band_min, rate_band_max: campaign.rate_band_max, budget: campaign.budget,
  });
  const existing = queryOne<any>(`SELECT id FROM campaign_shortlist WHERE campaign_id = ? AND creator_id = ?`, [campaignId, creator.id]);
  const id = existing?.id ?? newId('shl');
  if (existing) {
    execute(`UPDATE campaign_shortlist SET match_score = ?, rationale = COALESCE(NULLIF(?, ''), rationale) WHERE id = ?`, [scoring.score, rationale ?? '', id]);
  } else {
    execute(
      `INSERT INTO campaign_shortlist (id, campaign_id, creator_id, match_score, rationale, status, added_by, actor_id) VALUES (?, ?, ?, ?, ?, 'SUGGESTED', ?, ?)`,
      [id, campaignId, creator.id, scoring.score, rationale ?? scoring.reasons.join('. '), actor.type, actor.id],
    );
  }
  bus.publish('shortlist.updated', { campaign_id: campaignId, creator_id: creator.id });
  return listShortlist(campaignId).find((s) => s.id === id)!;
}

export function reviewShortlist(entryId: string, status: 'APPROVED' | 'REJECTED', actorId: string): ShortlistEntry {
  const row = queryOne<any>(`SELECT * FROM campaign_shortlist WHERE id = ?`, [entryId]);
  if (!row) throw notFound('Shortlist entry', entryId);
  execute(`UPDATE campaign_shortlist SET status = ? WHERE id = ?`, [status, entryId]);
  bus.publish('shortlist.updated', { campaign_id: row.campaign_id, creator_id: row.creator_id, status, by: actorId });
  return listShortlist(row.campaign_id).find((s) => s.id === entryId)!;
}

export function removeFromShortlist(entryId: string): void {
  const row = queryOne<any>(`SELECT campaign_id FROM campaign_shortlist WHERE id = ?`, [entryId]);
  execute(`DELETE FROM campaign_shortlist WHERE id = ?`, [entryId]);
  if (row) bus.publish('shortlist.updated', { campaign_id: row.campaign_id });
}
