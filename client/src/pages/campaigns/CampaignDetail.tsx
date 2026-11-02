import * as React from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { PlayCircle, PauseCircle, CheckCircle2, Archive, FileEdit, Sparkles, CalendarDays, Building2, ShieldAlert, Users, LayoutDashboard, FileText, Bookmark, Handshake, Film, Wallet, Activity, Hash, AtSign, Ticket } from 'lucide-react';
import type { Campaign, CampaignStatus, Collaboration } from '@/types';
import { useCampaign, useAction } from '@/hooks/queries';
import { api } from '@/lib/api';
import { money, fmtDate, timeAgo, platformLabel } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Card, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/overlay';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton, SkeletonCards, EmptyState, Progress, Callout } from '@/components/ui/feedback';
import { DataTable, type Column, KeyValue } from '@/components/ui/data';
import { CampaignStatusBadge, CollabStatusBadge, ActorBadge, PlatformIcons, PlatformIcon } from '@/components/ui/status';
import { CampaignOverviewTab } from '@/components/campaigns/CampaignOverviewTab';
import { CampaignShortlistTab } from '@/components/campaigns/CampaignShortlistTab';
import { CampaignContentTab } from '@/components/campaigns/CampaignContentTab';
import { CampaignBudgetTab } from '@/components/campaigns/CampaignBudgetTab';
import { CampaignActivityTab } from '@/components/campaigns/CampaignActivityTab';
import { EditBriefSheet } from '@/components/campaigns/EditBriefSheet';
import { RunAgentDialog } from '@/components/campaigns/RunAgentDialog';

type Transition = { to: CampaignStatus; label: string; icon: React.ElementType; variant: 'primary' | 'secondary' | 'success' | 'danger'; title: string; description: string; confirm: string; tone: 'primary' | 'danger' | 'success' };
const TRANSITIONS: Record<CampaignStatus, Transition[]> = {
  DRAFT: [{ to: 'ACTIVE', label: 'Activate', icon: PlayCircle, variant: 'success', tone: 'success', title: 'Activate this campaign?', description: 'Agents bound to the brand can start sourcing creators and sending offers inside the rate band. The budget is already allocated in the ledger.', confirm: 'Activate' }],
  ACTIVE: [
    { to: 'PAUSED', label: 'Pause', icon: PauseCircle, variant: 'secondary', tone: 'primary', title: 'Pause this campaign?', description: 'New offers and agent runs stop. Open collaborations and escrow are untouched; you can resume at any time.', confirm: 'Pause' },
    { to: 'COMPLETED', label: 'Complete', icon: CheckCircle2, variant: 'secondary', tone: 'primary', title: 'Mark this campaign complete?', description: 'No further offers can be sent. Pending payouts for approved deliverables can still be released from escrow.', confirm: 'Complete' },
  ],
  PAUSED: [
    { to: 'ACTIVE', label: 'Resume', icon: PlayCircle, variant: 'success', tone: 'success', title: 'Resume this campaign?', description: 'Agents and offers pick up where they left off, inside the same budget and rate band.', confirm: 'Resume' },
    { to: 'COMPLETED', label: 'Complete', icon: CheckCircle2, variant: 'secondary', tone: 'primary', title: 'Mark this campaign complete?', description: 'No further offers can be sent. Pending payouts for approved deliverables can still be released from escrow.', confirm: 'Complete' },
    { to: 'ARCHIVED', label: 'Archive', icon: Archive, variant: 'secondary', tone: 'danger', title: 'Archive this campaign?', description: 'Archived campaigns are hidden from agents and the default list. Ledger and audit history are kept forever.', confirm: 'Archive' },
  ],
  COMPLETED: [{ to: 'ARCHIVED', label: 'Archive', icon: Archive, variant: 'secondary', tone: 'danger', title: 'Archive this campaign?', description: 'Archived campaigns are hidden from agents and the default list. Ledger and audit history are kept forever.', confirm: 'Archive' }],
  ARCHIVED: [],
};

const TABS = ['overview', 'brief', 'shortlist', 'collaborations', 'content', 'budget', 'activity'] as const;

