import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Bot, Sparkles, Cpu, ShieldAlert, ShieldX, Wallet, ListOrdered, Clock, XCircle, ArrowDown, Braces, ScrollText, ShieldCheck, ArrowRight, Hash } from 'lucide-react';
import { api } from '@/lib/api';
import { useRun, useSession, useCheckpoints, useAudit, useAction } from '@/hooks/queries';
import { useRunStream } from '@/lib/realtime';
import { money, num, fmtDateTime, duration, titleCase, cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { Stat, EmptyState, Skeleton, SkeletonRows, PulseDot, Callout } from '@/components/ui/feedback';
import { KeyValue } from '@/components/ui/data';
import { ConfirmDialog, Tooltip } from '@/components/ui/overlay';
import { SegmentedControl } from '@/components/ui/field';
import { RunStatusBadge, CheckpointStatusBadge, ExecStatusBadge, ToolChip, CHECKPOINT_ACTION } from '@/components/ui/status';
import { RunTimeline, buildTimeline, matchesFilter, governanceSummary, type TimelineFilter } from '@/components/agents/RunTimeline';
import { SCOPE_META, RULE_META, modeLabel } from '@/components/agents/shared';
import type { AgentRun as AgentRunT } from '@/types';

function useElapsed(startedAt?: string, finishedAt?: string | null, running?: boolean): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [running]);
  if (!startedAt) return 0;
  const start = new Date(startedAt).getTime();
  const end = finishedAt ? new Date(finishedAt).getTime() : running ? now : Date.now();
  return Math.max(0, (end - start) / 1000);
}

