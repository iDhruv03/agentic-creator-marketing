import { queryOne, execute, transaction } from '../db/database';
import { CoreError } from './ids';
import { releasePayout, collaborationEscrow } from './ledger';
import { getCollaboration, getDeliverable, markDeliverablePaid, listDeliverables, type Collaboration } from './collaborations';
import type { ActorType } from './audit';
import { bus } from '../realtime/events';
import { notify, notifyCampaignOwners } from './notifications';
import { nowIso } from '../db/database';

/** Payouts above this amount require a human checkpoint when an agent initiates them (paper §9). */
export const HIGH_VALUE_PAYMENT_THRESHOLD = Number(process.env.CMI_PAYMENT_THRESHOLD ?? 1000);

export interface ReleaseInput {
  collaboration_id: string;
  deliverable_id?: string | null;
  amount?: number;
  note?: string;
}

/**
 * Move money from campaign escrow into the creator wallet for an approved
 * deliverable. Governance (threshold checkpoint) is applied by the caller.
 */
export function releasePayment(input: ReleaseInput, actor: { type: ActorType; id: string; name?: string }): { collaboration: Collaboration; amount: number; ledger_entry_id: string } {
  const col = getCollaboration(input.collaboration_id, false);
  if (!['ACCEPTED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'COMPLETED'].includes(col.status)) {
    throw new CoreError(`Cannot release payment for a collaboration in status ${col.status}.`, 409, 'INVALID_STATE');
  }
  const held = collaborationEscrow(col.id);
  if (held <= 0) throw new CoreError('No escrow remains for this collaboration.', 409, 'NOTHING_TO_RELEASE');

  let deliverable = input.deliverable_id ? getDeliverable(input.deliverable_id) : null;
  if (deliverable && deliverable.collaboration_id !== col.id) throw new CoreError('Deliverable does not belong to this collaboration.', 400, 'MISMATCH');
  if (deliverable && deliverable.status === 'PAID') throw new CoreError('Deliverable has already been paid.', 409, 'ALREADY_PAID');
  if (deliverable && deliverable.status !== 'APPROVED') throw new CoreError(`Deliverable must be APPROVED before payment (current status ${deliverable.status}).`, 409, 'NOT_APPROVED');

  // Without an explicit deliverable, require every deliverable to be approved or paid.
  if (!deliverable) {
    const all = listDeliverables(col.id);
    const unapproved = all.filter((d) => d.status !== 'APPROVED' && d.status !== 'PAID');
    if (unapproved.length) throw new CoreError(`${unapproved.length} deliverable(s) are not yet approved; release per deliverable or wait for approval.`, 409, 'NOT_APPROVED');
  }

  const amount = Math.round((input.amount ?? held) * 100) / 100;
  if (!(amount > 0)) throw new CoreError('Amount must be greater than zero.');
  if (amount > held + 0.001) throw new CoreError(`Amount $${amount.toLocaleString()} exceeds remaining escrow of $${held.toLocaleString()}.`, 409, 'INSUFFICIENT_ESCROW');

  return transaction(() => {
    const entry = releasePayout({
      campaign_id: col.campaign_id,
      collaboration_id: col.id,
      deliverable_id: deliverable?.id ?? null,
      creator_id: col.creator_id,
      amount,
      actor_type: actor.type,
      actor_id: actor.id,
      note: input.note ?? `Payout to @${col.creator_handle}${deliverable ? ` for ${deliverable.deliverable_type}` : ''}`,
    });
    if (deliverable) markDeliverablePaid(deliverable.id);
    const remaining = collaborationEscrow(col.id);
    const allPaid = listDeliverables(col.id).every((d) => d.status === 'PAID');
    if (remaining <= 0.001 || allPaid) {
      execute(`UPDATE collaborations SET status = 'COMPLETED', updated_at = ? WHERE id = ?`, [nowIso(), col.id]);
      execute(`UPDATE creators SET completed_campaigns = completed_campaigns + 1 WHERE id = ?`, [col.creator_id]);
    }
    execute(
      `INSERT INTO negotiation_messages (id, collaboration_id, sender_type, sender_id, sender_name, kind, amount, body) VALUES (?, ?, ?, ?, ?, 'SYSTEM', ?, ?)`,
      [`msg_${entry.id.slice(5)}`, col.id, actor.type === 'AGENT' ? 'AGENT' : 'BRAND', actor.id, actor.name ?? '', amount, `Payment of $${amount.toLocaleString()} released from escrow${remaining <= 0.001 ? '. Collaboration complete.' : '.'}`],
    );
    notify({ audience: 'CREATOR', audience_id: col.creator_id, kind: 'PAYMENT', title: `$${amount.toLocaleString()} paid out`, body: `${col.brand_name} released payment for "${col.campaign_title}"`, link: '/creator/wallet' });
    notifyCampaignOwners(col.campaign_id, { kind: 'PAYMENT', title: `Paid @${col.creator_handle} $${amount.toLocaleString()}`, body: `"${col.campaign_title}" · released by ${actor.type === 'AGENT' ? 'AI agent' : actor.name ?? 'reviewer'}`, link: `/collaborations/${col.id}` });
    bus.publish('collaboration.updated', { id: col.id, status: remaining <= 0.001 ? 'COMPLETED' : col.status });
    return { collaboration: getCollaboration(col.id), amount, ledger_entry_id: entry.id };
  });
}

export function creatorWallet(creatorId: string): { balance: number; pending_escrow: number; lifetime_earnings: number } {
  const balance = queryOne<{ b: number }>(`SELECT wallet_balance b FROM creators WHERE id = ?`, [creatorId])?.b ?? 0;
  const pending = queryOne<{ n: number }>(
    `SELECT COALESCE(SUM(CASE WHEN entry_type='ESCROW_HOLD' THEN amount WHEN entry_type IN ('ESCROW_REFUND','PAYOUT_RELEASE') THEN -amount END),0) n
     FROM ledger_entries l JOIN collaborations c ON c.id = l.collaboration_id
     WHERE c.creator_id = ? AND c.status NOT IN ('DECLINED','CANCELLED')`,
    [creatorId],
  )?.n ?? 0;
  const lifetime = queryOne<{ n: number }>(`SELECT COALESCE(SUM(amount),0) n FROM ledger_entries WHERE credit_account = ?`, [`creator:${creatorId}:wallet`])?.n ?? 0;
  return { balance, pending_escrow: Math.max(0, Math.round(pending * 100) / 100), lifetime_earnings: lifetime };
}
