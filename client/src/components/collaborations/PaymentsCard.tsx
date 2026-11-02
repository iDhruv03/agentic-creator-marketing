import * as React from 'react';
import { Link } from 'react-router-dom';
import { BadgeDollarSign, Receipt } from 'lucide-react';
import type { Collaboration, LedgerEntry } from '@/types';
import { api } from '@/lib/api';
import { useAction } from '@/hooks/queries';
import { money, fmtDate, cn } from '@/lib/utils';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/overlay';
import { SkeletonRows, EmptyState, Progress } from '@/components/ui/feedback';
import { EntryTypeBadge } from '@/components/governance/ledger-utils';

const INVALIDATE = ['collaboration', 'collaborations', 'ledger', 'campaign', 'campaigns', 'trial-balance', 'overview', 'notifications', 'wallet'];

export function PaymentsCard({ collab, entries, loading, canAct }: { collab: Collaboration; entries: LedgerEntry[]; loading: boolean; canAct: boolean }) {
  const [open, setOpen] = React.useState(false);
  const release = useAction(() => api.collaborations.releasePayment(collab.id, { note: 'Remaining escrow released on completion' }), { invalidate: INVALIDATE, success: (r) => `Released ${money(r.amount)} to @${collab.creator_handle}`, onSuccess: () => setOpen(false) });

  const sum = (t: LedgerEntry['entry_type']) => entries.filter((e) => e.entry_type === t).reduce((a, e) => a + e.amount, 0);
  const held = sum('ESCROW_HOLD');
  const refunded = sum('ESCROW_REFUND');
  const released = sum('PAYOUT_RELEASE');
  const reserved = Math.max(0, held - refunded);
  const remaining = collab.escrow_held;
  const canRelease = canAct && (collab.status === 'APPROVED' || collab.status === 'COMPLETED') && remaining > 0;
  const allApproved = collab.deliverables.every((d) => d.status === 'APPROVED' || d.status === 'PAID');

  return (
    <Card>
      <CardHeader title="Payments" description="Escrow and payouts from the double-entry ledger" action={<Link to="/finance" className="text-[12.5px] font-medium text-primary hover:underline">Ledger</Link>} />
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-surface-muted/70 px-3 py-2"><div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Escrowed</div><div className="text-[15px] font-semibold tabular-nums">{money(reserved)}</div></div>
        <div className="rounded-xl bg-surface-muted/70 px-3 py-2"><div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Released</div><div className="text-[15px] font-semibold tabular-nums text-success">{money(released)}</div></div>
        <div className="rounded-xl bg-surface-muted/70 px-3 py-2"><div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Remaining</div><div className={cn('text-[15px] font-semibold tabular-nums', remaining > 0 ? 'text-warning' : 'text-muted-foreground')}>{money(remaining)}</div></div>
      </div>
      {reserved > 0 && <Progress className="mt-3" value={1} segments={[{ value: (released / reserved) * 100, tone: 'success' }, { value: (remaining / reserved) * 100, tone: 'warning' }]} size="sm" />}

      {canRelease && (
        <div className="mt-4">
          <Button size="sm" className="w-full" leftIcon={<BadgeDollarSign className="h-3.5 w-3.5" />} onClick={() => setOpen(true)} disabled={!allApproved}>Release remaining escrow</Button>
          {!allApproved && <p className="mt-1.5 text-center text-[11px] text-muted-foreground">Every deliverable must be approved first.</p>}
        </div>
      )}

      <div className="mt-4 border-t border-border pt-3">
        {loading ? <SkeletonRows rows={3} /> : entries.length === 0 ? <EmptyState compact icon={Receipt} title="No ledger entries" description="Escrow holds and payouts appear here." /> : (
          <ul className="divide-y divide-border/70">
            {entries.map((e) => (
              <li key={e.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5"><EntryTypeBadge type={e.entry_type} /><span className="text-[11px] text-muted-foreground">#{e.seq} · {fmtDate(e.created_at)}</span></div>
                  <div className="mt-1 line-clamp-2 text-[12.5px] text-muted-foreground">{e.note}</div>
                </div>
                <div className={cn('shrink-0 text-[13px] font-semibold tabular-nums', e.entry_type === 'PAYOUT_RELEASE' ? 'text-success' : e.entry_type === 'ESCROW_HOLD' ? 'text-warning' : 'text-foreground')}>{e.entry_type === 'ESCROW_REFUND' ? '−' : ''}{money(e.amount)}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog open={open} onOpenChange={setOpen} title={`Release ${money(remaining)} to @${collab.creator_handle}?`} description="Moves everything still held in escrow for this collaboration into the creator's wallet and marks the collaboration complete." confirmLabel={`Release ${money(remaining)}`} loading={release.isPending} onConfirm={() => release.mutate([])}>
        <div className="space-y-2 text-[13px]">
          <div className="flex items-center justify-between rounded-xl border border-border bg-surface-muted/60 px-3 py-2"><span className="text-muted-foreground">From</span><span className="font-mono text-xs">Campaign escrow</span></div>
          <div className="flex items-center justify-between rounded-xl border border-border bg-surface-muted/60 px-3 py-2"><span className="text-muted-foreground">To</span><span className="font-mono text-xs">Creator wallet · @{collab.creator_handle}</span></div>
          <p className="text-muted-foreground">Recorded as a PAYOUT_RELEASE entry under your name in the audit trail.</p>
        </div>
      </ConfirmDialog>
    </Card>
  );
}
