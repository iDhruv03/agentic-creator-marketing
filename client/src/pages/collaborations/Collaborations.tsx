import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LayoutGrid, List, Handshake, Inbox, Clapperboard, Eye, Lock, BadgeDollarSign, Users } from 'lucide-react';
import { useCollaborations, useCampaigns } from '@/hooks/queries';
import type { Collaboration } from '@/types';
import { money, timeAgo, cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { Stat, SkeletonCards, Skeleton, EmptyState, Progress } from '@/components/ui/feedback';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { SegmentedControl, Select, SearchInput } from '@/components/ui/field';
import { DataTable, type Column } from '@/components/ui/data';
import { CollabStatusBadge, ActorBadge } from '@/components/ui/status';
import { CollabCard } from '@/components/collaborations/CollabCard';
import { BOARD_COLUMNS, OPEN_OFFER, IN_PRODUCTION, collabRate, deliverableProgress, deadlineInfo, matchesCreator } from '@/components/collaborations/collab-utils';

type View = 'board' | 'list';
type Initiated = 'ALL' | 'AGENT' | 'HUMAN';
const VIEW_KEY = 'cmi.collaborations.view';

function readView(): View {
  try { return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'board'; } catch { return 'board'; }
}

export default function Collaborations() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [view, setViewState] = React.useState<View>(() => (params.get('view') === 'list' ? 'list' : params.get('view') === 'board' ? 'board' : readView()));
  const setView = (v: View) => { setViewState(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ } };
  const [campaignId, setCampaignId] = React.useState('');
  const [initiated, setInitiated] = React.useState<Initiated>('ALL');
  const [search, setSearch] = React.useState('');

  const collabs = useCollaborations({});
  const campaigns = useCampaigns({});

  const filtered = React.useMemo(() => (collabs.data ?? []).filter((c) => (!campaignId || c.campaign_id === campaignId) && (initiated === 'ALL' || c.initiated_by === initiated) && matchesCreator(c, search)), [collabs.data, campaignId, initiated, search]);

  const stats = React.useMemo(() => {
    const all = collabs.data ?? [];
    return {
      offers: all.filter((c) => OPEN_OFFER.includes(c.status)).length,
      production: all.filter((c) => IN_PRODUCTION.includes(c.status)).length,
      review: all.filter((c) => c.status === 'SUBMITTED').length,
      payment: all.filter((c) => c.status === 'APPROVED').length,
      escrow: all.reduce((a, c) => a + (c.escrow_held ?? 0), 0),
    };
  }, [collabs.data]);

  const campaignOptions = (campaigns.data ?? []).map((c) => ({ value: c.id, label: c.title }));
  const hasAny = (collabs.data?.length ?? 0) > 0;
  const filtersActive = Boolean(campaignId || initiated !== 'ALL' || search);

  return (
    <div className="page">
      <PageHeader
        title="Collaborations"
        description="Every offer, contract and payout across your campaigns — negotiated by you or by an agent inside its budget."
        actions={<SegmentedControl value={view} onChange={setView} options={[{ value: 'board', label: 'Board', icon: <LayoutGrid className="h-3.5 w-3.5" /> }, { value: 'list', label: 'List', icon: <List className="h-3.5 w-3.5" /> }]} />}
      />

      {collabs.isLoading ? <SkeletonCards count={5} className="xl:grid-cols-5" /> : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
          <Stat size="sm" label="Open offers" value={stats.offers} icon={Inbox} tone="info" hint="Awaiting creator" />
          <Stat size="sm" label="In production" value={stats.production} icon={Clapperboard} tone="primary" hint="Contracted" />
          <Stat size="sm" label="In review" value={stats.review} icon={Eye} tone="warning" hint="Content submitted" />
          <Stat size="sm" label="Awaiting payment" value={stats.payment} icon={BadgeDollarSign} tone="success" hint="Approved, unpaid" />
          <Stat size="sm" label="Escrow held" value={money(stats.escrow)} icon={Lock} tone="warning" hint="Locked for open work" className="col-span-2 sm:col-span-1" />
        </div>
      )}

      {/* Filters */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Search creator or campaign…" className="sm:w-64" />
        <Select value={campaignId} onValueChange={setCampaignId} options={campaignOptions} allowEmpty="All campaigns" placeholder="All campaigns" className="sm:w-56" />
        <SegmentedControl size="sm" value={initiated} onChange={setInitiated} options={[{ value: 'ALL', label: 'All' }, { value: 'AGENT', label: 'Agent' }, { value: 'HUMAN', label: 'Human' }]} />
        <span className="text-xs text-muted-foreground sm:ml-auto">{filtered.length} of {collabs.data?.length ?? 0}</span>
      </div>

      <div className="mt-4">
        {collabs.isLoading ? (
          <div className="flex gap-4 overflow-hidden">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="w-[280px] shrink-0 space-y-3"><Skeleton className="h-6 w-2/3" /><Skeleton className="h-36 w-full rounded-2xl" /><Skeleton className="h-36 w-full rounded-2xl" /></div>)}</div>
        ) : !hasAny ? (
          <EmptyState icon={Handshake} title="No collaborations yet" description="Send an offer to a creator from the marketplace, or let an agent source and negotiate on your behalf." action={<div className="flex gap-2"><Button size="sm" variant="secondary" leftIcon={<Users className="h-3.5 w-3.5" />} onClick={() => navigate('/creators')}>Browse creators</Button><Button size="sm" variant="agent" onClick={() => navigate('/agents?new=1')}>Launch an agent</Button></div>} />
        ) : filtered.length === 0 ? (
          <EmptyState compact icon={Handshake} title="Nothing matches these filters" description="Try a different campaign, initiator or search term." action={filtersActive ? <Button size="sm" variant="secondary" onClick={() => { setCampaignId(''); setInitiated('ALL'); setSearch(''); }}>Clear filters</Button> : undefined} />
        ) : view === 'board' ? <Board rows={filtered} /> : <ListView rows={filtered} onOpen={(c) => navigate(`/collaborations/${c.id}`)} />}
      </div>
    </div>
  );
}

