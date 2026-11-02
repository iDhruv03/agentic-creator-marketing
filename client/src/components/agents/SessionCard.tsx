import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bot, MoreHorizontal, Play, Eye, PauseCircle, PlayCircle, ShieldX, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { useAction } from '@/hooks/queries';
import { money, num, timeAgo, cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/feedback';
import { SessionStatusBadge } from '@/components/ui/status';
import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem, DropdownSeparator, ConfirmDialog } from '@/components/ui/overlay';
import type { AgentSession } from '@/types';
import { ScopeBadge } from './shared';

/** Pause / resume / revoke actions with confirm for revoke. Shared by the grid card and the detail header. */
export function useSessionActions(session: AgentSession | undefined) {
  const [confirmRevoke, setConfirmRevoke] = React.useState(false);
  const setStatus = useAction(api.agents.setSessionStatus, { invalidate: ['sessions', 'session', 'audit'], success: (s) => `Session ${s.status === 'ACTIVE' ? 'resumed' : s.status.toLowerCase()}` });
  const pauseOrResume = () => { if (!session) return; setStatus.mutate([session.id, session.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED']); };
  const revoke = () => { if (!session) return; setStatus.mutate([session.id, 'REVOKED'], { onSuccess: () => setConfirmRevoke(false) }); };
  const dialog = session ? (
    <ConfirmDialog open={confirmRevoke} onOpenChange={setConfirmRevoke} title={`Revoke "${session.name}"?`} description="Revoking permanently suspends this agent identity. Every further tool call is rejected by the session-status guardrail and nothing is written. Pending checkpoints stay in the approval queue." confirmLabel="Revoke session" tone="danger" loading={setStatus.isPending} onConfirm={revoke} />
  ) : null;
  return { pauseOrResume, openRevoke: () => setConfirmRevoke(true), pending: setStatus.isPending, dialog };
}

export function SessionCard({ session, onLaunch }: { session: AgentSession; onLaunch: (id: string) => void }) {
  const navigate = useNavigate();
  const actions = useSessionActions(session);
  const s = session;
  const pctUsed = s.budget_ceiling ? (s.spent_amount / s.budget_ceiling) * 100 : 0;
  const canAct = s.status === 'ACTIVE' || s.status === 'PAUSED';

  return (
    <Card hover className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <Link to={`/agents/sessions/${s.id}`} className="flex min-w-0 items-start gap-3">
          <span className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', s.status === 'ACTIVE' ? 'bg-agent-soft text-agent' : 'bg-surface-muted text-muted-foreground')}><Bot className="h-[18px] w-[18px]" /></span>
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-semibold leading-tight hover:text-primary">{s.name}</span>
            <span className="mt-1 flex flex-wrap items-center gap-1.5"><SessionStatusBadge status={s.status} size="sm" /><ScopeBadge scope={s.role_scope} size="sm" /></span>
          </span>
        </Link>
        <Dropdown>
          <DropdownTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Session actions"><MoreHorizontal className="h-4 w-4" /></Button></DropdownTrigger>
          <DropdownContent>
            <DropdownItem icon={<Play />} disabled={s.status !== 'ACTIVE'} onSelect={() => onLaunch(s.id)}>Launch run</DropdownItem>
            <DropdownItem icon={<Eye />} onSelect={() => navigate(`/agents/sessions/${s.id}`)}>View session</DropdownItem>
            <DropdownSeparator />
            <DropdownItem icon={s.status === 'PAUSED' ? <PlayCircle /> : <PauseCircle />} disabled={!canAct} onSelect={actions.pauseOrResume}>{s.status === 'PAUSED' ? 'Resume' : 'Pause'}</DropdownItem>
            <DropdownItem icon={<ShieldX />} destructive disabled={s.status === 'REVOKED'} onSelect={actions.openRevoke}>Revoke</DropdownItem>
          </DropdownContent>
        </Dropdown>
      </div>

      <div className="mt-3 truncate text-xs text-muted-foreground">
        {s.brand_name ?? 'Any brand'}
        {s.campaign_id ? <> · <Link to={`/campaigns/${s.campaign_id}`} className="text-foreground/80 hover:text-primary">{s.campaign_title ?? s.campaign_id}</Link></> : ' · any campaign'}
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Committed</span>
          <span className="font-medium tabular-nums">{money(s.spent_amount)} <span className="text-muted-foreground">/ {money(s.budget_ceiling)}</span></span>
        </div>
        <Progress value={pctUsed} tone={pctUsed > 90 ? 'danger' : pctUsed > 70 ? 'warning' : 'agent'} size="sm" />
        <div className="mt-1.5 text-[11px] text-muted-foreground">Rate ceiling {money(s.rate_ceiling)} per collaboration</div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 rounded-xl bg-surface-muted/70 px-3 py-2.5 text-center">
        {[
          { label: 'Runs', value: s.stats?.runs ?? 0 },
          { label: 'Calls', value: s.stats?.tool_calls ?? 0 },
          { label: 'Pending', value: s.stats?.checkpoints_pending ?? 0, tone: (s.stats?.checkpoints_pending ?? 0) > 0 ? 'text-warning' : '' },
          { label: 'Blocked', value: s.stats?.blocked ?? 0, tone: (s.stats?.blocked ?? 0) > 0 ? 'text-danger' : '' },
        ].map((k) => (
          <div key={k.label}>
            <div className={cn('text-[15px] font-semibold tabular-nums', k.tone)}>{num(k.value)}</div>
            <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><Clock className="h-3 w-3" />{s.last_active_at ? `Active ${timeAgo(s.last_active_at)}` : 'Never run'}</span>
        <Button size="xs" variant={s.status === 'ACTIVE' ? 'agent' : 'secondary'} disabled={s.status !== 'ACTIVE'} leftIcon={<Play className="h-3 w-3" />} onClick={() => onLaunch(s.id)}>Launch run</Button>
      </div>
      {actions.dialog}
    </Card>
  );
}
