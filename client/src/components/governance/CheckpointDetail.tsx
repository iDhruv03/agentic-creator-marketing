import * as React from 'react';
import { Link } from 'react-router-dom';
import { Bot, ExternalLink, Quote, ShieldCheck, ShieldX, Megaphone, PlayCircle, Clock, AlertTriangle, Check, X, Users, FileEdit, ArrowLeftRight } from 'lucide-react';
import type { Checkpoint, ComplianceReport, DeliverableMetrics } from '@/types';
import { api } from '@/lib/api';
import { useAction, useSession, useScopes } from '@/hooks/queries';
import { money, num, pct, fmtDateTime, timeAgo, titleCase, deliverableLabel, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Label, Textarea } from '@/components/ui/field';
import { ConfirmDialog } from '@/components/ui/overlay';
import { Callout, Progress, Score } from '@/components/ui/feedback';
import { KeyValue, Mono } from '@/components/ui/data';
import { JsonPanel } from './JsonPanel';
import { CHECKPOINT_ACTION, CheckpointStatusBadge, RiskBadge, ToolChip, DeliverableStatusBadge, PlatformIcon } from '@/components/ui/status';
import { parseMaybe } from './hooks';

const INVALIDATE = ['checkpoints', 'checkpoint', 'collaborations', 'collaboration', 'campaigns', 'campaign', 'ledger', 'trial-balance', 'audit', 'audit-verify', 'overview', 'sessions', 'session', 'notifications'];

function Block({ title, children, className }: { title: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={className}>
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      {children}
    </section>
  );
}