export default function AgentRun() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const run = useRun(id, { refetchInterval: (q) => ((q.state.data as AgentRunT | undefined)?.status === 'RUNNING' ? 2000 : false) });
  const r = run.data;
  const running = r?.status === 'RUNNING';
  const stream = useRunStream(id);
  const session = useSession(r?.session_id);
  const checkpoints = useCheckpoints(r ? { session_id: r.session_id } : {});
  const audit = useAudit({ run_id: id, limit: 100 });
  const [filter, setFilter] = React.useState<TimelineFilter>('all');
  const [collapseAll, setCollapseAll] = React.useState(false);
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const elapsed = useElapsed(r?.started_at, r?.finished_at, running);

  const cancel = useAction(api.agents.cancelRun, { invalidate: ['run', 'runs', 'sessions'], success: 'Cancellation requested', onSuccess: () => setConfirmCancel(false) });

  // Events: prefer the live stream; fall back to the run payload's history if the stream is still connecting.
  const events = stream.events.length ? stream.events : (r?.events ?? []);
  const items = React.useMemo(() => buildTimeline(events), [events]);
  const visible = React.useMemo(() => items.filter((it) => matchesFilter(it, filter)), [items, filter]);
  const rules = React.useMemo(() => governanceSummary(events), [events]);
  const liveRunning = running || (stream.status === 'live' && !events.some((e) => e.type === 'done' || e.type === 'error'));

  // Auto-scroll: stick to the bottom while running unless the user scrolled up.
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [stick, setStick] = React.useState(true);
  const [unseen, setUnseen] = React.useState(false);
  const lastCount = React.useRef(0);
  // Scroll events fired by our own scrollTo (especially the intermediate frames of a smooth scroll) must not be
  // mistaken for the user scrolling away — otherwise auto-follow switches itself off after the first card.
  const programmatic = React.useRef<number | null>(null);
  const scrollToBottom = React.useCallback((smooth: boolean) => {
    const el = scrollRef.current;
    if (!el) return;
    // An instant scroll fires a single scroll event that already reads as "at bottom", so only smooth scrolls need the guard.
    if (programmatic.current) window.clearTimeout(programmatic.current);
    programmatic.current = smooth ? window.setTimeout(() => { programmatic.current = null; }, 700) : null;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);
  React.useEffect(() => () => { if (programmatic.current) window.clearTimeout(programmatic.current); }, []);
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (events.length !== lastCount.current) {
      lastCount.current = events.length;
      if (!liveRunning) return;
      if (stick) scrollToBottom(false);
      else setUnseen(true);
    }
  }, [events.length, stick, filter, liveRunning, scrollToBottom]);
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    if (programmatic.current && !atBottom) return;
    setStick(atBottom);
    if (atBottom) setUnseen(false);
  };
  const jump = () => { scrollToBottom(true); setStick(true); setUnseen(false); };

  if (run.isLoading) {
    return (
      <div className="page">
        <PageHeader crumbs={[{ label: 'Agents', to: '/agents' }, { label: 'Run' }]} title={<Skeleton className="h-8 w-80" />} />
        <div className="grid gap-6 xl:grid-cols-3"><div className="card p-5 xl:col-span-2"><SkeletonRows rows={6} /></div><div className="card p-5"><SkeletonRows rows={3} /></div></div>
      </div>
    );
  }
  if (run.isError || !r) {
    return (
      <div className="page">
        <PageHeader crumbs={[{ label: 'Agents', to: '/agents' }, { label: 'Run' }]} title="Run not found" />
        <EmptyState icon={Bot} title="This run does not exist or is outside your scope" action={<Button variant="secondary" onClick={() => navigate('/agents')}>Back to agents</Button>} />
      </div>
    );
  }

  const runCheckpoints = (checkpoints.data ?? []).filter((c) => c.run_id === r.id);
  const s = session.data;
  const held = events.filter((e) => e.type === 'checkpoint').length || r.checkpoints_count;
  const blocked = events.filter((e) => e.type === 'guardrail').length || r.blocked_count;
  const steps = Math.max(r.steps_count, events.filter((e) => e.type === 'tool_call').length);
  const isLlm = r.mode === 'LLM';

  return (
    <div className="page">
      <PageHeader
        crumbs={[{ label: 'Agents', to: '/agents' }, { label: <span className="inline-block max-w-[160px] truncate align-bottom sm:max-w-none">{r.session_name ?? 'Session'}</span>, to: `/agents/sessions/${r.session_id}` }, { label: <span className="font-mono text-[12px]">{r.id}</span> }]}
        title={<Tooltip content={r.goal}><span className="block max-w-[82vw] truncate md:max-w-[640px]">{r.goal}</span></Tooltip>}
        meta={<span className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5">{running && <PulseDot tone="agent" />}<RunStatusBadge status={r.status} /></span>
          <Badge tone={isLlm ? 'agent' : 'neutral'}>{isLlm ? <Sparkles className="h-3 w-3" /> : <Cpu className="h-3 w-3" />}{modeLabel(r.mode)}{r.model ? <span className="font-mono font-normal"> · {r.model}</span> : null}</Badge>
        </span>}
        description={<span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link to={`/agents/sessions/${r.session_id}`} className="inline-flex items-center gap-1 hover:text-foreground"><Bot className="h-3.5 w-3.5" />{r.session_name ?? r.session_id}</Link>
          {r.campaign_id && <Link to={`/campaigns/${r.campaign_id}`} className="hover:text-foreground">{r.campaign_title ?? r.campaign_id}</Link>}
          <span>Started {fmtDateTime(r.started_at)}</span>
          {r.finished_at && <span>Finished {fmtDateTime(r.finished_at)}</span>}
        </span>}
        actions={running ? <Button variant="danger" leftIcon={<XCircle className="h-4 w-4" />} onClick={() => setConfirmCancel(true)}>Cancel run</Button> : <Button variant="secondary" onClick={() => navigate(`/agents/sessions/${r.session_id}`)}>Back to session</Button>}
      />

      <div className={cn('grid gap-3 grid-cols-2 sm:grid-cols-3', isLlm ? 'xl:grid-cols-7' : 'xl:grid-cols-5')}>
        <Stat size="sm" label="Steps" value={num(steps)} icon={ListOrdered} tone="primary" />
        <Stat size="sm" label="Held" value={num(held)} icon={ShieldAlert} tone={held ? 'warning' : 'neutral'} />
        <Stat size="sm" label="Blocked" value={num(blocked)} icon={ShieldX} tone={blocked ? 'danger' : 'neutral'} />
        <Stat size="sm" label="Committed" value={money(r.spend_committed)} icon={Wallet} tone="agent" />
        {isLlm && <Stat size="sm" label="Tokens in" value={num(r.input_tokens, { compact: true })} icon={Hash} tone="neutral" />}
        {isLlm && <Stat size="sm" label="Tokens out" value={num(r.output_tokens, { compact: true })} icon={Hash} tone="neutral" />}
        <Stat size="sm" label="Elapsed" value={<span className={cn(running && 'text-agent')}>{duration(elapsed)}</span>} icon={Clock} tone={running ? 'agent' : 'neutral'} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        {/* Event stream */}
        <Card padded={false} className="relative flex min-h-0 flex-col xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold">Event stream</span>
              {stream.status === 'live' && liveRunning && <Badge tone="agent" size="sm" dot>live</Badge>}
              {stream.status === 'connecting' && <Badge tone="neutral" size="sm">connecting…</Badge>}
              {stream.status === 'error' && <Badge tone="danger" size="sm">stream disconnected</Badge>}
              {stream.status === 'ended' && <Badge tone="neutral" size="sm">replayed · {events.length} events</Badge>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SegmentedControl size="sm" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'tools', label: 'Tool calls' }, { value: 'reasoning', label: 'Reasoning' }, { value: 'governance', label: 'Governance' }]} />
              <Button size="xs" variant={collapseAll ? 'subtle' : 'ghost'} leftIcon={<Braces className="h-3.5 w-3.5" />} onClick={() => setCollapseAll((v) => !v)}>{collapseAll ? 'JSON collapsed' : 'Collapse all JSON'}</Button>
            </div>
          </div>
          <div ref={scrollRef} onScroll={onScroll} className="max-h-[72vh] min-h-[360px] overflow-y-auto px-4 py-5 sm:px-5">
            {events.length === 0 ? (
              stream.status === 'connecting' || running ? <SkeletonRows rows={4} /> : <EmptyState compact icon={Bot} title="No events recorded" description="This run produced no events." />
            ) : visible.length === 0 ? (
              <EmptyState compact icon={Bot} title={`No ${filter} events`} description="Try another filter." action={<Button size="sm" variant="secondary" onClick={() => setFilter('all')}>Show all</Button>} />
            ) : (
              <RunTimeline items={visible} collapseAll={collapseAll} running={liveRunning} />
            )}
          </div>
          {!stick && (unseen || liveRunning) && (
            <button type="button" onClick={jump} className="absolute bottom-4 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background shadow-raised animate-slide-up">
              <ArrowDown className="h-3.5 w-3.5" />Jump to latest
            </button>
          )}
        </Card>

        {/* Side column */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Run summary" icon={<Bot className="h-4 w-4" />} />
            <KeyValue items={[
              { label: 'Goal', value: <span className="text-[13px] leading-relaxed">{r.goal}</span> },
              { label: 'Session', value: s ? <span><Link to={`/agents/sessions/${s.id}`} className="hover:text-primary">{s.name}</Link> <span className="text-xs text-muted-foreground">· {SCOPE_META[s.role_scope].label} · {money(s.budget_ceiling)} ceiling · {money(s.rate_ceiling)} per collab</span></span> : r.session_name ?? r.session_id },
              { label: 'Campaign', value: r.campaign_id ? <Link to={`/campaigns/${r.campaign_id}`} className="hover:text-primary">{r.campaign_title ?? r.campaign_id}</Link> : <span className="text-muted-foreground">None</span> },
              { label: 'Mode', value: `${modeLabel(r.mode)}${r.model ? ` · ${r.model}` : ''}` },
              { label: 'Status', value: <RunStatusBadge status={r.status} size="sm" /> },
              { label: 'Duration', value: duration(elapsed) },
              ...(r.summary ? [{ label: 'Summary', value: <span className="text-[13px] leading-relaxed">{r.summary}</span> }] : []),
            ]} />
          </Card>

          <Card>
            <CardHeader title="Checkpoints raised" description="Held actions from this run" icon={<ShieldAlert className="h-4 w-4" />} />
            {checkpoints.isLoading ? <SkeletonRows rows={2} /> : runCheckpoints.length === 0 ? <EmptyState compact icon={ShieldCheck} title="None raised" description="Every action stayed inside policy." /> : (
              <div className="space-y-2">
                {runCheckpoints.map((c) => (
                  <Link key={c.id} to={`/approvals?checkpoint=${c.id}`} className="block rounded-xl border border-border p-3 transition hover:border-warning/50 hover:bg-warning-soft/20">
                    <div className="flex items-center justify-between gap-2"><Badge tone={CHECKPOINT_ACTION[c.action_type]?.tone ?? 'neutral'} size="sm">{CHECKPOINT_ACTION[c.action_type]?.label ?? titleCase(c.action_type)}</Badge><CheckpointStatusBadge status={c.status} size="sm" /></div>
                    <div className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{c.justification}</div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground"><ToolChip name={c.tool_name} />{c.amount != null && <span className="font-semibold tabular-nums text-foreground">{money(c.amount)}</span>}</div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="How governance applied" description="Rules evaluated on this run" icon={<ShieldCheck className="h-4 w-4" />} />
            {rules.length === 0 ? <p className="text-[13px] text-muted-foreground">No tool results yet — rules appear as calls complete.</p> : (
              <ul className="space-y-2.5">
                {rules.map((g) => {
                  const fired = g.held || g.blocked;
                  return (
                    <li key={g.rule} className={cn('rounded-xl border px-3 py-2.5', g.blocked ? 'border-danger/30 bg-danger-soft/30' : g.held ? 'border-warning/30 bg-warning-soft/30' : 'border-border')}>
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span className="text-[13px] font-medium">{RULE_META[g.rule]?.label ?? titleCase(g.rule)}</span>
                        <span className="flex items-center gap-1">
                          <Badge tone="neutral" size="sm">{Math.max(g.evaluated, g.held + g.blocked)}× checked</Badge>
                          {g.held > 0 && <Badge tone="warning" size="sm">{g.held} held</Badge>}
                          {g.blocked > 0 && <Badge tone="danger" size="sm">{g.blocked} blocked</Badge>}
                          {!fired && <Badge tone="success" size="sm">passed</Badge>}
                        </span>
                      </div>
                      <div className="mt-1 text-[11.5px] leading-snug text-muted-foreground">{RULE_META[g.rule]?.description ?? ''}</div>
                    </li>
                  );
                })}
              </ul>
            )}
            {(held > 0 || blocked > 0) && <Callout tone="neutral" className="mt-3">Held actions wait for a reviewer; blocked actions were never written. Both are in the audit trail.</Callout>}
          </Card>

          <Card>
            <CardHeader title="Audit entries" description={`${audit.data?.total ?? 0} hash-chained record${(audit.data?.total ?? 0) === 1 ? '' : 's'}`} icon={<ScrollText className="h-4 w-4" />} action={<Button variant="ghost" size="sm" onClick={() => navigate(`/audit?run_id=${r.id}`)}>Open</Button>} />
            {audit.isLoading ? <SkeletonRows rows={3} /> : (audit.data?.items ?? []).length === 0 ? <EmptyState compact icon={ScrollText} title="No audit entries yet" /> : (
              <ul className="divide-y divide-border/70">
                {[...(audit.data?.items ?? [])].reverse().map((a) => (
                  <li key={a.id} className="py-2">
                    <div className="flex flex-wrap items-center gap-1.5"><ExecStatusBadge status={a.execution_status} size="sm" /><ToolChip name={a.tool_name} /><span className="ml-auto text-[11px] tabular-nums text-muted-foreground">{a.duration_ms}ms</span></div>
                    <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.result_summary}</div>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/audit" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">Verify chain integrity <ArrowRight className="h-3 w-3" /></Link>
          </Card>
        </div>
      </div>

      <ConfirmDialog open={confirmCancel} onOpenChange={setConfirmCancel} title="Cancel this run?" description="The agent stops before its next tool call. Actions already executed stay in place and remain in the audit trail; held checkpoints stay in the approval queue." confirmLabel="Cancel run" tone="danger" loading={cancel.isPending} onConfirm={() => cancel.mutate([r.id])} />
    </div>
  );
}
