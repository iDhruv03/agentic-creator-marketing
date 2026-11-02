import { Link } from 'react-router-dom';
import { ArrowRight, Wallet, Lock, CheckCircle2, PiggyBank, BookOpen } from 'lucide-react';
import type { Campaign, LedgerEntry } from '@/types';
import { useCampaignLedger } from '@/hooks/queries';
import { money, pct, fmtDateTime, titleCase } from '@/lib/utils';
import { Stat, SkeletonRows, EmptyState } from '@/components/ui/feedback';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { DataTable, type Column, Mono } from '@/components/ui/data';
import { Donut, CHART } from '@/components/ui/charts';
import { ActorBadge } from '@/components/ui/status';

const ENTRY_TONE: Record<LedgerEntry['entry_type'], NonNullable<BadgeProps['tone']>> = { BUDGET_ALLOCATION: 'primary', BUDGET_ADJUSTMENT: 'info', ESCROW_HOLD: 'warning', ESCROW_RELEASE: 'success', ESCROW_REFUND: 'neutral', PAYOUT_RELEASE: 'success' };

export function CampaignBudgetTab({ campaign }: { campaign: Campaign }) {
  const ledger = useCampaignLedger(campaign.id);
  const f = campaign.financials;
  const segments = [{ value: f.spent, color: CHART.teal, label: 'Paid out' }, { value: f.escrow_locked, color: CHART.amber, label: 'In escrow' }, { value: Math.max(0, f.available), color: CHART.muted, label: 'Available' }];

  const columns: Column<LedgerEntry>[] = [
    { key: 'seq', header: '#', width: '56px', render: (e) => <Mono>{String(e.seq)}</Mono>, sortValue: (e) => e.seq },
    { key: 'type', header: 'Entry', render: (e) => <Badge tone={ENTRY_TONE[e.entry_type] ?? 'neutral'} size="sm">{titleCase(e.entry_type)}</Badge>, sortValue: (e) => e.entry_type },
    { key: 'amount', header: 'Amount', align: 'right', render: (e) => <span className="font-semibold tabular-nums">{money(e.amount)}</span>, sortValue: (e) => e.amount },
    { key: 'accounts', header: 'Debit → Credit', render: (e) => <div className="flex min-w-[200px] max-w-[320px] flex-col gap-0.5 font-mono text-[11.5px] leading-tight text-muted-foreground"><span className="break-all">{e.debit_account}</span><span className="flex items-center gap-1 break-all"><ArrowRight className="h-3 w-3 shrink-0" />{e.credit_account}</span></div> },
    { key: 'actor', header: 'Actor', render: (e) => <ActorBadge type={e.actor_type} name={e.actor_type === 'AGENT' ? 'Agent' : e.actor_type === 'SYSTEM' ? 'System' : 'Human'} size="sm" /> },
    { key: 'note', header: 'Note', render: (e) => <div className="max-w-[360px] text-[13px] text-muted-foreground"><span className="line-clamp-2">{e.note}</span>{e.collaboration_id && <Link to={`/collaborations/${e.collaboration_id}`} className="text-xs font-medium text-primary hover:underline">{e.creator_handle ? `@${e.creator_handle}` : 'Collaboration'}</Link>}</div> },
    { key: 'date', header: 'Date', render: (e) => <span className="whitespace-nowrap text-xs text-muted-foreground">{fmtDateTime(e.created_at)}</span>, sortValue: (e) => e.created_at },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Budget" value={money(f.budget)} icon={Wallet} tone="primary" hint={`${money(f.committed)} committed`} />
        <Stat label="In escrow" value={money(f.escrow_locked)} icon={Lock} tone="warning" hint="Returned if offers are declined" />
        <Stat label="Paid out" value={money(f.spent)} icon={CheckCircle2} tone="success" hint="Released to creator wallets" />
        <Stat label="Available" value={money(f.available)} icon={PiggyBank} tone="neutral" hint={`${pct(100 - f.utilisation_pct, 0)} of budget`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader title="Allocation" description="Where the budget sits right now" />
          <div className="flex items-center gap-5">
            <Donut segments={segments} size={120} thickness={14} center={<div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Utilised</div><div className="font-display text-lg font-semibold">{pct(f.utilisation_pct, 0)}</div></div>} />
            <div className="flex-1 space-y-2.5">
              {segments.map((s) => <div key={s.label} className="flex items-center justify-between text-[13px]"><span className="flex items-center gap-2 text-muted-foreground"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />{s.label}</span><span className="font-semibold tabular-nums">{money(s.value)}</span></div>)}
            </div>
          </div>
        </Card>
        <div className="xl:col-span-2">
          <div className="mb-3 flex items-end justify-between gap-4"><div><h3 className="text-[15px] font-semibold">Ledger</h3><p className="text-[13px] text-muted-foreground">Double-entry, append-only. Every hold, release and payout for this campaign.</p></div><Link to="/finance" className="text-xs font-medium text-primary hover:underline">All finance</Link></div>
          {ledger.isLoading ? <Card><SkeletonRows rows={5} /></Card> : (ledger.data ?? []).length === 0 ? <EmptyState compact icon={BookOpen} title="No ledger entries" description="The budget allocation appears here once the campaign is created." /> : <DataTable rows={[...(ledger.data ?? [])].sort((a, b) => b.seq - a.seq)} columns={columns} rowKey={(e) => e.id} dense />}
        </div>
      </div>
    </div>
  );
}
