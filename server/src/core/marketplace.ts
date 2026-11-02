import { queryAll, queryOne, parseJson } from '../db/database';
import { notFound } from './ids';

export interface PlatformStat {
  platform: string;
  handle: string;
  followers: number;
  engagement_rate: number;
  avg_views: number;
}

export interface Audience {
  countries: { name: string; pct: number }[];
  ages: { range: string; pct: number }[];
  gender: { female: number; male: number; other: number };
}

export interface Creator {
  id: string;
  name: string;
  handle: string;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  location: string | null;
  primary_niche: string;
  secondary_niches: string[];
  platforms: string[];
  platform_stats: PlatformStat[];
  audience: Audience;
  portfolio: { title: string; platform: string; url: string; views: number; brand?: string }[];
  content_tags: string[];
  follower_count: number;
  engagement_rate: number;
  avg_views: number;
  rate_post: number;
  rate_reel: number;
  rate_video: number;
  rate_story: number;
  verified: number;
  rating: number;
  completed_campaigns: number;
  response_time_hours: number;
  wallet_balance: number;
  available: number;
  created_at: string;
}

export function mapCreator(r: any): Creator {
  return {
    ...r,
    secondary_niches: parseJson<string[]>(r.secondary_niches, []),
    platforms: parseJson<string[]>(r.platforms, []),
    platform_stats: parseJson<PlatformStat[]>(r.platform_stats, []),
    audience: parseJson<Audience>(r.audience, { countries: [], ages: [], gender: { female: 50, male: 50, other: 0 } }),
    portfolio: parseJson(r.portfolio, []),
    content_tags: parseJson<string[]>(r.content_tags, []),
  };
}

export function getCreator(id: string): Creator {
  const row = queryOne(`SELECT * FROM creators WHERE id = ? OR handle = ?`, [id, id.replace(/^@/, '')]);
  if (!row) throw notFound('Creator', id);
  return mapCreator(row);
}

export function listCreators(): Creator[] {
  return queryAll(`SELECT * FROM creators ORDER BY follower_count DESC`).map(mapCreator);
}

export interface SearchParams {
  query?: string;
  niche?: string;
  platform?: string;
  min_followers?: number;
  max_followers?: number;
  min_engagement?: number;
  max_rate?: number;
  rate_type?: 'post' | 'reel' | 'video' | 'story';
  country?: string;
  verified_only?: boolean;
  tags?: string[];
  sort?: 'relevance' | 'followers' | 'engagement' | 'rate_asc' | 'rate_desc' | 'rating';
  limit?: number;
  campaign_id?: string;
}

export interface MatchBreakdown {
  niche: number;
  audience: number;
  performance: number;
  budget_fit: number;
  reliability: number;
}

export interface ScoredCreator extends Creator {
  match_score: number;
  match_breakdown: MatchBreakdown;
  match_reasons: string[];
}

function rateFor(c: Creator, type: SearchParams['rate_type'] = 'video'): number {
  switch (type) {
    case 'post': return c.rate_post;
    case 'reel': return c.rate_reel;
    case 'story': return c.rate_story;
    default: return c.rate_video;
  }
}

/**
 * Predictive creator ↔ campaign fit (paper §13: beyond filter-based search).
 * Weighted 0–100 score across five dimensions with human-readable reasons.
 */
