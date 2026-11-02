import * as React from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowUpRight, CalendarClock, Lock, BadgeDollarSign, ListChecks, Bot, Handshake, Package } from 'lucide-react';
import { useCollaboration, useLedger, useCampaign, useSession } from '@/hooks/queries';
import { useAuth } from '@/store/auth';
import { money, fmtDate, fmtDateTime, deliverableLabel, titleCase, cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { Avatar, OrgMark } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton, SkeletonRows, EmptyState, Progress } from '@/components/ui/feedback';
import { KeyValue } from '@/components/ui/data';
import { CollabStatusBadge, ActorBadge, CampaignStatusBadge, PlatformIcon } from '@/components/ui/status';
import { NegotiationThread } from '@/components/collaborations/NegotiationThread';
import { DeliverableCard } from '@/components/collaborations/DeliverableCard';
import { PaymentsCard } from '@/components/collaborations/PaymentsCard';
import { collabRate, deliverableProgress, deadlineInfo } from '@/components/collaborations/collab-utils';

export default function CollaborationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const me = useAuth((s) => s.me);
  const canAct = me?.user.role === 'BRAND' || me?.user.role === 'AGENCY';
  const collab = useCollaboration(id);
  const ledger = useLedger({ collaboration_id: id });
  const campaign = useCampaign(collab.data?.campaign_id);
  const session = useSession(collab.data?.agent_session_id ?? undefined);
  const c = collab.data;

  if (collab.isLoading) {
    return (
      <div className="page">
        <div className="mb-6 space-y-3"><Skeleton className="h-3.5 w-64" /><Skeleton className="h-8 w-80" /><Skeleton className="h-4 w-96" /></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
        <div className="mt-6 grid gap-6 lg:grid-cols-3"><div className="space-y-6 lg:col-span-2"><div className="card p-5"><SkeletonRows rows={5} /></div><div className="card p-5"><SkeletonRows rows={3} /></div></div><div className="space-y-6"><div className="card p-5"><SkeletonRows rows={4} /></div></div></div>
      </div>
    );
  }
  if (collab.isError || !c) {
    return (
      <div className="page">
        <PageHeader title="Collaboration not found" crumbs={[{ label: 'Collaborations', to: '/collaborations' }, { label: id ?? '' }]} />
        <EmptyState icon={Handshake} title="We couldn't load this collaboration" description="It may belong to another workspace or the link is out of date." action={<Button size="sm" variant="secondary" onClick={() => navigate('/collaborations')}>Back to pipeline</Button>} />
      </div>
    );
  }

  const rate = collabRate(c);
  const progress = deliverableProgress(c.deliverables);
  const deadline = deadlineInfo(c.deadline, c.status);
  const fin = campaign.data?.financials;

  return (
    <div className="page">
      <PageHeader
        crumbs={[{ label: 'Collaborations', to: '/collaborations' }, { label: c.campaign_title ?? 'Campaign', to: `/campaigns/${c.campaign_id}` }, { label: c.creator_name ?? 'Creator' }]}
        title={<span className="flex items-center gap-3"><Avatar name={c.creator_name ?? ''} src={c.creator_avatar} size="lg" /><span><span className="block leading-tight">{c.creator_name}</span><Link to={`/creators/${c.creator_id}`} className="block text-[14px] font-normal text-muted-foreground hover:text-primary">@{c.creator_handle}{c.creator_niche ? ` · ${c.creator_niche}` : ''}</Link></span></span>}
        meta={<div className="flex flex-wrap items-center gap-2"><CollabStatusBadge status={c.status} /><ActorBadge type={c.initiated_by} name={c.initiated_by === 'AGENT' ? session.data?.name ?? 'AI agent' : 'Human'} /></div>}
        description={<span>For <Link to={`/campaigns/${c.campaign_id}`} className="font-medium text-foreground hover:text-primary">{c.campaign_title}</Link> by {c.brand_name}. {c.initiated_by === 'AGENT' ? 'Negotiated by an agent inside its budget and rate ceilings.' : 'Negotiated by a human operator.'}</span>}
        actions={<Button variant="secondary" size="sm" rightIcon={<ArrowUpRight className="h-3.5 w-3.5" />} onClick={() => navigate(`/creators/${c.creator_id}`)}>Creator profile</Button>}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <MiniStat icon={BadgeDollarSign} tone="primary" label={c.agreed_rate != null ? 'Agreed rate' : 'Proposed rate'} value={money(rate)} hint={c.agreed_rate == null ? 'Not yet agreed' : `Proposed ${money(c.proposed_rate)}`} />
        <MiniStat icon={Lock} tone="warning" label="Escrow held" value={money(c.escrow_held)} hint={c.escrow_held > 0 ? 'Locked in campaign' : 'Nothing held'} />
        <MiniStat icon={CalendarClock} tone={deadline.overdue ? 'danger' : 'neutral'} label="Deadline" value={c.deadline ? fmtDate(c.deadline) : '—'} hint={deadline.label} hintClass={deadline.overdue ? 'text-danger font-medium' : undefined} />
        <MiniStat icon={ListChecks} tone="success" label="Deliverables" value={`${progress.done}/${progress.total}`} hint={`${progress.paid} paid`} extra={<Progress className="mt-2" value={1} segments={[{ value: progress.total ? (progress.paid / progress.total) * 100 : 0, tone: 'primary' }, { value: progress.total ? ((progress.done - progress.paid) / progress.total) * 100 : 0, tone: 'success' }]} size="xs" />} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Negotiation" description={`${c.messages?.length ?? 0} message${(c.messages?.length ?? 0) === 1 ? '' : 's'} between ${c.brand_name} and ${c.creator_name}`} />
            <NegotiationThread collab={c} canAct={Boolean(canAct)} />
          </Card>

          <Card>
            <CardHeader title="Deliverables" description="Content, compliance checks, performance and payout per deliverable" action={<span className="text-xs text-muted-foreground">{progress.done} of {progress.total} approved</span>} />
            {c.deliverables.length === 0 ? <EmptyState compact icon={Package} title="No deliverables" description="This offer did not specify any deliverables." /> : (
              <div className="space-y-3">{c.deliverables.map((d) => <DeliverableCard key={d.id} collab={c} deliverable={d} canAct={Boolean(canAct)} />)}</div>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Agreement" description="Terms as proposed and agreed" />
            <KeyValue items={[
              { label: 'Proposed rate', value: <span className="tabular-nums">{money(c.proposed_rate)}</span> },
              { label: 'Agreed rate', value: c.agreed_rate != null ? <span className="font-semibold tabular-nums">{money(c.agreed_rate)}</span> : <span className="text-muted-foreground">Not yet agreed</span> },
              { label: 'Deliverables', value: <ul className="space-y-1">{c.deliverables.map((d) => <li key={d.id} className="flex items-center gap-1.5"><PlatformIcon platform={d.platform} className="h-4 w-4 text-[9px]" />{deliverableLabel(d.deliverable_type)}</li>)}</ul> },
              { label: 'Deadline', value: c.deadline ? <span className={cn(deadline.overdue && 'text-danger')}>{fmtDate(c.deadline)} <span className="text-muted-foreground">· {deadline.label}</span></span> : '—' },
              { label: 'Usage rights', value: c.usage_rights || '—' },
              { label: 'Exclusivity', value: c.exclusivity_days > 0 ? `${c.exclusivity_days} days` : 'None' },
              { label: 'Terms', value: <span className="whitespace-pre-wrap leading-relaxed">{c.terms || '—'}</span> },
              { label: 'Created', value: fmtDateTime(c.created_at) },
              { label: 'Initiated by', value: <ActorBadge type={c.initiated_by} name={c.initiated_by === 'AGENT' ? session.data?.name ?? 'AI agent' : 'Human'} size="sm" /> },
              ...(c.agent_session_id ? [{ label: 'Agent session', value: <Link to={`/agents/sessions/${c.agent_session_id}`} className="inline-flex items-center gap-1.5 text-primary hover:underline"><Bot className="h-3.5 w-3.5" />{session.data?.name ?? c.agent_session_id}{session.data && <span className="text-muted-foreground">· {titleCase(session.data.role_scope)}</span>}</Link> }] : []),
            ]} />
          </Card>

          <PaymentsCard collab={c} entries={ledger.data ?? []} loading={ledger.isLoading} canAct={Boolean(canAct)} />

          <Card>
            <CardHeader title="Campaign" />
            <Link to={`/campaigns/${c.campaign_id}`} className="flex items-center gap-3 rounded-xl p-1 transition hover:bg-accent/40">
              <OrgMark name={c.brand_name ?? 'Brand'} src={c.brand_logo} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><span className="truncate text-[13.5px] font-semibold">{c.campaign_title}</span>{campaign.data && <CampaignStatusBadge status={campaign.data.status} size="sm" />}</div>
                <div className="truncate text-xs text-muted-foreground">{c.brand_name}</div>
              </div>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
            {campaign.isLoading ? <SkeletonRows rows={1} className="mt-3" /> : fin && (
              <div className="mt-3 grid grid-cols-2 gap-2 text-[13px]">
                <div className="rounded-xl bg-surface-muted/70 px-3 py-2"><div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Available</div><div className="font-semibold tabular-nums">{money(fin.available)}</div></div>
                <div className="rounded-xl bg-surface-muted/70 px-3 py-2"><div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Budget</div><div className="font-semibold tabular-nums">{money(fin.budget)}</div></div>
                <div className="col-span-2"><div className="mb-1 flex justify-between text-[11px] text-muted-foreground"><span>{money(fin.committed)} committed</span><span>{fin.utilisation_pct.toFixed(0)}%</span></div><Progress value={1} segments={[{ value: (fin.spent / (fin.budget || 1)) * 100, tone: 'success' }, { value: (fin.escrow_locked / (fin.budget || 1)) * 100, tone: 'warning' }]} size="sm" /></div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, tone, label, value, hint, hintClass, extra }: { icon: React.ElementType; tone: 'primary' | 'warning' | 'danger' | 'success' | 'neutral'; label: string; value: string; hint?: string; hintClass?: string; extra?: React.ReactNode }) {
  const tones = { primary: 'bg-primary-soft text-primary', warning: 'bg-warning-soft text-warning', danger: 'bg-danger-soft text-danger', success: 'bg-success-soft text-success', neutral: 'bg-surface-muted text-muted-foreground' };
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span><span className={cn('flex h-6 w-6 items-center justify-center rounded-md', tones[tone])}><Icon className="h-3.5 w-3.5" /></span></div>
      <div className="mt-1.5 font-display text-xl font-semibold tabular-nums tracking-tight">{value}</div>
      {hint && <div className={cn('mt-1 truncate text-[11.5px] text-muted-foreground', hintClass)}>{hint}</div>}
      {extra}
    </div>
  );
}
