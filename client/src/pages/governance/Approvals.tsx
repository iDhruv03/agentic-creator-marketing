import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldCheck, Clock, CheckCircle2, XCircle, Coins, Inbox, Bot, AlertTriangle } from 'lucide-react';
import { useCheckpoints } from '@/hooks/queries';
import type { Checkpoint, CheckpointAction } from '@/types';
import { money, timeAgo, titleCase, cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { Stat, SkeletonCards, SkeletonRows, EmptyState } from '@/components/ui/feedback';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SegmentedControl, Select } from '@/components/ui/field';
import { Sheet } from '@/components/ui/overlay';
import { CHECKPOINT_ACTION, CheckpointStatusBadge, RiskBadge } from '@/components/ui/status';
import { CheckpointDetail } from '@/components/governance/CheckpointDetail';
import { useMediaQuery } from '@/components/governance/hooks';

type Filter = 'PENDING' | 'RESOLVED' | 'ALL';
const ACTION_OPTIONS = (Object.keys(CHECKPOINT_ACTION) as CheckpointAction[]).map((k) => ({ value: k, label: CHECKPOINT_ACTION[k].label }));

export default function Approvals() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('checkpoint');
  const [filter, setFilter] = React.useState<Filter>('PENDING');
  const [type, setType] = React.useState('');
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const checkpoints = useCheckpoints({});
  const all = checkpoints.data ?? [];

  const select = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('checkpoint', id); else next.delete('checkpoint');
    setParams(next, { replace: true });
  };

  const pending = all.filter((c) => c.status === 'PENDING');
  const stats = {
    pending: pending.length,
    approved: all.filter((c) => c.status === 'APPROVED').length,
    rejected: all.filter((c) => c.status === 'REJECTED').length,
    avg: (() => { const a = pending.filter((c) => c.amount != null); return a.length ? a.reduce((s, c) => s + (c.amount ?? 0), 0) / a.length : 0; })(),
  };

  const visible = React.useMemo(() => {
    const rows = all.filter((c) => (filter === 'ALL' || (filter === 'PENDING' ? c.status === 'PENDING' : c.status !== 'PENDING')) && (!type || c.action_type === type));
    return [...rows].sort((a, b) => (a.status === 'PENDING' ? 0 : 1) - (b.status === 'PENDING' ? 0 : 1) || b.created_at.localeCompare(a.created_at));
  }, [all, filter, type]);

  const selected = all.find((c) => c.id === selectedId) ?? null;
  // If the URL points at a resolved item while the filter hides it, widen the filter so it stays visible.
  React.useEffect(() => { if (selected && filter === 'PENDING' && selected.status !== 'PENDING') setFilter('ALL'); }, [selected, filter]);
  // Auto-select the first pending item on desktop so the panel is never empty for no reason.
  React.useEffect(() => { if (isDesktop && !selectedId && !checkpoints.isLoading && visible.length > 0) select(visible[0]!.id); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [isDesktop, selectedId, checkpoints.isLoading, visible.length]);

  const detail = selected ? <CheckpointDetail key={selected.id} chk={selected} /> : null;

  return (
    <div className="page">
      <PageHeader title="Approvals" description="Agent actions held at a checkpoint. Approving executes the action on your authority; rejecting leaves every system untouched." meta={checkpoints.isLoading ? undefined : stats.pending > 0 ? <Badge tone="warning" size="lg" dot>{stats.pending} pending</Badge> : <Badge tone="success" size="lg" dot>Queue clear</Badge>} />

      {checkpoints.isLoading ? <SkeletonCards /> : checkpoints.isError ? null : (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <Stat size="sm" label="Pending" value={stats.pending} icon={Clock} tone="warning" hint="Waiting on you" />
          <Stat size="sm" label="Approved" value={stats.approved} icon={CheckCircle2} tone="success" hint="Executed by reviewers" />
          <Stat size="sm" label="Rejected" value={stats.rejected} icon={XCircle} tone="danger" hint="Nothing written" />
          <Stat size="sm" label="Avg amount pending" value={money(stats.avg)} icon={Coins} tone="primary" hint="Across money-moving items" />
        </div>
      )}

      <div className="mt-6 lg:grid lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start lg:gap-6">
        {/* Queue */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl size="sm" value={filter} onChange={setFilter} options={[{ value: 'PENDING', label: 'Pending' }, { value: 'RESOLVED', label: 'Resolved' }, { value: 'ALL', label: 'All' }]} />
            <Select size="sm" value={type} onValueChange={setType} options={ACTION_OPTIONS} allowEmpty="All types" placeholder="All types" className="w-auto min-w-[150px] flex-1" />
          </div>
          <Card padded={false} className="overflow-hidden">
            {checkpoints.isLoading ? <div className="p-4"><SkeletonRows rows={4} /></div> : checkpoints.isError ? (
              <div className="p-4"><EmptyState compact icon={AlertTriangle} title="Couldn't load checkpoints" description={checkpoints.error instanceof Error ? checkpoints.error.message : 'Try again in a moment.'} action={<Button size="sm" variant="secondary" onClick={() => checkpoints.refetch()}>Retry</Button>} /></div>
            ) : visible.length === 0 ? (
              <div className="p-4">
                {filter === 'PENDING' && !type ? <EmptyState compact icon={ShieldCheck} title="Agents are operating inside policy" description="No actions are waiting for approval. Anything above a ceiling or threshold will land here." /> : <EmptyState compact icon={Inbox} title="No checkpoints match" description="Try another status or action type." />}
              </div>
            ) : (
              <ul className="max-h-[70vh] divide-y divide-border/70 overflow-y-auto">
                {visible.map((c) => <QueueItem key={c.id} c={c} active={c.id === selectedId} onClick={() => select(c.id)} />)}
              </ul>
            )}
          </Card>
        </div>

        {/* Detail (desktop) */}
        {isDesktop && (
          <Card className="min-h-[400px]">
            {detail ?? (checkpoints.isLoading ? <SkeletonRows rows={6} /> : <EmptyState icon={Bot} title={all.length === 0 ? 'Nothing has needed a human yet' : 'Select a checkpoint'} description={all.length === 0 ? 'Agents stay inside their budget and rate ceilings; the moment one wants to go beyond, the action is parked here for you.' : 'Pick an item from the queue to see what the agent wants to do and why.'} />)}
          </Card>
        )}
      </div>

      {/* Detail (mobile) */}
      {!isDesktop && (
        <Sheet open={Boolean(selected)} onOpenChange={(o) => { if (!o) select(null); }} title={selected ? CHECKPOINT_ACTION[selected.action_type]?.label ?? titleCase(selected.action_type) : 'Checkpoint'} description={selected?.campaign_title ?? undefined} width="md">
          <div className="px-5 py-5">{detail}</div>
        </Sheet>
      )}
    </div>
  );
}

function QueueItem({ c, active, onClick }: { c: Checkpoint; active: boolean; onClick: () => void }) {
  const meta = CHECKPOINT_ACTION[c.action_type] ?? { label: titleCase(c.action_type), tone: 'neutral' as const };
  return (
    <li>
      <button type="button" onClick={onClick} className={cn('block w-full px-4 py-3 text-left transition hover:bg-accent/40', active && 'bg-primary-soft/40 shadow-[inset_3px_0_0_hsl(var(--primary))]')}>
        <div className="flex items-center justify-between gap-2">
          <Badge tone={meta.tone} size="sm">{meta.label}</Badge>
          {c.amount != null && <span className="text-[14px] font-semibold tabular-nums">{money(c.amount)}</span>}
        </div>
        <div className="mt-1.5 truncate text-[13px] font-medium">{c.campaign_title ?? 'No campaign'}</div>
        <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground"><Bot className="h-3 w-3 shrink-0 text-agent" />{c.agent_name ?? c.agent_session_id}</div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <RiskBadge level={c.risk_level} size="sm" />
          <CheckpointStatusBadge status={c.status} size="sm" />
          <span className="ml-auto">{timeAgo(c.created_at)}</span>
        </div>
      </button>
    </li>
  );
}
