import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, Megaphone, Wallet, ShieldAlert, ArrowRight, Bot, Plus, Clock, Sparkles, Cpu } from 'lucide-react';
import { useAgencies, useCampaigns, useCheckpoints, useRuns } from '@/hooks/queries';
import { useAuth } from '@/store/auth';
import { money, num, timeAgo, titleCase, cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { QueryError } from '@/components/collaborations/QueryError';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, Section } from '@/components/ui/card';
import { OrgMark } from '@/components/ui/avatar';
import { Stat, Progress, EmptyState, SkeletonCards, Skeleton, SkeletonRows } from '@/components/ui/feedback';
import { SegmentedControl } from '@/components/ui/field';
import { BarList, CHART } from '@/components/ui/charts';
import { DataTable, type Column } from '@/components/ui/data';
import { CampaignStatusBadge, RunStatusBadge, CHECKPOINT_ACTION, RiskBadge } from '@/components/ui/status';
import { Tooltip } from '@/components/ui/overlay';
import { ClientCard } from '@/components/agency/ClientCard';
import type { Campaign } from '@/types';

export default function AgencyWorkspace() {
  const navigate = useNavigate();
  const me = useAuth((s) => s.me);
  const agencies = useAgencies();
  const campaigns = useCampaigns({});
  const pending = useCheckpoints({ status: 'PENDING' });
  const runs = useRuns({});
  const [client, setClient] = React.useState<string>('all');

  const agency = (agencies.data ?? []).find((a) => a.id === me?.org?.id) ?? agencies.data?.[0];
  const clients = agency?.clients ?? [];
  const clientIds = new Set(clients.map((c) => c.id));
  const inScope = (brandId: string | null | undefined) => (client === 'all' ? Boolean(brandId && clientIds.has(brandId)) : brandId === client);

  const scopedCampaigns = (campaigns.data ?? []).filter((c) => inScope(c.brand_id));
  const scopedPending = (pending.data ?? []).filter((c) => inScope(c.brand_id));
  const campaignBrand = new Map((campaigns.data ?? []).map((c) => [c.id, c.brand_id]));
  const scopedRuns = (runs.data ?? []).filter((r) => (r.campaign_id ? inScope(campaignBrand.get(r.campaign_id)) : client === 'all'));
  const scopedClients = clients.filter((c) => client === 'all' || c.id === client);

  const totals = {
    active: clients.reduce((a, c) => a + (c.active_campaigns ?? 0), 0),
    budget: clients.reduce((a, c) => a + c.budget, 0),
    pending: clients.reduce((a, c) => a + c.pending_checkpoints, 0),
  };

  const columns: Column<Campaign>[] = [
    { key: 'brand', header: 'Client', render: (c) => <span className="flex items-center gap-2"><OrgMark name={c.brand_name ?? c.brand_id} src={c.brand_logo} size="xs" /><span className="max-w-[120px] truncate">{c.brand_name ?? c.brand_id}</span></span>, sortValue: (c) => c.brand_name ?? '' },
    { key: 'title', header: 'Campaign', render: (c) => <Tooltip content={c.title}><span className="block max-w-[200px] truncate font-medium">{c.title}</span></Tooltip>, sortValue: (c) => c.title },
    { key: 'status', header: 'Status', render: (c) => <CampaignStatusBadge status={c.status} size="sm" /> },
    { key: 'budget', header: 'Budget', align: 'right', render: (c) => <span className="tabular-nums">{money(c.financials.budget)}</span>, sortValue: (c) => c.financials.budget },
    { key: 'committed', header: 'Committed', align: 'right', render: (c) => <Tooltip content={`${c.financials.utilisation_pct.toFixed(0)}% of budget`}><span className="tabular-nums">{money(c.financials.committed)}</span></Tooltip>, sortValue: (c) => c.financials.committed },
    { key: 'pending', header: 'Approvals', align: 'right', render: (c) => c.stats.pending_checkpoints ? <Link to={`/approvals?campaign_id=${c.id}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-warning hover:underline">{c.stats.pending_checkpoints} <ArrowRight className="h-3 w-3" /></Link> : <span className="text-muted-foreground">—</span>, sortValue: (c) => c.stats.pending_checkpoints },
  ];

  if (agencies.isLoading) {
    return <div className="page"><PageHeader title={<Skeleton className="h-8 w-64" />} /><SkeletonCards /><div className="mt-6"><SkeletonCards count={3} className="xl:grid-cols-3" /></div></div>;
  }
  if (agencies.isError) {
    return <div className="page"><PageHeader title="Agency workspace" /><QueryError what="your agency workspace" error={agencies.error} refetch={agencies.refetch} /></div>;
  }
  if (!agency) {
    return <div className="page"><PageHeader title="Agency workspace" /><EmptyState icon={Building2} title="No agency linked to your account" description="Ask an administrator to attach your user to an agency." /></div>;
  }

  return (
    <div className="page">
      <PageHeader
        title={agency.name}
        meta={<Badge tone="primary">{clients.length} client{clients.length === 1 ? '' : 's'}</Badge>}
        description={agency.description ?? 'Consolidated view across every client brand you manage.'}
        actions={<>
          <Button variant="secondary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => navigate('/campaigns/new')}>New campaign</Button>
          <Button variant="agent" leftIcon={<Sparkles className="h-4 w-4" />} onClick={() => navigate('/agents?new=1')}>Authorise agent</Button>
        </>}
      />

      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Clients" value={num(clients.length)} icon={Building2} tone="primary" hint={clients.map((c) => c.industry).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3).join(' · ')} />
          <Stat label="Active campaigns" value={num(totals.active)} icon={Megaphone} tone="success" hint={`${clients.reduce((a, c) => a + (c.campaigns_count ?? 0), 0)} total`} onClick={() => navigate('/campaigns')} />
          <Stat label="Managed budget" value={money(totals.budget)} icon={Wallet} tone="info" hint={`${money(clients.reduce((a, c) => a + c.spent, 0))} paid · ${money(clients.reduce((a, c) => a + c.escrow, 0))} in escrow`} onClick={() => navigate('/finance')} />
          <Stat label="Pending approvals" value={num(totals.pending)} icon={ShieldAlert} tone={totals.pending ? 'warning' : 'neutral'} hint="Agent actions held across clients" onClick={() => navigate('/approvals')} />
        </div>

        <Section title="Clients" description="Budget, escrow and pending approvals per brand.">
          {clients.length === 0 ? <EmptyState icon={Building2} title="No clients yet" description="Client brands linked to this agency appear here." /> : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {clients.map((c) => <ClientCard key={c.id} client={c} />)}
            </div>
          )}
        </Section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-base font-semibold">Across clients</h2><p className="text-[13px] text-muted-foreground">Filter the sections below to one client.</p></div>
          <div className="max-w-full overflow-x-auto"><SegmentedControl size="sm" value={client} onChange={setClient} options={[{ value: 'all', label: 'All clients' }, ...clients.map((c) => ({ value: c.id, label: c.name }))]} /></div>
        </div>

        <Section title="Campaigns" description={`${scopedCampaigns.length} campaign${scopedCampaigns.length === 1 ? '' : 's'}`} action={<Button variant="ghost" size="sm" onClick={() => navigate(client === 'all' ? '/campaigns' : `/campaigns?brand_id=${client}`)}>Open</Button>}>
          {campaigns.isLoading ? <div className="card p-5"><Skeleton className="h-40" /></div> : <DataTable rows={scopedCampaigns} columns={columns} rowKey={(c) => c.id} onRowClick={(c) => navigate(`/campaigns/${c.id}`)} empty={<EmptyState compact icon={Megaphone} title="No campaigns" action={<Button size="sm" onClick={() => navigate('/campaigns/new')}>New campaign</Button>} />} />}
        </Section>

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">

            <Card>
              <CardHeader title="Recent agent runs" description="Latest runs across the selected clients" icon={<Bot className="h-4 w-4" />} action={<Button variant="ghost" size="sm" onClick={() => navigate('/agents')}>Agents</Button>} />
              {runs.isLoading ? <SkeletonRows rows={3} /> : scopedRuns.length === 0 ? <EmptyState compact icon={Bot} title="No agent runs" description="Launch an agent to see runs here." /> : (
                <ul className="divide-y divide-border/70">
                  {scopedRuns.slice(0, 6).map((r) => (
                    <li key={r.id}>
                      <Link to={`/agents/runs/${r.id}`} className="flex items-center gap-3 py-2.5 transition hover:text-primary">
                        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', r.status === 'RUNNING' ? 'bg-agent-soft text-agent' : 'bg-surface-muted text-muted-foreground')}>{r.mode === 'LLM' ? <Sparkles className="h-4 w-4" /> : <Cpu className="h-4 w-4" />}</span>
                        <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{r.session_name ?? r.session_id}{r.campaign_title ? <span className="font-normal text-muted-foreground"> · {r.campaign_title}</span> : null}</span><span className="block truncate text-xs text-muted-foreground">{r.goal}</span></span>
                        <span className="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:block">{money(r.spend_committed)} · {timeAgo(r.started_at)}</span>
                        <RunStatusBadge status={r.status} size="sm" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader title="Pending approvals" description="Held agent actions awaiting you" icon={<ShieldAlert className="h-4 w-4" />} action={<Button variant="ghost" size="sm" onClick={() => navigate('/approvals')}>Queue</Button>} />
              {pending.isLoading ? <SkeletonRows rows={3} /> : scopedPending.length === 0 ? <EmptyState compact icon={ShieldAlert} title="Nothing pending" description="Agents are operating inside policy." /> : (
                <div className="space-y-2.5">
                  {scopedPending.slice(0, 6).map((c) => (
                    <Link key={c.id} to={`/approvals?checkpoint=${c.id}`} className="block rounded-xl border border-border p-3 transition hover:border-warning/50 hover:bg-warning-soft/30">
                      <div className="flex items-center justify-between gap-2"><Badge tone={CHECKPOINT_ACTION[c.action_type]?.tone ?? 'neutral'} size="sm">{CHECKPOINT_ACTION[c.action_type]?.label ?? titleCase(c.action_type)}</Badge>{c.amount != null && <span className="text-[13px] font-semibold tabular-nums">{money(c.amount)}</span>}</div>
                      <div className="mt-1 truncate text-xs font-medium">{c.campaign_title ?? 'No campaign'}{c.agent_name ? <span className="font-normal text-muted-foreground"> · {c.agent_name}</span> : null}</div>
                      <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.justification}</div>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground"><span className="flex items-center gap-1"><Clock className="h-3 w-3" />{timeAgo(c.created_at)}</span><RiskBadge level={c.risk_level} size="sm" /></div>
                    </Link>
                  ))}
                  {scopedPending.length > 6 && <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate('/approvals')}>{scopedPending.length - 6} more in the queue</Button>}
                </div>
              )}
            </Card>

            <Card>
              <CardHeader title="Spend by client" description="Paid plus escrow, against allocated budget" icon={<Wallet className="h-4 w-4" />} />
              {scopedClients.length === 0 ? <EmptyState compact icon={Wallet} title="No clients" /> : (
                <BarList items={scopedClients.map((c) => ({ label: c.name, value: c.spent + c.escrow, hint: <Tooltip content={`${money(c.spent)} paid · ${money(c.escrow)} in escrow · ${money(c.budget)} allocated`}><span>of {money(c.budget, { compact: true })}</span></Tooltip> }))} format={(v) => money(v)} color={CHART.teal} max={Math.max(1, ...scopedClients.map((c) => c.budget))} />
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
