import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Bot, Play, Pencil, PauseCircle, PlayCircle, ShieldX, Wallet, ShieldAlert, ListChecks, ScrollText, Wrench, Cpu, Sparkles, ArrowRight } from 'lucide-react';
import { useSession, useScopes, useMcpTools, useCheckpoints, useAudit } from '@/hooks/queries';
import { money, num, timeAgo, fmtDateTime, titleCase, cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { Progress, EmptyState, Skeleton, SkeletonRows, Stat } from '@/components/ui/feedback';
import { DataTable, KeyValue, type Column } from '@/components/ui/data';
import { Tooltip } from '@/components/ui/overlay';
import { SessionStatusBadge, RunStatusBadge, CheckpointStatusBadge, ExecStatusBadge, ToolChip, CHECKPOINT_ACTION, RiskBadge } from '@/components/ui/status';
import type { AgentRun } from '@/types';
import { LaunchRunDialog } from '@/components/agents/LaunchRunDialog';
import { EditSessionSheet } from '@/components/agents/EditSessionSheet';
import { useSessionActions } from '@/components/agents/SessionCard';
import { ScopeBadge, SCOPE_META, TOOL_CATEGORIES, RiskToneBadge, modeLabel } from '@/components/agents/shared';

export default function AgentSessionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const session = useSession(id);
  const scopes = useScopes();
  const tools = useMcpTools(id);
  const checkpoints = useCheckpoints({ session_id: id });
  const audit = useAudit({ session_id: id, limit: 50 });
  const [launchOpen, setLaunchOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const actions = useSessionActions(session.data);

  const s = session.data;

  if (session.isLoading) {
    return (
      <div className="page">
        <PageHeader crumbs={[{ label: 'Agents', to: '/agents' }, { label: 'Session' }]} title={<Skeleton className="h-8 w-64" />} />
        <div className="grid gap-6 xl:grid-cols-3"><div className="card p-5 xl:col-span-2"><SkeletonRows /></div><div className="card p-5"><SkeletonRows rows={3} /></div></div>
      </div>
    );
  }
  if (session.isError || !s) {
    return (
      <div className="page">
        <PageHeader crumbs={[{ label: 'Agents', to: '/agents' }, { label: 'Session' }]} title="Session not found" />
        <EmptyState icon={Bot} title="This agent session does not exist or is outside your scope" action={<Button variant="secondary" onClick={() => navigate('/agents')}>Back to agents</Button>} />
      </div>
    );
  }

  const pctUsed = s.budget_ceiling ? (s.spent_amount / s.budget_ceiling) * 100 : 0;
  const runs = s.runs ?? [];
  const grouped = TOOL_CATEGORIES.map((c) => ({ ...c, tools: (tools.data?.all_tools ?? []).filter((t) => t.category === c.key) })).filter((c) => c.tools.length);
  const allowed = new Set(s.allowed_tools);

  const runColumns: Column<AgentRun>[] = [
    { key: 'goal', header: 'Goal', render: (r) => <Tooltip content={r.goal}><span className="block max-w-[240px] truncate font-medium">{r.goal}</span></Tooltip> },
    { key: 'status', header: 'Status', render: (r) => <span className="flex items-center gap-1.5"><RunStatusBadge status={r.status} size="sm" /><Badge tone={r.mode === 'LLM' ? 'agent' : 'neutral'} size="sm">{r.mode === 'LLM' ? <Sparkles className="h-3 w-3" /> : <Cpu className="h-3 w-3" />}{modeLabel(r.mode)}</Badge></span> },
    { key: 'steps', header: 'Steps', align: 'right', render: (r) => <span className="tabular-nums">{num(r.steps_count)}</span>, sortValue: (r) => r.steps_count },
    { key: 'gov', header: 'Held / blocked', align: 'right', render: (r) => <span className="tabular-nums"><span className={cn(r.checkpoints_count ? 'font-medium text-warning' : 'text-muted-foreground')}>{num(r.checkpoints_count)}</span><span className="text-muted-foreground"> / </span><span className={cn(r.blocked_count ? 'font-medium text-danger' : 'text-muted-foreground')}>{num(r.blocked_count)}</span></span> },
    { key: 'spend', header: 'Spend', align: 'right', render: (r) => <span className="tabular-nums">{money(r.spend_committed)}</span>, sortValue: (r) => r.spend_committed },
    { key: 'started', header: 'Started', align: 'right', render: (r) => <span className="whitespace-nowrap text-muted-foreground">{timeAgo(r.started_at)}</span>, sortValue: (r) => r.started_at },
  ];

  return (
    <div className="page">
      <PageHeader
        crumbs={[{ label: 'Agents', to: '/agents' }, { label: s.name }]}
        title={s.name}
        meta={<span className="flex flex-wrap items-center gap-1.5"><SessionStatusBadge status={s.status} /><ScopeBadge scope={s.role_scope} /></span>}
        description={<span>{s.brand_name ?? 'Any brand'}{s.campaign_id ? <> · bound to <Link to={`/campaigns/${s.campaign_id}`} className="text-foreground hover:text-primary">{s.campaign_title ?? s.campaign_id}</Link></> : ' · any campaign of this brand'} · created {timeAgo(s.created_at)}</span>}
        actions={<>
          <Button variant="secondary" leftIcon={<Pencil className="h-4 w-4" />} onClick={() => setEditOpen(true)} disabled={s.status === 'REVOKED'}>Edit</Button>
          <Button variant="secondary" leftIcon={s.status === 'PAUSED' ? <PlayCircle className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />} disabled={!(s.status === 'ACTIVE' || s.status === 'PAUSED')} loading={actions.pending} onClick={actions.pauseOrResume}>{s.status === 'PAUSED' ? 'Resume' : 'Pause'}</Button>
          <Button variant="danger" leftIcon={<ShieldX className="h-4 w-4" />} disabled={s.status === 'REVOKED'} onClick={actions.openRevoke}>Revoke</Button>
          <Button variant="agent" leftIcon={<Play className="h-4 w-4" />} disabled={s.status !== 'ACTIVE'} onClick={() => setLaunchOpen(true)}>Launch run</Button>
        </>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Committed" value={money(s.spent_amount)} icon={Wallet} tone="agent" hint={`of ${money(s.budget_ceiling)} ceiling`} />
        <Stat label="Runs" value={num(s.stats?.runs ?? runs.length)} icon={Play} tone="primary" hint={`${num(s.stats?.tool_calls ?? 0)} tool calls`} />
        <Stat label="Pending checkpoints" value={num(s.stats?.checkpoints_pending ?? 0)} icon={ShieldAlert} tone={(s.stats?.checkpoints_pending ?? 0) ? 'warning' : 'neutral'} hint="Waiting on a reviewer" onClick={() => navigate('/approvals')} />
        <Stat label="Guardrail blocks" value={num(s.stats?.blocked ?? 0)} icon={ShieldX} tone={(s.stats?.blocked ?? 0) ? 'danger' : 'neutral'} hint="Rejected, nothing written" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title="Runs" description="Every run streams its reasoning, tool calls and governance decisions." action={<Button size="sm" variant="agent" disabled={s.status !== 'ACTIVE'} leftIcon={<Play className="h-3.5 w-3.5" />} onClick={() => setLaunchOpen(true)}>Launch run</Button>} />
            <DataTable className="rounded-xl shadow-none" rows={runs} columns={runColumns} rowKey={(r) => r.id} onRowClick={(r) => navigate(`/agents/runs/${r.id}`)} empty={<EmptyState compact icon={Play} title="No runs yet" description="Launch a run to see this agent work inside its policy." />} />
          </Card>

          <Card>
            <CardHeader title="Checkpoints" description="Actions this session tried that were held for a human." icon={<ShieldAlert className="h-4 w-4" />} action={<Button variant="ghost" size="sm" onClick={() => navigate('/approvals')}>Approval queue</Button>} />
            {checkpoints.isLoading ? <SkeletonRows rows={3} /> : (checkpoints.data ?? []).length === 0 ? <EmptyState compact icon={ListChecks} title="No checkpoints raised" description="This session has stayed inside its ceilings." /> : (
              <div className="space-y-2">
                {(checkpoints.data ?? []).map((c) => (
                  <Link key={c.id} to={`/approvals?checkpoint=${c.id}`} className="flex flex-col gap-2 rounded-xl border border-border p-3 transition hover:border-warning/50 hover:bg-warning-soft/20 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5"><Badge tone={CHECKPOINT_ACTION[c.action_type]?.tone ?? 'neutral'} size="sm">{CHECKPOINT_ACTION[c.action_type]?.label ?? titleCase(c.action_type)}</Badge><ToolChip name={c.tool_name} />{c.amount != null && <span className="text-[13px] font-semibold tabular-nums">{money(c.amount)}</span>}</div>
                      <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.justification}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground"><RiskBadge level={c.risk_level} size="sm" /><CheckpointStatusBadge status={c.status} size="sm" /><span>{timeAgo(c.created_at)}</span><ArrowRight className="h-3.5 w-3.5" /></div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Audit trail" description="Hash-chained log of every tool call made under this session." icon={<ScrollText className="h-4 w-4" />} action={<Button variant="ghost" size="sm" onClick={() => navigate(`/audit?session_id=${s.id}`)}>Open audit</Button>} />
            {audit.isLoading ? <SkeletonRows rows={4} /> : (audit.data?.items ?? []).length === 0 ? <EmptyState compact icon={ScrollText} title="No tool calls yet" /> : (
              <ul className="divide-y divide-border/70">
                {(audit.data?.items ?? []).map((a) => (
                  <li key={a.id} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:gap-3">
                    <div className="flex shrink-0 items-center gap-2"><ExecStatusBadge status={a.execution_status} size="sm" /><ToolChip name={a.tool_name} /></div>
                    <div className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground" title={a.result_summary}>{a.result_summary}</div>
                    <div className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{a.duration_ms}ms · {fmtDateTime(a.timestamp)}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Policy" description="The bounds this agent operates in." icon={<ShieldAlert className="h-4 w-4" />} />
            <div className="mb-4">
              <div className="mb-1.5 flex items-center justify-between text-xs"><span className="text-muted-foreground">Budget ceiling</span><span className="font-medium tabular-nums">{money(s.spent_amount)} / {money(s.budget_ceiling)}</span></div>
              <Progress value={pctUsed} tone={pctUsed > 90 ? 'danger' : pctUsed > 70 ? 'warning' : 'agent'} />
              <div className="mt-1 text-[11px] text-muted-foreground">{money(Math.max(0, s.budget_ceiling - s.spent_amount))} headroom · hard block above</div>
            </div>
            <KeyValue items={[
              { label: 'Rate ceiling', value: <span>{money(s.rate_ceiling)} <span className="text-xs text-muted-foreground">per collaboration · checkpoint above</span></span> },
              { label: 'Payment threshold', value: scopes.data ? <span>{money(scopes.data.payment_threshold)} <span className="text-xs text-muted-foreground">autonomous payout limit</span></span> : '—' },
              { label: 'Scope', value: <span>{SCOPE_META[s.role_scope].label} <span className="text-xs text-muted-foreground">· {SCOPE_META[s.role_scope].description}</span></span> },
              { label: 'Campaign binding', value: s.campaign_id ? <Link to={`/campaigns/${s.campaign_id}`} className="hover:text-primary">{s.campaign_title ?? s.campaign_id}</Link> : <span className="text-muted-foreground">Any campaign of {s.brand_name ?? 'the brand'}</span> },
              { label: 'Model', value: s.model, mono: true },
              { label: 'Last active', value: s.last_active_at ? fmtDateTime(s.last_active_at) : 'Never' },
              { label: 'Instructions', value: s.instructions ? <span className="whitespace-pre-wrap text-[13px] leading-relaxed">{s.instructions}</span> : <span className="text-muted-foreground">None</span> },
            ]} />
          </Card>

          <Card>
            <CardHeader title="Allowed tools" description={`${s.allowed_tools.length} of ${tools.data?.all_tools.length ?? '…'} tools exposed to this session`} icon={<Wrench className="h-4 w-4" />} action={<Button variant="ghost" size="sm" onClick={() => navigate('/mcp')}>Registry</Button>} />
            {tools.isLoading ? <SkeletonRows rows={4} /> : (
              <div className="space-y-3.5">
                {grouped.map((g) => (
                  <div key={g.key}>
                    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.label}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {g.tools.map((t) => (
                        <Tooltip key={t.name} content={allowed.has(t.name) ? `${t.title} · ${t.risk.replace('_', ' ')}` : `${t.title} — not granted to this session`}>
                          <span className={cn('inline-flex items-center gap-1', !allowed.has(t.name) && 'opacity-35')}>
                            <ToolChip name={t.name} className={allowed.has(t.name) ? '' : 'line-through'} />
                            {allowed.has(t.name) && t.risk !== 'read' && <RiskToneBadge risk={t.risk} size="sm" />}
                          </span>
                        </Tooltip>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <LaunchRunDialog open={launchOpen} onOpenChange={setLaunchOpen} defaultSessionId={s.id} />
      <EditSessionSheet session={s} open={editOpen} onOpenChange={setEditOpen} />
      {actions.dialog}
    </div>
  );
}
