import { queryAll, queryOne, execute, parseJson, transaction, nowIso } from '../db/database';
import { newId, notFound, CoreError } from './ids';
import { holdEscrow, refundEscrow, collaborationEscrow, campaignFinancials } from './ledger';
import { getCreator } from './marketplace';
import { getCampaign } from './campaigns';
import type { ActorType } from './audit';
import { bus } from '../realtime/events';
import { notify, notifyCampaignOwners } from './notifications';

export type CollaborationStatus = 'OFFERED' | 'COUNTERED' | 'ACCEPTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'COMPLETED' | 'DECLINED' | 'CANCELLED';
export type DeliverableStatus = 'PENDING' | 'SUBMITTED' | 'CHANGES_REQUESTED' | 'APPROVED' | 'PAID';

export const DELIVERABLE_TYPES: Record<string, { label: string; platform: string; rateKey: 'rate_post' | 'rate_reel' | 'rate_video' | 'rate_story' }> = {
  POST: { label: 'Instagram Post', platform: 'instagram', rateKey: 'rate_post' },
  REEL: { label: 'Instagram Reel', platform: 'instagram', rateKey: 'rate_reel' },
  STORY: { label: 'Instagram Story', platform: 'instagram', rateKey: 'rate_story' },
  YOUTUBE_VIDEO: { label: 'YouTube Video', platform: 'youtube', rateKey: 'rate_video' },
  YOUTUBE_SHORT: { label: 'YouTube Short', platform: 'youtube', rateKey: 'rate_reel' },
  TIKTOK_VIDEO: { label: 'TikTok Video', platform: 'tiktok', rateKey: 'rate_reel' },
};

export function normaliseDeliverableType(raw: string): string {
  const key = raw.toUpperCase().replace(/[^A-Z]/g, '_').replace(/_+/g, '_');
  if (DELIVERABLE_TYPES[key]) return key;
  const s = raw.toLowerCase();
  if (s.includes('short')) return 'YOUTUBE_SHORT';
  if (s.includes('youtube') || s.includes('video review') || s.includes('long-form')) return 'YOUTUBE_VIDEO';
  if (s.includes('tiktok')) return 'TIKTOK_VIDEO';
  if (s.includes('reel')) return 'REEL';
  if (s.includes('story')) return 'STORY';
  return 'POST';
}

