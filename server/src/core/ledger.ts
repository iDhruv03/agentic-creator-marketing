import { queryAll, queryOne, execute, transaction } from '../db/database';
import { newId, CoreError } from './ids';
import type { ActorType } from './audit';
import { bus } from '../realtime/events';

/**
 * Double-entry financial ledger.
 *
 * Accounts:
 *   brand:<id>:budget          money the brand has committed to the platform
 *   campaign:<id>:available    allocated to a campaign, not yet promised
 *   campaign:<id>:escrow       held against an accepted/offered collaboration
 *   creator:<id>:wallet        released to the creator
 *
 * Every entry debits one account and credits another, so the sum over all
 * accounts is always zero and every dollar is traceable to the actor that
 * moved it.
 */
export type EntryType =
  | 'BUDGET_ALLOCATION'
  | 'BUDGET_ADJUSTMENT'
  | 'ESCROW_HOLD'
  | 'ESCROW_RELEASE'
  | 'ESCROW_REFUND'
  | 'PAYOUT_RELEASE';

export interface LedgerEntry {
  id: string;
  seq: number;
  campaign_id: string;
  collaboration_id: string | null;
  deliverable_id: string | null;
  actor_type: ActorType;
  actor_id: string;
  entry_type: EntryType;
  debit_account: string;
  credit_account: string;
  amount: number;
  currency: string;
  note: string;
  created_at: string;
  actor_name?: string | null;
}

export interface CampaignFinancials {
  budget: number;
  escrow_locked: number;
  spent: number;
  available: number;
  committed: number; // escrow + spent
  utilisation_pct: number;
}

export const acct = {
  brandBudget: (brandId: string) => `brand:${brandId}:budget`,
  campaignAvailable: (campaignId: string) => `campaign:${campaignId}:available`,
  campaignEscrow: (campaignId: string) => `campaign:${campaignId}:escrow`,
  creatorWallet: (creatorId: string) => `creator:${creatorId}:wallet`,
};

interface PostInput {
  campaign_id: string;
  collaboration_id?: string | null;
  deliverable_id?: string | null;
  actor_type: ActorType;
  actor_id: string;
  entry_type: EntryType;
  debit_account: string;
  credit_account: string;
  amount: number;
  note?: string;
}

function nextSeq(): number {
  return (queryOne<{ m: number | null }>(`SELECT MAX(seq) as m FROM ledger_entries`)?.m ?? 0) + 1;
}

