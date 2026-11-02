import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip } from 'recharts';
import { FlaskConical, Play, Clock, Users, Target, Sparkles, Cpu, ArrowRight, Bot } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useEvaluation, useScopes, useAction, useBrands } from '@/hooks/queries';
import { useAuth } from '@/store/auth';
import { cn, money, num, pct, duration, minutes, fmtDateTime, platformLabel } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, Section } from '@/components/ui/card';
import { QueryError } from '@/components/collaborations/QueryError';
import { Callout, EmptyState, SkeletonCards, Skeleton } from '@/components/ui/feedback';
import { SegmentedControl } from '@/components/ui/field';
import { ChartFrame, ChartTooltip, CHART } from '@/components/ui/charts';
import { DataTable, type Column } from '@/components/ui/data';
import { PlatformIcons } from '@/components/ui/status';
import { Tooltip } from '@/components/ui/overlay';
import type { EvaluationRun, Scenario } from '@/types';

const MANUAL = CHART.blue;
const AGENTIC = CHART.violet;
type Mode = 'AUTO' | 'SIMULATED';

function CompareTile({ label, icon: Icon, manual, agentic, delta, deltaPositive, unit }: { label: string; icon: React.ElementType; manual: string; agentic: string; delta: string; deltaPositive: boolean; unit?: string }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-agent-soft text-agent"><Icon className="h-3.5 w-3.5" /></span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="h-2 w-2 rounded-sm" style={{ background: MANUAL }} />Manual</div>
          <div className="mt-1 font-display text-xl font-semibold tabular-nums">{manual}</div>
        </div>
        <div className="rounded-xl border border-agent/30 bg-agent-soft/30 px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="h-2 w-2 rounded-sm" style={{ background: AGENTIC }} />Agentic</div>
          <div className="mt-1 font-display text-xl font-semibold tabular-nums">{agentic}</div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs"><Badge tone={deltaPositive ? 'success' : 'danger'}>{delta}</Badge><span className="text-muted-foreground">{unit}</span></div>
    </Card>
  );
}

