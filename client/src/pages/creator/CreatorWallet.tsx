import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { Wallet, Lock, TrendingUp, CalendarDays, Landmark, Inbox } from 'lucide-react';
import { useAuth } from '@/store/auth';
import { useWallet, useCollaborations } from '@/hooks/queries';
import type { LedgerEntry } from '@/types';
import { money, fmtDate, cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { Stat, SkeletonCards, SkeletonRows, EmptyState, Callout } from '@/components/ui/feedback';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { OrgMark } from '@/components/ui/avatar';
import { ChartFrame, ChartTooltip, CHART } from '@/components/ui/charts';
import { DataTable } from '@/components/ui/data';
import { CollabStatusBadge } from '@/components/ui/status';
import { Button } from '@/components/ui/button';
import { isClosed, currentMonthKey, monthLabel, ledgerDirection, LEDGER_LABEL, LEDGER_TONE } from '@/components/creator/utils';

export default function CreatorWallet() {
  const navigate = useNavigate();
  const me = useAuth((s) => s.me);
  const wallet = useWallet();
  const collabs = useCollaborations();
  const w = wallet.data;
  const thisMonth = currentMonthKey();
  const monthEarnings = (w?.analytics.earnings_by_month ?? []).find((m) => m.month === thisMonth)?.amount ?? 0;
  const earnings = (w?.analytics.earnings_by_month ?? []).map((e) => ({ ...e, label: monthLabel(e.month) }));
  const pending = (collabs.data ?? []).filter((c) => !isClosed(c) && c.escrow_held > 0);
  const creatorId = me?.user.creator_id;

  const columns = [
    { key: 'date', header: 'Date', render: (e: LedgerEntry) => <span className="whitespace-nowrap text-[13px]">{fmtDate(e.created_at, 'd MMM yyyy')}</span>, sortValue: (e: LedgerEntry) => e.created_at, width: '120px' },
    { key: 'type', header: 'Type', render: (e: LedgerEntry) => <Badge tone={LEDGER_TONE[e.entry_type]} size="sm">{LEDGER_LABEL[e.entry_type]}</Badge> },
    { key: 'campaign', header: 'Campaign', render: (e: LedgerEntry) => <div className="min-w-0"><div className="truncate text-[13px] font-medium">{e.campaign_title}</div><div className="truncate text-[11px] text-muted-foreground">{e.brand_name}</div></div> },
    { key: 'note', header: 'Note', render: (e: LedgerEntry) => <span className="line-clamp-2 text-[12.5px] text-muted-foreground">{e.note}</span>, className: 'hidden md:table-cell' },
    { key: 'amount', header: 'Amount', align: 'right' as const, sortValue: (e: LedgerEntry) => e.amount * ledgerDirection(e, creatorId), render: (e: LedgerEntry) => { const dir = ledgerDirection(e, creatorId); return <span className={cn('font-semibold tabular-nums', dir > 0 ? 'text-success' : 'text-foreground')}>{dir > 0 ? '+' : '−'}{money(e.amount)}</span>; } },
  ];

  return (
    <div className="page">
      <PageHeader title="Wallet" description="Payouts are released from the brand's escrow as each deliverable is approved. Every movement is a double-entry ledger record." actions={<Button variant="secondary" leftIcon={<Inbox className="h-4 w-4" />} onClick={() => navigate('/creator/offers?tab=active')}>Active work</Button>} />

      {wallet.isLoading ? <SkeletonCards /> : w && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Balance" value={money(w.balance)} icon={Wallet} tone="primary" hint="Available to pay out" />
          <Stat label="Pending escrow" value={money(w.pending_escrow)} icon={Lock} tone="warning" hint={`${pending.length} collaboration${pending.length === 1 ? '' : 's'} with funds locked`} />
          <Stat label="Lifetime earnings" value={money(w.lifetime_earnings)} icon={TrendingUp} tone="success" hint="All payouts to date" />
          <Stat label="This month" value={money(monthEarnings)} icon={CalendarDays} tone="info" hint={monthLabel(thisMonth)} />
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <ChartFrame title="Earnings by month" description="Payouts released to your wallet" height={220}>
            {earnings.length === 0 ? (
              <div className="flex h-full items-center justify-center"><EmptyState compact icon={TrendingUp} title="No payouts yet" description="Your first approved deliverable will show up here." className="w-full border-0" /></div>
            ) : (
              <BarChart data={earnings} margin={{ top: 8, right: 8, bottom: 0, left: -10 }} barCategoryGap="35%">
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => money(v, { compact: true })} width={56} />
                <Tooltip content={<ChartTooltip format={(v) => money(v)} />} cursor={{ fill: 'hsl(var(--muted) / 0.6)' }} />
                <Bar dataKey="amount" name="Paid out" fill={CHART.teal} radius={[4, 4, 0, 0]} maxBarSize={48}>
                  {earnings.map((e) => <Cell key={e.month} fill={e.month === thisMonth ? CHART.primary : CHART.teal} />)}
                </Bar>
              </BarChart>
            )}
          </ChartFrame>

          <div>
            <div className="mb-3"><h2 className="text-base font-semibold">Payout ledger</h2><p className="text-[13px] text-muted-foreground">Every credit and debit against your wallet account</p></div>
            {wallet.isLoading ? <div className="card p-5"><SkeletonRows rows={4} /></div> : (
              <DataTable rows={w?.ledger ?? []} columns={columns} rowKey={(e) => e.id} empty={<EmptyState compact icon={Landmark} title="No ledger entries yet" description="Payouts appear here as soon as a brand releases escrow for approved content." className="mx-auto max-w-md border-0" />} />
            )}
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Pending escrow by collaboration" description="Locked by the brand, released as you deliver" />
            {collabs.isLoading ? <SkeletonRows rows={2} /> : pending.length === 0 ? <EmptyState compact icon={Lock} title="Nothing in escrow" description="Accepted offers lock funds here until approval." /> : (
              <div className="divide-y divide-border/70">
                {pending.map((c) => (
                  <button key={c.id} type="button" onClick={() => navigate(`/creator/offers/${c.id}`)} className="flex w-full items-center gap-3 py-3 text-left first:pt-0 last:pb-0 transition hover:bg-accent/30">
                    <OrgMark name={c.brand_name ?? 'Brand'} src={c.brand_logo} size="sm" />
                    <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-medium">{c.campaign_title}</div><div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground"><span className="truncate">{c.brand_name}</span><CollabStatusBadge status={c.status} size="sm" /></div></div>
                    <div className="shrink-0 text-right font-semibold tabular-nums text-warning">{money(c.escrow_held)}</div>
                  </button>
                ))}
                <div className="flex items-center justify-between pt-3 text-[13px]"><span className="text-muted-foreground">Total locked</span><span className="font-semibold tabular-nums">{money(pending.reduce((a, c) => a + c.escrow_held, 0))}</span></div>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Payout method" description="Where released funds settle" icon={<Landmark className="h-4 w-4" />} action={<Badge tone="neutral" size="sm">Demo</Badge>} />
            <div className="rounded-xl border border-border bg-surface-muted/50 px-4 py-3">
              <div className="text-[13px] font-medium">Connected account</div>
              <div className="font-mono text-xs text-muted-foreground">•••• •••• •••• 4821 · USD</div>
            </div>
            <Callout tone="neutral" className="mt-3">Payouts settle to your connected account within 2 business days of release. This is a demo environment: no real transfers are made.</Callout>
          </Card>
        </div>
      </div>
    </div>
  );
}