function highlight(text: string): React.ReactNode {
  const parts = text.split(/(#[\w-]+|@[\w.]+|\b[A-Z][A-Z0-9]{3,}\b)/g);
  return parts.map((p, i) => {
    if (/^#[\w-]+$/.test(p)) return <Badge key={i} tone="info" size="sm" className="mx-0.5 align-baseline"><Hash className="h-2.5 w-2.5" />{p.slice(1)}</Badge>;
    if (/^@[\w.]+$/.test(p)) return <Badge key={i} tone="primary" size="sm" className="mx-0.5 align-baseline"><AtSign className="h-2.5 w-2.5" />{p.slice(1)}</Badge>;
    if (/^[A-Z][A-Z0-9]{3,}$/.test(p)) return <Badge key={i} tone="warning" size="sm" className="mx-0.5 align-baseline font-mono"><Ticket className="h-2.5 w-2.5" />{p}</Badge>;
    return <React.Fragment key={i}>{p}</React.Fragment>;
  });
}

function BriefTab({ c, onEdit }: { c: Campaign; onEdit: (tab: 'basics' | 'brief' | 'budget') => void }) {
  const Section = ({ title, children, tab }: { title: string; children: React.ReactNode; tab: 'basics' | 'brief' | 'budget' }) => (
    <Card>
      <CardHeader title={title} action={<Button size="xs" variant="ghost" leftIcon={<FileEdit className="h-3.5 w-3.5" />} onClick={() => onEdit(tab)}>Edit</Button>} />
      <div className="text-[14px] leading-relaxed text-foreground/90">{children}</div>
    </Card>
  );
  const empty = <span className="text-muted-foreground">Not provided yet.</span>;
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="space-y-6 xl:col-span-2">
        <Section title="Brief" tab="brief">{c.brief ? <p className="whitespace-pre-wrap">{c.brief}</p> : empty}</Section>
        <Section title="Objectives" tab="brief">{c.objectives ? <p className="whitespace-pre-wrap">{c.objectives}</p> : empty}</Section>
        <Section title="Target audience" tab="brief">{c.target_audience ? <p className="whitespace-pre-wrap">{c.target_audience}</p> : empty}</Section>
        <Section title="Content guidelines" tab="brief">
          {c.content_guidelines ? <p className="whitespace-pre-wrap leading-[1.9]">{highlight(c.content_guidelines)}</p> : empty}
          <p className="mt-3 text-xs text-muted-foreground">Highlighted hashtags, handles and codes are enforced by the compliance checker on every submitted caption, alongside #ad disclosure.</p>
        </Section>
      </div>
      <div className="space-y-6">
        <Section title="Deliverables" tab="brief">{c.required_deliverables.length ? <ul className="space-y-1.5">{c.required_deliverables.map((d) => <li key={d} className="flex items-center gap-2 text-[13.5px]"><CheckCircle2 className="h-4 w-4 text-success" />{d}</li>)}</ul> : empty}</Section>
        <Section title="Rate band & budget" tab="budget">
          <KeyValue items={[
            { label: 'Budget', value: <span className="font-semibold tabular-nums">{money(c.budget)}</span> },
            { label: 'Rate band', value: c.rate_band_max != null ? <span className="tabular-nums">{money(c.rate_band_min ?? 0)} – {money(c.rate_band_max)}</span> : 'No band — session ceilings only' },
          ]} />
          {c.rate_band_max != null && <p className="mt-3 text-xs text-muted-foreground">Agent offers above {money(c.rate_band_max)} are held as out-of-band checkpoints for a human to approve.</p>}
        </Section>
        <Section title="Targeting" tab="basics">
          <KeyValue items={[
            { label: 'Platforms', value: <span className="flex flex-wrap gap-1.5">{c.target_platforms.map((p) => <Badge key={p} tone="outline" size="sm"><PlatformIcon platform={p} className="h-3.5 w-3.5 text-[8px]" />{platformLabel(p)}</Badge>)}</span> },
            { label: 'Niches', value: <span className="flex flex-wrap gap-1.5">{c.target_niches.map((n) => <Badge key={n} tone="outline" size="sm">{n}</Badge>)}</span> },
            { label: 'Schedule', value: c.start_date || c.end_date ? `${fmtDate(c.start_date)} → ${fmtDate(c.end_date)}` : 'No dates set' },
          ]} />
        </Section>
      </div>
    </div>
  );
}

function CollaborationsTab({ c }: { c: Campaign }) {
  const navigate = useNavigate();
  const rows = c.collaborations ?? [];
  const columns: Column<Collaboration>[] = [
    { key: 'creator', header: 'Creator', render: (r) => <div className="flex items-center gap-2.5"><Avatar name={r.creator_name ?? 'Creator'} src={r.creator_avatar} size="sm" /><div className="min-w-0"><div className="truncate font-medium">{r.creator_name}</div><div className="truncate text-xs text-muted-foreground">@{r.creator_handle} · {r.creator_niche}</div></div></div>, sortValue: (r) => r.creator_name ?? '' },
    { key: 'status', header: 'Status', render: (r) => <CollabStatusBadge status={r.status} size="sm" />, sortValue: (r) => r.status },
    { key: 'rate', header: 'Rate', align: 'right', render: (r) => <div className="tabular-nums"><div className="font-semibold">{money(r.agreed_rate ?? r.proposed_rate)}</div>{r.agreed_rate != null && r.agreed_rate !== r.proposed_rate && <div className="text-[11px] text-muted-foreground line-through">{money(r.proposed_rate)}</div>}</div>, sortValue: (r) => r.agreed_rate ?? r.proposed_rate },
    { key: 'deliverables', header: 'Deliverables', render: (r) => { const total = r.deliverables?.length ?? 0; const done = (r.deliverables ?? []).filter((d) => d.status === 'APPROVED' || d.status === 'PAID').length; return <div className="min-w-[120px]"><div className="mb-1 text-xs tabular-nums">{done}/{total} approved</div><Progress value={total ? (done / total) * 100 : 0} size="xs" tone="success" /></div>; }, sortValue: (r) => (r.deliverables ?? []).filter((d) => d.status === 'APPROVED' || d.status === 'PAID').length },
    { key: 'initiated', header: 'Initiated by', render: (r) => <ActorBadge type={r.initiated_by} name={r.initiated_by === 'AGENT' ? 'Agent' : 'Human'} size="sm" /> },
    { key: 'deadline', header: 'Deadline', render: (r) => <span className="whitespace-nowrap text-xs text-muted-foreground">{fmtDate(r.deadline)}</span>, sortValue: (r) => r.deadline ?? '' },
    { key: 'escrow', header: 'Escrow', align: 'right', render: (r) => <span className="tabular-nums">{r.escrow_held ? money(r.escrow_held) : '—'}</span>, sortValue: (r) => r.escrow_held },
    { key: 'updated', header: 'Updated', render: (r) => <span className="whitespace-nowrap text-xs text-muted-foreground">{timeAgo(r.updated_at)}</span>, sortValue: (r) => r.updated_at },
  ];
  if (!rows.length) return <EmptyState icon={Handshake} title="No collaborations yet" description="Send an offer from the shortlist or run an agent to negotiate inside the rate band." />;
  return <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} onRowClick={(r) => navigate(`/collaborations/${r.id}`)} />;
}

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const q = useCampaign(id);
  const c = q.data;
  const tab = (TABS as readonly string[]).includes(params.get('tab') ?? '') ? params.get('tab')! : 'overview';
  const setTab = (t: string) => setParams((p) => { const n = new URLSearchParams(p); if (t === 'overview') n.delete('tab'); else n.set('tab', t); return n; }, { replace: true });

  const [pending, setPending] = React.useState<Transition | null>(null);
  const [edit, setEdit] = React.useState<{ open: boolean; tab: 'basics' | 'brief' | 'budget' }>({ open: false, tab: 'brief' });
  const [runOpen, setRunOpen] = React.useState(false);

  const transition = useAction(api.campaigns.setStatus, { invalidate: ['campaign', 'campaigns', 'overview', 'audit', 'sessions'], success: (r) => `Campaign is now ${r.status.toLowerCase()}`, onSuccess: () => setPending(null) });

  if (q.isLoading) {
    return (
      <div className="page">
        <div className="mb-6 space-y-3"><Skeleton className="h-3.5 w-40" /><Skeleton className="h-8 w-2/3 max-w-md" /><Skeleton className="h-3.5 w-1/2 max-w-sm" /></div>
        <Skeleton className="mb-6 h-10 w-full" />
        <SkeletonCards />
      </div>
    );
  }
  if (q.isError || !c) {
    return <div className="page"><PageHeader crumbs={[{ label: 'Campaigns', to: '/campaigns' }]} title="Campaign not found" /><EmptyState title="We couldn't load this campaign" description={q.error instanceof Error ? q.error.message : 'It may have been removed or you may not have access.'} action={<Button variant="secondary" onClick={() => navigate('/campaigns')}>Back to campaigns</Button>} /></div>;
  }

  const transitions = TRANSITIONS[c.status];
  const pendingCount = c.stats.pending_checkpoints;
  const deliverableRows = (c.collaborations ?? []).reduce((n, col) => n + (col.deliverables?.length ?? 0), 0);

  return (
    <div className="page">
      <PageHeader
        crumbs={[{ label: 'Campaigns', to: '/campaigns' }, { label: c.title }]}
        title={c.title}
        meta={<CampaignStatusBadge status={c.status} />}
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{c.brand_name}{c.agency_name ? <span className="text-muted-foreground/80"> · via {c.agency_name}</span> : null}</span>
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{c.start_date || c.end_date ? `${fmtDate(c.start_date)} → ${fmtDate(c.end_date)}` : 'No dates set'}</span>
            <span className="inline-flex items-center gap-1.5"><PlatformIcons platforms={c.target_platforms} /></span>
            <span className="inline-flex items-center gap-1.5"><Hash className="h-3.5 w-3.5" />{c.target_niches.slice(0, 2).join(', ')}{c.target_niches.length > 2 ? ` +${c.target_niches.length - 2}` : ''}</span>
          </span>
        }
        actions={<>
          {transitions.map((t) => <Button key={t.to} variant={t.variant} size="sm" leftIcon={<t.icon className="h-4 w-4" />} onClick={() => setPending(t)}>{t.label}</Button>)}
          {c.status !== 'ARCHIVED' && <Button variant="secondary" size="sm" leftIcon={<FileEdit className="h-4 w-4" />} onClick={() => setEdit({ open: true, tab: 'brief' })}>Edit brief</Button>}
          {['ACTIVE', 'DRAFT', 'PAUSED'].includes(c.status) && <Button variant="agent" size="sm" leftIcon={<Sparkles className="h-4 w-4" />} onClick={() => setRunOpen(true)}>Run agent</Button>}
        </>}
      />

      {pendingCount > 0 && (
        <Callout tone="warning" icon={ShieldAlert} className="mb-6" title={`${pendingCount} agent action${pendingCount === 1 ? '' : 's'} waiting for approval on this campaign`} action={<Button size="sm" onClick={() => navigate(`/approvals?campaign_id=${c.id}`)}>Review</Button>}>
          Held actions are not executed until a human approves them. Rejecting leaves everything untouched.
        </Callout>
      )}
      {c.status === 'DRAFT' && (
        <Callout tone="neutral" className="mb-6" title="This campaign is a draft">Agents can't see it yet. Finish the brief, then activate it to open it up for sourcing and offers.</Callout>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview" icon={<LayoutDashboard />}>Overview</TabsTrigger>
          <TabsTrigger value="brief" icon={<FileText />}>Brief</TabsTrigger>
          <TabsTrigger value="shortlist" icon={<Bookmark />} count={c.shortlist?.length ?? c.stats.shortlist}>Shortlist</TabsTrigger>
          <TabsTrigger value="collaborations" icon={<Handshake />} count={c.collaborations?.length ?? c.stats.collaborations}>Collaborations</TabsTrigger>
          <TabsTrigger value="content" icon={<Film />} count={deliverableRows}>Content</TabsTrigger>
          <TabsTrigger value="budget" icon={<Wallet />}>Budget</TabsTrigger>
          <TabsTrigger value="activity" icon={<Activity />} count={(c.checkpoints?.length ?? 0) + (c.runs?.length ?? 0)}>Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><CampaignOverviewTab campaign={c} /></TabsContent>
        <TabsContent value="brief"><BriefTab c={c} onEdit={(t) => setEdit({ open: true, tab: t })} /></TabsContent>
        <TabsContent value="shortlist"><CampaignShortlistTab campaign={c} /></TabsContent>
        <TabsContent value="collaborations"><CollaborationsTab c={c} /></TabsContent>
        <TabsContent value="content"><CampaignContentTab campaign={c} /></TabsContent>
        <TabsContent value="budget"><CampaignBudgetTab campaign={c} /></TabsContent>
        <TabsContent value="activity"><CampaignActivityTab campaign={c} /></TabsContent>
      </Tabs>

      {pending && (
        <ConfirmDialog open onOpenChange={(o) => { if (!o) setPending(null); }} title={pending.title} description={pending.description} confirmLabel={pending.confirm} tone={pending.tone} loading={transition.isPending} onConfirm={() => transition.mutate([c.id, pending.to])}>
          <KeyValue columns={3} items={[{ label: 'Campaign', value: c.title }, { label: 'Status', value: <span className="inline-flex items-center gap-1.5"><CampaignStatusBadge status={c.status} size="sm" />→<CampaignStatusBadge status={pending.to} size="sm" /></span> }, { label: 'In escrow', value: money(c.financials.escrow_locked) }]} />
          {pending.to === 'ARCHIVED' && c.financials.escrow_locked > 0 && <p className="mt-3 text-xs text-warning">{money(c.financials.escrow_locked)} is still locked in escrow for open offers. Resolve those collaborations first if you want the funds released.</p>}
        </ConfirmDialog>
      )}
      <EditBriefSheet campaign={c} open={edit.open} initialTab={edit.tab} onOpenChange={(o) => setEdit((e) => ({ ...e, open: o }))} />
      <RunAgentDialog campaign={c} open={runOpen} onOpenChange={setRunOpen} />
      <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground"><span>Created {fmtDate(c.created_at)}</span><span>· updated {timeAgo(c.updated_at)}</span><span className="inline-flex items-center gap-1">· <Users className="h-3 w-3" />{c.stats.collaborations} creator{c.stats.collaborations === 1 ? '' : 's'} engaged{c.stats.active_collaborations ? ` (${c.stats.active_collaborations} active)` : ''}</span><span>· <Link to="/collaborations" className="hover:underline">All collaborations</Link></span></div>
    </div>
  );
}