function ScenarioCard({ sc, latest, onRun, running, inScope, brandName }: { sc: Scenario; latest?: { manual?: EvaluationRun; agentic?: EvaluationRun }; onRun: (key: string, mode: Mode) => void; running: boolean; inScope: boolean; brandName?: string }) {
  const [mode, setMode] = React.useState<Mode>('AUTO');
  return (
    <Card className={cn('flex flex-col', running && 'border-agent/50 ring-4 ring-agent/10')}>
      <CardHeader className="mb-0" title={sc.name} description={sc.description} action={<PlatformIcons platforms={sc.platforms} />} />
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 text-[12.5px] sm:grid-cols-3">
        <div><dt className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Niche</dt><dd className="font-medium">{sc.niche}</dd></div>
        <div><dt className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Budget</dt><dd className="font-medium tabular-nums">{money(sc.budget)}</dd></div>
        <div><dt className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Rate band</dt><dd className="font-medium tabular-nums">{money(sc.rate_band[0])}–{money(sc.rate_band[1])}</dd></div>
        <div><dt className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Creators to evaluate</dt><dd className="font-medium tabular-nums">{sc.creators_to_evaluate}</dd></div>
        <div className="col-span-2"><dt className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Deliverables</dt><dd className="font-medium">{sc.deliverables.join(' · ')}</dd></div>
        <div className="col-span-2 sm:col-span-3"><dt className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Platforms</dt><dd className="font-medium">{sc.platforms.map(platformLabel).join(', ')}</dd></div>
      </dl>

      {latest?.agentic && latest.manual && (
        <div className="mt-4 rounded-xl border border-border bg-surface-muted/50 p-3">
          <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground"><span>Latest pair · {fmtDateTime(latest.agentic.created_at)}</span>{latest.agentic.agent_run_id && <Link to={`/agents/runs/${latest.agentic.agent_run_id}`} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">Agent run <ArrowRight className="h-3 w-3" /></Link>}</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { l: 'Launch', m: duration(latest.manual.time_to_launch_sec), a: duration(latest.agentic.time_to_launch_sec) },
              { l: 'Human', m: minutes(latest.manual.human_minutes), a: minutes(latest.agentic.human_minutes) },
              { l: 'Accuracy', m: pct(latest.manual.matching_accuracy_pct, 0), a: pct(latest.agentic.matching_accuracy_pct, 0) },
            ].map((k) => (
              <div key={k.l}><div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{k.l}</div><div className="mt-0.5 text-[12.5px] tabular-nums"><span className="text-muted-foreground">{k.m}</span> <span className="text-muted-foreground">→</span> <span className="font-semibold text-agent">{k.a}</span></div></div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
        <SegmentedControl size="sm" value={mode} onChange={setMode} options={[{ value: 'AUTO', label: 'Auto', icon: <Sparkles className="h-3 w-3" /> }, { value: 'SIMULATED', label: 'Simulated', icon: <Cpu className="h-3 w-3" /> }]} />
        {inScope ? (
          <Button size="sm" variant="agent" leftIcon={<Play className="h-3.5 w-3.5" />} loading={running} onClick={() => onRun(sc.key, mode)}>{running ? 'Running scenario…' : 'Run scenario'}</Button>
        ) : (
          <Tooltip content={`Runs against ${brandName ?? sc.brand_id}, which is outside your workspace`}><span><Button size="sm" variant="secondary" disabled leftIcon={<Play className="h-3.5 w-3.5" />}>Outside your workspace</Button></span></Tooltip>
        )}
      </div>
      {running && <p className="mt-2 text-xs text-muted-foreground">Creating a sandbox campaign and session, then running the agent against the live MCP server. Usually 5–20 seconds.</p>}
    </Card>
  );
}

export default function Evaluation() {
  const navigate = useNavigate();
  const evaluation = useEvaluation();
  const scopes = useScopes();
  const me = useAuth((st) => st.me);
  const brands = useBrands();
  const brandIds = React.useMemo(() => new Set((brands.data ?? []).map((b) => b.id)), [brands.data]);
  const inScope = (sc: Scenario) => me?.user.role === 'ADMIN' || brandIds.has(sc.brand_id);
  const brandName = (sc: Scenario) => sc.brand_name;
  const [runningKey, setRunningKey] = React.useState<string | null>(null);
  const [lastResult, setLastResult] = React.useState<{ scenario: string; agent_run_id: string; campaign_id: string; manual: EvaluationRun; agentic: EvaluationRun } | null>(null);

  const run = useAction((scenario: string, mode: Mode) => api.insights.runScenario(scenario, mode), { invalidate: ['evaluation', 'runs', 'sessions', 'campaigns', 'audit'] });
  const onRun = (key: string, mode: Mode) => {
    setRunningKey(key);
    const t = toast.loading('Running scenario against the governed MCP server…');
    run.mutate([key, mode], {
      onSuccess: (r) => { toast.success('Scenario recorded', { id: t, description: `Agent launched in ${duration(r.agentic.time_to_launch_sec)} with ${minutes(r.agentic.human_minutes)} of human oversight.` }); setLastResult({ scenario: key, ...r }); },
      onError: () => toast.dismiss(t),
      onSettled: () => setRunningKey(null),
    });
  };

  const d = evaluation.data;
  const runs = d?.runs ?? [];
  const latestBy = React.useMemo(() => {
    const m = new Map<string, { manual?: EvaluationRun; agentic?: EvaluationRun }>();
    for (const r of runs) { // runs are newest first
      const e = m.get(r.scenario_key) ?? {};
      if (r.workflow_type === 'MANUAL' && !e.manual) e.manual = r;
      if (r.workflow_type === 'AGENTIC' && !e.agentic) e.agentic = r;
      m.set(r.scenario_key, e);
    }
    return m;
  }, [runs]);

  const chartRows = (d?.scenarios ?? []).map((sc) => {
    const pair = latestBy.get(sc.key);
    // Two-word tick labels: full names collide on the x-axis once four scenarios sit side by side.
    const short = sc.name.replace(/\s*\(.*\)/, '').split(' ').slice(0, 2).join(' ');
    return { name: short, manual_hours: (pair?.manual?.time_to_launch_sec ?? 0) / 3600, agentic_min: (pair?.agentic?.time_to_launch_sec ?? 0) / 60, manual_min: pair?.manual?.human_minutes ?? 0, agentic_human: pair?.agentic?.human_minutes ?? 0, manual_acc: pair?.manual?.matching_accuracy_pct ?? 0, agentic_acc: pair?.agentic?.matching_accuracy_pct ?? 0 };
  }).filter((r) => r.manual_hours || r.agentic_min);

  const columns: Column<EvaluationRun>[] = [
    { key: 'scenario', header: 'Scenario', render: (r) => <span className="font-medium">{r.scenario_name}</span>, sortValue: (r) => r.scenario_name },
    { key: 'workflow', header: 'Workflow', render: (r) => <Badge tone={r.workflow_type === 'AGENTIC' ? 'agent' : 'neutral'} size="sm">{r.workflow_type === 'AGENTIC' ? <Bot className="h-3 w-3" /> : null}{r.workflow_type === 'AGENTIC' ? 'Agentic' : 'Manual'}</Badge> },
    { key: 'ttl', header: 'Time to launch', align: 'right', render: (r) => <span className="tabular-nums">{duration(r.time_to_launch_sec)}</span>, sortValue: (r) => r.time_to_launch_sec },
    { key: 'human', header: 'Human minutes', align: 'right', render: (r) => <span className="tabular-nums">{minutes(r.human_minutes)}</span>, sortValue: (r) => r.human_minutes },
    { key: 'acc', header: 'Accuracy', align: 'right', render: (r) => <span className="tabular-nums">{pct(r.matching_accuracy_pct, 1)}</span>, sortValue: (r) => r.matching_accuracy_pct },
    { key: 'creators', header: 'Evaluated', align: 'right', render: (r) => <span className="tabular-nums">{num(r.creators_evaluated)}</span> },
    { key: 'offers', header: 'Offers', align: 'right', render: (r) => <span className="tabular-nums">{num(r.offers_sent)}</span> },
    { key: 'approvals', header: 'Approvals', align: 'right', render: (r) => <span className="tabular-nums">{num(r.approvals_required)}</span> },
    { key: 'run', header: 'Run', render: (r) => r.agent_run_id ? <Link to={`/agents/runs/${r.agent_run_id}`} className="inline-flex items-center gap-1 text-primary hover:underline">Console <ArrowRight className="h-3 w-3" /></Link> : <Tooltip content={r.notes}><span className="text-muted-foreground">{r.workflow_type === 'MANUAL' ? 'modelled' : 'seeded'}</span></Tooltip> },
    { key: 'date', header: 'Date', align: 'right', render: (r) => <span className="whitespace-nowrap text-muted-foreground">{fmtDateTime(r.created_at)}</span>, sortValue: (r) => r.created_at },
  ];

  const legend = [{ label: 'Manual', color: MANUAL }, { label: 'Agentic', color: AGENTIC }];
  const axis = { axisLine: false, tickLine: false } as const;

  return (
    <div className="page">
      <PageHeader title="Evaluation Lab" description="Matched campaign scenarios run through the manual and agent-operated workflows, measuring time-to-launch, human labour and matching accuracy (paper §10)." meta={scopes.data && <Badge tone={scopes.data.runtime.llm_available ? 'agent' : 'neutral'}>{scopes.data.runtime.llm_available ? <Sparkles className="h-3 w-3" /> : <Cpu className="h-3 w-3" />}{scopes.data.runtime.llm_available ? 'Claude runtime' : 'Simulated runtime'}</Badge>} actions={<Button variant="secondary" onClick={() => navigate('/agents')}>Agents</Button>} />

      <div className="space-y-6">
        <Callout tone="agent" icon={FlaskConical} title="How this is measured">
          Each scenario is run twice. The <strong>agentic</strong> workflow is measured live: a sandbox campaign and a CAMPAIGN_MANAGER session are created and the agent runs against the governed MCP server — time to the first accepted offer, checkpoints raised and shortlist quality are recorded. The <strong>manual</strong> baseline is a time-and-motion model (6.5 min per creator reviewed, 45 min brief, 25 min per outreach, 35 min coordination, with reply latency across working days). Matching accuracy is the share of shortlisted creators clearing the 70-point reviewer bar.
        </Callout>

        {evaluation.isLoading ? <SkeletonCards count={3} className="xl:grid-cols-3" /> : evaluation.isError ? <QueryError what="evaluation results" error={evaluation.error} refetch={evaluation.refetch} /> : d && d.manual.runs > 0 ? (
          <div className="grid gap-4 md:grid-cols-3">
            <CompareTile label="Time to launch" icon={Clock} manual={duration(d.manual.time_to_launch_sec)} agentic={duration(d.agentic.time_to_launch_sec)} delta={`−${d.delta.time_to_launch_pct}%`} deltaPositive={d.delta.time_to_launch_pct > 0} unit="elapsed to first offer" />
            <CompareTile label="Human labour" icon={Users} manual={minutes(d.manual.human_minutes)} agentic={minutes(d.agentic.human_minutes)} delta={`−${d.delta.human_minutes_pct}%`} deltaPositive={d.delta.human_minutes_pct > 0} unit="minutes of operator time" />
            <CompareTile label="Matching accuracy" icon={Target} manual={pct(d.manual.matching_accuracy_pct, 1)} agentic={pct(d.agentic.matching_accuracy_pct, 1)} delta={`${d.delta.matching_accuracy_pts >= 0 ? '+' : ''}${d.delta.matching_accuracy_pts} pts`} deltaPositive={d.delta.matching_accuracy_pts >= 0} unit={`${d.agentic.runs} agentic vs ${d.manual.runs} manual runs`} />
          </div>
        ) : <EmptyState icon={FlaskConical} title="No evaluation runs yet" description="Run a scenario below to produce the first manual-vs-agentic pair." />}

        {lastResult && (
          <Callout tone="success" title="Scenario recorded" action={<div className="flex shrink-0 gap-2"><Button size="xs" variant="secondary" onClick={() => navigate(`/campaigns/${lastResult.campaign_id}`)}>Campaign</Button><Button size="xs" variant="agent" onClick={() => navigate(`/agents/runs/${lastResult.agent_run_id}`)}>Open run</Button></div>}>
            Agentic: {duration(lastResult.agentic.time_to_launch_sec)} to launch, {minutes(lastResult.agentic.human_minutes)} human, {pct(lastResult.agentic.matching_accuracy_pct, 0)} accuracy · Manual model: {duration(lastResult.manual.time_to_launch_sec)}, {minutes(lastResult.manual.human_minutes)}, {pct(lastResult.manual.matching_accuracy_pct, 0)}.
          </Callout>
        )}

        {evaluation.isLoading ? <div className="grid gap-6 xl:grid-cols-2"><Skeleton className="h-72" /><Skeleton className="h-72" /></div> : chartRows.length > 0 && (
          <div className="grid gap-6 xl:grid-cols-2">
            <ChartFrame title="Time to launch — manual" description="Hours from kickoff to first offer (modelled)" height={240} legend={[legend[0]!]}>
              <BarChart data={chartRows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap={24}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="name" {...axis} interval={0} tick={{ fontSize: 11 }} />
                <YAxis {...axis} tickFormatter={(v) => `${v}h`} width={48} />
                <RTooltip content={<ChartTooltip format={(v) => `${v.toFixed(1)} h`} />} cursor={{ fill: 'hsl(var(--muted) / 0.5)' }} />
                <Bar dataKey="manual_hours" name="Manual" fill={MANUAL} radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false} />
              </BarChart>
            </ChartFrame>
            <ChartFrame title="Time to launch — agentic" description="Minutes from kickoff to first offer (measured live)" height={240} legend={[legend[1]!]}>
              <BarChart data={chartRows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap={24}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="name" {...axis} interval={0} tick={{ fontSize: 11 }} />
                <YAxis {...axis} tickFormatter={(v) => `${v}m`} width={48} />
                <RTooltip content={<ChartTooltip format={(v) => `${v.toFixed(1)} min`} />} cursor={{ fill: 'hsl(var(--muted) / 0.5)' }} />
                <Bar dataKey="agentic_min" name="Agentic" fill={AGENTIC} radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false} />
              </BarChart>
            </ChartFrame>
            <ChartFrame title="Human labour minutes" description="Operator time per scenario" height={240} legend={legend}>
              <BarChart data={chartRows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap={24} barGap={2}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="name" {...axis} interval={0} tick={{ fontSize: 11 }} />
                <YAxis {...axis} width={48} />
                <RTooltip content={<ChartTooltip format={(v) => minutes(v)} />} cursor={{ fill: 'hsl(var(--muted) / 0.5)' }} />
                <Bar dataKey="manual_min" name="Manual" fill={MANUAL} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
                <Bar dataKey="agentic_human" name="Agentic" fill={AGENTIC} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
              </BarChart>
            </ChartFrame>
            <ChartFrame title="Matching accuracy" description="Share of shortlist clearing the reviewer bar" height={240} legend={legend}>
              <BarChart data={chartRows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap={24} barGap={2}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="name" {...axis} interval={0} tick={{ fontSize: 11 }} />
                <YAxis {...axis} domain={[0, 100]} tickFormatter={(v) => `${v}%`} width={48} />
                <RTooltip content={<ChartTooltip format={(v) => pct(v, 1)} />} cursor={{ fill: 'hsl(var(--muted) / 0.5)' }} />
                <Bar dataKey="manual_acc" name="Manual" fill={MANUAL} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
                <Bar dataKey="agentic_acc" name="Agentic" fill={AGENTIC} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
              </BarChart>
            </ChartFrame>
          </div>
        )}

        <Section title="Scenarios" description="Each run creates a sandbox campaign and a scoped session, so production campaigns are never touched.">
          {evaluation.isLoading ? <SkeletonCards count={3} className="xl:grid-cols-3" /> : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(d?.scenarios ?? []).map((sc) => <ScenarioCard key={sc.key} sc={sc} latest={latestBy.get(sc.key)} onRun={onRun} running={runningKey === sc.key} inScope={inScope(sc)} brandName={brandName(sc)} />)}
            </div>
          )}
        </Section>

        <Section title="Run history" description="Every recorded manual/agentic pair.">
          {evaluation.isLoading ? <div className="card p-5"><Skeleton className="h-40" /></div> : <DataTable rows={runs} columns={columns} rowKey={(r) => r.id} empty={<EmptyState compact icon={FlaskConical} title="No runs recorded" />} />}
        </Section>
      </div>
    </div>
  );
}
