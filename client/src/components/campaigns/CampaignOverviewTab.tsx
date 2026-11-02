import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Wallet, Lock, CheckCircle2, PiggyBank, Eye, MousePointerClick, Heart, BarChart3 } from 'lucide-react';
import type { Campaign, CampaignAnalytics } from '@/types';
import { useCampaignAnalytics } from '@/hooks/queries';
import { money, num, pct, fmtDate, platformLabel, cn } from '@/lib/utils';
import { Stat, SkeletonCards, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Card, CardHeader, Section } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { DataTable, type Column } from '@/components/ui/data';
import { ChartFrame, ChartTooltip, CHART, BarList } from '@/components/ui/charts';
import { CollabStatusBadge } from '@/components/ui/status';
import type { CollaborationStatus } from '@/types';

const FUNNEL: { key: keyof CampaignAnalytics['funnel']; label: string }[] = [
  { key: 'shortlisted', label: 'Shortlisted' }, { key: 'offered', label: 'Offered' }, { key: 'accepted', label: 'Accepted' }, { key: 'delivered', label: 'Delivered' }, { key: 'approved', label: 'Approved' }, { key: 'paid', label: 'Paid' },
];

export function Funnel({ funnel }: { funnel: CampaignAnalytics['funnel'] }) {
  const max = Math.max(1, ...FUNNEL.map((f) => funnel[f.key]));
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {FUNNEL.map((f, i) => {
        const v = funnel[f.key];
        const prev = i > 0 ? funnel[FUNNEL[i - 1]!.key] : null;
        const conv = prev ? Math.round((v / prev) * 100) : null;
        return (
          <div key={f.key} className="min-w-0">
            <div className="flex h-9 items-end overflow-hidden rounded-md bg-muted">
              <div className={cn('w-full rounded-md transition-all duration-500', v > 0 ? 'bg-primary' : 'bg-transparent')} style={{ height: `${Math.max(v > 0 ? 12 : 0, (v / max) * 100)}%`, opacity: 0.35 + 0.65 * ((i + 1) / FUNNEL.length) }} />
            </div>
            <div className="mt-1.5 font-display text-lg font-semibold tabular-nums leading-none">{v}</div>
            <div className="truncate text-[11px] text-muted-foreground">{f.label}{conv != null && prev ? <span className="ml-1">· {conv}%</span> : null}</div>
          </div>
        );
      })}
    </div>
  );
}

