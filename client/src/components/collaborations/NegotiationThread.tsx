import * as React from 'react';
import { Send, Check, X, Undo2, ArrowLeftRight, MessageSquare } from 'lucide-react';
import type { Collaboration, NegotiationMessage } from '@/types';
import { api } from '@/lib/api';
import { useAction } from '@/hooks/queries';
import { money, fmtDateTime, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea, Hint } from '@/components/ui/field';
import { Dialog, ConfirmDialog, Tooltip } from '@/components/ui/overlay';
import { Callout, EmptyState } from '@/components/ui/feedback';
import { ActorBadge } from '@/components/ui/status';
import { Avatar } from '@/components/ui/avatar';

const INVALIDATE = ['collaboration', 'collaborations', 'ledger', 'campaign', 'campaigns', 'trial-balance', 'overview', 'notifications'];

function isCreator(m: NegotiationMessage) { return m.sender_type === 'CREATOR'; }

function Bubble({ m, collab }: { m: NegotiationMessage; collab: Collaboration }) {
  const mine = !isCreator(m);
  if (m.kind === 'SYSTEM') {
    return (
      <div className="flex justify-center px-6">
        <Tooltip content={fmtDateTime(m.created_at)}><span className="max-w-full rounded-full bg-surface-muted px-3 py-1 text-center text-[11.5px] text-muted-foreground">{m.body}</span></Tooltip>
      </div>
    );
  }
  const amountCard = (m.kind === 'OFFER' || m.kind === 'COUNTER') && m.amount != null;
  const tone = m.kind === 'ACCEPT' ? 'border-success/30 bg-success-soft' : m.kind === 'DECLINE' ? 'border-danger/30 bg-danger-soft' : m.kind === 'OFFER' ? 'border-primary/25 bg-primary-soft/70' : m.kind === 'COUNTER' ? 'border-warning/30 bg-warning-soft' : mine ? 'border-border bg-surface-muted/70' : 'border-border bg-surface';
  const headline = m.kind === 'OFFER' ? `Offered ${money(m.amount)}` : m.kind === 'COUNTER' ? `Countered ${money(m.amount)}` : m.kind === 'ACCEPT' ? `Accepted${m.amount != null ? ` at ${money(m.amount)}` : ''}` : m.kind === 'DECLINE' ? (isCreator(m) ? 'Declined' : 'Offer withdrawn') : null;
  const HeadIcon = m.kind === 'ACCEPT' ? Check : m.kind === 'DECLINE' ? X : m.kind === 'COUNTER' ? ArrowLeftRight : null;
  return (
    <div className={cn('flex gap-2.5', mine ? 'flex-row-reverse' : 'flex-row')}>
      {isCreator(m) ? <Avatar name={m.sender_name || collab.creator_name || 'Creator'} src={collab.creator_avatar} size="sm" className="mt-1" /> : <div className="mt-1"><ActorBadge type={m.sender_type === 'AGENT' ? 'AGENT' : 'HUMAN'} name={m.sender_name || (m.sender_type === 'AGENT' ? 'Agent' : collab.brand_name)} size="sm" /></div>}
      <div className={cn('max-w-[82%] sm:max-w-[72%]', mine ? 'items-end text-right' : 'items-start')}>
        <div className={cn('rounded-2xl border px-3.5 py-2.5 text-left', tone, mine ? 'rounded-tr-md' : 'rounded-tl-md')}>
          {headline && (
            <div className={cn('mb-1 flex items-center gap-1.5 font-semibold', amountCard ? 'text-[15px]' : 'text-[13px]', m.kind === 'ACCEPT' && 'text-success', m.kind === 'DECLINE' && 'text-danger', m.kind === 'COUNTER' && 'text-warning', m.kind === 'OFFER' && 'text-primary')}>
              {HeadIcon && <HeadIcon className="h-3.5 w-3.5" />}{headline}
            </div>
          )}
          <div className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-foreground/90">{m.body}</div>
        </div>
        <div className={cn('mt-1 text-[11px] text-muted-foreground', mine && 'text-right')}>{isCreator(m) ? m.sender_name : null}{isCreator(m) && ' · '}{fmtDateTime(m.created_at)}</div>
      </div>
    </div>
  );
}

