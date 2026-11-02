import { RotateCcw, Target } from 'lucide-react';
import { useCampaigns, useNiches } from '@/hooks/queries';
import { num, money, platformLabel } from '@/lib/utils';
import { Label, SearchInput, Select, ChipGroup, Slider, Switch, Input, Hint } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { PlatformIcon } from '@/components/ui/status';

export const FOLLOWER_MAX = 1_200_000;
export const PLATFORM_OPTIONS = ['instagram', 'youtube', 'tiktok'];

export interface CreatorFilterState {
  q: string; campaign_id: string; niche: string; platform: string; min_followers: number; max_followers: number; min_engagement: string; max_rate: string; rate_type: 'post' | 'reel' | 'video' | 'story'; verified: boolean; sort: string;
}

export const DEFAULT_FILTERS: CreatorFilterState = { q: '', campaign_id: '', niche: '', platform: '', min_followers: 0, max_followers: FOLLOWER_MAX, min_engagement: '', max_rate: '', rate_type: 'video', verified: false, sort: 'relevance' };

export function filtersToParams(f: CreatorFilterState): Record<string, unknown> {
  return {
    q: f.q.trim() || undefined, campaign_id: f.campaign_id || undefined, niche: f.niche || undefined, platform: f.platform || undefined,
    min_followers: f.min_followers > 0 ? f.min_followers : undefined, max_followers: f.max_followers < FOLLOWER_MAX ? f.max_followers : undefined,
    min_engagement: f.min_engagement ? Number(f.min_engagement) : undefined, max_rate: f.max_rate ? Number(f.max_rate) : undefined, rate_type: f.max_rate || f.sort.startsWith('rate') ? f.rate_type : undefined,
    verified: f.verified ? '1' : undefined, sort: f.sort !== 'relevance' ? f.sort : undefined, limit: 100,
  };
}

export function filtersFromSearch(sp: URLSearchParams): CreatorFilterState {
  const n = (k: string, d: number) => { const v = Number(sp.get(k)); return sp.has(k) && Number.isFinite(v) ? v : d; };
  const rt = sp.get('rate_type');
  return {
    q: sp.get('q') ?? '', campaign_id: sp.get('campaign_id') ?? '', niche: sp.get('niche') ?? '', platform: sp.get('platform') ?? '',
    min_followers: n('min_followers', 0), max_followers: n('max_followers', FOLLOWER_MAX), min_engagement: sp.get('min_engagement') ?? '', max_rate: sp.get('max_rate') ?? '',
    rate_type: rt === 'post' || rt === 'reel' || rt === 'story' || rt === 'video' ? rt : 'video', verified: sp.get('verified') === '1', sort: sp.get('sort') ?? 'relevance',
  };
}

export function filtersToSearch(f: CreatorFilterState): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.q.trim()) sp.set('q', f.q.trim());
  if (f.campaign_id) sp.set('campaign_id', f.campaign_id);
  if (f.niche) sp.set('niche', f.niche);
  if (f.platform) sp.set('platform', f.platform);
  if (f.min_followers > 0) sp.set('min_followers', String(f.min_followers));
  if (f.max_followers < FOLLOWER_MAX) sp.set('max_followers', String(f.max_followers));
  if (f.min_engagement) sp.set('min_engagement', f.min_engagement);
  if (f.max_rate) sp.set('max_rate', f.max_rate);
  if (f.rate_type !== 'video') sp.set('rate_type', f.rate_type);
  if (f.verified) sp.set('verified', '1');
  if (f.sort !== 'relevance') sp.set('sort', f.sort);
  return sp;
}

export function activeFilterCount(f: CreatorFilterState): number {
  return [f.q.trim(), f.niche, f.platform, f.min_followers > 0, f.max_followers < FOLLOWER_MAX, f.min_engagement, f.max_rate, f.verified].filter(Boolean).length;
}

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance (match score)' }, { value: 'followers', label: 'Followers · high to low' }, { value: 'engagement', label: 'Engagement · high to low' },
  { value: 'rate_asc', label: 'Rate · low to high' }, { value: 'rate_desc', label: 'Rate · high to low' }, { value: 'rating', label: 'Rating' },
];

