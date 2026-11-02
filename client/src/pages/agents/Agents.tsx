import * as React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Bot, Plus, Play, Sparkles, Cpu, ShieldAlert, ShieldX, Wallet, Activity, Server } from 'lucide-react';
import { useRuns, useScopes, useSessions } from '@/hooks/queries';
import { money, num, timeAgo } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Callout, Stat, SkeletonCards, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Section } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data';
import { RunStatusBadge } from '@/components/ui/status';
import { Tooltip } from '@/components/ui/overlay';
import type { AgentRun } from '@/types';
import { CreateSessionDialog } from '@/components/agents/CreateSessionDialog';
import { LaunchRunDialog } from '@/components/agents/LaunchRunDialog';
import { SessionCard } from '@/components/agents/SessionCard';
import { modeLabel } from '@/components/agents/shared';
import { QueryError } from '@/components/collaborations/QueryError';

export default function Agents() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const scopes = useScopes();
  const sessions = useSessions({});
  const runs = useRuns({});
  const [createOpen, setCreateOpen] = React.useState(params.get('new') === '1');
  const [launch, setLaunch] = React.useState<{ open: boolean; sessionId?: string }>({ open: false });

  React.useEffect(() => { if (params.get('new') === '1') setCreateOpen(true); }, [params]);
  const closeCreate = (o: boolean) => {
    setCreateOpen(o);
    if (!o && params.get('new')) { const next = new URLSearchParams(params); next.delete('new'); setParams(next, { replace: true }); }
  };

  const list = sessions.data ?? [];
  const active = list.filter((s) => s.status === 'ACTIVE').length;
  const committed = list.reduce((a, s) => a + s.spent_amount, 0);
  const pending = list.reduce((a, s) => a + (s.stats?.checkpoints_pending ?? 0), 0);
  const blocked = list.reduce((a, s) => a + (s.stats?.blocked ?? 0), 0);
  const runtime = scopes.data?.runtime;

  const runColumns: Column<AgentRun>[] = [
    { key: 'session', header: 'Session', render: (r) => <span className="font-medium">{r.session_name ?? r.session_id}</span>, sortValue: (r) => r.session_name ?? '' },
    { key: 'campaign', header: 'Campaign', render: (r) => r.campaign_id ? <Link to={`/campaigns/${r.campaign_id}`} onClick={(e) => e.stopPropagation()} className="text-foreground/80 hover:text-primary">{r.campaign_title ?? r.campaign_id}</Link> : <span className="text-muted-foreground">—</span> },
    { key: 'goal', header: 'Goal', render: (r) => <Tooltip content={r.goal}><span className="block max-w-[260px] truncate text-muted-foreground">{r.goal}</span></Tooltip> },
    { key: 'mode', header: 'Mode', render: (r) => <Badge tone={r.mode === 'LLM' ? 'agent' : 'neutral'} size="sm">{r.mode === 'LLM' ? <Sparkles className="h-3 w-3" /> : <Cpu className="h-3 w-3" />}{modeLabel(r.mode)}</Badge> },
    { key: 'status', header: 'Status', render: (r) => <RunStatusBadge status={r.status} size="sm" /> },
    { key: 'steps', header: 'Steps', align: 'right', render: (r) => <span className="tabular-nums">{num(r.steps_count)}</span>, sortValue: (r) => r.steps_count },
    { key: 'checkpoints', header: 'Held', align: 'right', render: (r) => <span className={r.checkpoints_count ? 'font-medium tabular-nums text-warning' : 'tabular-nums text-muted-foreground'}>{num(r.checkpoints_count)}</span>, sortValue: (r) => r.checkpoints_count },
    { key: 'blocked', header: 'Blocked', align: 'right', render: (r) => <span className={r.blocked_count ? 'font-medium tabular-nums text-danger' : 'tabular-nums text-muted-foreground'}>{num(r.blocked_count)}</span>, sortValue: (r) => r.blocked_count },
    { key: 'spend', header: 'Spend', align: 'right', render: (r) => <span className="tabular-nums">{money(r.spend_committed)}</span>, sortValue: (r) => r.spend_committed },
    { key: 'started', header: 'Started', align: 'right', render: (r) => <span className="whitespace-nowrap text-muted-foreground">{timeAgo(r.started_at)}</span>, sortValue: (r) => r.started_at },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Agents"
        description="Authorised agent sessions and the runs they execute. Every tool call passes through the governed MCP server: scoped, ceilinged, checkpointed and audited."
        actions={<>
          <Button variant="secondary" leftIcon={<Server className="h-4 w-4" />} onClick={() => navigate('/mcp')}>MCP server</Button>
          <Button variant="secondary" leftIcon={<Play className="h-4 w-4" />} disabled={active === 0} onClick={() => setLaunch({ open: true })}>Launch run</Button>
          <Button variant="agent" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>Authorise agent</Button>
        </>}
      />

      <div className="space-y-6">
        {scopes.isLoading ? <Skeleton className="h-14 w-full" /> : runtime && (
          runtime.llm_available
            ? <Callout tone="agent" icon={Sparkles} title={<span>Runtime: Claude · <span className="font-mono text-[12.5px]">{runtime.default_model}</span></span>}>Runs plan with Claude and call tools through the governed MCP server. {runtime.active_runs > 0 && <strong>{runtime.active_runs} run{runtime.active_runs === 1 ? '' : 's'} in flight.</strong>}</Callout>
            : <Callout tone="agent" icon={Cpu} title="Runtime: simulated planner">Set <code className="font-mono text-[12px]">ANTHROPIC_API_KEY</code> on the server to plan with Claude ({runtime.default_model}). Governance is identical: the simulated planner calls the same governed tools, hits the same ceilings and raises the same checkpoints.{runtime.active_runs > 0 && <> <strong>{runtime.active_runs} run{runtime.active_runs === 1 ? '' : 's'} in flight.</strong></>}</Callout>
        )}

        {sessions.isLoading ? <SkeletonCards /> : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Active sessions" value={num(active)} icon={Bot} tone="agent" hint={`${list.length} total`} />
            <Stat label="Committed by agents" value={money(committed)} icon={Wallet} tone="primary" hint="Escrow locked through agent offers" onClick={() => navigate('/finance')} />
            <Stat label="Pending checkpoints" value={num(pending)} icon={ShieldAlert} tone={pending ? 'warning' : 'neutral'} hint="Held actions waiting on you" onClick={() => navigate('/approvals')} />
            <Stat label="Guardrail blocks" value={num(blocked)} icon={ShieldX} tone={blocked ? 'danger' : 'neutral'} hint="Rejected before anything was written" onClick={() => navigate('/audit?status=REJECTED_BY_GUARDRAIL')} />
          </div>
        )}

        <Section title="Sessions" description="Each session is a scoped identity with its own ceilings and tool list.">
          {sessions.isLoading ? <SkeletonCards count={3} className="xl:grid-cols-3" /> : sessions.isError ? <QueryError what="agent sessions" error={sessions.error} refetch={sessions.refetch} /> : list.length === 0 ? (
            <EmptyState icon={Bot} title="No agent sessions yet" description="Authorise an agent with a scope, a budget ceiling and a rate ceiling. It can only act inside those bounds." action={<Button variant="agent" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>Authorise agent</Button>} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {list.map((s) => <SessionCard key={s.id} session={s} onLaunch={(id) => setLaunch({ open: true, sessionId: id })} />)}
            </div>
          )}
        </Section>

        <Section title="Recent runs" description="Click a run to open its live console." action={runs.data && runs.data.some((r) => r.status === 'RUNNING') ? <Badge tone="agent" dot><Activity className="h-3 w-3" />{runs.data.filter((r) => r.status === 'RUNNING').length} running</Badge> : undefined}>
          {runs.isLoading ? <div className="card p-5"><Skeleton className="h-40 w-full" /></div> : (
            <DataTable rows={runs.data ?? []} columns={runColumns} rowKey={(r) => r.id} onRowClick={(r) => navigate(`/agents/runs/${r.id}`)} empty={<EmptyState compact icon={Play} title="No runs yet" description="Launch a run to watch the agent plan and call governed tools live." action={<Button size="sm" variant="agent" disabled={active === 0} onClick={() => setLaunch({ open: true })}>Launch run</Button>} />} />
          )}
        </Section>
      </div>

      <CreateSessionDialog open={createOpen} onOpenChange={closeCreate} defaultCampaignId={params.get('campaign_id') ?? undefined} />
      <LaunchRunDialog open={launch.open} onOpenChange={(o) => setLaunch((l) => ({ ...l, open: o }))} defaultSessionId={launch.sessionId} />
    </div>
  );
}