function RatioBar({ label, value, limit, limitLabel }: { label: string; value: number; limit: number; limitLabel: string }) {
  const over = value > limit;
  const p = limit > 0 ? Math.min(100, (value / limit) * 100) : 100;
  return (
    <div className="rounded-xl border border-border bg-surface-muted/50 p-3">
      <div className="flex items-center justify-between text-[12.5px]"><span className="text-muted-foreground">{label}</span><span className={cn('font-semibold tabular-nums', over ? 'text-danger' : 'text-foreground')}>{money(value)}</span></div>
      <div className="relative mt-2">
        <Progress value={over ? 100 : p} tone={over ? 'danger' : 'success'} size="sm" />
        {over && <span className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-foreground/60" style={{ left: `${(limit / value) * 100}%` }} />}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground"><span>{limitLabel}: {money(limit)}</span>{over ? <span className="font-medium text-danger">{money(value - limit)} over · {pct(((value - limit) / (limit || 1)) * 100, 0)}</span> : <span>Within limit</span>}</div>
    </div>
  );
}

function CreatorRow({ ctx }: { ctx: any }) {
  if (!ctx?.creator_name) return null;
  return (
    <div className="flex items-center gap-3">
      <Avatar name={ctx.creator_name} src={ctx.creator_avatar} size="md" />
      <div className="min-w-0 flex-1">
        <Link to={`/creators/${ctx.id}`} className="block truncate text-[13.5px] font-semibold hover:text-primary">{ctx.creator_name}</Link>
        <div className="truncate text-xs text-muted-foreground">@{ctx.creator_handle}{ctx.follower_count != null && ` · ${num(ctx.follower_count, { compact: true })} followers`}{ctx.engagement_rate != null && ` · ${pct(ctx.engagement_rate)} ER`}</div>
      </div>
    </div>
  );
}

function ActionBody({ chk, session }: { chk: Checkpoint; session: ReturnType<typeof useSession>['data'] }) {
  const p = chk.payload ?? {};
  const ctx = chk.context ?? {};
  const scopes = useScopes();
  const threshold = scopes.data?.payment_threshold ?? 1000;

  switch (chk.tool_name) {
    case 'release_payment': {
      const d = ctx.deliverable;
      const compliance = parseMaybe<ComplianceReport>(d?.compliance);
      const metrics = parseMaybe<DeliverableMetrics>(d?.metrics);
      return (
        <div className="space-y-3">
          <CreatorRow ctx={ctx} />
          {d && (
            <div className="rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <PlatformIcon platform={String(d.deliverable_type ?? '').startsWith('YOUTUBE') ? 'youtube' : String(d.deliverable_type ?? '').startsWith('TIKTOK') ? 'tiktok' : 'instagram'} />
                <span className="text-[13.5px] font-medium">{deliverableLabel(d.deliverable_type)}</span>
                <DeliverableStatusBadge status={d.status} size="sm" />
                {compliance && <span className="ml-auto flex items-center gap-1.5 text-[11.5px] text-muted-foreground"><Score value={compliance.score} size="sm" /> compliance</span>}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
                {d.content_url && <a href={d.content_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">View content <ExternalLink className="h-3 w-3" /></a>}
                {metrics && <span>{num(metrics.views, { compact: true })} views · {pct(metrics.engagement_rate, 2)} ER</span>}
              </div>
            </div>
          )}
          {chk.amount != null ? <RatioBar label="Payout" value={chk.amount} limit={threshold} limitLabel="Autonomous release limit" /> : <Callout tone="warning" icon={AlertTriangle}>Releases the full remaining escrow for {ctx.creator_handle ? `@${ctx.creator_handle}` : 'this collaboration'} — amount decided at execution.</Callout>}
          {p.note && <div className="text-[13px] text-muted-foreground"><span className="font-medium text-foreground/80">Ledger note:</span> {p.note}</div>}
          {p.collaboration_id && <Link to={`/collaborations/${p.collaboration_id}`} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-primary hover:underline">Open collaboration <ExternalLink className="h-3 w-3" /></Link>}
        </div>
      );
    }
    case 'send_collaboration_offer': {
      const rates = [['Video', ctx.rate_video], ['Reel', ctx.rate_reel], ['Post', ctx.rate_post]].filter(([, v]) => v != null) as [string, number][];
      return (
        <div className="space-y-3">
          <div className="rounded-xl border border-border p-3">
            <CreatorRow ctx={ctx} />
            {rates.length > 0 && <div className="mt-3 grid grid-cols-3 gap-2">{rates.map(([l, v]) => <div key={l} className="rounded-lg bg-surface-muted/70 px-2.5 py-1.5"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">{l} rate</div><div className="text-[13px] font-semibold tabular-nums">{money(v)}</div></div>)}</div>}
          </div>
          <RatioBar label="Proposed rate" value={Number(p.proposed_rate ?? chk.amount ?? 0)} limit={session?.rate_ceiling ?? 0} limitLabel="Session rate ceiling" />
          <KeyValue columns={2} items={[
            { label: 'Deliverables', value: <div className="flex flex-wrap gap-1">{(p.deliverables ?? []).map((d: string) => <Badge key={d} tone="primary" size="sm">{deliverableLabel(d)}</Badge>)}</div> },
            { label: 'Deadline', value: p.deadline ?? 'None' },
            ...(p.usage_rights ? [{ label: 'Usage rights', value: p.usage_rights }] : []),
            ...(p.exclusivity_days ? [{ label: 'Exclusivity', value: `${p.exclusivity_days} days` }] : []),
            ...(p.terms ? [{ label: 'Terms', value: <span className="whitespace-pre-wrap">{p.terms}</span> }] : []),
            ...(p.message ? [{ label: 'Message to creator', value: <span className="whitespace-pre-wrap">{p.message}</span> }] : []),
          ]} />
        </div>
      );
    }
    case 'respond_to_counter_offer': {
      const tone = p.decision === 'ACCEPT' ? 'success' : p.decision === 'DECLINE' ? 'danger' : 'warning';
      return (
        <div className="space-y-3">
          <CreatorRow ctx={ctx} />
          <div className="flex flex-wrap items-center gap-2 text-[13.5px]">
            <Badge tone={tone}>{p.decision === 'ACCEPT' ? 'Accept counter' : p.decision === 'DECLINE' ? 'Decline' : 'Counter'}</Badge>
            {ctx.proposed_rate != null && <span className="text-muted-foreground">creator's figure {money(ctx.proposed_rate)}</span>}
            {p.decision === 'COUNTER' && p.counter_amount != null && <span className="inline-flex items-center gap-1 font-semibold tabular-nums"><ArrowLeftRight className="h-3.5 w-3.5 text-warning" />{money(p.counter_amount)}</span>}
          </div>
          {(p.decision === 'ACCEPT' || p.decision === 'COUNTER') && <RatioBar label={p.decision === 'ACCEPT' ? 'Rate to accept' : 'Counter amount'} value={Number(p.decision === 'ACCEPT' ? ctx.proposed_rate ?? chk.amount ?? 0 : p.counter_amount ?? 0)} limit={session?.rate_ceiling ?? 0} limitLabel="Session rate ceiling" />}
          {p.message && <div className="text-[13px] text-muted-foreground"><span className="font-medium text-foreground/80">Message:</span> {p.message}</div>}
          {p.collaboration_id && <Link to={`/collaborations/${p.collaboration_id}`} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-primary hover:underline">Open collaboration <ExternalLink className="h-3 w-3" /></Link>}
        </div>
      );
    }
    case 'draft_campaign_brief': {
      const fields = Object.entries(p).filter(([k]) => k !== 'campaign_id');
      return (
        <div className="space-y-2">
          <div className="text-[12.5px] text-muted-foreground">{fields.length} field{fields.length === 1 ? '' : 's'} would change on <Link to={`/campaigns/${p.campaign_id}`} className="font-medium text-primary hover:underline">{chk.campaign_title ?? p.campaign_id}</Link>.</div>
          {fields.map(([k, v]) => (
            <div key={k} className="rounded-xl border border-border p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><FileEdit className="h-3 w-3" />{titleCase(k)}</div>
              <div className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed">{Array.isArray(v) ? <div className="flex flex-wrap gap-1">{v.map((x) => <Badge key={String(x)} tone="info" size="sm">{String(x)}</Badge>)}</div> : typeof v === 'object' && v !== null ? <JsonPanel value={v} /> : String(v)}</div>
            </div>
          ))}
        </div>
      );
    }
    case 'request_human_approval':
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2"><Badge tone="agent">{titleCase(p.action_type ?? 'Escalation')}</Badge><span className="text-xs text-muted-foreground">Agent asked for a decision</span></div>
          <div className="rounded-xl border border-border bg-surface-muted/40 p-3 text-[13.5px] leading-relaxed whitespace-pre-wrap">{p.details}</div>
          {p.reason && <div className="text-[13px] text-muted-foreground"><span className="font-medium text-foreground/80">Why a human:</span> {p.reason}</div>}
        </div>
      );
    default:
      return <JsonPanel value={p} title="Tool parameters" />;
  }
}

export function CheckpointDetail({ chk }: { chk: Checkpoint }) {
  const [notes, setNotes] = React.useState('');
  const [approveOpen, setApproveOpen] = React.useState(false);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  React.useEffect(() => { setNotes(''); }, [chk.id]);
  const session = useSession(chk.agent_session_id);
  const resolve = useAction((decision: 'APPROVED' | 'REJECTED', n?: string) => api.checkpoints.resolve(chk.id, decision, n), { invalidate: INVALIDATE, success: (r) => (r.status === 'APPROVED' ? 'Approved and executed' : 'Checkpoint rejected'), onSuccess: () => { setApproveOpen(false); setRejectOpen(false); } });

  const meta = CHECKPOINT_ACTION[chk.action_type] ?? { label: titleCase(chk.action_type), tone: 'neutral' as const, description: '' };
  const s = session.data;
  const execError = chk.executed_result && typeof chk.executed_result === 'object' && 'error' in chk.executed_result ? String(chk.executed_result.error) : null;
  const verb = chk.tool_name === 'request_human_approval' ? 'Approve' : 'Approve & execute';

  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={meta.tone}>{meta.label}</Badge>
          <CheckpointStatusBadge status={chk.status} />
          <RiskBadge level={chk.risk_level} />
          <ToolChip name={chk.tool_name} className="ml-auto" />
        </div>
        <h3 className="mt-3 font-display text-lg font-semibold leading-tight">{chk.amount != null ? <span className="tabular-nums">{money(chk.amount)}</span> : meta.label}{chk.amount != null && <span className="text-muted-foreground"> · {meta.label.toLowerCase()}</span>}</h3>
        <p className="mt-1 text-[13px] text-muted-foreground">{meta.description}</p>
      </div>

      <Block title="What the agent wants to do"><ActionBody chk={chk} session={s} /></Block>

      <Block title="Agent's justification">
        <blockquote className="flex gap-2.5 rounded-xl border border-agent/25 bg-agent-soft/50 px-3.5 py-3 text-[13.5px] leading-relaxed"><Quote className="mt-0.5 h-4 w-4 shrink-0 text-agent" /><span>{chk.justification}</span></blockquote>
      </Block>

      <Block title="Context">
        <div className="space-y-2.5 text-[13px]">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-agent-soft text-agent"><Bot className="h-3.5 w-3.5" /></span>
            <div className="min-w-0 flex-1">
              <Link to={`/agents/sessions/${chk.agent_session_id}`} className="font-medium hover:text-primary">{chk.agent_name ?? s?.name ?? chk.agent_session_id}</Link>
              <div className="text-xs text-muted-foreground">{titleCase(chk.role_scope ?? s?.role_scope ?? '')}{s && ` · ${money(s.spent_amount)} of ${money(s.budget_ceiling)} budget used · rate ceiling ${money(s.rate_ceiling)}`}</div>
              {s && <Progress className="mt-1.5 max-w-[240px]" value={s.budget_ceiling ? (s.spent_amount / s.budget_ceiling) * 100 : 0} tone="agent" size="xs" />}
            </div>
          </div>
          {chk.campaign_id && <div className="flex items-center gap-2.5"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><Megaphone className="h-3.5 w-3.5" /></span><Link to={`/campaigns/${chk.campaign_id}`} className="font-medium hover:text-primary">{chk.campaign_title ?? chk.campaign_id}</Link></div>}
          {chk.run_id && <div className="flex items-center gap-2.5"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted-foreground"><PlayCircle className="h-3.5 w-3.5" /></span><Link to={`/agents/runs/${chk.run_id}`} className="font-medium hover:text-primary">Agent run</Link><Mono>{chk.run_id}</Mono></div>}
          <div className="flex items-center gap-2.5"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted-foreground"><Clock className="h-3.5 w-3.5" /></span><span>Raised {fmtDateTime(chk.created_at)} <span className="text-muted-foreground">· {timeAgo(chk.created_at)}</span></span></div>
        </div>
      </Block>

      <JsonPanel value={chk.payload} title="Raw payload" collapsed />

      {chk.status === 'PENDING' ? (
        <div className="rounded-2xl border border-warning/30 bg-warning-soft/30 p-4">
          <Label htmlFor="reviewer-notes">Reviewer notes <span className="font-normal text-muted-foreground">(recorded in the audit trail{chk.tool_name === 'request_human_approval' ? ', returned to the agent as guidance' : ''})</span></Label>
          <Textarea id="reviewer-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={chk.tool_name === 'request_human_approval' ? 'Tell the agent which option to take…' : 'Why you are approving or rejecting…'} className="bg-surface" />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="success" leftIcon={<Check className="h-4 w-4" />} onClick={() => setApproveOpen(true)}>{verb}</Button>
            <Button variant="danger" leftIcon={<X className="h-4 w-4" />} onClick={() => setRejectOpen(true)}>Reject</Button>
          </div>
        </div>
      ) : (
        <div className={cn('rounded-2xl border p-4', chk.status === 'APPROVED' ? 'border-success/30 bg-success-soft/30' : chk.status === 'REJECTED' ? 'border-danger/25 bg-danger-soft/30' : 'border-border bg-surface-muted/40')}>
          <div className="flex items-center gap-2 text-[13.5px] font-semibold">{chk.status === 'APPROVED' ? <ShieldCheck className="h-4 w-4 text-success" /> : <ShieldX className="h-4 w-4 text-danger" />}{chk.status === 'APPROVED' ? 'Approved and executed on the reviewer\'s authority' : chk.status === 'REJECTED' ? 'Rejected — nothing was written' : 'Expired'}</div>
          <KeyValue className="mt-3" columns={2} items={[
            { label: 'Reviewer', value: chk.resolved_by ? <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-muted-foreground" /><Mono>{chk.resolved_by}</Mono></span> : '—' },
            { label: 'Resolved', value: chk.resolved_at ? `${fmtDateTime(chk.resolved_at)} · ${timeAgo(chk.resolved_at)}` : '—' },
            { label: 'Notes', value: chk.reviewer_notes ? <span className="whitespace-pre-wrap">{chk.reviewer_notes}</span> : <span className="text-muted-foreground">None</span> },
          ]} />
          {execError ? <Callout tone="danger" icon={AlertTriangle} title="Execution failed" className="mt-3">{execError}</Callout> : chk.executed_result != null && <div className="mt-3"><div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Executed result</div><JsonPanel value={chk.executed_result} title="Executed result" /></div>}
        </div>
      )}

      <ConfirmDialog open={approveOpen} onOpenChange={setApproveOpen} title={`${verb}?`} description={chk.tool_name === 'request_human_approval' ? 'The agent receives your notes as guidance and continues. No state changes.' : `The held ${chk.tool_name} call runs now on your authority — the agent never gains the permission itself. Both your decision and the execution are written to the audit trail.`} confirmLabel={verb} tone="success" loading={resolve.isPending} onConfirm={() => resolve.mutate(['APPROVED', notes.trim() || undefined])}>
        <div className="space-y-2 text-[13px]">
          <div className="flex items-center justify-between rounded-xl border border-border bg-surface-muted/60 px-3 py-2"><span className="text-muted-foreground">Action</span><ToolChip name={chk.tool_name} /></div>
          {chk.amount != null && <div className="flex items-center justify-between rounded-xl border border-border bg-surface-muted/60 px-3 py-2"><span className="text-muted-foreground">Amount</span><span className="font-semibold tabular-nums">{money(chk.amount)}</span></div>}
          {chk.context?.creator_handle && <div className="flex items-center justify-between rounded-xl border border-border bg-surface-muted/60 px-3 py-2"><span className="text-muted-foreground">Creator</span><span className="font-medium">@{chk.context.creator_handle}</span></div>}
          {notes.trim() && <div className="rounded-xl border border-border bg-surface-muted/60 px-3 py-2"><div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Your notes</div><div className="whitespace-pre-wrap">{notes.trim()}</div></div>}
        </div>
      </ConfirmDialog>
      <ConfirmDialog open={rejectOpen} onOpenChange={setRejectOpen} title="Reject this action?" description="The agent is told the action was declined. Nothing is written to campaigns, collaborations or the ledger." confirmLabel="Reject" tone="danger" loading={resolve.isPending} onConfirm={() => resolve.mutate(['REJECTED', notes.trim() || undefined])}>
        {!notes.trim() && <Callout tone="neutral">Consider adding a note so the agent — and the audit trail — know why.</Callout>}
        {notes.trim() && <div className="rounded-xl border border-border bg-surface-muted/60 px-3 py-2 text-[13px]"><div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Your notes</div><div className="whitespace-pre-wrap">{notes.trim()}</div></div>}
      </ConfirmDialog>
    </div>
  );
}
