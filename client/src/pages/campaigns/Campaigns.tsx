import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, LayoutGrid, List, Megaphone, Wallet, PlayCircle, ShieldAlert, Layers, SearchX, AlertTriangle } from 'lucide-react';
import type { Campaign, CampaignStatus } from '@/types';
import { useCampaigns, useBrands } from '@/hooks/queries';
import { useAuth } from '@/store/auth';
import { money, fmtDate, num } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { SearchInput, SegmentedControl, Select } from '@/components/ui/field';
import { Stat, SkeletonCards, EmptyState, Skeleton } from '@/components/ui/feedback';
import { DataTable, type Column } from '@/components/ui/data';
import { CampaignStatusBadge, PlatformIcons } from '@/components/ui/status';
import { CampaignCard, BudgetBar } from '@/components/campaigns/CampaignCard';

type StatusFilter = 'ALL' | CampaignStatus;
const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [{ value: 'ALL', label: 'All' }, { value: 'ACTIVE', label: 'Active' }, { value: 'DRAFT', label: 'Draft' }, { value: 'PAUSED', label: 'Paused' }, { value: 'COMPLETED', label: 'Completed' }];

export default function Campaigns() {
  const navigate = useNavigate();
  const me = useAuth((s) => s.me);
  const isAgency = me?.user.role === 'AGENCY' || me?.user.role === 'ADMIN';
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') as StatusFilter) || 'ALL';
  const brandId = params.get('brand_id') ?? '';
  const view = (params.get('view') as 'cards' | 'table') || 'cards';
  const [search, setSearch] = React.useState(params.get('q') ?? '');

  const setParam = (k: string, v: string) => setParams((p) => { const n = new URLSearchParams(p); if (v) n.set(k, v); else n.delete(k); return n; }, { replace: true });

  const brands = useBrands();
  const all = useCampaigns({});
  const list = useCampaigns({ status: status === 'ALL' ? undefined : status, brand_id: brandId || undefined });

  const q = search.trim().toLowerCase();
  const rows = React.useMemo(() => (list.data ?? []).filter((c) => !q || c.title.toLowerCase().includes(q) || (c.brand_name ?? '').toLowerCase().includes(q) || c.target_niches.some((n) => n.toLowerCase().includes(q))), [list.data, q]);

  const totals = React.useMemo(() => {
    const src = all.data ?? [];
    return { campaigns: src.length, active: src.filter((c) => c.status === 'ACTIVE').length, budget: src.reduce((a, c) => a + c.budget, 0), escrow: src.reduce((a, c) => a + c.financials.escrow_locked, 0), spent: src.reduce((a, c) => a + c.financials.spent, 0), pending: src.reduce((a, c) => a + c.stats.pending_checkpoints, 0) };
  }, [all.data]);

  const hasFilter = status !== 'ALL' || Boolean(brandId) || Boolean(q);
  const clear = () => { setSearch(''); setParams((p) => { const n = new URLSearchParams(p); n.delete('status'); n.delete('brand_id'); n.delete('q'); return n; }, { replace: true }); };

  const columns: Column<Campaign>[] = [
    { key: 'title', header: 'Campaign', render: (c) => <div className="flex min-w-0 items-center gap-3"><Avatar name={c.brand_name ?? 'Brand'} src={c.brand_logo} size="sm" square /><div className="min-w-0"><div className="truncate font-medium">{c.title}</div><div className="truncate text-xs text-muted-foreground">{c.brand_name}</div></div></div>, sortValue: (c) => c.title.toLowerCase() },
    { key: 'status', header: 'Status', render: (c) => <CampaignStatusBadge status={c.status} size="sm" />, sortValue: (c) => c.status },
    { key: 'platforms', header: 'Platforms', render: (c) => <PlatformIcons platforms={c.target_platforms} /> },
    { key: 'budget', header: 'Budget', align: 'right', render: (c) => <span className="font-semibold tabular-nums">{money(c.budget)}</span>, sortValue: (c) => c.budget },
    { key: 'util', header: 'Utilisation', width: '180px', render: (c) => <div className="min-w-[140px]"><BudgetBar c={c} size="xs" /><div className="mt-1 text-[11px] text-muted-foreground">{money(c.financials.spent)} paid · {money(c.financials.escrow_locked)} escrow</div></div>, sortValue: (c) => c.financials.utilisation_pct },
    { key: 'collabs', header: 'Collabs', align: 'right', render: (c) => <span className="tabular-nums">{c.stats.collaborations}</span>, sortValue: (c) => c.stats.collaborations },
    { key: 'shortlist', header: 'Shortlist', align: 'right', render: (c) => <span className="tabular-nums">{c.stats.shortlist}</span>, sortValue: (c) => c.stats.shortlist },
    { key: 'pending', header: 'Approvals', render: (c) => c.stats.pending_checkpoints ? <Badge tone="warning" size="sm"><ShieldAlert className="h-3 w-3" />{c.stats.pending_checkpoints} pending</Badge> : <span className="text-xs text-muted-foreground">—</span>, sortValue: (c) => c.stats.pending_checkpoints },
    { key: 'dates', header: 'Dates', render: (c) => <span className="whitespace-nowrap text-xs text-muted-foreground">{fmtDate(c.start_date)} → {fmtDate(c.end_date)}</span>, sortValue: (c) => c.start_date ?? '' },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Campaigns"
        description={isAgency ? 'Every campaign across your client brands — budgets, pipelines and what agents are waiting on.' : `Briefs, budgets and creator pipelines for ${me?.org?.name ?? 'your brand'}.`}
        actions={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => navigate('/campaigns/new')}>New campaign</Button>}
      />

      {all.isLoading ? <SkeletonCards /> : all.isError ? null : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Campaigns" value={num(totals.campaigns)} icon={Layers} tone="primary" hint={`${totals.active} active`} />
          <Stat label="Active" value={num(totals.active)} icon={PlayCircle} tone="success" hint={`${totals.campaigns - totals.active} draft, paused or done`} onClick={() => setParam('status', 'ACTIVE')} />
          <Stat label="Total budget" value={money(totals.budget)} icon={Wallet} tone="info" hint={`${money(totals.spent)} paid · ${money(totals.escrow)} in escrow`} />
          <Stat label="Pending approvals" value={num(totals.pending)} icon={ShieldAlert} tone={totals.pending ? 'warning' : 'neutral'} hint={totals.pending ? 'Agent actions waiting on you' : 'Agents are operating inside policy'} onClick={() => navigate('/approvals')} />
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="overflow-x-auto"><SegmentedControl size="md" label="Filter by status" options={STATUS_OPTIONS} value={status} onChange={(v) => setParam('status', v === 'ALL' ? '' : v)} /></div>
          {isAgency && <Select size="md" className="sm:w-56" value={brandId} onValueChange={(v) => setParam('brand_id', v)} allowEmpty="All clients" placeholder="All clients" options={(brands.data ?? []).map((b) => ({ value: b.id, label: b.name }))} />}
        </div>
        <div className="flex items-center gap-2">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setParam('q', v); }} placeholder="Search title, brand or niche…" className="sm:w-64" />
          <SegmentedControl size="md" label="View" options={[{ value: 'cards', label: <LayoutGrid className="h-4 w-4" />, title: 'Card view' }, { value: 'table', label: <List className="h-4 w-4" />, title: 'Table view' }]} value={view} onChange={(v) => setParam('view', v === 'cards' ? '' : v)} />
        </div>
      </div>

      <div className="mt-4">
        {list.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="card space-y-3 p-5"><div className="flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-xl" /><div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-2/3" /><Skeleton className="h-3 w-1/3" /></div></div><Skeleton className="h-3 w-1/2" /><Skeleton className="h-2 w-full" /><Skeleton className="h-3 w-3/4" /></div>)}</div>
        ) : list.isError ? (
          <EmptyState icon={AlertTriangle} title="Couldn't load campaigns" description={list.error instanceof Error ? list.error.message : 'Try again in a moment.'} action={<Button size="sm" variant="secondary" onClick={() => list.refetch()}>Retry</Button>} />
        ) : rows.length === 0 ? (
          hasFilter ? <EmptyState icon={SearchX} title="No campaigns match" description="Try a different status, client or search term." action={<Button variant="secondary" size="sm" onClick={clear}>Clear filters</Button>} />
            : <EmptyState icon={Megaphone} title="No campaigns yet" description="Create a campaign with a brief, budget and rate band — then let an agent source creators inside those limits." action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => navigate('/campaigns/new')}>New campaign</Button>} />
        ) : view === 'table' ? (
          <DataTable rows={rows} columns={columns} rowKey={(c) => c.id} onRowClick={(c) => navigate(`/campaigns/${c.id}`)} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rows.map((c) => <CampaignCard key={c.id} c={c} />)}</div>
        )}
        {!list.isLoading && rows.length > 0 && <div className="mt-3 text-xs text-muted-foreground">{rows.length} campaign{rows.length === 1 ? '' : 's'}{hasFilter ? ' matching' : ''}</div>}
      </div>
    </div>
  );
}
