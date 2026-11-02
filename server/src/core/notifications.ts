import { queryAll, queryOne, execute } from '../db/database';
import { newId } from './ids';
import { bus } from '../realtime/events';

export type Audience = 'BRAND' | 'AGENCY' | 'CREATOR';
export type NotificationKind = 'INFO' | 'CHECKPOINT' | 'OFFER' | 'DELIVERABLE' | 'PAYMENT' | 'AGENT';

export interface Notification {
  id: string;
  audience: Audience;
  audience_id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  link: string | null;
  read: number;
  created_at: string;
}

export function notify(input: { audience: Audience; audience_id: string; kind?: NotificationKind; title: string; body?: string; link?: string }): Notification {
  const id = newId('ntf');
  execute(
    `INSERT INTO notifications (id, audience, audience_id, kind, title, body, link) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.audience, input.audience_id, input.kind ?? 'INFO', input.title, input.body ?? '', input.link ?? null],
  );
  const n = queryOne<Notification>(`SELECT * FROM notifications WHERE id = ?`, [id])!;
  bus.publish('notification.created', { ...n });
  return n;
}

/** Notify the brand and, if one manages it, the agency attached to a campaign. */
export function notifyCampaignOwners(campaignId: string, input: Omit<Parameters<typeof notify>[0], 'audience' | 'audience_id'>): void {
  const c = queryOne<{ brand_id: string; agency_id: string | null }>(`SELECT brand_id, agency_id FROM campaigns WHERE id = ?`, [campaignId]);
  if (!c) return;
  notify({ audience: 'BRAND', audience_id: c.brand_id, ...input });
  if (c.agency_id) notify({ audience: 'AGENCY', audience_id: c.agency_id, ...input });
}

export function listNotifications(audience: Audience, audienceId: string, limit = 50): Notification[] {
  return queryAll<Notification>(
    `SELECT * FROM notifications WHERE audience = ? AND audience_id = ? ORDER BY created_at DESC LIMIT ?`,
    [audience, audienceId, limit],
  );
}

export function unreadCount(audience: Audience, audienceId: string): number {
  return queryOne<{ n: number }>(`SELECT COUNT(*) n FROM notifications WHERE audience = ? AND audience_id = ? AND read = 0`, [audience, audienceId])?.n ?? 0;
}

export function markRead(audience: Audience, audienceId: string, ids?: string[]): number {
  if (ids && ids.length) {
    let changed = 0;
    for (const id of ids) {
      changed += Number(execute(`UPDATE notifications SET read = 1 WHERE id = ? AND audience = ? AND audience_id = ?`, [id, audience, audienceId]).changes);
    }
    return changed;
  }
  return Number(execute(`UPDATE notifications SET read = 1 WHERE audience = ? AND audience_id = ? AND read = 0`, [audience, audienceId]).changes);
}