function Board({ rows }: { rows: Collaboration[] }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="flex min-w-max gap-4">
        {BOARD_COLUMNS.map((col) => {
          const items = rows.filter((c) => col.statuses.includes(c.status));
          const total = items.reduce((a, c) => a + collabRate(c), 0);
          return (
            <div key={col.key} className="flex w-[272px] shrink-0 flex-col rounded-2xl bg-surface-muted/60 p-2">
              <div className="flex items-center justify-between px-2 pb-2 pt-1">
                <div className="flex items-center gap-2"><span className="text-[13px] font-semibold">{col.label}</span><span className="rounded-full bg-surface px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-muted-foreground shadow-sm">{items.length}</span></div>
                <span className="text-[11.5px] font-medium tabular-nums text-muted-foreground">{money(total)}</span>
              </div>
              <div className="flex flex-col gap-2">
                {items.map((c) => <CollabCard key={c.id} collab={c} />)}
                {items.length === 0 && <div className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-[11.5px] text-muted-foreground">{col.hint}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ListView({ rows, onOpen }: { rows: Collaboration[]; onOpen: (c: Collaboration) => void }) {
  const columns: Column<Collaboration>[] = [
    { key: 'creator', header: 'Creator', sortValue: (c) => c.creator_name ?? '', render: (c) => <div className="flex items-center gap-2.5"><Avatar name={c.creator_name ?? c.creator_id} src={c.creator_avatar} size="sm" /><div className="min-w-0"><div className="truncate text-[13.5px] font-medium">{c.creator_name}</div><div className="truncate text-xs text-muted-foreground">@{c.creator_handle}</div></div></div> },
    { key: 'campaign', header: 'Campaign', sortValue: (c) => c.campaign_title ?? '', render: (c) => <span className="block min-w-[160px] max-w-[240px] truncate text-[13px]">{c.campaign_title}</span> },
    { key: 'status', header: 'Status', sortValue: (c) => c.status, render: (c) => <CollabStatusBadge status={c.status} size="sm" /> },
    { key: 'rate', header: 'Rate', align: 'right', sortValue: (c) => collabRate(c), render: (c) => <span className="font-semibold tabular-nums">{money(collabRate(c))}{c.agreed_rate == null && <span className="ml-1 text-[10.5px] font-normal text-muted-foreground">proposed</span>}</span> },
    { key: 'deliverables', header: 'Deliverables', sortValue: (c) => deliverableProgress(c.deliverables).pct, render: (c) => { const p = deliverableProgress(c.deliverables); return <div className="w-28"><div className="mb-1 text-[11px] tabular-nums text-muted-foreground">{p.done}/{p.total} approved</div><Progress value={p.pct} size="xs" tone="success" /></div>; } },
    { key: 'escrow', header: 'Escrow', align: 'right', sortValue: (c) => c.escrow_held, render: (c) => <span className={cn('tabular-nums', c.escrow_held > 0 ? 'text-warning' : 'text-muted-foreground')}>{money(c.escrow_held)}</span> },
    { key: 'deadline', header: 'Deadline', sortValue: (c) => c.deadline ?? '9999', render: (c) => { const d = deadlineInfo(c.deadline, c.status); return <span className={cn('whitespace-nowrap text-[12.5px]', d.overdue ? 'font-medium text-danger' : 'text-muted-foreground')}>{d.label}</span>; } },
    { key: 'initiated', header: 'Initiated by', sortValue: (c) => c.initiated_by, render: (c) => <ActorBadge type={c.initiated_by} name={c.initiated_by === 'AGENT' ? 'Agent' : 'Human'} size="sm" /> },
    { key: 'updated', header: 'Updated', sortValue: (c) => c.updated_at, render: (c) => <span className="whitespace-nowrap text-xs text-muted-foreground">{timeAgo(c.updated_at)}</span> },
  ];
  return <DataTable rows={rows} columns={columns} rowKey={(c) => c.id} onRowClick={onOpen} />;
}
