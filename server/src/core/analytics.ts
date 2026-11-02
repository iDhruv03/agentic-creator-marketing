import { queryAll, queryOne, parseJson } from '../db/database';
import { campaignFinancials } from './ledger';
import { getCampaign } from './campaigns';
import type { DeliverableMetrics } from './collaborations';

/**
 * Performance Analytics engine (paper §7.5): the same numbers are read by
 * humans deciding their next move and by agents deciding their next tool call.
 */

export interface CampaignAnalytics {
  campaign_id: string;
  title: string;
  financials: ReturnType<typeof campaignFinancials>;
  reach: { views: number; likes: number; comments: number; shares: number; saves: number; clicks: number; engagement_rate: number; impressions_est: number };
  cost: { cost_per_view: number; cost_per_engagement: number; cost_per_click: number; avg_rate: number };
  funnel: { shortlisted: number; offered: number; accepted: number; delivered: number; approved: number; paid: number };
  by_creator: { creator_id: string; name: string; handle: string; avatar_url: string | null; rate: number; status: string; views: number; engagement_rate: number; cpe: number; deliverables: number }[];
  by_platform: { platform: string; views: number; engagements: number; deliverables: number }[];
  timeline: { date: string; spend: number; committed: number; views: number }[];
}

function sumMetrics(rows: { metrics: DeliverableMetrics | null }[]) {
  const totals = { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0 };
  let weighted = 0;
  for (const r of rows) {
    const m = r.metrics;
    if (!m) continue;
    totals.views += m.views; totals.likes += m.likes; totals.comments += m.comments; totals.shares += m.shares; totals.saves += m.saves; totals.clicks += m.clicks;
    weighted += m.engagement_rate * m.views;
  }
  const engagement_rate = totals.views > 0 ? Math.round((weighted / totals.views) * 100) / 100 : 0;
  return { ...totals, engagement_rate, impressions_est: Math.round(totals.views * 1.35) };
}

