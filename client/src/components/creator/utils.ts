import type { Collaboration, CollaborationStatus, Creator, Deliverable, LedgerEntry, NegotiationMessage } from '@/types';
import { toDate, timeAgo } from '@/lib/utils';

export type BenchmarkKey = 'post' | 'reel' | 'video' | 'story';

/** Deliverable type → the rate-card / benchmark bucket it is priced from (mirrors server DELIVERABLE_TYPES.rateKey). */
export function benchmarkKeyFor(type: string): BenchmarkKey {
  switch (type) {
    case 'POST': return 'post';
    case 'STORY': return 'story';
    case 'YOUTUBE_VIDEO': return 'video';
    default: return 'reel'; // REEL, YOUTUBE_SHORT, TIKTOK_VIDEO
  }
}

export const RATE_FIELDS: { key: BenchmarkKey; field: 'rate_post' | 'rate_reel' | 'rate_video' | 'rate_story'; label: string; hint: string }[] = [
  { key: 'post', field: 'rate_post', label: 'Instagram post', hint: 'Static feed post' },
  { key: 'reel', field: 'rate_reel', label: 'Reel / short video', hint: 'Reels, Shorts and TikTok' },
  { key: 'video', field: 'rate_video', label: 'YouTube video', hint: 'Long-form, integrated or dedicated' },
  { key: 'story', field: 'rate_story', label: 'Story', hint: 'Per story frame set' },
];

/** The most relevant benchmark bucket for an offer: the first non-story deliverable, else story. */
export function primaryBenchmarkKey(deliverables: Deliverable[]): BenchmarkKey {
  const keys = deliverables.map((d) => benchmarkKeyFor(d.deliverable_type));
  return keys.find((k) => k === 'video') ?? keys.find((k) => k === 'reel') ?? keys.find((k) => k === 'post') ?? keys[0] ?? 'post';
}

export function rateFor(creator: Pick<Creator, 'rate_post' | 'rate_reel' | 'rate_video' | 'rate_story'>, key: BenchmarkKey): number {
  return creator[`rate_${key}`];
}

export const INBOX_STATUSES: CollaborationStatus[] = ['OFFERED', 'COUNTERED'];
export const ACTIVE_STATUSES: CollaborationStatus[] = ['ACCEPTED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED'];
export const CLOSED_STATUSES: CollaborationStatus[] = ['COMPLETED', 'DECLINED', 'CANCELLED'];

export const isInbox = (c: Collaboration) => INBOX_STATUSES.includes(c.status);
export const isActive = (c: Collaboration) => ACTIVE_STATUSES.includes(c.status);
export const isClosed = (c: Collaboration) => CLOSED_STATUSES.includes(c.status);

/** The rate that matters to the creator right now: agreed once accepted, otherwise the latest proposal. */
export const currentRate = (c: Collaboration) => c.agreed_rate ?? c.proposed_rate;

export function deadlineInfo(deadline: string | null | undefined): { label: string; past: boolean; soon: boolean } | null {
  const d = toDate(deadline);
  if (!d) return null;
  const ms = d.getTime() - Date.now();
  return { label: timeAgo(d), past: ms < 0, soon: ms >= 0 && ms < 3 * 86_400_000 };
}

export function lastCounter(c: Collaboration): NegotiationMessage | null {
  const msgs = c.messages ?? [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i]!;
    if (m.kind === 'COUNTER') return m;
    if (m.kind === 'ACCEPT' || m.kind === 'DECLINE') return null;
  }
  return null;
}

/** True when the ball is in the creator's court on an open offer. */
export function creatorCanRespond(c: Collaboration): boolean {
  if (c.status === 'OFFERED') return true;
  if (c.status !== 'COUNTERED') return false;
  const last = lastCounter(c);
  // Without the message thread (list view) we cannot know; assume the brand countered.
  return !last || last.sender_type !== 'CREATOR';
}

/** Hashtags, @handles and discount codes the brief demands — same regex the server's compliance check uses. */
export function extractMustInclude(guidelines: string | null | undefined): string[] {
  if (!guidelines) return [];
  const found = guidelines.match(/#[A-Za-z0-9_]+|@[A-Za-z0-9_.]+|\b[A-Z0-9]{4,}\d+\b/g) ?? [];
  return found.filter((x, i, a) => a.indexOf(x) === i).slice(0, 6);
}

export function deliverableProgress(c: Collaboration): { done: number; total: number; pct: number } {
  const total = c.deliverables.length;
  const done = c.deliverables.filter((d) => d.status === 'APPROVED' || d.status === 'PAID').length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

/** Sign of a ledger entry from the creator's point of view. */
export function ledgerDirection(e: LedgerEntry, creatorId: string | null | undefined): 1 | -1 {
  const wallet = `creator:${creatorId}:wallet`;
  if (e.credit_account === wallet) return 1;
  if (e.debit_account === wallet) return -1;
  return e.entry_type === 'PAYOUT_RELEASE' ? 1 : -1;
}

export const LEDGER_TONE: Record<LedgerEntry['entry_type'], 'success' | 'warning' | 'neutral' | 'info' | 'danger'> = {
  PAYOUT_RELEASE: 'success', ESCROW_HOLD: 'warning', ESCROW_RELEASE: 'info', ESCROW_REFUND: 'neutral', BUDGET_ALLOCATION: 'neutral', BUDGET_ADJUSTMENT: 'neutral',
};

export const LEDGER_LABEL: Record<LedgerEntry['entry_type'], string> = {
  PAYOUT_RELEASE: 'Payout', ESCROW_HOLD: 'Escrow hold', ESCROW_RELEASE: 'Escrow release', ESCROW_REFUND: 'Escrow refund', BUDGET_ALLOCATION: 'Budget allocation', BUDGET_ADJUSTMENT: 'Budget adjustment',
};

export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'short', year: ym.startsWith(String(new Date().getFullYear())) ? undefined : '2-digit' });
}

export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
