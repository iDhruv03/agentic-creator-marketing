import * as React from 'react';
import { ExternalLink, Check, X, CheckCircle2, XCircle, MessageSquareWarning, BadgeDollarSign, AlertTriangle } from 'lucide-react';
import type { Collaboration, Deliverable } from '@/types';
import { api } from '@/lib/api';
import { useAction } from '@/hooks/queries';
import { money, num, pct, fmtDate, deliverableLabel, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Label, Input, Textarea, Hint } from '@/components/ui/field';
import { Dialog, ConfirmDialog } from '@/components/ui/overlay';
import { Callout, Score } from '@/components/ui/feedback';
import { DeliverableStatusBadge, PlatformIcon } from '@/components/ui/status';
import { suggestedPayout } from './collab-utils';

const INVALIDATE = ['collaboration', 'collaborations', 'ledger', 'campaign', 'campaigns', 'trial-balance', 'overview', 'notifications', 'wallet'];

export function DeliverableCard({ collab, deliverable: d, canAct }: { collab: Collaboration; deliverable: Deliverable; canAct: boolean }) {
  const [approveOpen, setApproveOpen] = React.useState(false);
  const [changesOpen, setChangesOpen] = React.useState(false);
  const [payOpen, setPayOpen] = React.useState(false);
  const [notes, setNotes] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [payNote, setPayNote] = React.useState('');
  const [showCaption, setShowCaption] = React.useState(false);

  const review = useAction((decision: 'APPROVED' | 'CHANGES_REQUESTED', n?: string) => api.collaborations.reviewDeliverable(collab.id, d.id, decision, n), { invalidate: INVALIDATE, success: (r) => (r.deliverable.status === 'APPROVED' ? 'Deliverable approved' : 'Changes requested'), onSuccess: () => { setApproveOpen(false); setChangesOpen(false); setNotes(''); } });
  const release = useAction((amt: number, note?: string) => api.collaborations.releasePayment(collab.id, { deliverable_id: d.id, amount: amt, note }), { invalidate: INVALIDATE, success: (r) => `Released ${money(r.amount)} to @${collab.creator_handle}`, onSuccess: () => { setPayOpen(false); setPayNote(''); } });

  const remaining = collab.escrow_held;
  const amt = Number(amount);
  const amtValid = Number.isFinite(amt) && amt > 0;
  const overEscrow = amtValid && amt > remaining + 0.001;
  const openPay = () => { setAmount(String(suggestedPayout(collab, d))); setPayOpen(true); };

  const metrics = d.metrics;
  const caption = d.caption ?? '';
  const captionLong = caption.length > 220;

  return (
    <div className={cn('rounded-xl border border-border p-4', d.status === 'SUBMITTED' && 'border-warning/40 bg-warning-soft/20', d.status === 'CHANGES_REQUESTED' && 'border-danger/30')}>
      <div className="flex flex-wrap items-center gap-2">
        <PlatformIcon platform={d.platform} />
        <span className="text-[14px] font-semibold">{deliverableLabel(d.deliverable_type)}</span>
        <DeliverableStatusBadge status={d.status} size="sm" />
        {d.content_url && <a href={d.content_url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-[12.5px] font-medium text-primary hover:underline">View content<ExternalLink className="h-3 w-3" /></a>}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
        {d.submitted_at && <span>Submitted {fmtDate(d.submitted_at)}</span>}
        {d.approved_at && <span>Approved {fmtDate(d.approved_at)}</span>}
        {d.paid_at && <span>Paid {fmtDate(d.paid_at)}</span>}
        {!d.submitted_at && <span>Awaiting content from the creator</span>}
      </div>

      {caption && (
        <div className="mt-3 rounded-lg bg-surface-muted/70 px-3 py-2 text-[13px] leading-relaxed text-foreground/85">
          <span className={cn(!showCaption && captionLong && 'line-clamp-2')}>{caption}</span>
          {captionLong && <button type="button" className="mt-1 text-[12px] font-medium text-primary hover:underline" onClick={() => setShowCaption((s) => !s)}>{showCaption ? 'Show less' : 'Show full caption'}</button>}
        </div>
      )}

      {d.status === 'CHANGES_REQUESTED' && d.review_notes && (
        <Callout tone="danger" icon={MessageSquareWarning} title="Changes requested" className="mt-3">{d.review_notes}</Callout>
      )}
      {d.status !== 'CHANGES_REQUESTED' && d.review_notes && (
        <div className="mt-3 text-[12.5px] text-muted-foreground"><span className="font-medium text-foreground/80">Review note:</span> {d.review_notes}</div>
      )}

      {d.compliance && (
        <div className="mt-3 rounded-xl border border-border bg-surface p-3">
          <div className="flex items-center gap-3">
            <Score value={d.compliance.score} size="md" label="Compliance score" />
            <div className="min-w-0">
              <div className="text-[13px] font-semibold">{d.compliance.passed ? 'Compliance checks passed' : 'Compliance issues flagged'}</div>
              <div className="text-[11.5px] text-muted-foreground">{d.compliance.checks.filter((c) => c.passed).length} of {d.compliance.checks.length} checks · {fmtDate(d.compliance.checked_at, 'd MMM, HH:mm')}</div>
            </div>
          </div>
          <ul className="mt-3 space-y-1.5">
            {d.compliance.checks.map((c) => (
              <li key={c.id} className="flex items-start gap-2 text-[12.5px]">
                {c.passed ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />}
                <div className="min-w-0"><span className={cn('font-medium', !c.passed && 'text-danger')}>{c.label}</span><span className="text-muted-foreground"> — {c.detail}</span></div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {metrics && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {([['Views', num(metrics.views, { compact: true })], ['Likes', num(metrics.likes, { compact: true })], ['Comments', num(metrics.comments, { compact: true })], ['Shares', num(metrics.shares, { compact: true })], ['Saves', num(metrics.saves, { compact: true })], ['Clicks', num(metrics.clicks, { compact: true })], ['ER', pct(metrics.engagement_rate, 2)]] as [string, string][]).map(([l, v]) => (
            <div key={l} className="rounded-lg bg-surface-muted/70 px-2.5 py-2"><div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{l}</div><div className="text-[13.5px] font-semibold tabular-nums">{v}</div></div>
          ))}
        </div>
      )}

      {canAct && d.status === 'SUBMITTED' && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="success" leftIcon={<Check className="h-3.5 w-3.5" />} onClick={() => setApproveOpen(true)}>Approve</Button>
          <Button size="sm" variant="secondary" leftIcon={<X className="h-3.5 w-3.5" />} onClick={() => setChangesOpen(true)}>Request changes</Button>
        </div>
      )}
      {canAct && d.status === 'APPROVED' && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button size="sm" leftIcon={<BadgeDollarSign className="h-3.5 w-3.5" />} onClick={openPay} disabled={remaining <= 0}>Release payment</Button>
          <span className="text-[11.5px] text-muted-foreground">{money(remaining)} remaining in escrow</span>
        </div>
      )}

      <ConfirmDialog open={approveOpen} onOpenChange={setApproveOpen} title={`Approve ${deliverableLabel(d.deliverable_type)}?`} description="Approval is the precondition for releasing payment. The creator is notified." confirmLabel="Approve" tone="success" loading={review.isPending} onConfirm={() => review.mutate(['APPROVED', notes.trim() || undefined])}>
        {d.compliance && !d.compliance.passed && <Callout tone="warning" icon={AlertTriangle} title="Compliance issues were flagged" className="mb-3">Approving overrides the automated check. Make sure disclosure and platform requirements are met.</Callout>}
        <Label htmlFor={`note-${d.id}`}>Note to creator <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Textarea id={`note-${d.id}`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Great work — exactly the tone we wanted." />
      </ConfirmDialog>

      <Dialog open={changesOpen} onOpenChange={setChangesOpen} title="Request changes" description="Tell the creator what to fix. The deliverable goes back to them and the collaboration returns to production." size="sm" footer={<><Button variant="ghost" onClick={() => setChangesOpen(false)}>Cancel</Button><Button variant="danger" loading={review.isPending} disabled={!notes.trim()} onClick={() => review.mutate(['CHANGES_REQUESTED', notes.trim()])}>Send request</Button></>}>
        <Label htmlFor={`changes-${d.id}`} required>What needs to change</Label>
        <Textarea id={`changes-${d.id}`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Add the #ad disclosure in the first line and resubmit." autoFocus />
        {d.compliance && d.compliance.checks.some((c) => !c.passed) && <Hint>Failed checks: {d.compliance.checks.filter((c) => !c.passed).map((c) => c.label).join(', ')}.</Hint>}
      </Dialog>

      <Dialog open={payOpen} onOpenChange={setPayOpen} title="Release payment" description={`Moves funds from campaign escrow to @${collab.creator_handle}'s wallet for this ${deliverableLabel(d.deliverable_type)}. Recorded as a double-entry payout.`} size="sm" footer={<><Button variant="ghost" onClick={() => setPayOpen(false)}>Cancel</Button><Button loading={release.isPending} disabled={!amtValid || overEscrow} onClick={() => release.mutate([amt, payNote.trim() || undefined])}>Release {amtValid ? money(amt) : 'payment'}</Button></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-[13px]">
            <div className="rounded-xl border border-border bg-surface-muted/60 px-3 py-2"><div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Escrow remaining</div><div className="font-semibold tabular-nums">{money(remaining)}</div></div>
            <div className="rounded-xl border border-border bg-surface-muted/60 px-3 py-2"><div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Agreed rate</div><div className="font-semibold tabular-nums">{money(collab.agreed_rate ?? collab.proposed_rate)}</div></div>
          </div>
          <div>
            <Label htmlFor={`amt-${d.id}`} required hint={`Suggested ${money(suggestedPayout(collab, d))}`}>Amount (USD)</Label>
            <Input id={`amt-${d.id}`} type="number" min={1} step={10} value={amount} onChange={(e) => setAmount(e.target.value)} error={!amtValid || overEscrow} />
            {overEscrow && <Callout tone="warning" icon={AlertTriangle} className="mt-2">Amount exceeds the {money(remaining)} still held in escrow for this collaboration.</Callout>}
            {amtValid && !overEscrow && amt < remaining && <Hint>{money(remaining - amt)} stays in escrow for the remaining deliverables.</Hint>}
            {amtValid && !overEscrow && Math.abs(amt - remaining) < 0.005 && <Hint>This releases everything in escrow and completes the collaboration.</Hint>}
          </div>
          <div>
            <Label htmlFor={`paynote-${d.id}`}>Ledger note <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input id={`paynote-${d.id}`} value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder={`Payout for ${deliverableLabel(d.deliverable_type)}`} />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
