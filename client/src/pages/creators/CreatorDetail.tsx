import * as React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { MapPin, Star, Clock, Send, ExternalLink, Users, Heart, Eye, Layers, Briefcase, Film, TrendingUp, Globe } from 'lucide-react';
import type { Creator, Collaboration, RateBenchmark } from '@/types';
import { useCreator, useBenchmark } from '@/hooks/queries';
import { money, num, pct, fmtDate, hashHue, platformLabel, deliverableLabel } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Card, CardHeader } from '@/components/ui/card';
import { Stat, Skeleton, SkeletonCards, EmptyState } from '@/components/ui/feedback';
import { DataTable, type Column } from '@/components/ui/data';
import { ChartFrame, ChartTooltip, CHART, BarList, Donut } from '@/components/ui/charts';
import { PlatformIcon, PlatformIcons, CollabStatusBadge } from '@/components/ui/status';
import { ShortlistButton } from '@/components/creators/ShortlistButton';
import { OfferDialog } from '@/components/creators/OfferDialog';
import { VerifiedMark } from '@/components/creators/CreatorCard';

const RATE_ROWS: { key: 'post' | 'reel' | 'video' | 'story'; label: string; field: keyof Pick<Creator, 'rate_post' | 'rate_reel' | 'rate_video' | 'rate_story'> }[] = [
  { key: 'post', label: deliverableLabel('POST'), field: 'rate_post' }, { key: 'reel', label: deliverableLabel('REEL'), field: 'rate_reel' }, { key: 'video', label: deliverableLabel('YOUTUBE_VIDEO'), field: 'rate_video' }, { key: 'story', label: deliverableLabel('STORY'), field: 'rate_story' },
];

function RateRow({ c, row }: { c: Creator; row: (typeof RATE_ROWS)[number] }) {
  const bench = useBenchmark({ follower_count: c.follower_count, deliverable: row.key, niche: c.primary_niche });
  const rate = c[row.field];
  const b: RateBenchmark | undefined = bench.data;
  const position = b ? (rate > b.p75 ? 'above' : rate < b.p25 ? 'below' : 'within') : null;
  const span = b ? Math.max(1, b.p75 * 1.25) : 1;
  return (
    <tr className="border-t border-border/70">
      <td className="py-3 pr-3 text-[13.5px] font-medium">{row.label}</td>
      <td className="py-3 pr-3 text-right font-semibold tabular-nums">{money(rate)}</td>
      <td className="hidden py-3 pr-3 sm:table-cell">
        {bench.isLoading ? <Skeleton className="h-3 w-full" /> : b ? (
          <div className="relative h-5 w-full min-w-[140px]">
            <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-muted" />
            <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-info/40" style={{ left: `${(b.p25 / span) * 100}%`, width: `${((b.p75 - b.p25) / span) * 100}%` }} title={`Market p25–p75: ${money(b.p25)}–${money(b.p75)}`} />
            <div className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-info" style={{ left: `${(b.median / span) * 100}%` }} title={`Median ${money(b.median)}`} />
            <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-primary shadow" style={{ left: `${Math.min(100, (rate / span) * 100)}%` }} title={`This creator: ${money(rate)}`} />
          </div>
        ) : <span className="text-xs text-muted-foreground">—</span>}
      </td>
      <td className="hidden py-3 pr-3 text-right text-xs tabular-nums text-muted-foreground md:table-cell">{b ? <span>{money(b.p25)} · <span className="font-medium text-foreground">{money(b.median)}</span> · {money(b.p75)}</span> : '—'}</td>
      <td className="py-3 text-right">{position === 'above' ? <Badge tone="warning" size="sm">Above p75</Badge> : position === 'below' ? <Badge tone="info" size="sm">Below market</Badge> : position === 'within' ? <Badge tone="success" size="sm">Within market</Badge> : null}</td>
    </tr>
  );
}