export function CreatorFilters({ value, onChange, onReset, hideHeader }: { value: CreatorFilterState; onChange: (patch: Partial<CreatorFilterState>) => void; onReset: () => void; hideHeader?: boolean }) {
  const niches = useNiches();
  const campaigns = useCampaigns({});
  const eligible = (campaigns.data ?? []).filter((c) => ['ACTIVE', 'DRAFT', 'PAUSED'].includes(c.status));
  const selected = eligible.find((c) => c.id === value.campaign_id);
  const count = activeFilterCount(value);

  return (
    <div className="space-y-5">
      <div className={hideHeader ? 'flex justify-end' : 'flex items-center justify-between'}>
        {!hideHeader && <h2 className="text-sm font-semibold">Filters{count > 0 && <span className="ml-1.5 rounded-full bg-primary-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-primary">{count}</span>}</h2>}
        {count > 0 && <Button size="xs" variant="ghost" leftIcon={<RotateCcw className="h-3 w-3" />} onClick={onReset}>Reset</Button>}
      </div>

      <SearchInput value={value.q} onChange={(q) => onChange({ q })} placeholder="Name, handle, bio, tag…" />

      <div className="rounded-xl border border-primary/25 bg-primary-soft/40 p-3">
        <Label className="mb-1.5"><span className="inline-flex items-center gap-1.5"><Target className="h-3.5 w-3.5 text-primary" />Score against campaign</span></Label>
        <Select size="sm" value={value.campaign_id} onValueChange={(campaign_id) => onChange({ campaign_id })} allowEmpty="No campaign — generic scoring" placeholder={campaigns.isLoading ? 'Loading…' : 'Pick a campaign'} options={eligible.map((c) => ({ value: c.id, label: <span className="truncate">{c.title}</span>, description: `${c.status.toLowerCase()} · ${c.target_niches.slice(0, 2).join(', ') || 'no niches'}` }))} />
        <Hint>{selected ? <span>Scoring against <strong>{selected.target_niches.slice(0, 2).join(', ')}</strong>{selected.rate_band_max != null ? ` · band ${money(selected.rate_band_min ?? 0)}–${money(selected.rate_band_max)}` : ''}. Shortlist goes straight to this campaign.</span> : 'Match scores, reasons and one-click shortlisting use the campaign brief.'}</Hint>
      </div>

      <div>
        <Label>Niche</Label>
        <ChipGroup size="sm" multiple={false} options={(niches.data ?? []).map((n) => ({ value: n, label: n }))} value={value.niche ? [value.niche] : []} onChange={(v) => onChange({ niche: v[0] ?? '' })} />
      </div>

      <div>
        <Label>Platform</Label>
        <ChipGroup size="sm" multiple={false} options={PLATFORM_OPTIONS.map((p) => ({ value: p, label: <span className="inline-flex items-center gap-1.5"><PlatformIcon platform={p} className="h-4 w-4 text-[9px]" />{platformLabel(p)}</span> }))} value={value.platform ? [value.platform] : []} onChange={(v) => onChange({ platform: v[0] ?? '' })} />
      </div>

      <div>
        <Label hint={`${num(value.min_followers, { compact: true })} – ${value.max_followers >= FOLLOWER_MAX ? `${num(FOLLOWER_MAX, { compact: true })}+` : num(value.max_followers, { compact: true })}`}>Followers</Label>
        <Slider min={0} max={FOLLOWER_MAX} step={10_000} value={[value.min_followers, value.max_followers]} onValueChange={([a, b]) => onChange({ min_followers: a ?? 0, max_followers: b ?? FOLLOWER_MAX })} format={(v) => (v >= FOLLOWER_MAX ? `${num(v, { compact: true })}+` : num(v, { compact: true }))} />
      </div>

      <div>
        <Label>Min engagement</Label>
        <Input type="number" min={0} step={0.5} value={value.min_engagement} onChange={(e) => onChange({ min_engagement: e.target.value })} placeholder="e.g. 3" rightSlot={<span className="text-xs">%</span>} className="h-9" />
      </div>

      <div>
        <Label>Max rate</Label>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Input type="number" min={0} step={50} value={value.max_rate} onChange={(e) => onChange({ max_rate: e.target.value })} placeholder="Any" leftIcon={<span className="text-sm">$</span>} className="h-9" />
          <Select size="sm" className="w-[104px]" value={value.rate_type} onValueChange={(rate_type) => onChange({ rate_type: rate_type as CreatorFilterState['rate_type'] })} options={[{ value: 'video', label: 'Video' }, { value: 'reel', label: 'Reel' }, { value: 'post', label: 'Post' }, { value: 'story', label: 'Story' }]} />
        </div>
      </div>

      <Switch checked={value.verified} onCheckedChange={(verified) => onChange({ verified })} label="Verified only" description="Identity-checked creators" />

      <div>
        <Label>Sort by</Label>
        <Select size="sm" value={value.sort} onValueChange={(sort) => onChange({ sort })} options={SORT_OPTIONS} />
      </div>
    </div>
  );
}
