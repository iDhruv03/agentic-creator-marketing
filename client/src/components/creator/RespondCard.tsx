import * as React from 'react';
import { Check, ArrowLeftRight, X, Play, Clock, Lock, Hourglass } from 'lucide-react';
import type { Collaboration, Creator } from '@/types';
import { api } from '@/lib/api';
import { useAction } from '@/hooks/queries';
import { money, deliverableLabel, fmtDate } from '@/lib/utils';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, ConfirmDialog } from '@/components/ui/overlay';
import { Label, Input, Textarea, Hint } from '@/components/ui/field';
import { Callout } from '@/components/ui/feedback';
import { KeyValue } from '@/components/ui/data';
import { BenchmarkPanel } from './BenchmarkPanel';
import { creatorCanRespond, lastCounter, primaryBenchmarkKey, currentRate } from './utils';

const INVALIDATE = ['collaboration', 'collaborations', 'wallet', 'creator', 'notifications'];

export function RespondCard({ collab, creator }: { collab: Collaboration; creator: Creator | undefined }) {
  const [accepting, setAccepting] = React.useState(false);
  const [countering, setCountering] = React.useState(false);
  const [declining, setDeclining] = React.useState(false);
  const [starting, setStarting] = React.useState(false);
  const [amount, setAmount] = React.useState('');
  const [counterMsg, setCounterMsg] = React.useState('');
  const [reason, setReason] = React.useState('');

  const accept = useAction(() => api.collaborations.accept(collab.id), { invalidate: INVALIDATE, success: 'Offer accepted — funds are secured in escrow', onSuccess: () => setAccepting(false) });
  const counter = useAction((a: number, m?: string) => api.collaborations.counter(collab.id, a, m), { invalidate: INVALIDATE, success: 'Counter-offer sent', onSuccess: () => { setCountering(false); setCounterMsg(''); } });
  const decline = useAction((r?: string) => api.collaborations.decline(collab.id, r), { invalidate: INVALIDATE, success: 'Offer declined', onSuccess: () => setDeclining(false) });
  const start = useAction(() => api.collaborations.start(collab.id), { invalidate: INVALIDATE, success: 'Production started', onSuccess: () => setStarting(false) });

  const rate = currentRate(collab);
  const deliverables = collab.deliverables.map((d) => deliverableLabel(d.deliverable_type));
  const amountNum = Number(amount);
  const benchKey = primaryBenchmarkKey(collab.deliverables);

  React.useEffect(() => { if (countering) setAmount(String(rate)); }, [countering, rate]);

  if (collab.status === 'OFFERED' || collab.status === 'COUNTERED') {
    const canRespond = creatorCanRespond(collab);
    const last = lastCounter(collab);
    return (
      <Card>
        <CardHeader title="Respond" description={canRespond ? 'Accept, negotiate or pass. Funds are already locked in escrow for this offer.' : 'Your counter is with the brand.'} />
        {canRespond ? (
          <div className="space-y-2.5">
            <div className="rounded-xl border border-border bg-surface-muted/60 px-3.5 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{collab.status === 'COUNTERED' ? 'Their counter' : 'On the table'}</div>
              <div className="mt-0.5 font-display text-2xl font-semibold tabular-nums">{money(rate)}</div>
              <div className="text-xs text-muted-foreground">{deliverables.join(' + ')}{collab.deadline ? ` · due ${fmtDate(collab.deadline)}` : ''}</div>
            </div>
            <Button variant="success" className="w-full" leftIcon={<Check className="h-4 w-4" />} onClick={() => setAccepting(true)}>Accept {money(rate)}</Button>
            <Button variant="secondary" className="w-full" leftIcon={<ArrowLeftRight className="h-4 w-4" />} onClick={() => setCountering(true)}>Counter</Button>
            <Button variant="ghost" className="w-full text-danger hover:bg-danger-soft" leftIcon={<X className="h-4 w-4" />} onClick={() => setDeclining(true)}>Decline</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Callout tone="warning" icon={Hourglass} title={`You countered at ${money(last?.amount ?? rate)}`}>Waiting for {collab.brand_name ?? 'the brand'} to accept, counter or withdraw. You will be notified.</Callout>
            <Button variant="ghost" size="sm" className="w-full text-danger hover:bg-danger-soft" onClick={() => setDeclining(true)}>Withdraw and decline</Button>
          </div>
        )}

        <ConfirmDialog open={accepting} onOpenChange={setAccepting} title="Accept this offer?" description="Acceptance is binding. Escrow is released to your wallet as each deliverable is approved." confirmLabel={`Accept ${money(rate)}`} tone="success" loading={accept.isPending} onConfirm={() => accept.mutate([])}>
          <KeyValue columns={2} items={[{ label: 'Rate', value: <span className="font-semibold tabular-nums">{money(rate)}</span> }, { label: 'Deadline', value: collab.deadline ? fmtDate(collab.deadline) : 'Not set' }, { label: 'Deliverables', value: deliverables.join(', ') }, { label: 'Usage rights', value: collab.usage_rights || '—' }]} />
          {collab.exclusivity_days > 0 && <Hint>Includes {collab.exclusivity_days} days of category exclusivity.</Hint>}
        </ConfirmDialog>

        <Dialog open={countering} onOpenChange={setCountering} title="Counter-offer" description={`Propose a different rate for ${collab.campaign_title}. Escrow is re-balanced to your figure automatically.`}
          footer={<><Button variant="ghost" onClick={() => setCountering(false)}>Cancel</Button><Button loading={counter.isPending} disabled={!(amountNum > 0) || amountNum === rate} onClick={() => counter.mutate([amountNum, counterMsg.trim() || undefined])}>Send counter {amountNum > 0 ? money(amountNum) : ''}</Button></>}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="counter-amount" hint={`Current ${money(rate)}`}>Your rate</Label>
              <Input id="counter-amount" type="number" min={1} step={25} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} leftIcon={<span className="text-sm">$</span>} />
              {amountNum > 0 && amountNum === rate && <Hint>That is the same as the current offer — accept it instead.</Hint>}
            </div>
            {creator && (
              <div className="rounded-xl border border-border bg-surface-muted/50 p-3">
                <BenchmarkPanel followerCount={creator.follower_count} deliverable={benchKey} niche={creator.primary_niche} rate={amountNum > 0 ? amountNum : rate} />
                <p className="mt-2 text-[11px] text-muted-foreground">Benchmarked against the {deliverableLabel(benchKey === 'video' ? 'YOUTUBE_VIDEO' : benchKey === 'reel' ? 'REEL' : benchKey === 'story' ? 'STORY' : 'POST').toLowerCase()} rate for your follower band. Your rate card lists {money(creator[`rate_${benchKey}`])}.</p>
              </div>
            )}
            <div>
              <Label htmlFor="counter-msg">Message <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Textarea id="counter-msg" value={counterMsg} onChange={(e) => setCounterMsg(e.target.value)} placeholder="Explain what the rate covers — usage, exclusivity, production time…" />
            </div>
          </div>
        </Dialog>

        <Dialog open={declining} onOpenChange={setDeclining} title="Decline this offer?" description="The brand is notified and the escrowed funds return to their campaign. This cannot be undone."
          footer={<><Button variant="ghost" onClick={() => setDeclining(false)}>Keep offer</Button><Button variant="danger" loading={decline.isPending} onClick={() => decline.mutate([reason.trim() || undefined])}>Decline offer</Button></>}>
          <Label htmlFor="decline-reason">Reason <span className="font-normal text-muted-foreground">(optional, shared with the brand)</span></Label>
          <Textarea id="decline-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Not the right fit for my audience right now…" />
        </Dialog>
      </Card>
    );
  }

  if (collab.status === 'ACCEPTED') {
    return (
      <Card>
        <CardHeader title="Start production" description="Let the brand know you are working on it. Deliverables unlock for submission." />
        <Callout tone="success" icon={Lock} className="mb-3">{money(collab.escrow_held)} is secured in escrow for this agreement.</Callout>
        <Button className="w-full" leftIcon={<Play className="h-4 w-4" />} onClick={() => setStarting(true)}>Start production</Button>
        <ConfirmDialog open={starting} onOpenChange={setStarting} title="Start production?" description={`Marks "${collab.campaign_title}" as in production and notifies ${collab.brand_name ?? 'the brand'}.`} confirmLabel="Start" loading={start.isPending} onConfirm={() => start.mutate([])} />
      </Card>
    );
  }

  const copy: Record<string, { title: string; body: string }> = {
    IN_PROGRESS: { title: 'In production', body: 'Submit each deliverable below once it is live. Compliance runs before the brand sees it.' },
    SUBMITTED: { title: 'Awaiting review', body: `${collab.brand_name ?? 'The brand'} is reviewing your submission. Approved content releases escrow to your wallet.` },
    APPROVED: { title: 'All content approved', body: 'Payment is pending release from escrow by the brand.' },
    COMPLETED: { title: 'Completed', body: 'Everything is approved and paid. Nice work.' },
    DECLINED: { title: 'Declined', body: 'You passed on this offer. Escrow was returned to the brand.' },
    CANCELLED: { title: 'Withdrawn', body: 'The brand withdrew this offer. Escrow was returned to their campaign.' },
  };
  const c = copy[collab.status] ?? { title: collab.status, body: '' };
  return (
    <Card>
      <CardHeader title={c.title} description={c.body} icon={<Clock className="h-4 w-4" />} />
      {collab.escrow_held > 0 && <div className="flex items-center gap-2 text-xs text-success"><Lock className="h-3.5 w-3.5" />{money(collab.escrow_held)} still secured in escrow</div>}
    </Card>
  );
}