export interface Deliverable {
  id: string;
  collaboration_id: string;
  deliverable_type: string;
  platform: string;
  status: DeliverableStatus;
  content_url: string | null;
  caption: string | null;
  compliance: ComplianceReport | null;
  metrics: DeliverableMetrics | null;
  review_notes: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface DeliverableMetrics {
  views: number; likes: number; comments: number; shares: number; saves: number; clicks: number; engagement_rate: number;
}

export interface ComplianceCheck { id: string; label: string; passed: boolean; detail: string }
export interface ComplianceReport { passed: boolean; score: number; checks: ComplianceCheck[]; checked_at: string }

export interface NegotiationMessage {
  id: string; collaboration_id: string; sender_type: string; sender_id: string; sender_name: string;
  kind: 'MESSAGE' | 'OFFER' | 'COUNTER' | 'ACCEPT' | 'DECLINE' | 'SYSTEM'; amount: number | null; body: string; created_at: string;
}

export interface Collaboration {
  id: string;
  campaign_id: string;
  campaign_title?: string;
  brand_id?: string;
  brand_name?: string;
  brand_logo?: string | null;
  creator_id: string;
  creator_name?: string;
  creator_handle?: string;
  creator_avatar?: string | null;
  creator_niche?: string;
  proposed_rate: number;
  agreed_rate: number | null;
  status: CollaborationStatus;
  initiated_by: 'HUMAN' | 'AGENT';
  agent_session_id: string | null;
  terms: string;
  usage_rights: string;
  exclusivity_days: number;
  deadline: string | null;
  created_at: string;
  updated_at: string;
  escrow_held: number;
  deliverables: Deliverable[];
  messages?: NegotiationMessage[];
}

const BASE = `
  SELECT col.*, c.title as campaign_title, c.brand_id, b.name as brand_name, b.logo_url as brand_logo,
         cr.name as creator_name, cr.handle as creator_handle, cr.avatar_url as creator_avatar, cr.primary_niche as creator_niche
  FROM collaborations col
  JOIN campaigns c ON c.id = col.campaign_id
  JOIN brands b ON b.id = c.brand_id
  JOIN creators cr ON cr.id = col.creator_id`;

export function mapDeliverable(r: any): Deliverable {
  return { ...r, compliance: parseJson<ComplianceReport | null>(r.compliance, null), metrics: parseJson<DeliverableMetrics | null>(r.metrics, null) };
}

export function listDeliverables(collaborationId: string): Deliverable[] {
  return queryAll(`SELECT * FROM deliverables WHERE collaboration_id = ? ORDER BY created_at ASC`, [collaborationId]).map(mapDeliverable);
}

export function getDeliverable(id: string): Deliverable {
  const row = queryOne(`SELECT * FROM deliverables WHERE id = ?`, [id]);
  if (!row) throw notFound('Deliverable', id);
  return mapDeliverable(row);
}

export function listMessages(collaborationId: string): NegotiationMessage[] {
  return queryAll(`SELECT * FROM negotiation_messages WHERE collaboration_id = ? ORDER BY created_at ASC`, [collaborationId]);
}

function mapCollab(r: any, withMessages = false): Collaboration {
  return {
    ...r,
    escrow_held: collaborationEscrow(r.id),
    deliverables: listDeliverables(r.id),
    ...(withMessages ? { messages: listMessages(r.id) } : {}),
  };
}

export function getCollaboration(id: string, withMessages = true): Collaboration {
  const row = queryOne(`${BASE} WHERE col.id = ?`, [id]);
  if (!row) throw notFound('Collaboration', id);
  return mapCollab(row, withMessages);
}

export function listCollaborations(filter: { campaign_id?: string; creator_id?: string; brand_id?: string; agency_id?: string; status?: string } = {}): Collaboration[] {
  const where: string[] = [];
  const params: any[] = [];
  if (filter.campaign_id) { where.push('col.campaign_id = ?'); params.push(filter.campaign_id); }
  if (filter.creator_id) { where.push('col.creator_id = ?'); params.push(filter.creator_id); }
  if (filter.brand_id) { where.push('c.brand_id = ?'); params.push(filter.brand_id); }
  if (filter.agency_id) { where.push('(c.agency_id = ? OR c.brand_id IN (SELECT brand_id FROM agency_brands WHERE agency_id = ?))'); params.push(filter.agency_id, filter.agency_id); }
  if (filter.status) { where.push('col.status = ?'); params.push(filter.status); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return queryAll(`${BASE} ${whereSql} ORDER BY col.updated_at DESC`, params).map((r) => mapCollab(r, false));
}

function addMessage(collaborationId: string, m: { sender_type: string; sender_id: string; sender_name?: string; kind: NegotiationMessage['kind']; amount?: number | null; body: string }): NegotiationMessage {
  const id = newId('msg');
  execute(
    `INSERT INTO negotiation_messages (id, collaboration_id, sender_type, sender_id, sender_name, kind, amount, body) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, collaborationId, m.sender_type, m.sender_id, m.sender_name ?? '', m.kind, m.amount ?? null, m.body],
  );
  return queryOne<NegotiationMessage>(`SELECT * FROM negotiation_messages WHERE id = ?`, [id])!;
}

function touch(id: string, status?: CollaborationStatus): void {
  if (status) execute(`UPDATE collaborations SET status = ?, updated_at = ? WHERE id = ?`, [status, nowIso(), id]);
  else execute(`UPDATE collaborations SET updated_at = ? WHERE id = ?`, [nowIso(), id]);
  bus.publish('collaboration.updated', { id, status });
}

// ---------------------------------------------------------------------------
// Offers & negotiation
// ---------------------------------------------------------------------------
export interface OfferInput {
  id?: string;
  /** Override who initiated the offer (used when a human approves an agent-held offer). */
  initiated_by?: 'HUMAN' | 'AGENT';
  campaign_id: string;
  creator_id: string;
  proposed_rate: number;
  deliverables: string[];
  deadline?: string | null;
  terms?: string;
  usage_rights?: string;
  exclusivity_days?: number;
  message?: string;
}

export function sendOffer(input: OfferInput, actor: { type: ActorType; id: string; name?: string; session_id?: string | null }): Collaboration {
  const campaign = getCampaign(input.campaign_id);
  const creator = getCreator(input.creator_id);
  if (!(input.proposed_rate > 0)) throw new CoreError('Proposed rate must be greater than zero.');
  if (!input.deliverables?.length) throw new CoreError('At least one deliverable is required.');
  if (campaign.status === 'COMPLETED' || campaign.status === 'ARCHIVED') throw new CoreError(`Campaign is ${campaign.status.toLowerCase()}; offers are closed.`, 409, 'CAMPAIGN_CLOSED');
  if (!creator.available) throw new CoreError(`@${creator.handle} is not currently accepting offers.`, 409, 'CREATOR_UNAVAILABLE');
  const open = queryOne(`SELECT id FROM collaborations WHERE campaign_id = ? AND creator_id = ? AND status NOT IN ('DECLINED','CANCELLED','COMPLETED')`, [campaign.id, creator.id]);
  if (open) throw new CoreError(`@${creator.handle} already has an open collaboration on this campaign (${(open as any).id}).`, 409, 'DUPLICATE_OFFER');

  return transaction(() => {
    const id = input.id ?? newId('collab');
    const terms = input.terms?.trim() || `${input.deliverables.length} deliverable(s) for "${campaign.title}". Content must follow the campaign guidelines and carry clear sponsorship disclosure.`;
    execute(
      `INSERT INTO collaborations (id, campaign_id, creator_id, proposed_rate, agreed_rate, status, initiated_by, agent_session_id, terms, usage_rights, exclusivity_days, deadline)
       VALUES (?, ?, ?, ?, NULL, 'OFFERED', ?, ?, ?, ?, ?, ?)`,
      [id, campaign.id, creator.id, input.proposed_rate, input.initiated_by ?? (actor.type === 'AGENT' ? 'AGENT' : 'HUMAN'), actor.session_id ?? null, terms, input.usage_rights ?? 'Organic social usage, 90 days', input.exclusivity_days ?? 0, input.deadline ?? null],
    );
    for (const raw of input.deliverables) {
      const type = normaliseDeliverableType(raw);
      execute(`INSERT INTO deliverables (id, collaboration_id, deliverable_type, platform, status) VALUES (?, ?, ?, ?, 'PENDING')`, [newId('deliv'), id, type, DELIVERABLE_TYPES[type].platform]);
    }
    holdEscrow({ campaign_id: campaign.id, collaboration_id: id, amount: input.proposed_rate, actor_type: actor.type, actor_id: actor.id, note: `Escrow hold for offer to @${creator.handle}` });
    addMessage(id, { sender_type: actor.type === 'AGENT' ? 'AGENT' : 'BRAND', sender_id: actor.id, sender_name: actor.name ?? (actor.type === 'AGENT' ? 'AI Agent' : campaign.brand_name ?? 'Brand'), kind: 'OFFER', amount: input.proposed_rate, body: input.message?.trim() || `Offer of $${input.proposed_rate.toLocaleString()} for ${input.deliverables.join(', ')}${input.deadline ? `, due ${input.deadline}` : ''}.` });
    notify({ audience: 'CREATOR', audience_id: creator.id, kind: 'OFFER', title: `New offer from ${campaign.brand_name}`, body: `$${input.proposed_rate.toLocaleString()} for "${campaign.title}"`, link: `/creator/offers/${id}` });
    touch(id);
    return getCollaboration(id);
  });
}

export function counterOffer(id: string, amount: number, message: string | undefined, actor: { type: 'CREATOR' | 'BRAND' | 'AGENT'; id: string; name?: string }): Collaboration {
  const col = getCollaboration(id, false);
  if (!['OFFERED', 'COUNTERED'].includes(col.status)) throw new CoreError(`Cannot counter a collaboration in status ${col.status}.`, 409, 'INVALID_STATE');
  if (!(amount > 0)) throw new CoreError('Counter amount must be greater than zero.');
  return transaction(() => {
    execute(`UPDATE collaborations SET proposed_rate = ?, status = 'COUNTERED', updated_at = ? WHERE id = ?`, [amount, nowIso(), id]);
    // Re-balance escrow to the latest proposed figure so the campaign never over- or under-reserves.
    const held = collaborationEscrow(id);
    if (amount > held) {
      holdEscrow({ campaign_id: col.campaign_id, collaboration_id: id, amount: amount - held, actor_type: actor.type === 'AGENT' ? 'AGENT' : 'HUMAN', actor_id: actor.id, note: 'Escrow topped up to match counter-offer' });
    } else if (amount < held) {
      refundEscrow({ campaign_id: col.campaign_id, collaboration_id: id, amount: held - amount, actor_type: actor.type === 'AGENT' ? 'AGENT' : 'HUMAN', actor_id: actor.id, note: 'Escrow reduced to match counter-offer' });
    }
    addMessage(id, { sender_type: actor.type, sender_id: actor.id, sender_name: actor.name, kind: 'COUNTER', amount, body: message?.trim() || `Counter-offer: $${amount.toLocaleString()}` });
    if (actor.type === 'CREATOR') notifyCampaignOwners(col.campaign_id, { kind: 'OFFER', title: `@${col.creator_handle} countered at $${amount.toLocaleString()}`, body: `"${col.campaign_title}"`, link: `/collaborations/${id}` });
    else notify({ audience: 'CREATOR', audience_id: col.creator_id, kind: 'OFFER', title: `${col.brand_name} countered at $${amount.toLocaleString()}`, body: `"${col.campaign_title}"`, link: `/creator/offers/${id}` });
    bus.publish('collaboration.updated', { id, status: 'COUNTERED' });
    return getCollaboration(id);
  });
}

export function acceptOffer(id: string, actor: { type: 'CREATOR' | 'BRAND' | 'AGENT'; id: string; name?: string }, message?: string): Collaboration {
  const col = getCollaboration(id, false);
  if (!['OFFERED', 'COUNTERED'].includes(col.status)) throw new CoreError(`Cannot accept a collaboration in status ${col.status}.`, 409, 'INVALID_STATE');
  return transaction(() => {
    execute(`UPDATE collaborations SET agreed_rate = proposed_rate, status = 'ACCEPTED', updated_at = ? WHERE id = ?`, [nowIso(), id]);
    addMessage(id, { sender_type: actor.type, sender_id: actor.id, sender_name: actor.name, kind: 'ACCEPT', amount: col.proposed_rate, body: message?.trim() || `Accepted at $${col.proposed_rate.toLocaleString()}. Agreement is now in effect and funds are secured in escrow.` });
    if (actor.type === 'CREATOR') notifyCampaignOwners(col.campaign_id, { kind: 'OFFER', title: `@${col.creator_handle} accepted your offer`, body: `$${col.proposed_rate.toLocaleString()} for "${col.campaign_title}"`, link: `/collaborations/${id}` });
    else notify({ audience: 'CREATOR', audience_id: col.creator_id, kind: 'OFFER', title: `${col.brand_name} accepted your counter`, body: `$${col.proposed_rate.toLocaleString()} for "${col.campaign_title}"`, link: `/creator/offers/${id}` });
    bus.publish('collaboration.updated', { id, status: 'ACCEPTED' });
    return getCollaboration(id);
  });
}

export function declineOffer(id: string, actor: { type: 'CREATOR' | 'BRAND' | 'AGENT'; id: string; name?: string }, reason?: string): Collaboration {
  const col = getCollaboration(id, false);
  if (!['OFFERED', 'COUNTERED', 'ACCEPTED'].includes(col.status)) throw new CoreError(`Cannot decline a collaboration in status ${col.status}.`, 409, 'INVALID_STATE');
  return transaction(() => {
    const status: CollaborationStatus = actor.type === 'CREATOR' ? 'DECLINED' : 'CANCELLED';
    execute(`UPDATE collaborations SET status = ?, updated_at = ? WHERE id = ?`, [status, nowIso(), id]);
    refundEscrow({ campaign_id: col.campaign_id, collaboration_id: id, actor_type: actor.type === 'AGENT' ? 'AGENT' : 'HUMAN', actor_id: actor.id, note: `Escrow released back to campaign: offer ${status.toLowerCase()}` });
    addMessage(id, { sender_type: actor.type, sender_id: actor.id, sender_name: actor.name, kind: 'DECLINE', body: reason?.trim() || (status === 'DECLINED' ? 'Offer declined.' : 'Offer withdrawn.') });
    if (actor.type === 'CREATOR') notifyCampaignOwners(col.campaign_id, { kind: 'OFFER', title: `@${col.creator_handle} declined`, body: reason ?? `"${col.campaign_title}"`, link: `/collaborations/${id}` });
    else notify({ audience: 'CREATOR', audience_id: col.creator_id, kind: 'OFFER', title: `${col.brand_name} withdrew their offer`, body: `"${col.campaign_title}"`, link: `/creator/offers/${id}` });
    bus.publish('collaboration.updated', { id, status });
    return getCollaboration(id);
  });
}

export function postMessage(id: string, body: string, actor: { type: 'CREATOR' | 'BRAND' | 'AGENCY' | 'AGENT'; id: string; name?: string }): NegotiationMessage {
  getCollaboration(id, false);
  if (!body?.trim()) throw new CoreError('Message body is required.');
  const m = addMessage(id, { sender_type: actor.type, sender_id: actor.id, sender_name: actor.name, kind: 'MESSAGE', body: body.trim() });
  touch(id);
  return m;
}

// ---------------------------------------------------------------------------
// Deliverables, compliance & review
// ---------------------------------------------------------------------------
const DISCLOSURE_RX = /#(ad|sponsored|paid|paidpartnership|partner|gifted)\b|paid partnership|sponsored by|in partnership with/i;

export function runComplianceCheck(args: { caption: string; content_url: string; campaign: { content_guidelines: string; title: string; brand_name?: string }; deliverable_type: string }): ComplianceReport {
  const caption = args.caption ?? '';
  const url = args.content_url ?? '';
  const checks: ComplianceCheck[] = [];

  const disclosure = DISCLOSURE_RX.test(caption);
  checks.push({ id: 'disclosure', label: 'Sponsorship disclosure present', passed: disclosure, detail: disclosure ? 'Found a recognised disclosure tag (#ad / paid partnership).' : 'No #ad, #sponsored or "paid partnership" disclosure detected in the caption.' });

  const disclosureEarly = disclosure && (caption.slice(0, 180).match(DISCLOSURE_RX) !== null);
  checks.push({ id: 'disclosure_placement', label: 'Disclosure is above the fold', passed: disclosureEarly, detail: disclosureEarly ? 'Disclosure appears within the first 180 characters.' : 'Disclosure should appear before the "more" truncation point.' });

  const urlOk = /^https?:\/\/(www\.)?(instagram\.com|youtube\.com|youtu\.be|tiktok\.com)\//i.test(url);
  checks.push({ id: 'url', label: 'Live URL on a supported platform', passed: urlOk, detail: urlOk ? 'URL points at Instagram, YouTube or TikTok.' : 'URL must be a public Instagram, YouTube or TikTok link.' });

  const expectedPlatform = DELIVERABLE_TYPES[args.deliverable_type]?.platform ?? 'instagram';
  const platformOk = url.toLowerCase().includes(expectedPlatform === 'youtube' ? 'youtu' : expectedPlatform);
  checks.push({ id: 'platform', label: `Published on ${expectedPlatform}`, passed: platformOk, detail: platformOk ? 'Platform matches the agreed deliverable.' : `Agreed deliverable is for ${expectedPlatform}, but the URL points elsewhere.` });

  // Required mentions pulled out of guidelines: hashtags, @handles and discount codes
  const required = [...(args.campaign.content_guidelines.match(/#[A-Za-z0-9_]+|@[A-Za-z0-9_.]+|\b[A-Z0-9]{4,}\d+\b/g) ?? [])].filter((x, i, a) => a.indexOf(x) === i).slice(0, 6);
  const missing = required.filter((r) => !caption.toLowerCase().includes(r.toLowerCase()));
  checks.push({ id: 'required_mentions', label: 'Required tags, handles and codes', passed: missing.length === 0, detail: required.length === 0 ? 'No mandatory tags specified in the brief.' : missing.length === 0 ? `All ${required.length} required mentions present (${required.join(', ')}).` : `Missing: ${missing.join(', ')}` });

  const lengthOk = caption.trim().length >= 40;
  checks.push({ id: 'caption_length', label: 'Caption has substantive copy', passed: lengthOk, detail: lengthOk ? `${caption.trim().length} characters.` : 'Caption is too short to carry the key messages.' });

  const passedCount = checks.filter((c) => c.passed).length;
  const score = Math.round((passedCount / checks.length) * 100);
  // Disclosure + URL are hard requirements; everything else is advisory.
  const passed = disclosure && urlOk && platformOk;
  return { passed, score, checks, checked_at: nowIso() };
}

/** Deterministic but plausible "fetched" performance metrics for a deliverable. */
export function synthesiseMetrics(creator: { follower_count: number; engagement_rate: number; avg_views: number }, type: string, seed: string): DeliverableMetrics {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = (min: number, max: number) => { h = (h * 1664525 + 1013904223) >>> 0; return min + (h / 2 ** 32) * (max - min); };
  const base = creator.avg_views || creator.follower_count * 0.25;
  const mult = type === 'STORY' ? 0.35 : type === 'YOUTUBE_VIDEO' ? 0.55 : type === 'TIKTOK_VIDEO' || type === 'REEL' || type === 'YOUTUBE_SHORT' ? 1.4 : 0.8;
  const views = Math.round(base * mult * rnd(0.75, 1.35));
  const er = creator.engagement_rate * rnd(0.8, 1.25);
  const interactions = Math.round(views * (er / 100));
  const likes = Math.round(interactions * 0.78);
  const comments = Math.round(interactions * 0.07);
  const shares = Math.round(interactions * 0.09);
  const saves = Math.round(interactions * 0.06);
  const clicks = Math.round(views * rnd(0.008, 0.025));
  return { views, likes, comments, shares, saves, clicks, engagement_rate: Math.round(er * 100) / 100 };
}

export function submitDeliverable(deliverableId: string, input: { content_url: string; caption?: string; metrics?: Partial<DeliverableMetrics> }, actor: { type: ActorType; id: string; name?: string }): { deliverable: Deliverable; collaboration: Collaboration } {
  const d = getDeliverable(deliverableId);
  const col = getCollaboration(d.collaboration_id, false);
  if (!['ACCEPTED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED'].includes(col.status)) throw new CoreError(`Deliverables can only be submitted after the offer is accepted (current status ${col.status}).`, 409, 'INVALID_STATE');
  if (d.status === 'PAID') throw new CoreError('This deliverable has already been paid out.', 409, 'INVALID_STATE');
  if (!input.content_url?.trim()) throw new CoreError('A live content URL is required.');
  const campaign = getCampaign(col.campaign_id);
  const creator = getCreator(col.creator_id);
  const compliance = runComplianceCheck({ caption: input.caption ?? '', content_url: input.content_url, campaign: { content_guidelines: campaign.content_guidelines, title: campaign.title, brand_name: campaign.brand_name }, deliverable_type: d.deliverable_type });
  const metrics: DeliverableMetrics = { ...synthesiseMetrics(creator, d.deliverable_type, deliverableId + input.content_url), ...(input.metrics ?? {}) } as DeliverableMetrics;

  return transaction(() => {
    execute(
      `UPDATE deliverables SET status = 'SUBMITTED', content_url = ?, caption = ?, compliance = ?, metrics = ?, submitted_at = ?, review_notes = NULL WHERE id = ?`,
      [input.content_url.trim(), input.caption ?? '', JSON.stringify(compliance), JSON.stringify(metrics), nowIso(), deliverableId],
    );
    touch(col.id, 'SUBMITTED');
    addMessage(col.id, { sender_type: actor.type === 'AGENT' ? 'AGENT' : 'CREATOR', sender_id: actor.id, sender_name: actor.name, kind: 'SYSTEM', body: `${DELIVERABLE_TYPES[d.deliverable_type]?.label ?? d.deliverable_type} submitted for review${compliance.passed ? ' — compliance checks passed.' : ' — compliance issues flagged.'}` });
    notifyCampaignOwners(col.campaign_id, { kind: 'DELIVERABLE', title: `@${creator.handle} submitted content`, body: `${DELIVERABLE_TYPES[d.deliverable_type]?.label} for "${campaign.title}" · compliance ${compliance.score}%`, link: `/collaborations/${col.id}` });
    bus.publish('deliverable.updated', { id: deliverableId, collaboration_id: col.id, status: 'SUBMITTED' });
    return { deliverable: getDeliverable(deliverableId), collaboration: getCollaboration(col.id) };
  });
}

export function reviewDeliverable(deliverableId: string, decision: 'APPROVED' | 'CHANGES_REQUESTED', notes: string | undefined, actor: { type: ActorType; id: string; name?: string }): { deliverable: Deliverable; collaboration: Collaboration } {
  const d = getDeliverable(deliverableId);
  if (d.status !== 'SUBMITTED') throw new CoreError(`Only submitted deliverables can be reviewed (current status ${d.status}).`, 409, 'INVALID_STATE');
  const col = getCollaboration(d.collaboration_id, false);
  return transaction(() => {
    execute(`UPDATE deliverables SET status = ?, review_notes = ?, approved_at = ? WHERE id = ?`, [decision, notes ?? null, decision === 'APPROVED' ? nowIso() : null, deliverableId]);
    const all = listDeliverables(col.id);
    const allApproved = all.every((x) => x.status === 'APPROVED' || x.status === 'PAID');
    touch(col.id, decision === 'APPROVED' ? (allApproved ? 'APPROVED' : 'IN_PROGRESS') : 'IN_PROGRESS');
    addMessage(col.id, { sender_type: actor.type === 'AGENT' ? 'AGENT' : 'BRAND', sender_id: actor.id, sender_name: actor.name, kind: 'SYSTEM', body: decision === 'APPROVED' ? `${DELIVERABLE_TYPES[d.deliverable_type]?.label} approved.${notes ? ` ${notes}` : ''}` : `Changes requested on ${DELIVERABLE_TYPES[d.deliverable_type]?.label}: ${notes ?? 'see review notes'}` });
    notify({ audience: 'CREATOR', audience_id: col.creator_id, kind: 'DELIVERABLE', title: decision === 'APPROVED' ? 'Content approved' : 'Changes requested', body: `${DELIVERABLE_TYPES[d.deliverable_type]?.label} for "${col.campaign_title}"${notes ? `: ${notes}` : ''}`, link: `/creator/offers/${col.id}` });
    bus.publish('deliverable.updated', { id: deliverableId, collaboration_id: col.id, status: decision });
    return { deliverable: getDeliverable(deliverableId), collaboration: getCollaboration(col.id) };
  });
}

export function markDeliverablePaid(deliverableId: string): void {
  execute(`UPDATE deliverables SET status = 'PAID', paid_at = ? WHERE id = ?`, [nowIso(), deliverableId]);
}

export function startWork(id: string, actor: { type: 'CREATOR'; id: string; name?: string }): Collaboration {
  const col = getCollaboration(id, false);
  if (col.status !== 'ACCEPTED') throw new CoreError(`Collaboration must be ACCEPTED to start work (current ${col.status}).`, 409, 'INVALID_STATE');
  touch(id, 'IN_PROGRESS');
  addMessage(id, { sender_type: 'CREATOR', sender_id: actor.id, sender_name: actor.name, kind: 'SYSTEM', body: 'Creator started production.' });
  return getCollaboration(id);
}

export function campaignBudgetSnapshot(campaignId: string) {
  return campaignFinancials(campaignId);
}
