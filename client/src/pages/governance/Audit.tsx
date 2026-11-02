import * as React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ShieldX, RefreshCw, ChevronRight, ChevronLeft, Megaphone, Bot, PlayCircle, ScrollText, Hash } from 'lucide-react';
import { useAudit, useAuditVerify, useCampaigns } from '@/hooks/queries';
import type { AuditRecord, ExecutionStatus } from '@/types';
import { fmtDateTime, timeAgo, num, titleCase, cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton, SkeletonRows, EmptyState, Callout } from '@/components/ui/feedback';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SearchInput } from '@/components/ui/field';
import { Tooltip } from '@/components/ui/overlay';
import { CopyButton } from '@/components/ui/data';
import { JsonPanel } from '@/components/governance/JsonPanel';
import { BarList, CHART } from '@/components/ui/charts';
import { ActorBadge, ToolChip, ExecStatusBadge, EXEC_STATUS } from '@/components/ui/status';
import { useDebounced } from '@/components/governance/hooks';

const PAGE = 50;
const STATUS_OPTIONS = (Object.keys(EXEC_STATUS) as ExecutionStatus[]).map((k) => ({ value: k, label: EXEC_STATUS[k].label }));
const ACTOR_OPTIONS = [{ value: 'AGENT', label: 'Agent' }, { value: 'HUMAN', label: 'Human' }, { value: 'SYSTEM', label: 'System' }];
const STATUS_TONE: Record<ExecutionStatus, 'success' | 'warning' | 'danger' | 'neutral'> = { SUCCESS: 'success', HELD_FOR_APPROVAL: 'warning', REJECTED_BY_GUARDRAIL: 'danger', FAILED: 'neutral' };
const STATUS_COLOR: Record<string, string> = { SUCCESS: CHART.teal, HELD_FOR_APPROVAL: CHART.amber, REJECTED_BY_GUARDRAIL: CHART.rose, FAILED: CHART.muted };