export function CampaignOverviewTab({ campaign }: { campaign: Campaign }) {
  const navigate = useNavigate();
  const analytics = useCampaignAnalytics(campaign.id);
  const a = analytics.data;
  const f = campaign.financials;

  const byCreatorCols: Column<CampaignAnalytics['by_creator'][number]>[] = [
    { key: 'creator', header: 'Creator', render: (r) => <div className="flex items-center gap-2.5"><Avatar name={r.name} src={r.avatar_url} size="sm" /><div className="min-w-0"><div className="truncate font-medium">{r.name}</div><div className="truncate text-xs text-muted-foreground">@{r.handle}</div></div></div>, sortValue: (r) => r.name },
    { key: 'status', header: 'Status', render: (r) => <CollabStatusBadge status={r.status as CollaborationStatus} size="sm" /> },
    { key: 'rate', header: 'Rate', align: 'right', render: (r) => <span className="tabular-nums">{money(r.rate)}</span>, sortValue: (r) => r.rate },
    { key: 'deliverables', header: 'Deliv.', align: 'right', render: (r) => <span className="tabular-nums">{r.deliverables}</span>, sortValue: (r) => r.deliverables },
    { key: 'views', header: 'Views', align: 'right', render: (r) => <span className="tabular-nums">{num(r.views, { compact: true })}</span>, sortValue: (r) => r.views },
    { key: 'er', header: 'Eng.', align: 'right', render: (r) => <span className="tabular-nums">{pct(r.engagement_rate)}</span>, sortValue: (r) => r.engagement_rate },
    { key: 'cpe', header: 'CPE', align: 'right', render: (r) => <span className="tabular-nums">{r.cpe ? money(r.cpe, { cents: true }) : '—'}</span>, sortValue: (r) => r.cpe },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Budget" value={money(f.budget)} icon={Wallet} tone="primary" hint={`${pct(f.utilisation_pct, 0)} utilised`} />
        <Stat label="In escrow" value={money(f.escrow_locked)} icon={Lock} tone="warning" hint="Locked against open offers and contracts" />
        <Stat label="Paid out" value={money(f.spent)} icon={CheckCircle2} tone="success" hint={`${campaign.stats.approved_deliverables}/${campaign.stats.deliverables} deliverables approved`} />
        <Stat label="Available" value={money(f.available)} icon={PiggyBank} tone="neutral" hint="Free for new offers" />
      </div>

      <Card>
        <CardHeader title="Pipeline" description="Creators moving from shortlist to payout" />
        {analytics.isLoading ? <Skeleton className="h-20 w-full" /> : a ? <Funnel funnel={a.funnel} /> : null}
      </Card>

      {analytics.isLoading ? <SkeletonCards /> : a && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat size="sm" label="Views" value={num(a.reach.views, { compact: true })} icon={Eye} tone="info" hint={`${num(a.reach.impressions_est, { compact: true })} est. impressions`} />
            <Stat size="sm" label="Engagement" value={pct(a.reach.engagement_rate)} icon={Heart} tone="danger" hint={`${num(a.reach.likes + a.reach.comments + a.reach.shares + a.reach.saves, { compact: true })} interactions`} />
            <Stat size="sm" label="Cost per view" value={a.cost.cost_per_view ? money(a.cost.cost_per_view, { cents: true }) : '—'} icon={BarChart3} hint={a.cost.cost_per_engagement ? `${money(a.cost.cost_per_engagement, { cents: true })} per engagement` : 'No approved content yet'} />
            <Stat size="sm" label="Cost per click" value={a.cost.cost_per_click ? money(a.cost.cost_per_click, { cents: true }) : '—'} icon={MousePointerClick} hint={`${num(a.reach.clicks)} clicks · avg rate ${money(a.cost.avg_rate)}`} />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <ChartFrame title="Spend & reach over time" description="Cumulative committed & paid vs views from approved content" height={220} legend={[{ label: 'Committed', color: CHART.amber }, { label: 'Spend', color: CHART.teal }, { label: 'Views', color: CHART.primary }]}>
                <AreaChart data={a.timeline} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
                  <defs>
                    <linearGradient id={`committed-${campaign.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CHART.amber} stopOpacity={0.25} /><stop offset="100%" stopColor={CHART.amber} stopOpacity={0} /></linearGradient>
                    <linearGradient id={`spend-${campaign.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CHART.teal} stopOpacity={0.3} /><stop offset="100%" stopColor={CHART.teal} stopOpacity={0} /></linearGradient>
                    <linearGradient id={`views-${campaign.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CHART.primary} stopOpacity={0.3} /><stop offset="100%" stopColor={CHART.primary} stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(d) => fmtDate(d, 'd MMM')} axisLine={false} tickLine={false} minTickGap={24} />
                  <YAxis yAxisId="spend" axisLine={false} tickLine={false} tickFormatter={(v) => money(v, { compact: true })} width={52} />
                  <YAxis yAxisId="views" orientation="right" axisLine={false} tickLine={false} tickFormatter={(v) => num(v, { compact: true })} width={44} />
                  <Tooltip content={<ChartTooltip labelFormat={(l) => fmtDate(l, 'EEE d MMM')} format={(v, n) => (n === 'Views' ? num(v, { compact: true }) : money(v))} />} />
                  <Area yAxisId="spend" type="monotone" dataKey="committed" name="Committed" stroke={CHART.amber} strokeWidth={2} fill={`url(#committed-${campaign.id})`} />
                  <Area yAxisId="spend" type="monotone" dataKey="spend" name="Spend" stroke={CHART.teal} strokeWidth={2} fill={`url(#spend-${campaign.id})`} />
                  <Area yAxisId="views" type="monotone" dataKey="views" name="Views" stroke={CHART.primary} strokeWidth={2} fill={`url(#views-${campaign.id})`} />
                </AreaChart>
              </ChartFrame>
            </div>
            <Card>
              <CardHeader title="By platform" description="Views from approved deliverables" />
              {a.by_platform.length ? <BarList items={a.by_platform.map((p) => ({ label: platformLabel(p.platform), value: p.views, hint: `${p.deliverables} deliv.` }))} format={(v) => num(v, { compact: true })} color={CHART.violet} /> : <EmptyState compact title="No approved content yet" description="Platform reach appears once deliverables are approved." />}
            </Card>
          </div>

          <Section title="By creator" description="Rate, delivery and performance per collaboration">
            <DataTable rows={a.by_creator} columns={byCreatorCols} rowKey={(r) => r.creator_id} onRowClick={(r) => navigate(`/creators/${r.creator_id}`)} empty="No collaborations yet — send an offer from the shortlist." />
          </Section>
        </>
      )}
    </div>
  );
}
