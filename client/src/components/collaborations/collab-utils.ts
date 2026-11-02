import type { Collaboration, CollaborationStatus, Deliverable } from '@/types';
import { toDate, timeAgo } from '@/lib/utils';

/** Pipeline columns for the board view. */
export const BOARD_COLUMNS: { key: string; label: string; statuses: CollaborationStatus[]; hint: string }[] = [
  { key: 'offers', label: 'Offers', statuses: ['OFFERED', 'COUNTERED'], hint: 'Awaiting a creator decision' },
  { key: 'contracted', label: 'Contracted', statuses: ['ACCEPTED', 'IN_PROGRESS'], hint: 'Agreed, content in production' },
  { key: 'review', label: 'In review', statuses: ['SUBMITTED'], hint: 'Content submitted for approval' },
  { key: 'approved', label: 'Approved', statuses: ['APPROVED'], hint: 'Ready for payout' },
  { key: 'completed', label: 'Completed', statuses: ['COMPLETED'], hint: 'Paid in full' },
  { key: 'closed', label: 'Closed', statuses: ['DECLINED', 'CANCELLED'], hint: 'Declined or withdrawn' },
];

export const OPEN_OFFER: CollaborationStatus[] = ['OFFERED', 'COUNTERED'];
export const IN_PRODUCTION: CollaborationStatus[] = ['ACCEPTED', 'IN_PROGRESS'];
export const CLOSED: CollaborationStatus[] = ['DECLINED', 'CANCELLED', 'COMPLETED'];

/** The rate that matters right now: agreed once accepted, otherwise the latest proposal. */
export function collabRate(c: Pick<Collaboration, 'agreed_rate' | 'proposed_rate'>): number {
  return c.agreed_rate ?? c.proposed_rate;
}

export function isDone(d: Deliverable): boolean {
  return d.status === 'APPROVED' || d.status === 'PAID';
}

export function deliverableProgress(deliverables: Deliverable[]): { done: number; total: number; pct: number; paid: number } {
  const total = deliverables.length;
  const done = deliverables.filter(isDone).length;
  const paid = deliverables.filter((d) => d.status === 'PAID').length;
  return { done, total, paid, pct: total ? (done / total) * 100 : 0 };
}

export interface DeadlineInfo { label: string; overdue: boolean; date: Date | null }

export function deadlineInfo(deadline: string | null | undefined, status: CollaborationStatus): DeadlineInfo {
  const date = toDate(deadline);
  if (!date) return { label: 'No deadline', overdue: false, date: null };
  const past = date.getTime() < Date.now();
  const overdue = past && !CLOSED.includes(status);
  return { label: overdue ? `Overdue · ${timeAgo(date)}` : past ? `Was due ${timeAgo(date)}` : `Due ${timeAgo(date)}`, overdue, date };
}

/** Share of the agreed rate attributable to one deliverable, capped by what is still in escrow. */
export function suggestedPayout(c: Collaboration, deliverable: Deliverable): number {
  const unpaid = c.deliverables.filter((d) => d.status !== 'PAID');
  const remaining = c.escrow_held;
  if (unpaid.length <= 1) return remaining;
  const share = Math.round((collabRate(c) / Math.max(1, c.deliverables.length)) * 100) / 100;
  return Math.min(remaining, share > 0 ? share : remaining);
}

export function matchesCreator(c: Collaboration, q: string): boolean {
  if (!q) return true;
  const s = q.trim().toLowerCase();
  return [c.creator_name, c.creator_handle, c.campaign_title, c.brand_name].some((v) => (v ?? '').toLowerCase().includes(s));
}