export function NegotiationThread({ collab, canAct }: { collab: Collaboration; canAct: boolean }) {
  const [draft, setDraft] = React.useState('');
  const [counterOpen, setCounterOpen] = React.useState(false);
  const [acceptOpen, setAcceptOpen] = React.useState(false);
  const [withdrawOpen, setWithdrawOpen] = React.useState(false);
  const [counterAmount, setCounterAmount] = React.useState(String(collab.proposed_rate));
  const [counterMsg, setCounterMsg] = React.useState('');
  const [reason, setReason] = React.useState('');
  const listRef = React.useRef<HTMLDivElement>(null);
  const messages = collab.messages ?? [];

  React.useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, [messages.length]);

  const send = useAction((body: string) => api.collaborations.message(collab.id, body), { invalidate: ['collaboration'], success: 'Message sent', onSuccess: () => setDraft('') });
  const counter = useAction((amount: number, message?: string) => api.collaborations.counter(collab.id, amount, message), { invalidate: INVALIDATE, success: 'Counter-offer sent', onSuccess: () => { setCounterOpen(false); setCounterMsg(''); } });
  const accept = useAction(() => api.collaborations.accept(collab.id), { invalidate: INVALIDATE, success: `Accepted at ${money(collab.proposed_rate)}`, onSuccess: () => setAcceptOpen(false) });
  const withdraw = useAction((r?: string) => api.collaborations.decline(collab.id, r), { invalidate: INVALIDATE, success: 'Offer withdrawn · escrow returned', onSuccess: () => setWithdrawOpen(false) });

  const negotiating = collab.status === 'OFFERED' || collab.status === 'COUNTERED';
  const counterNum = Number(counterAmount);
  const counterValid = Number.isFinite(counterNum) && counterNum > 0;
  const closed = collab.status === 'DECLINED' || collab.status === 'CANCELLED';

  return (
    <div className="space-y-4">
      <div ref={listRef} className="max-h-[560px] space-y-4 overflow-y-auto pr-1">
        {messages.length === 0 && <EmptyState compact icon={MessageSquare} title="No messages yet" description="Offers, counters and notes between you and the creator show up here." />}
        {messages.map((m) => <Bubble key={m.id} m={m} collab={collab} />)}
      </div>

      {canAct && negotiating && (
        <Callout tone={collab.status === 'COUNTERED' ? 'warning' : 'info'} title={collab.status === 'COUNTERED' ? `${collab.creator_name} countered at ${money(collab.proposed_rate)}` : `Offer of ${money(collab.proposed_rate)} is with the creator`}>
          <div className="text-[12.5px]">{money(collab.escrow_held)} is already held in campaign escrow for this offer. {collab.status === 'COUNTERED' ? 'Accept the counter, propose a new figure, or withdraw.' : 'You can revise the figure or withdraw while you wait.'}</div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {collab.status === 'COUNTERED' && <Button size="sm" variant="success" leftIcon={<Check className="h-3.5 w-3.5" />} onClick={() => setAcceptOpen(true)}>Accept counter</Button>}
            <Button size="sm" variant="secondary" leftIcon={<ArrowLeftRight className="h-3.5 w-3.5" />} onClick={() => { setCounterAmount(String(collab.proposed_rate)); setCounterOpen(true); }}>Counter</Button>
            <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft" leftIcon={<Undo2 className="h-3.5 w-3.5" />} onClick={() => setWithdrawOpen(true)}>Withdraw offer</Button>
          </div>
        </Callout>
      )}

      {!closed && (
        <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) send.mutate([draft.trim()]); }}>
          <div className="flex-1"><Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Message ${collab.creator_name?.split(' ')[0] ?? 'the creator'}…`} maxLength={2000} /></div>
          <Button type="submit" size="icon" loading={send.isPending} disabled={!draft.trim()} aria-label="Send message"><Send className="h-4 w-4" /></Button>
        </form>
      )}

      <ConfirmDialog open={acceptOpen} onOpenChange={setAcceptOpen} title={`Accept counter at ${money(collab.proposed_rate)}?`} description="This locks the agreed rate and moves the collaboration into production." confirmLabel="Accept counter" tone="success" loading={accept.isPending} onConfirm={() => accept.mutate([])}>
        <div className="space-y-2 text-[13px]">
          <div className="flex items-center justify-between rounded-xl border border-border bg-surface-muted/60 px-3 py-2"><span className="text-muted-foreground">Agreed rate</span><span className="font-semibold tabular-nums">{money(collab.proposed_rate)}</span></div>
          <div className="flex items-center justify-between rounded-xl border border-border bg-surface-muted/60 px-3 py-2"><span className="text-muted-foreground">Already in escrow</span><span className="font-semibold tabular-nums">{money(collab.escrow_held)}</span></div>
          <p className="text-muted-foreground">No new funds move now. Escrow is released to the creator deliverable by deliverable once content is approved.</p>
        </div>
      </ConfirmDialog>

      <Dialog open={counterOpen} onOpenChange={setCounterOpen} title="Send a counter-offer" description={`Current figure is ${money(collab.proposed_rate)}. Escrow is re-balanced to match your counter.`} size="sm" footer={<><Button variant="ghost" onClick={() => setCounterOpen(false)}>Cancel</Button><Button loading={counter.isPending} disabled={!counterValid} onClick={() => counter.mutate([counterNum, counterMsg.trim() || undefined])}>Send counter</Button></>}>
        <div className="space-y-4">
          <div>
            <Label htmlFor="counter-amount" required>Amount (USD)</Label>
            <Input id="counter-amount" type="number" min={1} step={50} value={counterAmount} onChange={(e) => setCounterAmount(e.target.value)} error={!counterValid} />
            {counterValid && counterNum !== collab.escrow_held && <Hint>{counterNum > collab.escrow_held ? `${money(counterNum - collab.escrow_held)} more will be held from the campaign budget.` : `${money(collab.escrow_held - counterNum)} returns to the campaign budget.`}</Hint>}
          </div>
          <div>
            <Label htmlFor="counter-msg">Message <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Textarea id="counter-msg" value={counterMsg} onChange={(e) => setCounterMsg(e.target.value)} placeholder="Explain the figure or adjust the scope…" />
          </div>
        </div>
      </Dialog>

      <ConfirmDialog open={withdrawOpen} onOpenChange={setWithdrawOpen} title="Withdraw this offer?" description={`The offer to @${collab.creator_handle} is cancelled and ${money(collab.escrow_held)} in escrow returns to the campaign budget. This cannot be undone.`} confirmLabel="Withdraw offer" tone="danger" loading={withdraw.isPending} onConfirm={() => withdraw.mutate([reason.trim() || undefined])}>
        <Label htmlFor="withdraw-reason">Reason <span className="font-normal text-muted-foreground">(shared with the creator)</span></Label>
        <Textarea id="withdraw-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Budget reallocated to another creator." />
      </ConfirmDialog>
    </div>
  );
}