export default function Audit() {
  const [q, setQ] = React.useState('');
  const dq = useDebounced(q, 300);
  const [actor, setActor] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [tool, setTool] = React.useState('');
  const [campaignId, setCampaignId] = React.useState('');
  const [offset, setOffset] = React.useState(0);
  const [open, setOpen] = React.useState<string | null>(null);
  React.useEffect(() => { setOffset(0); }, [dq, actor, status, tool, campaignId]);

  const verify = useAuditVerify();
  const campaigns = useCampaigns({});
  const audit = useAudit({ limit: PAGE, offset, ...(dq ? { q: dq } : {}), ...(actor ? { actor_type: actor } : {}), ...(status ? { status } : {}), ...(tool ? { tool_name: tool } : {}), ...(campaignId ? { campaign_id: campaignId } : {}) });

  const campaignNames = React.useMemo(() => Object.fromEntries((campaigns.data ?? []).map((c) => [c.id, c.title])), [campaigns.data]);
  const v = verify.data;
  const toolOptions = Object.keys(v?.stats.by_tool ?? {}).map((t) => ({ value: t, label: t }));
  const total = audit.data?.total ?? 0;
  const items = audit.data?.items ?? [];
  const from = total ? offset + 1 : 0;
  const to = Math.min(offset + PAGE, total);
  const filtersActive = Boolean(q || actor || status || tool || campaignId);

  return (
    <div className="page">
      <PageHeader title="Audit trail" description="Append-only, hash-chained log of every tool call and human decision. Each entry's hash covers its content and the previous hash, so tampering breaks the chain." />

      {/* Verification banner */}
      {verify.isLoading ? <Skeleton className="h-20 rounded-2xl" /> : v && (
        <div className={cn('flex flex-col gap-3 rounded-2xl border px-5 py-4 sm:flex-row sm:items-center sm:justify-between', v.valid ? 'border-success/30 bg-success-soft/50' : 'border-danger/30 bg-danger-soft/50')}>
          <div className="flex items-start gap-3">
            <span className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', v.valid ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger')}>{v.valid ? <ShieldCheck className="h-5 w-5" /> : <ShieldX className="h-5 w-5" />}</span>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold">{v.valid ? `Chain intact · ${num(v.checked)} entr${v.checked === 1 ? 'y' : 'ies'} verified` : `Chain broken at ${v.broken_at}`}</div>
              <div className="mt-0.5 text-[12.5px] text-muted-foreground">{v.valid ? 'Every hash re-derived from genesis matches the stored value.' : `${num(v.checked)} entries walked; the first mismatch is listed above. Entries after it cannot be trusted.`}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(Object.keys(EXEC_STATUS) as ExecutionStatus[]).filter((k) => v.stats.by_status[k]).map((k) => <button key={k} type="button" onClick={() => setStatus((s) => (s === k ? '' : k))} className={cn('rounded-full transition', status === k && 'ring-2 ring-primary/40')}><Badge tone={EXEC_STATUS[k].tone} size="sm">{EXEC_STATUS[k].label} · {v.stats.by_status[k]}</Badge></button>)}
                {Object.entries(v.stats.by_actor).map(([k, n]) => <button key={k} type="button" onClick={() => setActor((a) => (a === k ? '' : k))} className={cn('rounded-full transition', actor === k && 'ring-2 ring-primary/40')}><ActorBadge type={k} name={`${titleCase(k)} · ${n}`} size="sm" /></button>)}
              </div>
            </div>
          </div>
          <Button variant="secondary" size="sm" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', verify.isFetching && 'animate-spin')} />} onClick={() => verify.refetch()} disabled={verify.isFetching}>Re-verify</Button>
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_236px]">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <SearchInput value={q} onChange={setQ} placeholder="Search summaries, notes, parameters…" className="sm:w-72" />
            <Select size="sm" value={actor} onValueChange={setActor} options={ACTOR_OPTIONS} allowEmpty="All actors" placeholder="All actors" className="w-auto min-w-[120px]" />
            <Select size="sm" value={status} onValueChange={setStatus} options={STATUS_OPTIONS} allowEmpty="All statuses" placeholder="All statuses" className="w-auto min-w-[140px]" />
            <Select size="sm" value={tool} onValueChange={setTool} options={toolOptions} allowEmpty="All tools" placeholder="All tools" className="w-auto min-w-[150px]" />
            <Select size="sm" value={campaignId} onValueChange={setCampaignId} options={(campaigns.data ?? []).map((c) => ({ value: c.id, label: c.title }))} allowEmpty="All campaigns" placeholder="All campaigns" className="w-auto min-w-[150px]" />
            {filtersActive && <Button variant="ghost" size="sm" onClick={() => { setQ(''); setActor(''); setStatus(''); setTool(''); setCampaignId(''); }}>Clear</Button>}
          </div>

          <Card padded={false} className="overflow-hidden">
            {audit.isLoading ? <div className="p-5"><SkeletonRows rows={8} /></div> : items.length === 0 ? (
              <div className="p-5"><EmptyState compact icon={ScrollText} title="No audit entries match" description={filtersActive ? 'Loosen the filters to see more of the trail.' : 'Tool calls and human decisions will appear here as they happen.'} /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-base [&_td]:px-2.5 [&_th]:px-2.5">
                  <thead><tr><th className="w-14">#</th><th>When</th><th>Actor</th><th>Tool</th><th>Status</th><th>Result</th></tr></thead>
                  <tbody>
                    {items.map((a) => <Row key={a.id} a={a} open={open === a.id} onToggle={() => setOpen((o) => (o === a.id ? null : a.id))} campaignName={a.campaign_id ? campaignNames[a.campaign_id] : undefined} />)}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-[12.5px] text-muted-foreground">
              <span>{total ? `Showing ${from}–${to} of ${num(total)}` : audit.isFetching ? 'Loading…' : 'No entries'}</span>
              <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="xs" leftIcon={<ChevronLeft className="h-3.5 w-3.5" />} disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - PAGE))}>Prev</Button>
                <Button variant="ghost" size="xs" rightIcon={<ChevronRight className="h-3.5 w-3.5" />} disabled={offset + PAGE >= total} onClick={() => setOffset((o) => o + PAGE)}>Next</Button>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="By tool" description="All-time call volume" />
            {verify.isLoading ? <SkeletonRows rows={4} /> : <BarList items={Object.entries(v?.stats.by_tool ?? {}).slice(0, 10).map(([k, n]) => ({ label: <button type="button" className={cn('font-mono text-[12px] hover:text-primary', tool === k && 'text-primary')} onClick={() => setTool((t) => (t === k ? '' : k))}>{k}</button>, value: n }))} color={CHART.violet} />}
          </Card>
          <Card>
            <CardHeader title="By status" description="Governance outcomes" />
            {verify.isLoading ? <SkeletonRows rows={3} /> : <BarList items={Object.entries(v?.stats.by_status ?? {}).map(([k, n]) => ({ label: EXEC_STATUS[k as ExecutionStatus]?.label ?? titleCase(k), value: n, color: STATUS_COLOR[k] ?? CHART.primary }))} />}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ a, open, onToggle, campaignName }: { a: AuditRecord; open: boolean; onToggle: () => void; campaignName?: string }) {
  return (
    <>
      <tr onClick={onToggle} className={cn('cursor-pointer transition hover:bg-accent/50', open && 'bg-primary-soft/30')}>
        <td><span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground"><ChevronRight className={cn('h-3.5 w-3.5 transition', open && 'rotate-90')} />{a.seq}</span></td>
        <td><Tooltip content={a.timestamp}><span className="block whitespace-nowrap text-xs text-muted-foreground">{fmtDateTime(a.timestamp)}</span></Tooltip><span className="block whitespace-nowrap font-mono text-[10.5px] tabular-nums text-muted-foreground/80">{a.duration_ms} ms</span></td>
        <td><span className="block max-w-[128px] truncate"><ActorBadge type={a.actor_type} name={a.actor_name ?? (a.actor_type === 'AGENT' ? 'Agent' : a.actor_type === 'SYSTEM' ? 'System' : 'Human')} size="sm" /></span></td>
        <td><ToolChip name={a.tool_name} /></td>
        <td><ExecStatusBadge status={a.execution_status} size="sm" /></td>
        <td><span className="line-clamp-2 min-w-[150px] text-[12.5px] text-foreground/85">{a.result_summary}</span>{a.campaign_id && <Link to={`/campaigns/${a.campaign_id}`} onClick={(e) => e.stopPropagation()} className="mt-0.5 block max-w-[220px] truncate text-[11px] text-muted-foreground hover:text-primary">{campaignName ?? a.campaign_id}</Link>}</td>
      </tr>
      {open && (
        <tr className="bg-surface-muted/40">
          <td colSpan={6} className="px-5 py-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <Callout tone={STATUS_TONE[a.execution_status] ?? 'neutral'} title="Guardrail notes">{a.guardrail_notes || 'No guardrail notes recorded.'}</Callout>
                <div>
                  <JsonPanel value={a.parameters} title="Parameters" maxHeight={240} />
                </div>
              </div>
              <div className="space-y-3 text-[13px]">
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {a.session_id && <Link to={`/agents/sessions/${a.session_id}`} className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"><Bot className="h-3.5 w-3.5" />Agent session</Link>}
                  {a.run_id && <Link to={`/agents/runs/${a.run_id}`} className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"><PlayCircle className="h-3.5 w-3.5" />Run</Link>}
                  {a.campaign_id && <Link to={`/campaigns/${a.campaign_id}`} className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"><Megaphone className="h-3.5 w-3.5" />{campaignName ?? 'Campaign'}</Link>}
                  <span className="text-muted-foreground">Actor id <span className="font-mono text-xs">{a.actor_id}</span></span>
                  <span className="text-muted-foreground">{timeAgo(a.timestamp)}</span>
                </div>
                <HashRow label="Hash" value={a.hash} />
                <HashRow label="Previous hash" value={a.prev_hash} />
                <div className="text-[11.5px] text-muted-foreground">Entry id <span className="font-mono">{a.id}</span></div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function HashRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2">
      <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground"><Hash className="h-3 w-3" />{label}</span><CopyButton value={value} /></div>
      <div className="mt-0.5 break-all font-mono text-[11.5px] leading-relaxed text-foreground/80">{value}</div>
    </div>
  );
}
