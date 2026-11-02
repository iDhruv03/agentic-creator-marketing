import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from 'recharts';
import { Wallet, Lock, CheckCircle2, ShieldAlert, Bot, Users, Eye, ArrowRight, Plus, Sparkles, Megaphone, ShieldX, Clock } from 'lucide-react';
import { useOverview, useCheckpoints, useAudit, useCampaigns, useSessions, useRuns } from '@/hooks/queries';
import { useAuth } from '@/store/auth';
import { money, num, pct, timeAgo, fmtDate, cn, titleCase } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { Stat, SkeletonCards, EmptyState, Progress, PulseDot } from '@/components/ui/feedback';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { ChartFrame, ChartTooltip, CHART, BarList, Donut } from '@/components/ui/charts';
import { CampaignStatusBadge, ExecStatusBadge, ActorBadge, CHECKPOINT_ACTION, RiskBadge, ToolChip, RunStatusBadge } from '@/components/ui/status';
import { SCOPE_META } from '@/components/agents/shared';
import { QueryError } from '@/components/collaborations/QueryError';

export default function Overview() {
  const navigate = useNavigate();
  const me = useAuth((s) => s.me);
  const overview = useOverview();
  const checkpoints = useCheckpoints({ status: 'PENDING' });
  const audit = useAudit({ limit: 8 });
  const campaigns = useCampaigns({});
  const sessions = useSessions({});
  const runs = useRuns({});
  const t = overview.data?.totals;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const activeRuns = (runs.data ?? []).filter((r) => r.status === 'RUNNING');

  const budgetSegments = t ? [{ value: t.spent, color: CHART.teal, label: 'Paid out' }, { value: t.escrow, color: CHART.amber, label: 'In escrow' }, { value: Math.max(0, t.available), color: 'hsl(var(--muted-foreground) / 0.25)', label: 'Available' }] : [];

  return (
    <div className="page">
      <PageHeader
        title={<span>{greeting}, {me?.user.name.split(' ')[0]}</span>}
        description={`Here's what's moving across ${me?.org?.name ?? 'your workspace'} — campaigns, agent activity and anything waiting on you.`}
        actions={<>
          <Button variant="secondary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => navigate('/campaigns/new')}>New campaign</Button>
          <Button variant="agent" leftIcon={<Sparkles className="h-4 w-4" />} onClick={() => navigate('/agents?new=1')}>Launch an agent</Button>
        </>}
      />

      {/* Attention strip */}
      {(checkpoints.data?.length ?? 0) > 0 && (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-warning/30 bg-warning-soft/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning"><ShieldAlert className="h-4 w-4" /></span>
            <div>
              <div className="text-sm font-semibold">{checkpoints.data!.length} agent action{checkpoints.data!.length === 1 ? '' : 's'} waiting for your approval</div>
              <div className="mt-0.5 text-[13px] text-muted-foreground">{checkpoints.data!.slice(0, 2).map((c) => `${CHECKPOINT_ACTION[c.action_type]?.label ?? titleCase(c.action_type)}${c.amount ? ` · ${money(c.amount)}` : ''}`).join(' · ')}{checkpoints.data!.length > 2 ? ' · …' : ''}</div>
            </div>
          </div>
          <Button size="sm" onClick={() => navigate('/approvals')} rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>Review queue</Button>
        </div>
      )}

      {/* KPIs */}
      {overview.isLoading ? <SkeletonCards /> : overview.isError ? <QueryError what="your overview" error={overview.error} refetch={overview.refetch} /> : t && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Managed budget" value={money(t.budget)} icon={Wallet} tone="primary" hint={`${t.campaigns} campaign${t.campaigns === 1 ? '' : 's'} · ${t.active_campaigns} active`} onClick={() => navigate('/finance')} />
          <Stat label="Locked in escrow" value={money(t.escrow)} icon={Lock} tone="warning" hint="Committed to open offers & contracts" onClick={() => navigate('/finance')} />
          <Stat label="Paid to creators" value={money(t.spent)} icon={CheckCircle2} tone="success" hint={`${t.creators_engaged} creators engaged`} onClick={() => navigate('/collaborations')} />
          <Stat label="Agent actions" value={num(t.agent_actions)} icon={Bot} tone="agent" hint={<span>{t.held_for_approval} held · {t.guardrail_blocks} blocked</span>} onClick={() => navigate('/audit')} />
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        {/* Left column */}
        <div className="space-y-6 xl:col-span-2">
          {/* Activity chart */}
          <ChartFrame title="Platform activity" description="Tool calls per day — agents vs humans, from the audit trail" height={220} legend={[{ label: 'Agent', color: CHART.violet }, { label: 'Human', color: CHART.primary }]}>
            <AreaChart data={overview.data?.activity ?? []} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="ov-agent" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CHART.violet} stopOpacity={0.35} /><stop offset="100%" stopColor={CHART.violet} stopOpacity={0} /></linearGradient>
                <linearGradient id="ov-human" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CHART.primary} stopOpacity={0.3} /><stop offset="100%" stopColor={CHART.primary} stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={(d) => fmtDate(d, 'd MMM')} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip labelFormat={(l) => fmtDate(l, 'EEE d MMM')} />} />
              <Area type="monotone" dataKey="agent" name="Agent" stroke={CHART.violet} strokeWidth={2} fill="url(#ov-agent)" />
              <Area type="monotone" dataKey="human" name="Human" stroke={CHART.primary} strokeWidth={2} fill="url(#ov-human)" />
            </AreaChart>
          </ChartFrame>

          {/* Campaigns */}
          <Card padded={false}>
            <CardHeader className="mb-0 px-5 pt-5" title="Campaigns" description="Budget utilisation and pipeline per campaign" action={<Button variant="ghost" size="sm" rightIcon={<ArrowRight className="h-3.5 w-3.5" />} onClick={() => navigate('/campaigns')}>All campaigns</Button>} />
            <div className="mt-3 divide-y divide-border/70">
              {(campaigns.data ?? []).length === 0 && <div className="px-5 py-8"><EmptyState compact icon={Megaphone} title="No campaigns yet" description="Create a campaign and let an agent source creators for it." action={<Button size="sm" onClick={() => navigate('/campaigns/new')}>New campaign</Button>} /></div>}
              {(campaigns.data ?? []).slice(0, 5).map((c) => (
                <Link key={c.id} to={`/campaigns/${c.id}`} className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-3.5 transition hover:bg-accent/40 sm:grid-cols-[1.4fr_1fr_auto]">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><span className="truncate text-[14px] font-medium">{c.title}</span><CampaignStatusBadge status={c.status} size="sm" /></div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{c.brand_name} · {c.stats.collaborations} collab{c.stats.collaborations === 1 ? '' : 's'} · {c.stats.shortlist} shortlisted{c.stats.pending_checkpoints ? ` · ${c.stats.pending_checkpoints} pending approval` : ''}</div>
                  </div>
                  <div className="hidden sm:block">
                    <div className="mb-1 flex justify-between text-[11px] text-muted-foreground tabular-nums"><span>{money(c.financials.committed)} committed</span><span>{pct(c.financials.utilisation_pct, 0)}</span></div>
                    <Progress value={1} segments={[{ value: c.financials.spent / (c.budget || 1) * 100, tone: 'success' }, { value: c.financials.escrow_locked / (c.budget || 1) * 100, tone: 'warning' }]} size="sm" />
                  </div>
                  <div className="text-right text-[13px] font-semibold tabular-nums">{money(c.budget)}</div>
                </Link>
              ))}
            </div>
          </Card>

          {/* Recent audit */}
          <Card padded={false}>
            <CardHeader className="mb-0 px-5 pt-5" title="Latest audited actions" description="Append-only, hash-chained — the same log agents read" action={<Button variant="ghost" size="sm" rightIcon={<ArrowRight className="h-3.5 w-3.5" />} onClick={() => navigate('/audit')}>Audit trail</Button>} />
            <div className="mt-3 divide-y divide-border/70">
              {(audit.data?.items ?? []).map((a) => (
                <div key={a.id} className="flex items-start gap-3 px-5 py-3">
                  <div className="mt-0.5"><ActorBadge type={a.actor_type} name={a.actor_type === 'AGENT' ? a.actor_name ?? 'Agent' : a.actor_name ?? 'Human'} size="sm" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><ToolChip name={a.tool_name} /><ExecStatusBadge status={a.execution_status} size="sm" /></div>
                    <div className="mt-1 line-clamp-2 text-[13px] text-muted-foreground">{a.result_summary}</div>
                  </div>
                  <div className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(a.timestamp)}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Budget donut */}
          <Card>
            <CardHeader title="Budget allocation" description="Across all campaigns in scope" />
            {t && (
              <div className="flex items-center gap-5">
                <Donut segments={budgetSegments} size={132} thickness={16} center={<div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Utilised</div><div className="font-display text-xl font-semibold">{t.budget ? pct(((t.spent + t.escrow) / t.budget) * 100, 0) : '0%'}</div></div>} />
                <div className="flex-1 space-y-2.5">
                  {budgetSegments.map((s) => (
                    <div key={s.label} className="flex items-center justify-between text-[13px]"><span className="flex items-center gap-2 text-muted-foreground"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />{s.label}</span><span className="font-semibold tabular-nums">{money(s.value)}</span></div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Agents */}
          <Card>
            <CardHeader title="Agent sessions" description="Scoped, budget-capped autonomous operators" action={<Button variant="ghost" size="sm" onClick={() => navigate('/agents')}>Manage</Button>} />
            <div className="space-y-3">
              {activeRuns.map((r) => (
                <Link key={r.id} to={`/agents/runs/${r.id}`} className="flex items-center gap-3 rounded-xl border border-agent/30 bg-agent-soft/50 px-3 py-2.5 transition hover:border-agent/60">
                  <PulseDot tone="agent" />
                  <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-medium">{r.session_name}</div><div className="truncate text-xs text-muted-foreground">{r.goal}</div></div>
                  <RunStatusBadge status={r.status} size="sm" />
                </Link>
              ))}
              {(sessions.data ?? []).slice(0, 4).map((s) => (
                <Link key={s.id} to={`/agents/sessions/${s.id}`} className="flex items-center gap-3 rounded-xl px-1 py-1 transition hover:bg-accent/40">
                  <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', s.status === 'ACTIVE' ? 'bg-agent-soft text-agent' : 'bg-surface-muted text-muted-foreground')}><Bot className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground tabular-nums">{SCOPE_META[s.role_scope]?.label ?? titleCase(s.role_scope)} · {money(s.spent_amount)} / {money(s.budget_ceiling)}</div>
                  </div>
                  <Progress value={s.budget_ceiling ? (s.spent_amount / s.budget_ceiling) * 100 : 0} tone="agent" size="xs" className="w-14" />
                </Link>
              ))}
              {(sessions.data ?? []).length === 0 && <EmptyState compact icon={Bot} title="No agent sessions" description="Authorise an agent with a budget ceiling and scope." action={<Button size="sm" variant="agent" onClick={() => navigate('/agents?new=1')}>Authorise agent</Button>} />}
            </div>
          </Card>

          {/* Pending approvals */}
          <Card>
            <CardHeader title="Approval queue" description="High-impact agent actions held for you" action={<Button variant="ghost" size="sm" onClick={() => navigate('/approvals')}>Open</Button>} />
            <div className="space-y-2.5">
              {(checkpoints.data ?? []).length === 0 && <EmptyState compact icon={CheckCircle2} title="Nothing pending" description="Agents are operating inside policy." />}
              {(checkpoints.data ?? []).slice(0, 4).map((c) => (
                <Link key={c.id} to={`/approvals?checkpoint=${c.id}`} className="block rounded-xl border border-border p-3 transition hover:border-warning/50 hover:bg-warning-soft/30">
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone={CHECKPOINT_ACTION[c.action_type]?.tone ?? 'neutral'} size="sm">{CHECKPOINT_ACTION[c.action_type]?.label ?? titleCase(c.action_type)}</Badge>
                    {c.amount != null && <span className="text-[13px] font-semibold tabular-nums">{money(c.amount)}</span>}
                  </div>
                  <div className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{c.justification}</div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground"><span className="flex items-center gap-1"><Clock className="h-3 w-3" />{timeAgo(c.created_at)}</span><RiskBadge level={c.risk_level} size="sm" /></div>
                </Link>
              ))}
            </div>
          </Card>

          {/* Spend by niche */}
          <Card>
            <CardHeader title="Spend by niche" description="Committed collaboration value" />
            {(overview.data?.spend_by_niche ?? []).length ? <BarList items={(overview.data?.spend_by_niche ?? []).slice(0, 6).map((n) => ({ label: n.niche, value: n.amount }))} format={(v) => money(v)} color={CHART.teal} /> : <EmptyState compact icon={Users} title="No spend yet" />}
          </Card>

          {/* Reach */}
          {t && (
            <Card className="bg-gradient-to-br from-primary-soft/70 to-surface">
              <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-wider text-muted-foreground"><Eye className="h-3.5 w-3.5" />Reach to date</div>
              <div className="mt-2 font-display text-[26px] font-semibold tabular-nums">{num(t.views, { compact: true })} <span className="text-base font-medium text-muted-foreground">views</span></div>
              <div className="mt-1 text-[13px] text-muted-foreground">{pct(t.engagement_rate)} weighted engagement across approved content</div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
