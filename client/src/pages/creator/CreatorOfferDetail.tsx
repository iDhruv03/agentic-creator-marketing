import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CalendarClock, Lock, Target, Users, FileText, Hash, ShieldCheck, Scale } from 'lucide-react';
import { useAuth } from '@/store/auth';
import { useCollaboration, useCampaign, useCreator, useLedger } from '@/hooks/queries';
import { money, fmtDate, deliverableLabel, cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { OrgMark } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Callout, Skeleton, SkeletonRows, EmptyState, Progress } from '@/components/ui/feedback';
import { KeyValue } from '@/components/ui/data';
import { CollabStatusBadge } from '@/components/ui/status';
import { AgentOfferBadge } from '@/components/creator/OfferCard';
import { ConversationThread } from '@/components/creator/ConversationThread';
import { RespondCard } from '@/components/creator/RespondCard';
import { DeliverablesCard } from '@/components/creator/DeliverablesCard';
import { extractMustInclude, deadlineInfo, currentRate, isClosed } from '@/components/creator/utils';

function Prose({ text }: { text: string | null | undefined }) {
  if (!text) return <span className="text-muted-foreground">—</span>;
  return <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-foreground/85">{text}</p>;
}

export default function CreatorOfferDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const me = useAuth((s) => s.me);
  const collab = useCollaboration(id);
  const campaign = useCampaign(collab.data?.campaign_id);
  const creator = useCreator(me?.user.creator_id ?? undefined);
  const ledger = useLedger({ collaboration_id: id });
  const c = collab.data;

  if (collab.isLoading) {
    return (
      <div className="page">
        <div className="mb-6 space-y-3"><Skeleton className="h-4 w-40" /><Skeleton className="h-8 w-2/3" /><Skeleton className="h-4 w-1/2" /></div>
        <div className="grid gap-6 lg:grid-cols-3"><div className="space-y-6 lg:col-span-2"><div className="card p-5"><SkeletonRows rows={4} /></div><div className="card p-5"><SkeletonRows rows={3} /></div></div><div className="space-y-6"><div className="card p-5"><SkeletonRows rows={2} /></div><div className="card p-5"><SkeletonRows rows={2} /></div></div></div>
      </div>
    );
  }
  if (collab.isError || !c) {
    return (
      <div className="page">
        <PageHeader title="Offer not found" crumbs={[{ label: 'Offers & work', to: '/creator/offers' }, { label: id ?? '' }]} />
        <EmptyState title="We could not load this offer" description="It may belong to another creator or have been removed." action={<Button onClick={() => navigate('/creator/offers')}>Back to offers</Button>} />
      </div>
    );
  }

  const mustInclude = extractMustInclude(campaign.data?.content_guidelines);
  const dl = deadlineInfo(c.deadline);
  const released = (ledger.data ?? []).filter((e) => e.entry_type === 'PAYOUT_RELEASE').reduce((a, e) => a + e.amount, 0);
  const rate = currentRate(c);
  const remaining = Math.max(0, rate - released);
  const closed = isClosed(c);

  return (
    <div className="page">
      <PageHeader
        crumbs={[{ label: 'Offers & work', to: '/creator/offers' }, { label: c.campaign_title ?? c.id }]}
        title={<span className="flex items-center gap-3"><OrgMark name={c.brand_name ?? 'Brand'} src={c.brand_logo} size="lg" /><span className="min-w-0"><span className="block text-[13px] font-medium text-muted-foreground">{c.brand_name}</span>{c.campaign_title}</span></span>}
        meta={<span className="flex flex-wrap items-center gap-2"><CollabStatusBadge status={c.status} />{c.initiated_by === 'AGENT' && <AgentOfferBadge brand={c.brand_name} />}</span>}
        description={<span className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-semibold tabular-nums text-foreground">{money(rate)} <span className="font-normal text-muted-foreground">{c.agreed_rate != null ? 'agreed' : 'proposed'}</span></span>
          {dl && <span className={cn('flex items-center gap-1', dl.past && !closed ? 'font-medium text-danger' : dl.soon ? 'text-warning' : '')}><CalendarClock className="h-3.5 w-3.5" />Due {fmtDate(c.deadline)} ({dl.label})</span>}
          {c.escrow_held > 0 && <span className="flex items-center gap-1 text-success"><Lock className="h-3.5 w-3.5" />{money(c.escrow_held)} secured in escrow</span>}
        </span>}
      />

      {c.initiated_by === 'AGENT' && (c.status === 'OFFERED' || c.status === 'COUNTERED') && (
        <Callout tone="agent" className="mb-6" title={`Sent by ${c.brand_name}'s AI agent`}>A human reviewer at {c.brand_name} approves anything above policy — rate, budget and brief changes are checkpointed before they reach you. Escrow was locked before this offer was sent.</Callout>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="The brief" description={campaign.data ? `${campaign.data.title} · ${campaign.data.start_date ? fmtDate(campaign.data.start_date) : 'TBC'} → ${campaign.data.end_date ? fmtDate(campaign.data.end_date) : 'TBC'}` : 'Campaign context from the brand'} icon={<FileText className="h-4 w-4" />} />
            {campaign.isLoading ? <SkeletonRows rows={3} /> : campaign.data ? (
              <div className="space-y-5">
                <div><div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><FileText className="h-3.5 w-3.5" />Brief</div><Prose text={campaign.data.brief} /></div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div><div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><Target className="h-3.5 w-3.5" />Objectives</div><Prose text={campaign.data.objectives} /></div>
                  <div><div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><Users className="h-3.5 w-3.5" />Target audience</div><Prose text={campaign.data.target_audience} /></div>
                </div>
                <div>
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" />Content guidelines</div>
                  <Prose text={campaign.data.content_guidelines} />
                  {mustInclude.length > 0 && (
                    <Callout tone="warning" icon={Hash} title="Must include" className="mt-3">
                      <div className="mt-1 flex flex-wrap gap-1.5">{mustInclude.map((t) => <code key={t} className="rounded-md border border-warning/30 bg-surface px-1.5 py-0.5 font-mono text-[12px] text-foreground">{t}</code>)}</div>
                      <div className="mt-1.5 text-xs">Compliance checks every submitted caption for these tags, handles and codes.</div>
                    </Callout>
                  )}
                </div>
                <div>
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Required deliverables for the campaign</div>
                  <div className="flex flex-wrap gap-1.5">{campaign.data.required_deliverables.map((d) => <Badge key={d} tone="outline">{d}</Badge>)}</div>
                </div>
                <div className="rounded-xl border border-border bg-surface-muted/50 p-4">
                  <div className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><Scale className="h-3.5 w-3.5" />Your agreement</div>
                  <KeyValue columns={3} items={[{ label: 'Your deliverables', value: c.deliverables.map((d) => deliverableLabel(d.deliverable_type)).join(', ') }, { label: 'Usage rights', value: c.usage_rights || '—' }, { label: 'Exclusivity', value: c.exclusivity_days > 0 ? `${c.exclusivity_days} days` : 'None' }]} />
                  <div className="mt-3"><div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Terms</div><Prose text={c.terms} /></div>
                </div>
              </div>
            ) : <EmptyState compact title="Brief unavailable" description="The campaign brief could not be loaded." />}
          </Card>

          <ConversationThread collab={c} />
        </div>

        <div className="space-y-6">
          <RespondCard collab={c} creator={creator.data} />
          {(c.status !== 'OFFERED' && c.status !== 'COUNTERED' && c.status !== 'DECLINED' && c.status !== 'CANCELLED') && <DeliverablesCard collab={c} mustInclude={mustInclude} />}
          <Card>
            <CardHeader title="Payment" description="Escrow is released to your wallet as deliverables are approved" />
            {ledger.isLoading ? <SkeletonRows rows={2} /> : (
              <div className="space-y-3">
                <Progress value={rate ? (released / rate) * 100 : 0} tone="success" size="sm" />
                <KeyValue columns={3} items={[{ label: 'Secured', value: <span className="tabular-nums">{money(c.escrow_held)}</span> }, { label: 'Released', value: <span className="tabular-nums text-success">{money(released)}</span> }, { label: 'Remaining', value: <span className="tabular-nums">{money(closed && c.status !== 'COMPLETED' ? 0 : remaining)}</span> }]} />
                {(ledger.data ?? []).length > 0 && (
                  <div className="divide-y divide-border/70 border-t border-border/70 pt-1">
                    {(ledger.data ?? []).map((e) => (
                      <div key={e.id} className="flex items-center justify-between gap-3 py-2 text-xs"><span className="min-w-0 truncate text-muted-foreground">{e.note || e.entry_type} · {fmtDate(e.created_at)}</span><span className={cn('shrink-0 font-semibold tabular-nums', e.entry_type === 'PAYOUT_RELEASE' ? 'text-success' : '')}>{e.entry_type === 'PAYOUT_RELEASE' ? '+' : ''}{money(e.amount)}</span></div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