export default function CreatorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const q = useCreator(id);
  const c = q.data;
  const [offerOpen, setOfferOpen] = React.useState(false);

  if (q.isLoading) {
    return <div className="page"><Skeleton className="mb-6 h-44 w-full rounded-2xl" /><SkeletonCards /><div className="mt-6 grid gap-6 lg:grid-cols-2"><Skeleton className="h-64" /><Skeleton className="h-64" /></div></div>;
  }
  if (q.isError || !c) {
    return <div className="page"><PageHeader crumbs={[{ label: 'Creators', to: '/creators' }]} title="Creator not found" /><EmptyState icon={Users} title="We couldn't load this creator" description={q.error instanceof Error ? q.error.message : 'The profile may have been removed.'} action={<Button variant="secondary" onClick={() => navigate('/creators')}>Back to creators</Button>} /></div>;
  }

  const hue = hashHue(c.handle);
  const collabs = c.collaborations ?? [];
  const a = c.analytics;
  const gender = c.audience.gender;
  const genderSegments = [{ label: 'Female', value: gender.female, color: CHART.rose }, { label: 'Male', value: gender.male, color: CHART.blue }, { label: 'Other', value: gender.other, color: CHART.amber }];

  const collabCols: Column<Collaboration>[] = [
    { key: 'campaign', header: 'Campaign', render: (r) => <div className="min-w-0"><div className="truncate font-medium">{r.campaign_title ?? r.campaign_id}</div><div className="truncate text-xs text-muted-foreground">{r.brand_name}</div></div>, sortValue: (r) => r.campaign_title ?? '' },
    { key: 'status', header: 'Status', render: (r) => <CollabStatusBadge status={r.status} size="sm" />, sortValue: (r) => r.status },
    { key: 'rate', header: 'Rate', align: 'right', render: (r) => <span className="font-semibold tabular-nums">{money(r.agreed_rate ?? r.proposed_rate)}</span>, sortValue: (r) => r.agreed_rate ?? r.proposed_rate },
    { key: 'deliverables', header: 'Deliverables', render: (r) => <span className="text-xs text-muted-foreground">{(r.deliverables ?? []).map((d) => deliverableLabel(d.deliverable_type)).join(', ') || '—'}</span> },
    { key: 'date', header: 'Date', render: (r) => <span className="whitespace-nowrap text-xs text-muted-foreground">{fmtDate(r.created_at)}</span>, sortValue: (r) => r.created_at },
  ];

  return (
    <div className="page">
      <PageHeader compact crumbs={[{ label: 'Creators', to: '/creators' }, { label: c.name }]} title={<span className="sr-only">{c.name}</span>} className="mb-2" />

      {/* Hero */}
      <div className="card overflow-hidden p-0">
        <div className="h-28 w-full sm:h-36" style={{ background: c.cover_url ? `url(${c.cover_url}) center/cover` : `linear-gradient(120deg, hsl(${hue} 70% 55%) 0%, hsl(${(hue + 50) % 360} 72% 48%) 55%, hsl(${(hue + 100) % 360} 65% 42%) 100%)` }} />
        <div className="px-5 pb-5 sm:px-6">
          <div className="-mt-10 flex flex-col gap-4 sm:-mt-12 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
              <Avatar name={c.name} src={c.avatar_url} size="2xl" className="ring-4 ring-surface" />
              <div className="min-w-0 sm:pb-1">
                <div className="flex flex-wrap items-center gap-2"><h1 className="font-display text-2xl font-semibold tracking-tight">{c.name}</h1>{c.verified ? <VerifiedMark className="h-5 w-5" /> : null}<Badge tone={c.available ? 'success' : 'neutral'} dot>{c.available ? 'Available' : 'Unavailable'}</Badge></div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
                  <span>@{c.handle}</span>
                  {c.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{c.location}</span>}
                  <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-current text-warning" />{c.rating} · {c.completed_campaigns} completed campaigns</span>
                  <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />responds in ~{c.response_time_hours}h</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:pb-1">
              <ShortlistButton creator={c} size="md" />
              <Button leftIcon={<Send className="h-4 w-4" />} onClick={() => setOfferOpen(true)}>Send offer</Button>
            </div>
          </div>
          {c.bio && <p className="mt-4 max-w-3xl text-[14px] leading-relaxed text-foreground/85">{c.bio}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Badge tone="primary">{c.primary_niche}</Badge>
            {c.secondary_niches.map((n) => <Badge key={n} tone="outline">{n}</Badge>)}
            {c.content_tags.map((t) => <Badge key={t} tone="neutral" size="sm">#{t}</Badge>)}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Followers" value={num(c.follower_count, { compact: true })} icon={Users} tone="primary" hint="Across all platforms" />
        <Stat label="Engagement" value={pct(c.engagement_rate)} icon={Heart} tone="danger" hint="Weighted by platform reach" />
        <Stat label="Avg views" value={num(c.avg_views, { compact: true })} icon={Eye} tone="info" hint="Per post, last 90 days" />
        <Stat label="Platforms" value={<PlatformIcons platforms={c.platforms} className="gap-1.5 [&>span]:h-7 [&>span]:w-7 [&>span]:text-sm" />} icon={Layers} tone="neutral" hint={c.platforms.map(platformLabel).join(' · ')} />
      </div>

      {/* Platform cards */}
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {c.platform_stats.map((p) => (
          <Card key={p.platform}>
            <div className="flex items-center gap-3">
              <PlatformIcon platform={p.platform} className="h-10 w-10 rounded-xl text-base" />
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold">{platformLabel(p.platform)}</div>
                <div className="truncate text-xs text-muted-foreground">@{p.handle}</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3">
              <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Followers</div><div className="font-semibold tabular-nums">{num(p.followers, { compact: true })}</div></div>
              <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Engagement</div><div className="font-semibold tabular-nums">{pct(p.engagement_rate)}</div></div>
              <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg views</div><div className="font-semibold tabular-nums">{num(p.avg_views, { compact: true })}</div></div>
            </div>
          </Card>
        ))}
      </div>

      {/* Audience */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Top countries" description="Share of audience by market" icon={<Globe className="h-4 w-4" />} />
          <BarList items={c.audience.countries.map((x) => ({ label: x.name, value: x.pct }))} format={(v) => `${v}%`} color={CHART.blue} max={100} />
        </Card>
        <ChartFrame title="Age distribution" description="Share of audience per age band" height={180}>
          <BarChart data={c.audience.ages} margin={{ top: 8, right: 4, bottom: 0, left: -24 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="range" axisLine={false} tickLine={false} />
            <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
            <Tooltip cursor={{ fill: 'hsl(var(--muted) / 0.5)' }} content={<ChartTooltip format={(v) => `${v}%`} />} />
            <Bar dataKey="pct" name="Audience" fill={CHART.primary} radius={[6, 6, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ChartFrame>
        <Card>
          <CardHeader title="Gender" description="Self-reported audience split" />
          <div className="flex items-center gap-5">
            <Donut segments={genderSegments} size={120} thickness={14} center={<div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Female</div><div className="font-display text-lg font-semibold">{gender.female}%</div></div>} />
            <div className="flex-1 space-y-2.5">{genderSegments.map((s) => <div key={s.label} className="flex items-center justify-between text-[13px]"><span className="flex items-center gap-2 text-muted-foreground"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />{s.label}</span><span className="font-semibold tabular-nums">{s.value}%</span></div>)}</div>
          </div>
        </Card>
      </div>

      {/* Rate card + analytics */}
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Rate card" description={`Benchmarked against ${c.primary_niche} creators in the same follower tier`} icon={<Briefcase className="h-4 w-4" />} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><th className="pb-2 pr-3">Deliverable</th><th className="pb-2 pr-3 text-right">Rate</th><th className="hidden pb-2 pr-3 sm:table-cell">Market position</th><th className="hidden pb-2 pr-3 text-right md:table-cell">p25 · median · p75</th><th className="pb-2 text-right">Verdict</th></tr></thead>
              <tbody>{RATE_ROWS.map((r) => <RateRow key={r.key} c={c} row={r} />)}</tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">The shaded band is the market p25–p75; the tick is the median. Offers above a campaign's rate band raise checkpoints for agents regardless of market position.</p>
        </Card>
        <Card>
          <CardHeader title="Performance on CMI" description="From approved deliverables" icon={<TrendingUp className="h-4 w-4" />} />
          {a ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Views</div><div className="font-display text-xl font-semibold tabular-nums">{num(a.reach.views, { compact: true })}</div></div>
                <div><div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Engagement</div><div className="font-display text-xl font-semibold tabular-nums">{pct(a.reach.engagement_rate)}</div></div>
                <div><div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Clicks</div><div className="font-display text-xl font-semibold tabular-nums">{num(a.reach.clicks, { compact: true })}</div></div>
                <div><div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Est. impressions</div><div className="font-display text-xl font-semibold tabular-nums">{num(a.reach.impressions_est, { compact: true })}</div></div>
              </div>
              <div className="border-t border-border pt-3 text-[13px]">
                <div className="flex justify-between"><span className="text-muted-foreground">Offers received</span><span className="font-medium tabular-nums">{a.offers.total}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Accepted / declined</span><span className="font-medium tabular-nums">{a.offers.accepted} / {a.offers.declined}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Open right now</span><span className="font-medium tabular-nums">{a.offers.open}</span></div>
              </div>
              <div className="text-xs text-muted-foreground">{num(a.reach.likes + a.reach.comments + a.reach.shares + a.reach.saves, { compact: true })} interactions across tracked content.</div>
            </div>
          ) : <EmptyState compact title="No tracked performance yet" />}
        </Card>
      </div>

      {/* Portfolio */}
      <div className="mt-6">
        <div className="mb-3 flex items-end justify-between"><div><h3 className="text-[15px] font-semibold">Portfolio</h3><p className="text-[13px] text-muted-foreground">Recent work and brand collaborations off-platform</p></div></div>
        {c.portfolio.length === 0 ? <EmptyState compact icon={Film} title="No portfolio items" /> : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {c.portfolio.map((p) => (
              <a key={p.url} href={p.url} target="_blank" rel="noreferrer" className="card card-hover group flex items-start gap-3 p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: `linear-gradient(135deg, hsl(${hashHue(p.title)} 60% 60% / 0.25), hsl(${(hashHue(p.title) + 60) % 360} 60% 50% / 0.25))` }}><PlatformIcon platform={p.platform} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2"><span className="line-clamp-2 text-[13.5px] font-medium">{p.title}</span><ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" /></div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">{p.views != null && <span className="tabular-nums">{num(p.views, { compact: true })} views</span>}{p.brand && <span>· for {p.brand}</span>}</div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* History */}
      <div className="mt-6">
        <div className="mb-3 flex items-end justify-between"><div><h3 className="text-[15px] font-semibold">Collaboration history</h3><p className="text-[13px] text-muted-foreground">{collabs.length} collaboration{collabs.length === 1 ? '' : 's'} on CMI</p></div><Link to="/collaborations" className="text-xs font-medium text-primary hover:underline">All collaborations</Link></div>
        <DataTable rows={collabs} columns={collabCols} rowKey={(r) => r.id} onRowClick={(r) => navigate(`/collaborations/${r.id}`)} empty="No collaborations yet — send the first offer." />
      </div>

      <OfferDialog creator={c} open={offerOpen} onOpenChange={setOfferOpen} />
    </div>
  );
}