export function postEntry(input: PostInput): LedgerEntry {
  if (!(input.amount >= 0)) throw new CoreError('Ledger amount must be non-negative.', 400, 'INVALID_AMOUNT');
  const id = newId('ledg');
  const seq = nextSeq();
  execute(
    `INSERT INTO ledger_entries (id, seq, campaign_id, collaboration_id, deliverable_id, actor_type, actor_id,
       entry_type, debit_account, credit_account, amount, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, seq, input.campaign_id, input.collaboration_id ?? null, input.deliverable_id ?? null,
      input.actor_type, input.actor_id, input.entry_type, input.debit_account, input.credit_account,
      Math.round(input.amount * 100) / 100, input.note ?? '',
    ],
  );
  const entry = queryOne<LedgerEntry>(`SELECT * FROM ledger_entries WHERE id = ?`, [id])!;
  bus.publish('ledger.posted', { id, campaign_id: input.campaign_id, entry_type: input.entry_type, amount: input.amount });
  return entry;
}

/** Net balance of an account = credits - debits. */
export function accountBalance(account: string): number {
  const row = queryOne<{ credits: number | null; debits: number | null }>(
    `SELECT
       (SELECT COALESCE(SUM(amount),0) FROM ledger_entries WHERE credit_account = ?) as credits,
       (SELECT COALESCE(SUM(amount),0) FROM ledger_entries WHERE debit_account = ?) as debits`,
    [account, account],
  );
  return Math.round(((row?.credits ?? 0) - (row?.debits ?? 0)) * 100) / 100;
}

export function campaignFinancials(campaignId: string): CampaignFinancials {
  const c = queryOne<{ budget: number }>(`SELECT budget FROM campaigns WHERE id = ?`, [campaignId]);
  const budget = c?.budget ?? 0;
  const escrow_locked = accountBalance(acct.campaignEscrow(campaignId));
  // spent = everything that left escrow into creator wallets for this campaign
  const spent = queryOne<{ n: number }>(
    `SELECT COALESCE(SUM(amount),0) as n FROM ledger_entries WHERE campaign_id = ? AND entry_type = 'PAYOUT_RELEASE'`,
    [campaignId],
  )?.n ?? 0;
  const available = Math.round((budget - escrow_locked - spent) * 100) / 100;
  const committed = Math.round((escrow_locked + spent) * 100) / 100;
  return {
    budget,
    escrow_locked,
    spent,
    available,
    committed,
    utilisation_pct: budget > 0 ? Math.round((committed / budget) * 1000) / 10 : 0,
  };
}

/** Fund a campaign from the brand budget (campaign creation / budget change). */
export function allocateBudget(args: { campaign_id: string; brand_id: string; amount: number; actor_type: ActorType; actor_id: string; note?: string }): LedgerEntry {
  return postEntry({
    campaign_id: args.campaign_id,
    actor_type: args.actor_type,
    actor_id: args.actor_id,
    entry_type: 'BUDGET_ALLOCATION',
    debit_account: acct.brandBudget(args.brand_id),
    credit_account: acct.campaignAvailable(args.campaign_id),
    amount: args.amount,
    note: args.note ?? 'Campaign budget allocation',
  });
}

export function adjustBudget(args: { campaign_id: string; brand_id: string; delta: number; actor_type: ActorType; actor_id: string; note?: string }): LedgerEntry {
  const amount = Math.abs(args.delta);
  const increase = args.delta >= 0;
  return postEntry({
    campaign_id: args.campaign_id,
    actor_type: args.actor_type,
    actor_id: args.actor_id,
    entry_type: 'BUDGET_ADJUSTMENT',
    debit_account: increase ? acct.brandBudget(args.brand_id) : acct.campaignAvailable(args.campaign_id),
    credit_account: increase ? acct.campaignAvailable(args.campaign_id) : acct.brandBudget(args.brand_id),
    amount,
    note: args.note ?? (increase ? 'Budget increased' : 'Budget decreased'),
  });
}

export function holdEscrow(args: { campaign_id: string; collaboration_id: string; amount: number; actor_type: ActorType; actor_id: string; note?: string }): LedgerEntry {
  return transaction(() => {
    const fin = campaignFinancials(args.campaign_id);
    if (fin.available < args.amount) {
      throw new CoreError(
        `Insufficient available campaign budget: $${fin.available.toLocaleString()} available, $${args.amount.toLocaleString()} requested.`,
        409,
        'INSUFFICIENT_BUDGET',
      );
    }
    return postEntry({
      campaign_id: args.campaign_id,
      collaboration_id: args.collaboration_id,
      actor_type: args.actor_type,
      actor_id: args.actor_id,
      entry_type: 'ESCROW_HOLD',
      debit_account: acct.campaignAvailable(args.campaign_id),
      credit_account: acct.campaignEscrow(args.campaign_id),
      amount: args.amount,
      note: args.note ?? 'Escrow hold for collaboration offer',
    });
  });
}

export function collaborationEscrow(collaborationId: string): number {
  const row = queryOne<{ held: number; released: number; refunded: number }>(
    `SELECT
      COALESCE(SUM(CASE WHEN entry_type='ESCROW_HOLD' THEN amount END),0) as held,
      COALESCE(SUM(CASE WHEN entry_type='PAYOUT_RELEASE' THEN amount END),0) as released,
      COALESCE(SUM(CASE WHEN entry_type='ESCROW_REFUND' THEN amount END),0) as refunded
     FROM ledger_entries WHERE collaboration_id = ?`,
    [collaborationId],
  );
  return Math.round(((row?.held ?? 0) - (row?.released ?? 0) - (row?.refunded ?? 0)) * 100) / 100;
}

export function refundEscrow(args: { campaign_id: string; collaboration_id: string; amount?: number; actor_type: ActorType; actor_id: string; note?: string }): LedgerEntry | null {
  const remaining = args.amount ?? collaborationEscrow(args.collaboration_id);
  if (remaining <= 0) return null;
  return postEntry({
    campaign_id: args.campaign_id,
    collaboration_id: args.collaboration_id,
    actor_type: args.actor_type,
    actor_id: args.actor_id,
    entry_type: 'ESCROW_REFUND',
    debit_account: acct.campaignEscrow(args.campaign_id),
    credit_account: acct.campaignAvailable(args.campaign_id),
    amount: remaining,
    note: args.note ?? 'Escrow returned to campaign budget',
  });
}

export function releasePayout(args: { campaign_id: string; collaboration_id: string; deliverable_id?: string | null; creator_id: string; amount: number; actor_type: ActorType; actor_id: string; note?: string }): LedgerEntry {
  return transaction(() => {
    const held = collaborationEscrow(args.collaboration_id);
    if (held + 0.001 < args.amount) {
      throw new CoreError(
        `Payout of $${args.amount.toLocaleString()} exceeds escrow held for this collaboration ($${held.toLocaleString()}).`,
        409,
        'INSUFFICIENT_ESCROW',
      );
    }
    const entry = postEntry({
      campaign_id: args.campaign_id,
      collaboration_id: args.collaboration_id,
      deliverable_id: args.deliverable_id ?? null,
      actor_type: args.actor_type,
      actor_id: args.actor_id,
      entry_type: 'PAYOUT_RELEASE',
      debit_account: acct.campaignEscrow(args.campaign_id),
      credit_account: acct.creatorWallet(args.creator_id),
      amount: args.amount,
      note: args.note ?? 'Payout released from escrow',
    });
    execute(`UPDATE creators SET wallet_balance = wallet_balance + ? WHERE id = ?`, [args.amount, args.creator_id]);
    return entry;
  });
}

export interface LedgerQuery {
  campaign_id?: string;
  collaboration_id?: string;
  brand_id?: string;
  brand_ids?: string[];
  creator_id?: string;
  entry_type?: string;
  limit?: number;
}

export function listLedger(q: LedgerQuery = {}): LedgerEntry[] {
  const where: string[] = [];
  const params: any[] = [];
  if (q.campaign_id) { where.push('l.campaign_id = ?'); params.push(q.campaign_id); }
  if (q.collaboration_id) { where.push('l.collaboration_id = ?'); params.push(q.collaboration_id); }
  if (q.brand_id) { where.push('c.brand_id = ?'); params.push(q.brand_id); }
  if (q.brand_ids) { where.push(q.brand_ids.length ? `c.brand_id IN (${q.brand_ids.map(() => '?').join(',')})` : '0'); params.push(...q.brand_ids); }
  if (q.creator_id) { where.push('(l.credit_account = ? OR l.debit_account = ?)'); params.push(acct.creatorWallet(q.creator_id), acct.creatorWallet(q.creator_id)); }
  if (q.entry_type) { where.push('l.entry_type = ?'); params.push(q.entry_type); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(q.limit ?? 500, 2000);
  return queryAll(
    `SELECT l.*, c.title as campaign_title, c.brand_id, b.name as brand_name,
            cr.handle as creator_handle, cr.name as creator_name,
            COALESCE(u.name, s.name, acr.name) as actor_name
     FROM ledger_entries l
     JOIN campaigns c ON c.id = l.campaign_id
     JOIN brands b ON b.id = c.brand_id
     LEFT JOIN collaborations col ON col.id = l.collaboration_id
     LEFT JOIN creators cr ON cr.id = col.creator_id
     LEFT JOIN users u ON u.id = l.actor_id
     LEFT JOIN agent_sessions s ON s.id = l.actor_id
     LEFT JOIN creators acr ON acr.id = l.actor_id
     ${whereSql}
     ORDER BY l.seq DESC LIMIT ?`,
    [...params, limit],
  );
}

/** Trial balance: sum of all credits must equal sum of all debits. */
export function trialBalance(): { debits: number; credits: number; balanced: boolean; accounts: { account: string; balance: number }[] } {
  const rows = queryAll<{ account: string; balance: number }>(
    `SELECT account, ROUND(SUM(delta), 2) as balance FROM (
       SELECT credit_account as account, amount as delta FROM ledger_entries
       UNION ALL
       SELECT debit_account as account, -amount as delta FROM ledger_entries
     ) GROUP BY account ORDER BY account`,
  );
  const debits = queryOne<{ n: number }>(`SELECT COALESCE(SUM(amount),0) n FROM ledger_entries`)?.n ?? 0;
  return { debits, credits: debits, balanced: Math.abs(rows.reduce((a, r) => a + r.balance, 0)) < 0.005, accounts: rows };
}
