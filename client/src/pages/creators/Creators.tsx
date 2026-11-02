import * as React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { LayoutGrid, List, SlidersHorizontal, Users, SearchX, Target } from 'lucide-react';
import type { Creator } from '@/types';
import { useCreators, useCampaign } from '@/hooks/queries';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet } from '@/components/ui/overlay';
import { SegmentedControl } from '@/components/ui/field';
import { EmptyState } from '@/components/ui/feedback';
import { CreatorFilters, filtersFromSearch, filtersToSearch, filtersToParams, activeFilterCount, DEFAULT_FILTERS, type CreatorFilterState } from '@/components/creators/CreatorFilters';
import { CreatorCard, CreatorCardSkeleton } from '@/components/creators/CreatorCard';
import { CreatorQuickView } from '@/components/creators/CreatorQuickView';
import { OfferDialog } from '@/components/creators/OfferDialog';

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export default function Creators() {
  const [sp, setSp] = useSearchParams();
  const [filters, setFilters] = React.useState<CreatorFilterState>(() => filtersFromSearch(sp));
  const [view, setView] = React.useState<'grid' | 'list'>((sp.get('view') as 'grid' | 'list') || 'grid');
  const [drawer, setDrawer] = React.useState(false);
  const [quick, setQuick] = React.useState<Creator | null>(null);
  const [offerFor, setOfferFor] = React.useState<Creator | null>(null);

  const debounced = useDebounced(filters, 250);
  // Keep the URL in sync (shareable, and ?campaign_id= is the contract with the campaign page)
  React.useEffect(() => {
    const next = filtersToSearch(debounced);
    if (view !== 'grid') next.set('view', view);
    if (next.toString() !== sp.toString()) setSp(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, view]);
  // React to external URL changes (e.g. "Find creators" link while already on this page)
  React.useEffect(() => {
    const fromUrl = filtersFromSearch(sp);
    if (filtersToSearch(fromUrl).toString() !== filtersToSearch(debounced).toString()) setFilters(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  const params = React.useMemo(() => filtersToParams(debounced), [debounced]);
  const creators = useCreators(params);
  const campaign = useCampaign(debounced.campaign_id || undefined);
  const rows = creators.data ?? [];
  const patch = (p: Partial<CreatorFilterState>) => setFilters((f) => ({ ...f, ...p }));
  const reset = () => setFilters((f) => ({ ...DEFAULT_FILTERS, campaign_id: f.campaign_id, sort: f.sort }));
  const count = activeFilterCount(filters);

  const list = (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{creators.isLoading ? 'Searching…' : `${rows.length} creator${rows.length === 1 ? '' : 's'}`}{creators.isFetching && !creators.isLoading && <span className="ml-2 text-xs font-normal text-muted-foreground">updating…</span>}</div>
          {campaign.data ? (
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"><Target className="h-3.5 w-3.5 text-primary" />Scored against <Link to={`/campaigns/${campaign.data.id}`} className="font-medium text-foreground hover:underline">{campaign.data.title}</Link>{campaign.data.target_niches.slice(0, 2).map((n) => <Badge key={n} tone="outline" size="sm">{n}</Badge>)}</div>
          ) : <div className="mt-0.5 text-xs text-muted-foreground">Generic fit scores. Pick a campaign to rank against its brief, platforms and rate band.</div>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="md" className="lg:hidden" leftIcon={<SlidersHorizontal className="h-4 w-4" />} onClick={() => setDrawer(true)}>Filters{count ? ` (${count})` : ''}</Button>
          <SegmentedControl size="md" label="View" value={view} onChange={setView} options={[{ value: 'grid', label: <LayoutGrid className="h-4 w-4" />, title: 'Card view' }, { value: 'list', label: <List className="h-4 w-4" />, title: 'Table view' }]} />
        </div>
      </div>

      {creators.isLoading ? (
        <div className={cn('grid gap-4', view === 'grid' ? 'md:grid-cols-2 2xl:grid-cols-3' : 'grid-cols-1')}>{Array.from({ length: 6 }).map((_, i) => <CreatorCardSkeleton key={i} />)}</div>
      ) : creators.isError ? (
        <EmptyState icon={Users} title="Couldn't load creators" description={creators.error instanceof Error ? creators.error.message : 'Try again in a moment.'} action={<Button size="sm" variant="secondary" onClick={() => creators.refetch()}>Retry</Button>} />
      ) : rows.length === 0 ? (
        <EmptyState icon={SearchX} title="No creators match these filters" description="Loosen the follower range, rate ceiling or niche to see more of the marketplace." action={<Button size="sm" variant="secondary" onClick={reset}>Clear filters</Button>} />
      ) : (
        <div className={cn('grid gap-4', view === 'grid' ? 'md:grid-cols-2 2xl:grid-cols-3' : 'grid-cols-1')}>
          {rows.map((c) => <CreatorCard key={c.id} c={c} campaignId={debounced.campaign_id || undefined} layout={view} onQuickView={setQuick} onOffer={setOfferFor} />)}
        </div>
      )}
    </>
  );

  return (
    <div className="page">
      <PageHeader title="Creators" description="Search the marketplace, score creators against a brief, and shortlist or send offers in one place." />
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="hidden lg:block"><div className="card sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto p-5"><CreatorFilters value={filters} onChange={patch} onReset={reset} /></div></aside>
        <div className="min-w-0">{list}</div>
      </div>

      <Sheet open={drawer} onOpenChange={setDrawer} side="left" width="sm" title="Filters" description="Narrow the marketplace" footer={<Button onClick={() => setDrawer(false)}>Show {rows.length} result{rows.length === 1 ? '' : 's'}</Button>}>
        <div className="px-6 py-5"><CreatorFilters value={filters} onChange={patch} onReset={reset} hideHeader /></div>
      </Sheet>
      <CreatorQuickView creator={quick} campaignId={debounced.campaign_id || undefined} open={Boolean(quick)} onOpenChange={(o) => { if (!o) setQuick(null); }} onOffer={setOfferFor} />
      {offerFor && <OfferDialog creator={offerFor} defaultCampaignId={debounced.campaign_id || undefined} open={Boolean(offerFor)} onOpenChange={(o) => { if (!o) setOfferFor(null); }} />}
    </div>
  );
}