export function scoreCreatorForCampaign(c: Creator, campaign: { target_niches: string[]; target_platforms: string[]; target_audience: string; rate_band_min: number | null; rate_band_max: number | null; budget: number } | null, p: SearchParams = {}): { score: number; breakdown: MatchBreakdown; reasons: string[] } {
  const reasons: string[] = [];
  const niches = (campaign?.target_niches ?? (p.niche ? [p.niche] : [])).map((n) => n.toLowerCase());
  const creatorNiches = [c.primary_niche, ...c.secondary_niches].map((n) => n.toLowerCase());

  // Niche fit (0-100)
  let niche = 35;
  if (niches.length === 0) niche = 70;
  else if (niches.some((n) => c.primary_niche.toLowerCase().includes(n) || n.includes(c.primary_niche.toLowerCase()))) {
    niche = 100;
    reasons.push(`Primary niche ${c.primary_niche} matches the brief`);
  } else if (niches.some((n) => creatorNiches.some((cn) => cn.includes(n) || n.includes(cn)))) {
    niche = 75;
    reasons.push(`Secondary niche overlap with the brief`);
  }

  // Audience fit: platform + country + age heuristics
  let audience = 60;
  const platforms = (campaign?.target_platforms ?? (p.platform ? [p.platform] : [])).map((x) => x.toLowerCase());
  if (platforms.length) {
    const hits = platforms.filter((pl) => c.platforms.includes(pl)).length;
    audience = hits === platforms.length ? 95 : hits > 0 ? 75 : 30;
    if (hits === platforms.length) reasons.push(`Active on every target platform (${platforms.join(', ')})`);
  }
  const ta = (campaign?.target_audience ?? '').toLowerCase();
  const topCountry = c.audience.countries[0];
  if (ta && topCountry && ta.includes(topCountry.name.toLowerCase().split(' ')[0])) {
    audience = Math.min(100, audience + 5);
    reasons.push(`${topCountry.pct}% of audience in ${topCountry.name}`);
  }
  if (p.country && topCountry && topCountry.name.toLowerCase().includes(p.country.toLowerCase())) audience = Math.min(100, audience + 5);

  // Performance: engagement relative to follower tier
  const tierBaseline = c.follower_count > 1_000_000 ? 1.8 : c.follower_count > 300_000 ? 2.8 : c.follower_count > 100_000 ? 3.6 : 4.5;
  const performance = Math.max(10, Math.min(100, Math.round((c.engagement_rate / tierBaseline) * 70)));
  if (c.engagement_rate >= tierBaseline * 1.3) reasons.push(`Engagement ${c.engagement_rate}% is well above the ${c.follower_count > 300_000 ? 'macro' : 'mid-tier'} baseline`);

  // Budget fit: rate vs band / max_rate
  let budget_fit = 70;
  const rate = rateFor(c, p.rate_type);
  const bandMax = p.max_rate ?? campaign?.rate_band_max ?? null;
  const bandMin = campaign?.rate_band_min ?? null;
  if (bandMax != null) {
    if (rate <= bandMax) {
      budget_fit = bandMin != null && rate < bandMin ? 80 : 100;
      reasons.push(`Rate $${rate.toLocaleString()} sits inside the approved band`);
    } else {
      const over = (rate - bandMax) / bandMax;
      budget_fit = Math.max(5, Math.round(100 - over * 160));
      if (over > 0.1) reasons.push(`Rate is ${Math.round(over * 100)}% above the approved ceiling`);
    }
  }

  // Reliability
  const reliability = Math.min(100, Math.round(c.rating * 14 + Math.min(c.completed_campaigns, 20) * 1.5 + (c.verified ? 5 : 0) - Math.min(c.response_time_hours, 48) * 0.3));
  if (c.completed_campaigns >= 12 && c.rating >= 4.8) reasons.push(`${c.completed_campaigns} completed campaigns at ${c.rating}★`);

  const breakdown: MatchBreakdown = { niche, audience, performance, budget_fit, reliability };
  const score = Math.round(niche * 0.32 + audience * 0.18 + performance * 0.2 + budget_fit * 0.18 + reliability * 0.12);
  return { score, breakdown, reasons: reasons.slice(0, 4) };
}

