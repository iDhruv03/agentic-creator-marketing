import { Link } from 'react-router-dom';
import { Bot, User, Cpu, ShieldAlert, ArrowRight, Activity } from 'lucide-react';
import type { Campaign } from '@/types';
import { useCampaignAudit } from '@/hooks/queries';
import { money, timeAgo, fmtDateTime, titleCase, duration } from '@/lib/utils';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SkeletonRows, EmptyState } from '@/components/ui/feedback';
import { Timeline } from '@/components/ui/data';
import { ActorBadge, ToolChip, ExecStatusBadge, CheckpointStatusBadge, RunStatusBadge, RiskBadge, CHECKPOINT_ACTION } from '@/components/ui/status';

export function CampaignActivityTab({ campaign }: { campaign: Campaign }) {
  const audit = useCampaignAudit(campaign.id);
  const items = audit.data?.items ?? [];
  const checkpoints = campaign.checkpoints ?? [];
  const runs = campaign.runs ?? [];

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader title="Audit trail" description={`${audit.data?.total ?? items.length} hash-chained entries for this campaign — every tool call, human action and guardrail decision`} action={<Link to={`/audit?campaign_id=${campaign.id}`} className="text-xs font-medium text-primary hover:underline">Full log</Link>} />
        {audit.isLoading ? <SkeletonRows rows={6} /> : items.length === 0 ? <EmptyState compact icon={Activity} title="No activity yet" description="Actions on this campaign will appear here." /> : (
          <Timeline items={items.map((a) => ({
            id: a.id,
            tone: a.execution_status === 'REJECTED_BY_GUARDRAIL' ? 'danger' : a.execution_status === 'HELD_FOR_APPROVAL' ? 'warning' : a.actor_type === 'AGENT' ? 'agent' : a.actor_type === 'SYSTEM' ? 'neutral' : 'primary',
            icon: a.actor_type === 'AGENT' ? <Bot /> : a.actor_type === 'SYSTEM' ? <Cpu /> : <User />,
            title: <span className="flex flex-wrap items-center gap-1.5"><ActorBadge type={a.actor_type} name={a.actor_name ?? undefined} size="sm" /><ToolChip name={a.tool_name} /><ExecStatusBadge status={a.execution_status} size="sm" /></span>,
            body: <span>{a.result_summary}{a.guardrail_notes ? <span className={`mt-1 block text-xs ${a.execution_status === 'REJECTED_BY_GUARDRAIL' ? 'text-danger' : a.execution_status === 'HELD_FOR_APPROVAL' ? 'text-warning' : 'text-muted-foreground'}`}>{a.guardrail_notes}</span> : null}{a.run_id ? <Link to={`/agents/runs/${a.run_id}`} className="ml-1 text-xs font-medium text-primary hover:underline">run</Link> : null}</span>,
            meta: <span title={fmtDateTime(a.timestamp)}>{timeAgo(a.timestamp)}{a.duration_ms ? ` · ${duration(a.duration_ms / 1000)}` : ''}</span>,
          }))} />
        )}
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Checkpoints" description="Agent actions held for a human decision" />
          {checkpoints.length === 0 ? <EmptyState compact icon={ShieldAlert} title="No checkpoints" description="Agents have stayed inside policy on this campaign." /> : (
            <div className="space-y-2.5">
              {checkpoints.map((c) => (
                <Link key={c.id} to={`/approvals?checkpoint=${c.id}`} className="block rounded-xl border border-border p-3 transition hover:border-warning/50 hover:bg-warning-soft/30">
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone={CHECKPOINT_ACTION[c.action_type]?.tone ?? 'neutral'} size="sm">{CHECKPOINT_ACTION[c.action_type]?.label ?? titleCase(c.action_type)}</Badge>
                    <CheckpointStatusBadge status={c.status} size="sm" />
                  </div>
                  <div className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{c.justification}</div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{c.amount != null ? <span className="font-semibold text-foreground">{money(c.amount)}</span> : <ToolChip name={c.tool_name} />}</span>
                    <span className="flex items-center gap-2"><RiskBadge level={c.risk_level} size="sm" />{timeAgo(c.created_at)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Agent runs" description="Latest runs bound to this campaign" />
          {runs.length === 0 ? <EmptyState compact icon={Bot} title="No runs yet" description="Use “Run agent” to put an authorised session to work here." /> : (
            <div className="space-y-2">
              {runs.map((r) => (
                <Link key={r.id} to={`/agents/runs/${r.id}`} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 transition hover:border-agent/50 hover:bg-agent-soft/30">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-agent-soft text-agent"><Bot className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">{r.session_name ?? r.session_id}</div>
                    <div className="truncate text-xs text-muted-foreground">{r.goal}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{r.steps_count} steps · {r.checkpoints_count} held · {r.blocked_count} blocked · {money(r.spend_committed)} committed · {timeAgo(r.started_at)}</div>
                  </div>
                  <RunStatusBadge status={r.status} size="sm" />
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