export function campaignAnalytics(campaignId: string): CampaignAnalytics {
  const campaign = getCampaign(campaignId);
  const deliverables = queryAll<any>(
    `SELECT d.*, col.creator_id, col.agreed_rate, col.proposed_rate, col.status as col_status, cr.name, cr.handle, cr.avatar_url
     FROM deliverables d JOIN collaborations col ON col.id = d.collaboration_id JOIN creators cr ON cr.id = col.creator_id
     WHERE col.campaign_id = ?`,
    [campaignId],
  ).map((d) => ({ ...d, metrics: parseJson<DeliverableMetrics | null>(d.metrics, null) }));

  const reach = sumMetrics(deliverables);
  const fin = campaignFinancials(campaignId);
  const engagements = reach.likes + reach.comments + reach.shares + reach.saves;
  const spentOrCommitted = fin.committed;
  const cost = {
    cost_per_view: reach.views ? Math.round((spentOrCommitted / reach.views) * 10000) / 10000 : 0,
    cost_per_engagement: engagements ? Math.round((spentOrCommitted / engagements) * 100) / 100 : 0,
    cost_per_click: reach.clicks ? Math.round((spentOrCommitted / reach.clicks) * 100) / 100 : 0,
    avg_rate: 0,
  };

  const collabs = queryAll<any>(`SELECT * FROM collaborations WHERE campaign_id = ?`, [campaignId]);
  const rates = collabs.filter((c) => !['DECLINED', 'CANCELLED'].includes(c.status)).map((c) => c.agreed_rate ?? c.proposed_rate);
  cost.avg_rate = rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0;

  const funnel = {
    shortlisted: queryOne<{ n: number }>(`SELECT COUNT(*) n FROM campaign_shortlist WHERE campaign_id = ?`, [campaignId])?.n ?? 0,
    offered: collabs.length,
    accepted: collabs.filter((c) => ['ACCEPTED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'COMPLETED'].includes(c.status)).length,
    delivered: deliverables.filter((d) => d.status !== 'PENDING').length,
    approved: deliverables.filter((d) => ['APPROVED', 'PAID'].includes(d.status)).length,
    paid: deliverables.filter((d) => d.status === 'PAID').length,
  };

  const byCreatorMap = new Map<string, CampaignAnalytics['by_creator'][number]>();
  for (const c of collabs) {
    const cr = queryOne<any>(`SELECT name, handle, avatar_url FROM creators WHERE id = ?`, [c.creator_id]);
    byCreatorMap.set(c.creator_id, { creator_id: c.creator_id, name: cr?.name ?? '', handle: cr?.handle ?? '', avatar_url: cr?.avatar_url ?? null, rate: c.agreed_rate ?? c.proposed_rate, status: c.status, views: 0, engagement_rate: 0, cpe: 0, deliverables: 0 });
  }
  for (const d of deliverables) {
    const row = byCreatorMap.get(d.creator_id);
    if (!row) continue;
    row.deliverables += 1;
    if (d.metrics) {
      row.views += d.metrics.views;
      row.engagement_rate = Math.max(row.engagement_rate, d.metrics.engagement_rate);
      const eng = d.metrics.likes + d.metrics.comments + d.metrics.shares + d.metrics.saves;
      row.cpe = eng ? Math.round((row.rate / eng) * 100) / 100 : 0;
    }
  }

  const byPlatformMap = new Map<string, { platform: string; views: number; engagements: number; deliverables: number }>();
  for (const d of deliverables) {
    const row = byPlatformMap.get(d.platform) ?? { platform: d.platform, views: 0, engagements: 0, deliverables: 0 };
    row.deliverables += 1;
    if (d.metrics) { row.views += d.metrics.views; row.engagements += d.metrics.likes + d.metrics.comments + d.metrics.shares + d.metrics.saves; }
    byPlatformMap.set(d.platform, row);
  }

  const timelineMap = new Map<string, { date: string; spend: number; committed: number; views: number }>();
  const ensure = (date: string) => { const row = timelineMap.get(date) ?? { date, spend: 0, committed: 0, views: 0 }; timelineMap.set(date, row); return row; };
  ensure((campaign.start_date ?? campaign.created_at).slice(0, 10));
  for (const l of queryAll<any>(`SELECT amount, entry_type, created_at FROM ledger_entries WHERE campaign_id = ? AND entry_type IN ('PAYOUT_RELEASE','ESCROW_HOLD','ESCROW_REFUND')`, [campaignId])) {
    const row = ensure(l.created_at.slice(0, 10));
    if (l.entry_type === 'PAYOUT_RELEASE') row.spend += l.amount;
    else row.committed += l.entry_type === 'ESCROW_HOLD' ? l.amount : -l.amount;
  }
  for (const d of deliverables) {
    if (!d.submitted_at || !d.metrics) continue;
    ensure(d.submitted_at.slice(0, 10)).views += d.metrics.views;
  }
  ensure(new Date().toISOString().slice(0, 10));
  // Cumulative series so the chart reads as a running total.
  let cumSpend = 0, cumCommitted = 0, cumViews = 0;
  const timeline = [...timelineMap.values()].sort((a, b) => a.date.localeCompare(b.date)).map((r) => { cumSpend += r.spend; cumCommitted += r.committed; cumViews += r.views; return { date: r.date, spend: Math.round(cumSpend * 100) / 100, committed: Math.round(cumCommitted * 100) / 100, views: cumViews }; });

  return {
    campaign_id: campaignId,
    title: campaign.title,
    financials: fin,
    reach,
    cost,
    funnel,
    by_creator: [...byCreatorMap.values()].sort((a, b) => b.views - a.views),
    by_platform: [...byPlatformMap.values()],
    timeline,
  };
}

export interface OverviewAnalytics {
  totals: { budget: number; escrow: number; spent: number; available: number; campaigns: number; active_campaigns: number; creators_engaged: number; pending_checkpoints: number; agent_actions: number; guardrail_blocks: number; held_for_approval: number; views: number; engagement_rate: number };
  campaigns: { id: string; title: string; brand_name: string; status: string; budget: number; spent: number; escrow: number; views: number; collaborations: number }[];
  spend_by_niche: { niche: string; amount: number }[];
  activity: { date: string; agent: number; human: number }[];
  checkpoint_mix: { type: string; count: number }[];
  pipeline: { status: string; count: number }[];
}

export function overviewAnalytics(filter: { brand_id?: string; agency_id?: string } = {}): OverviewAnalytics {
  const where: string[] = [];
  const params: any[] = [];
  if (filter.brand_id) { where.push('c.brand_id = ?'); params.push(filter.brand_id); }
  if (filter.agency_id) { where.push('(c.agency_id = ? OR c.brand_id IN (SELECT brand_id FROM agency_brands WHERE agency_id = ?))'); params.push(filter.agency_id, filter.agency_id); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const campaigns = queryAll<any>(`SELECT c.*, b.name as brand_name FROM campaigns c JOIN brands b ON b.id = c.brand_id ${whereSql} ORDER BY c.created_at DESC`, params);
  const ids = campaigns.map((c) => c.id);
  const inList = ids.length ? `(${ids.map(() => '?').join(',')})` : `('')`;

  let budget = 0, escrow = 0, spent = 0, views = 0, weighted = 0;
  const rows: OverviewAnalytics['campaigns'] = [];
  for (const c of campaigns) {
    const fin = campaignFinancials(c.id);
    budget += fin.budget; escrow += fin.escrow_locked; spent += fin.spent;
    const m = queryAll<any>(`SELECT d.metrics FROM deliverables d JOIN collaborations col ON col.id = d.collaboration_id WHERE col.campaign_id = ? AND d.metrics IS NOT NULL`, [c.id]).map((r) => parseJson<DeliverableMetrics | null>(r.metrics, null)).filter(Boolean) as DeliverableMetrics[];
    const v = m.reduce((a, x) => a + x.views, 0);
    views += v; weighted += m.reduce((a, x) => a + x.engagement_rate * x.views, 0);
    rows.push({ id: c.id, title: c.title, brand_name: c.brand_name, status: c.status, budget: fin.budget, spent: fin.spent, escrow: fin.escrow_locked, views: v, collaborations: queryOne<{ n: number }>(`SELECT COUNT(*) n FROM collaborations WHERE campaign_id = ?`, [c.id])?.n ?? 0 });
  }

  const creators_engaged = queryOne<{ n: number }>(`SELECT COUNT(DISTINCT creator_id) n FROM collaborations WHERE campaign_id IN ${inList} AND status NOT IN ('DECLINED','CANCELLED')`, ids)?.n ?? 0;
  const pending_checkpoints = queryOne<{ n: number }>(`SELECT COUNT(*) n FROM approval_checkpoints WHERE status = 'PENDING' AND (campaign_id IN ${inList} OR campaign_id IS NULL)`, ids)?.n ?? 0;
  const auditScope = ids.length ? `AND (campaign_id IN ${inList} OR campaign_id IS NULL)` : '';
  const agent_actions = queryOne<{ n: number }>(`SELECT COUNT(*) n FROM audit_logs WHERE actor_type = 'AGENT' ${auditScope}`, ids)?.n ?? 0;
  const guardrail_blocks = queryOne<{ n: number }>(`SELECT COUNT(*) n FROM audit_logs WHERE execution_status = 'REJECTED_BY_GUARDRAIL' ${auditScope}`, ids)?.n ?? 0;
  const held_for_approval = queryOne<{ n: number }>(`SELECT COUNT(*) n FROM audit_logs WHERE execution_status = 'HELD_FOR_APPROVAL' ${auditScope}`, ids)?.n ?? 0;

  const spendByNiche = new Map<string, number>();
  for (const r of queryAll<any>(`SELECT cr.primary_niche niche, COALESCE(col.agreed_rate, col.proposed_rate) amt FROM collaborations col JOIN creators cr ON cr.id = col.creator_id WHERE col.campaign_id IN ${inList} AND col.status NOT IN ('DECLINED','CANCELLED')`, ids)) {
    spendByNiche.set(r.niche, (spendByNiche.get(r.niche) ?? 0) + r.amt);
  }

  const activity = queryAll<any>(
    `SELECT substr(timestamp,1,10) date,
            SUM(CASE WHEN actor_type='AGENT' THEN 1 ELSE 0 END) agent,
            SUM(CASE WHEN actor_type<>'AGENT' THEN 1 ELSE 0 END) human
     FROM audit_logs WHERE 1=1 ${auditScope} GROUP BY date ORDER BY date DESC LIMIT 14`, ids,
  ).reverse();

  const checkpoint_mix = queryAll<any>(`SELECT action_type type, COUNT(*) count FROM approval_checkpoints WHERE campaign_id IN ${inList} GROUP BY action_type`, ids);
  const pipeline = queryAll<any>(`SELECT status, COUNT(*) count FROM collaborations WHERE campaign_id IN ${inList} GROUP BY status`, ids);

  return {
    totals: {
      budget, escrow, spent, available: Math.round((budget - escrow - spent) * 100) / 100,
      campaigns: campaigns.length, active_campaigns: campaigns.filter((c) => c.status === 'ACTIVE').length,
      creators_engaged, pending_checkpoints, agent_actions, guardrail_blocks, held_for_approval,
      views, engagement_rate: views ? Math.round((weighted / views) * 100) / 100 : 0,
    },
    campaigns: rows,
    spend_by_niche: [...spendByNiche.entries()].map(([niche, amount]) => ({ niche, amount })).sort((a, b) => b.amount - a.amount),
    activity,
    checkpoint_mix,
    pipeline,
  };
}

export function creatorAnalytics(creatorId: string) {
  const collabs = queryAll<any>(`SELECT col.*, c.title as campaign_title, b.name as brand_name FROM collaborations col JOIN campaigns c ON c.id = col.campaign_id JOIN brands b ON b.id = c.brand_id WHERE col.creator_id = ? ORDER BY col.created_at DESC`, [creatorId]);
  const deliverables = queryAll<any>(`SELECT d.* FROM deliverables d JOIN collaborations col ON col.id = d.collaboration_id WHERE col.creator_id = ?`, [creatorId]).map((d) => ({ ...d, metrics: parseJson<DeliverableMetrics | null>(d.metrics, null) }));
  const reach = sumMetrics(deliverables);
  const earningsByMonth = new Map<string, number>();
  for (const l of queryAll<any>(`SELECT amount, created_at FROM ledger_entries WHERE credit_account = ?`, [`creator:${creatorId}:wallet`])) {
    const k = l.created_at.slice(0, 7);
    earningsByMonth.set(k, (earningsByMonth.get(k) ?? 0) + l.amount);
  }
  return {
    reach,
    offers: { total: collabs.length, accepted: collabs.filter((c) => !['OFFERED', 'COUNTERED', 'DECLINED', 'CANCELLED'].includes(c.status)).length, declined: collabs.filter((c) => c.status === 'DECLINED').length, open: collabs.filter((c) => ['OFFERED', 'COUNTERED'].includes(c.status)).length },
    earnings_by_month: [...earningsByMonth.entries()].map(([month, amount]) => ({ month, amount })).sort((a, b) => a.month.localeCompare(b.month)),
    recent: collabs.slice(0, 8),
  };
}
