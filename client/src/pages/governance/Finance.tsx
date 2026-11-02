import * as React from 'react';
import { Link } from 'react-router-dom';
import { Wallet, Lock, CheckCircle2, PiggyBank, ArrowRight, Megaphone, Handshake, Scale, Receipt } from 'lucide-react';
import { useCampaigns, useLedger, useTrialBalance, useSessions, useCreators, useBrands } from '@/hooks/queries';
import type { Campaign, LedgerEntry } from '@/types';
import { money, pct, fmtDate, cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { Stat, SkeletonCards, SkeletonRows, EmptyState, Progress } from '@/components/ui/feedback';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/field';
import { Tooltip } from '@/components/ui/overlay';
import { DataTable, type Column } from '@/components/ui/data';
import { BarList, Donut, CHART, CHART_SERIES } from '@/components/ui/charts';
import { CampaignStatusBadge, ActorBadge } from '@/components/ui/status';
import { EntryTypeBadge, ENTRY_TYPE_OPTIONS, AccountLabel, ACCOUNT_TONE, prettyAccount, type AccountNames } from '@/components/governance/ledger-utils';

export default function Finance() {
  const [entryType, setEntryType] = React.useState('');
  const [campaignId, setCampaignId] = React.useState('');
  const campaigns = useCampaigns({});
  const ledger = useLedger({ ...(entryType ? { entry_type: entryType } : {}), ...(campaignId ? { campaign_id: campaignId } : {}) });
  const allLedger = useLedger({});
  const trial = useTrialBalance();
  const sessions = useSessions({});
  const creators = useCreators({});
  const brands = useBrands();

  const names = React.useMemo<AccountNames>(() => ({
    campaigns: Object.fromEntries((campaigns.data ?? []).map((c) => [c.id, c.title])),
    creators: Object.fromEntries((creators.data ?? []).map((c) => [c.id, c.handle])),
    brands: Object.fromEntries((brands.data ?? []).map((b) => [b.id, b.name])),
  }), [campaigns.data, creators.data, brands.data]);
  const sessionNames = React.useMemo(() => Object.fromEntries((sessions.data ?? []).map((s) => [s.id, s.name])), [sessions.data]);

  const totals = React.useMemo(() => (campaigns.data ?? []).reduce((a, c) => ({ budget: a.budget + c.financials.budget, escrow: a.escrow + c.financials.escrow_locked, spent: a.spent + c.financials.spent, available: a.available + c.financials.available }), { budget: 0, escrow: 0, spent: 0, available: 0 }), [campaigns.data]);

  const payouts = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const e of allLedger.data ?? []) if (e.entry_type === 'PAYOUT_RELEASE') m.set(e.creator_handle ? `@${e.creator_handle}` : 'Unknown creator', (m.get(e.creator_handle ? `@${e.creator_handle}` : 'Unknown creator') ?? 0) + e.amount);
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [allLedger.data]);

  const escrowSegments = (campaigns.data ?? []).filter((c) => c.financials.escrow_locked > 0).map((c, i) => ({ label: c.title, value: c.financials.escrow_locked, color: CHART_SERIES[i % CHART_SERIES.length]! }));

  const campaignColumns: Column<Campaign>[] = [
    { key: 'title', header: 'Campaign', sortValue: (c) => c.title, render: (c) => <Link to={`/campaigns/${c.id}`} className="block max-w-[200px] truncate text-[13.5px] font-medium hover:text-primary">{c.title}</Link> },
    { key: 'brand', header: 'Brand', sortValue: (c) => c.brand_name ?? '', render: (c) => <span className="whitespace-nowrap text-[13px] text-muted-foreground">{c.brand_name}</span> },
    { key: 'status', header: 'Status', sortValue: (c) => c.status, render: (c) => <CampaignStatusBadge status={c.status} size="sm" /> },
    { key: 'budget', header: 'Budget', align: 'right', sortValue: (c) => c.financials.budget, render: (c) => <span className="font-semibold tabular-nums">{money(c.financials.budget)}</span> },
    { key: 'escrow', header: 'Escrow', align: 'right', sortValue: (c) => c.financials.escrow_locked, render: (c) => <span className={cn('tabular-nums', c.financials.escrow_locked > 0 ? 'text-warning' : 'text-muted-foreground')}>{money(c.financials.escrow_locked)}</span> },
    { key: 'spent', header: 'Paid out', align: 'right', sortValue: (c) => c.financials.spent, render: (c) => <span className={cn('tabular-nums', c.financials.spent > 0 ? 'text-success' : 'text-muted-foreground')}>{money(c.financials.spent)}</span> },
    { key: 'available', header: 'Available', align: 'right', sortValue: (c) => c.financials.available, render: (c) => <span className="tabular-nums">{money(c.financials.available)}</span> },
    { key: 'util', header: 'Utilisation', width: '130px', sortValue: (c) => c.financials.utilisation_pct, render: (c) => <div className="w-28"><div className="mb-1 text-[11px] tabular-nums text-muted-foreground">{pct(c.financials.utilisation_pct, 0)} committed</div><Progress value={1} segments={[{ value: (c.financials.spent / (c.financials.budget || 1)) * 100, tone: 'success' }, { value: (c.financials.escrow_locked / (c.financials.budget || 1)) * 100, tone: 'warning' }]} size="sm" /></div> },
  ];

  const ledgerColumns: Column<LedgerEntry>[] = [
    { key: 'seq', header: '#', sortValue: (e) => e.seq, render: (e) => <span className="font-mono text-xs text-muted-foreground">{e.seq}</span> },
    { key: 'date', header: 'Date', sortValue: (e) => e.created_at, render: (e) => <span className="whitespace-nowrap text-xs text-muted-foreground">{fmtDate(e.created_at)}</span> },
    { key: 'type', header: 'Entry', sortValue: (e) => e.entry_type, render: (e) => <EntryTypeBadge type={e.entry_type} /> },
    { key: 'amount', header: 'Amount', align: 'right', sortValue: (e) => e.amount, render: (e) => <span className={cn('font-semibold tabular-nums', e.entry_type === 'PAYOUT_RELEASE' ? 'text-success' : e.entry_type === 'ESCROW_HOLD' ? 'text-warning' : '')}>{money(e.amount)}</span> },
    { key: 'accounts', header: 'Debit → Credit', render: (e) => <div className="flex flex-col gap-0.5 text-[12px]"><span className="flex items-center gap-1.5"><span className="w-5 text-[10px] font-semibold uppercase text-muted-foreground">Dr</span><AccountLabel account={e.debit_account} names={names} className={ACCOUNT_TONE(e.debit_account)} /></span><span className="flex items-center gap-1.5"><span className="w-5 text-[10px] font-semibold uppercase text-muted-foreground">Cr</span><AccountLabel account={e.credit_account} names={names} className={ACCOUNT_TONE(e.credit_account)} /></span></div> },
    { key: 'actor', header: 'Actor', sortValue: (e) => e.actor_type, render: (e) => <Tooltip content={<span className="font-mono">{e.actor_id}</span>}><span><ActorBadge type={e.actor_type} name={e.actor_type === 'AGENT' ? sessionNames[e.actor_id] ?? 'Agent' : e.actor_type === 'SYSTEM' ? 'System' : e.creator_handle && e.actor_id.startsWith('cr_') ? `@${e.creator_handle}` : 'Human'} size="sm" /></span></Tooltip> },
    { key: 'note', header: 'Note', render: (e) => <Tooltip content={e.note}><span className="line-clamp-2 min-w-[140px] max-w-[220px] text-[12px] text-muted-foreground">{e.note}</span></Tooltip> },
    { key: 'links', header: '', render: (e) => <div className="flex items-center gap-1"><Tooltip content={e.campaign_title ?? 'Campaign'}><Link to={`/campaigns/${e.campaign_id}`} className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground" onClick={(ev) => ev.stopPropagation()}><Megaphone className="h-3.5 w-3.5" /></Link></Tooltip>{e.collaboration_id && <Tooltip content={e.creator_name ? `Collaboration with ${e.creator_name}` : 'Collaboration'}><Link to={`/collaborations/${e.collaboration_id}`} className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground" onClick={(ev) => ev.stopPropagation()}><Handshake className="h-3.5 w-3.5" /></Link></Tooltip>}</div> },
  ];

  const campaignOptions = (campaigns.data ?? []).map((c) => ({ value: c.id, label: c.title }));
  const tb = trial.data;

  return (
    <div className="page">
      <PageHeader title="Finance" description="Where every dollar sits: campaign budgets, escrow locked against offers, and payouts released to creators — all from one double-entry ledger." />

      {campaigns.isLoading ? <SkeletonCards /> : (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <Stat label="Managed budget" value={money(totals.budget)} icon={Wallet} tone="primary" hint={`${campaigns.data?.length ?? 0} campaign${(campaigns.data?.length ?? 0) === 1 ? '' : 's'}`} />
          <Stat label="In escrow" value={money(totals.escrow)} icon={Lock} tone="warning" hint="Locked for open offers & contracts" />
          <Stat label="Paid out" value={money(totals.spent)} icon={CheckCircle2} tone="success" hint="Released to creator wallets" />
          <Stat label="Available" value={money(totals.available)} icon={PiggyBank} tone="info" hint={totals.budget ? `${pct((totals.available / totals.budget) * 100, 0)} of budget` : 'No budget'} />
        </div>
      )}

      <div className="mt-6 space-y-6">
        <section className="min-w-0">
          <div className="mb-3 flex items-end justify-between gap-4"><div><h2 className="text-base font-semibold">Budget by campaign</h2><p className="text-[13px] text-muted-foreground">Budget, escrow and spend per campaign</p></div><Link to="/campaigns" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-primary hover:underline">Campaigns <ArrowRight className="h-3.5 w-3.5" /></Link></div>
          {campaigns.isLoading ? <div className="card p-5"><SkeletonRows rows={3} /></div> : <DataTable rows={campaigns.data ?? []} columns={campaignColumns} rowKey={(c) => c.id} className="[&_td]:px-3 [&_th]:px-3" empty={<EmptyState compact icon={Megaphone} title="No campaigns" description="Create a campaign to allocate budget." />} />}
        </section>

        <section className="min-w-0">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div><h2 className="text-base font-semibold">Double-entry ledger</h2><p className="text-[13px] text-muted-foreground">Every movement debits one account and credits another</p></div>
            <div className="flex flex-wrap gap-2">
              <Select size="sm" value={entryType} onValueChange={setEntryType} options={ENTRY_TYPE_OPTIONS} allowEmpty="All entry types" placeholder="All entry types" className="w-auto min-w-[160px]" />
              <Select size="sm" value={campaignId} onValueChange={setCampaignId} options={campaignOptions} allowEmpty="All campaigns" placeholder="All campaigns" className="w-auto min-w-[160px]" />
            </div>
          </div>
          {ledger.isLoading ? <div className="card p-5"><SkeletonRows rows={5} /></div> : <DataTable rows={ledger.data ?? []} columns={ledgerColumns} rowKey={(e) => e.id} dense className="[&_td]:px-3 [&_th]:px-3" empty={<EmptyState compact icon={Receipt} title="No ledger entries" description="Nothing matches these filters." />} />}
          {ledger.data && ledger.data.length > 0 && <p className="mt-2 text-right text-[11.5px] text-muted-foreground">{ledger.data.length} entr{ledger.data.length === 1 ? 'y' : 'ies'} · newest first</p>}
        </section>
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="min-w-0">
            <CardHeader title="Trial balance" description="Sum of credits must equal sum of debits" icon={<Scale className="h-4 w-4" />} action={trial.isLoading ? null : tb?.balanced ? <Badge tone="success" dot>Balanced</Badge> : <Badge tone="danger" dot>Out of balance</Badge>} />
            {trial.isLoading ? <SkeletonRows rows={4} /> : tb && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-surface-muted/70 px-3 py-2"><div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Total debits</div><div className="text-[15px] font-semibold tabular-nums">{money(tb.debits)}</div></div>
                  <div className="rounded-xl bg-surface-muted/70 px-3 py-2"><div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Total credits</div><div className="text-[15px] font-semibold tabular-nums">{money(tb.credits)}</div></div>
                </div>
                <ul className="mt-4 max-h-[300px] divide-y divide-border/70 overflow-y-auto">
                  {tb.accounts.map((a) => { const p = prettyAccount(a.account, names); return (
                    <li key={a.account} className="flex items-center justify-between gap-3 py-2 text-[12.5px]">
                      <Tooltip content={<span className="font-mono">{a.account}</span>}><span className="min-w-0 cursor-default"><span className={cn('block truncate font-medium', ACCOUNT_TONE(a.account))}>{p.label}</span>{p.owner && <span className="block truncate text-[11px] text-muted-foreground">{p.owner}</span>}</span></Tooltip>
                      <span className={cn('shrink-0 font-mono tabular-nums', a.balance > 0 ? 'text-success' : a.balance < 0 ? 'text-danger' : 'text-muted-foreground')}>{a.balance < 0 ? '−' : ''}{money(Math.abs(a.balance))}</span>
                    </li>
                  ); })}
                </ul>
              </>
            )}
          </Card>

          <Card className="min-w-0">
            <CardHeader title="Payouts by creator" description="Released from escrow to creator wallets" />
            {allLedger.isLoading ? <SkeletonRows rows={3} /> : payouts.length ? <BarList items={payouts.slice(0, 8)} format={(v) => money(v)} color={CHART.teal} /> : <EmptyState compact icon={CheckCircle2} title="No payouts yet" description="Approve a deliverable and release payment." />}
          </Card>

          <Card className="min-w-0">
            <CardHeader title="Escrow by campaign" description="Funds locked against open work" />
            {campaigns.isLoading ? <SkeletonRows rows={2} /> : escrowSegments.length ? (
              <div className="flex items-center gap-5">
                <Donut segments={escrowSegments} size={124} thickness={16} center={<div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Escrow</div><div className="font-display text-base font-semibold tabular-nums">{money(totals.escrow, { compact: true })}</div></div>} />
                <div className="min-w-0 flex-1 space-y-2">
                  {escrowSegments.map((s) => <div key={s.label} className="flex items-center justify-between gap-2 text-[12.5px]"><span className="flex min-w-0 items-center gap-2 text-muted-foreground"><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} /><span className="truncate">{s.label}</span></span><span className="shrink-0 font-semibold tabular-nums">{money(s.value)}</span></div>)}
                </div>
              </div>
            ) : <EmptyState compact icon={Lock} title="Nothing in escrow" description="Escrow is held the moment an offer goes out." />}
          </Card>
        </div>
      </div>
    </div>
  );
}