export function searchCreators(p: SearchParams = {}): ScoredCreator[] {
  const where: string[] = [];
  const params: any[] = [];
  if (p.niche) {
    where.push(`(LOWER(primary_niche) LIKE ? OR LOWER(secondary_niches) LIKE ?)`);
    const s = `%${p.niche.toLowerCase()}%`;
    params.push(s, s);
  }
  if (p.platform) { where.push(`LOWER(platforms) LIKE ?`); params.push(`%${p.platform.toLowerCase()}%`); }
  if (p.min_followers) { where.push(`follower_count >= ?`); params.push(p.min_followers); }
  if (p.max_followers) { where.push(`follower_count <= ?`); params.push(p.max_followers); }
  if (p.min_engagement) { where.push(`engagement_rate >= ?`); params.push(p.min_engagement); }
  if (p.max_rate) {
    const col = p.rate_type === 'post' ? 'rate_post' : p.rate_type === 'reel' ? 'rate_reel' : p.rate_type === 'story' ? 'rate_story' : 'rate_video';
    where.push(`${col} <= ?`); params.push(p.max_rate);
  }
  if (p.verified_only) where.push(`verified = 1`);
  if (p.country) { where.push(`LOWER(audience) LIKE ?`); params.push(`%${p.country.toLowerCase()}%`); }
  if (p.query) {
    where.push(`(LOWER(name) LIKE ? OR LOWER(handle) LIKE ? OR LOWER(bio) LIKE ? OR LOWER(primary_niche) LIKE ? OR LOWER(content_tags) LIKE ?)`);
    const s = `%${p.query.toLowerCase()}%`;
    params.push(s, s, s, s, s);
  }
  if (p.tags?.length) {
    for (const t of p.tags) { where.push(`LOWER(content_tags) LIKE ?`); params.push(`%${t.toLowerCase()}%`); }
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = queryAll(`SELECT * FROM creators ${whereSql}`, params).map(mapCreator);

  const campaign = p.campaign_id ? getCampaignTargeting(p.campaign_id) : null;
  const scored: ScoredCreator[] = rows.map((c) => {
    const s = scoreCreatorForCampaign(c, campaign, p);
    return { ...c, match_score: s.score, match_breakdown: s.breakdown, match_reasons: s.reasons };
  });

  const sort = p.sort ?? 'relevance';
  scored.sort((a, b) => {
    switch (sort) {
      case 'followers': return b.follower_count - a.follower_count;
      case 'engagement': return b.engagement_rate - a.engagement_rate;
      case 'rate_asc': return rateFor(a, p.rate_type) - rateFor(b, p.rate_type);
      case 'rate_desc': return rateFor(b, p.rate_type) - rateFor(a, p.rate_type);
      case 'rating': return b.rating - a.rating;
      default: return b.match_score - a.match_score || b.engagement_rate - a.engagement_rate;
    }
  });
  return scored.slice(0, Math.min(p.limit ?? 50, 200));
}

function getCampaignTargeting(campaignId: string) {
  const c = queryOne<any>(`SELECT target_niches, target_platforms, target_audience, rate_band_min, rate_band_max, budget FROM campaigns WHERE id = ?`, [campaignId]);
  if (!c) return null;
  return {
    target_niches: parseJson<string[]>(c.target_niches, []),
    target_platforms: parseJson<string[]>(c.target_platforms, []),
    target_audience: c.target_audience ?? '',
    rate_band_min: c.rate_band_min,
    rate_band_max: c.rate_band_max,
    budget: c.budget,
  };
}

/** Creator-facing rate benchmarking (paper §5.2): where does a rate sit among peers? */
export function rateBenchmark(args: { niche?: string; follower_count: number; deliverable: 'post' | 'reel' | 'video' | 'story' }): {
  sample_size: number; p25: number; median: number; p75: number; suggested: number; tier: string;
} {
  const lo = args.follower_count * 0.4;
  const hi = args.follower_count * 2.5;
  const col = `rate_${args.deliverable}`;
  const where: string[] = [`follower_count BETWEEN ? AND ?`];
  const params: any[] = [lo, hi];
  if (args.niche) { where.push(`(LOWER(primary_niche) LIKE ? OR LOWER(secondary_niches) LIKE ?)`); params.push(`%${args.niche.toLowerCase()}%`, `%${args.niche.toLowerCase()}%`); }
  let rates = queryAll<{ r: number }>(`SELECT ${col} as r FROM creators WHERE ${where.join(' AND ')} ORDER BY r`, params).map((x) => x.r);
  if (rates.length < 3) rates = queryAll<{ r: number }>(`SELECT ${col} as r FROM creators WHERE follower_count BETWEEN ? AND ? ORDER BY r`, [lo, hi]).map((x) => x.r);
  if (rates.length < 3) rates = queryAll<{ r: number }>(`SELECT ${col} as r FROM creators ORDER BY r`).map((x) => x.r);
  const q = (p: number) => rates[Math.min(rates.length - 1, Math.floor(p * (rates.length - 1)))] ?? 0;
  const tier = args.follower_count >= 1_000_000 ? 'Mega' : args.follower_count >= 500_000 ? 'Macro' : args.follower_count >= 100_000 ? 'Mid-tier' : args.follower_count >= 10_000 ? 'Micro' : 'Nano';
  return { sample_size: rates.length, p25: q(0.25), median: q(0.5), p75: q(0.75), suggested: Math.round(q(0.5) / 25) * 25, tier };
}

export const NICHES = [
  'Tech & Gadgets', 'Beauty & Skincare', 'Fitness & Apparel', 'Lifestyle & Travel', 'Gaming', 'Food & Cooking',
  'Finance & Investing', 'Parenting & Family', 'Home & Interior', 'Fashion', 'Outdoors & Adventure', 'Education',
];
