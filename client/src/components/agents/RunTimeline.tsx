import * as React from 'react';
import { Link } from 'react-router-dom';
import { Brain, Bot, Wrench, ShieldAlert, ShieldX, CheckCircle2, AlertTriangle, ArrowRight, Flag } from 'lucide-react';
import { cn, money, num, fmtDateTime } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/feedback';
import { Mono } from '@/components/ui/data';
import { JsonBlock } from './JsonBlock';
import { ExecStatusBadge, ToolChip } from '@/components/ui/status';
import { Tooltip } from '@/components/ui/overlay';
import type { RunEvent, ExecutionStatus } from '@/types';
import { RULE_META } from './shared';

export type TimelineFilter = 'all' | 'tools' | 'reasoning' | 'governance';

export type TimelineItem =
  | { kind: 'event'; key: string; event: RunEvent }
  | { kind: 'tool'; key: string; call: RunEvent; result?: RunEvent; held?: RunEvent; blocked?: RunEvent };

/** Fold raw run events into timeline items: tool_result/checkpoint/guardrail attach to their tool_call by payload.id. */
export function buildTimeline(events: RunEvent[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  const tools = new Map<string, Extract<TimelineItem, { kind: 'tool' }>>();
  for (const e of events) {
    const id = e.payload?.id as string | undefined;
    if (e.type === 'tool_call') {
      const item: Extract<TimelineItem, { kind: 'tool' }> = { kind: 'tool', key: `tool-${e.seq}`, call: e };
      if (id) tools.set(id, item);
      items.push(item);
      continue;
    }
    if (e.type === 'tool_result' && id && tools.has(id)) { tools.get(id)!.result = e; continue; }
    if (e.type === 'checkpoint' && id && tools.has(id)) tools.get(id)!.held = e;
    if (e.type === 'guardrail' && id && tools.has(id)) tools.get(id)!.blocked = e;
    items.push({ kind: 'event', key: `evt-${e.seq}`, event: e });
  }
  return items;
}

export function matchesFilter(item: TimelineItem, f: TimelineFilter): boolean {
  if (f === 'all') return true;
  if (item.kind === 'tool') return f === 'tools' || (f === 'governance' && Boolean(item.held || item.blocked));
  const t = item.event.type;
  if (f === 'reasoning') return t === 'thinking' || t === 'text';
  if (f === 'governance') return t === 'checkpoint' || t === 'guardrail' || t === 'done' || t === 'error';
  return false;
}

/** Which governance rules were evaluated / held / blocked across the run. */
export function governanceSummary(events: RunEvent[]): { rule: string; evaluated: number; held: number; blocked: number }[] {
  const map = new Map<string, { rule: string; evaluated: number; held: number; blocked: number }>();
  const get = (r: string) => { if (!map.has(r)) map.set(r, { rule: r, evaluated: 0, held: 0, blocked: 0 }); return map.get(r)!; };
  for (const e of events) {
    if (e.type === 'tool_result') {
      const rules: string[] = Array.isArray(e.payload?.rules) ? e.payload.rules : [];
      for (const r of rules) get(r).evaluated += 1;
      const last = rules[rules.length - 1];
      if (last && e.payload?.status === 'HELD_FOR_APPROVAL') get(last).held += 1;
      if (last && e.payload?.status === 'REJECTED_BY_GUARDRAIL') get(last).blocked += 1;
    } else if (e.type === 'guardrail') {
      const rules: string[] = Array.isArray(e.payload?.rules) ? e.payload.rules : [];
      const last = rules[rules.length - 1];
      if (last) { const g = get(last); if (!g.blocked) g.blocked += 1; }
    }
  }
  return [...map.values()];
}

const small = (v: unknown) => v && typeof v === 'object' && Object.keys(v as object).length <= 6 && JSON.stringify(v).length < 400;

function Node({ tone, icon, pulse }: { tone: 'neutral' | 'agent' | 'primary' | 'warning' | 'danger' | 'success'; icon: React.ReactNode; pulse?: boolean }) {
  const tones = { neutral: 'bg-surface-muted text-muted-foreground', agent: 'bg-agent-soft text-agent', primary: 'bg-primary-soft text-primary', warning: 'bg-warning-soft text-warning', danger: 'bg-danger-soft text-danger', success: 'bg-success-soft text-success' };
  return <span className={cn('relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-surface [&>svg]:h-4 [&>svg]:w-4', tones[tone], pulse && 'animate-pulse')}>{icon}</span>;
}

function Row({ node, children, center }: { node?: React.ReactNode; children: React.ReactNode; center?: boolean }) {
  if (center) return <li className="relative flex justify-center py-1"><div className="relative z-10">{children}</div></li>;
  return (
    <li className="relative flex gap-3 animate-slide-up">
      {node}
      <div className="min-w-0 flex-1 pb-1">{children}</div>
    </li>
  );
}

function RulesChips({ rules, firedIndex }: { rules?: string[]; firedIndex?: number }) {
  if (!rules?.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {rules.map((r, i) => (
        <Tooltip key={r} content={RULE_META[r]?.description ?? r}>
          <span className={cn('rounded-md border px-1.5 py-0.5 font-mono text-[10.5px]', firedIndex === i ? 'border-current' : 'border-border bg-surface-muted/70 text-muted-foreground')}>{r}</span>
        </Tooltip>
      ))}
    </div>
  );
}

function ToolCard({ item, collapseAll, running }: { item: Extract<TimelineItem, { kind: 'tool' }>; collapseAll: boolean; running: boolean }) {
  const { call, result } = item;
  const p = call.payload ?? {};
  const r = result?.payload;
  const status = r?.status as ExecutionStatus | undefined;
  const outcome: 'pending' | 'success' | 'held' | 'blocked' | 'failed' = !result ? 'pending' : status === 'SUCCESS' ? 'success' : status === 'HELD_FOR_APPROVAL' ? 'held' : status === 'REJECTED_BY_GUARDRAIL' ? 'blocked' : 'failed';
  const border = { pending: 'border-agent/40', success: 'border-border', held: 'border-warning/40', blocked: 'border-danger/40', failed: 'border-border' }[outcome];
  const summary = typeof r?.result?.message === 'string' ? r.result.message : typeof r?.result?.error === 'string' ? r.result.error : null;
  const rules: string[] | undefined = Array.isArray(r?.rules) ? r.rules : undefined;
  const inputCollapsed = collapseAll || !small(p.input);
  const jsonKey = collapseAll ? 'c' : 'o';
  return (
    <Row node={<Node tone={outcome === 'pending' ? 'agent' : outcome === 'held' ? 'warning' : outcome === 'blocked' ? 'danger' : 'primary'} icon={<Wrench />} pulse={outcome === 'pending' && running} />}>
      <div className={cn('card overflow-hidden p-0', border)}>
        <div className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-surface-muted/50 px-3.5 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Called</span>
          <ToolChip name={p.tool ?? '?'} />
          {p.step !== undefined && <Badge tone="outline" size="sm">step {p.step}</Badge>}
          <span className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
            {outcome === 'pending' ? (running ? <span className="flex items-center gap-1.5 text-agent"><Spinner className="h-3 w-3" />executing</span> : <span>no result recorded</span>) : (
              <>
                {status && <ExecStatusBadge status={status} size="sm" />}
                {r?.duration_ms !== undefined && <span className="tabular-nums">{num(r.duration_ms)} ms</span>}
              </>
            )}
          </span>
        </div>
        <div className="space-y-2.5 px-3.5 py-3">
          <div>
            <div className="mb-1 text-[11px] font-medium text-muted-foreground">Input</div>
            <JsonBlock key={`in-${jsonKey}`} value={p.input ?? {}} collapsed={inputCollapsed} maxHeight={240} />
          </div>
          {result && (
            <div>
              <div className="mb-1 text-[11px] font-medium text-muted-foreground">Result</div>
              {summary && <div className={cn('mb-1.5 text-[13px] leading-snug', outcome === 'blocked' ? 'text-danger' : outcome === 'held' ? 'text-warning' : 'text-foreground/90')}>{summary}</div>}
              <JsonBlock key={`out-${jsonKey}`} value={r?.result ?? {}} collapsed maxHeight={280} />
              {(rules?.length || r?.guardrail_notes) && (
                <div className="mt-2 flex flex-col gap-1.5">
                  {rules?.length ? <div className="flex flex-wrap items-center gap-1.5"><span className="text-[11px] text-muted-foreground">Rules evaluated</span><RulesChips rules={rules} firedIndex={outcome === 'held' || outcome === 'blocked' ? rules.length - 1 : undefined} /></div> : null}
                  {r?.guardrail_notes && <div className="text-[11.5px] text-muted-foreground">{r.guardrail_notes}</div>}
                </div>
              )}
              {r?.audit_id && <div className="mt-1.5 text-[11px] text-muted-foreground">audit <Mono copy>{String(r.audit_id)}</Mono></div>}
            </div>
          )}
        </div>
      </div>
    </Row>
  );
}

function EventCard({ event }: { event: RunEvent }) {
  const p = event.payload ?? {};
  switch (event.type) {
    case 'status':
      return <Row center><span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-0.5 text-[11px] text-muted-foreground"><Flag className="h-3 w-3" />{p.text}</span></Row>;
    case 'thinking':
      return (
        <Row node={<Node tone="agent" icon={<Brain />} />}>
          <div className="rounded-2xl border border-agent/25 bg-agent-soft/40 px-4 py-3">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-agent">Reasoning</div>
            <p className="text-[13.5px] italic leading-relaxed text-foreground/85">{p.text}</p>
          </div>
        </Row>
      );
    case 'text':
      return (
        <Row node={<Node tone="primary" icon={<Bot />} />}>
          <div className="card px-4 py-3">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Agent</div>
            <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{p.text}</p>
          </div>
        </Row>
      );
    case 'checkpoint':
      return (
        <Row node={<Node tone="warning" icon={<ShieldAlert />} />}>
          <div className="rounded-2xl border border-warning/40 bg-warning-soft/50 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2"><span className="text-[13.5px] font-semibold text-warning">Held for human approval</span>{p.tool && <ToolChip name={p.tool} />}</div>
            <p className="mt-1 text-[13px] leading-relaxed text-foreground/85">{p.message ?? 'This action needs a reviewer decision.'}</p>
            {p.guardrail_notes && <p className="mt-1 text-[11.5px] text-muted-foreground">{p.guardrail_notes}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
              <span className="text-muted-foreground">The action has <strong>not</strong> executed — approving runs it on the reviewer's authority.</span>
              {p.checkpoint_id && <Link to={`/approvals?checkpoint=${p.checkpoint_id}`} className="inline-flex items-center gap-1 font-medium text-warning hover:underline">Review checkpoint <ArrowRight className="h-3 w-3" /></Link>}
            </div>
          </div>
        </Row>
      );
    case 'guardrail': {
      const rules: string[] | undefined = Array.isArray(p.rules) ? p.rules : undefined;
      return (
        <Row node={<Node tone="danger" icon={<ShieldX />} />}>
          <div className="rounded-2xl border border-danger/35 bg-danger-soft/50 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2"><span className="text-[13.5px] font-semibold text-danger">Blocked by guardrail</span>{p.tool && <ToolChip name={p.tool} />}</div>
            <p className="mt-1 text-[13px] leading-relaxed text-foreground/85">{p.message}</p>
            {p.guardrail_notes && <p className="mt-1 text-[11.5px] text-muted-foreground">{p.guardrail_notes}</p>}
            {rules?.length ? <div className="mt-2 flex flex-wrap items-center gap-1.5 text-danger"><span className="text-[11px] text-muted-foreground">Rules</span><RulesChips rules={rules} firedIndex={rules.length - 1} /></div> : null}
            <div className="mt-2 text-xs text-muted-foreground">Nothing was written. The agent continues with the next step.</div>
          </div>
        </Row>
      );
    }
    case 'done': {
      const ok = p.status === 'COMPLETED';
      return (
        <Row node={<Node tone={ok ? 'success' : 'neutral'} icon={<CheckCircle2 />} />}>
          <div className={cn('rounded-2xl border px-4 py-3', ok ? 'border-success/30 bg-success-soft/40' : 'border-border bg-surface-muted/50')}>
            <div className="flex flex-wrap items-center gap-2"><span className={cn('text-[13.5px] font-semibold', ok ? 'text-success' : 'text-foreground')}>Run {String(p.status ?? 'finished').toLowerCase()}</span><span className="text-[11px] text-muted-foreground">{fmtDateTime(event.created_at)}</span></div>
            {p.summary && <p className="mt-1 text-[13px] leading-relaxed text-foreground/85">{p.summary}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone="neutral" size="sm">{num(p.steps ?? 0)} steps</Badge>
              <Badge tone={p.checkpoints ? 'warning' : 'neutral'} size="sm">{num(p.checkpoints ?? 0)} held</Badge>
              <Badge tone={p.blocked ? 'danger' : 'neutral'} size="sm">{num(p.blocked ?? 0)} blocked</Badge>
              <Badge tone="primary" size="sm">{money(p.spend ?? 0)} committed</Badge>
            </div>
          </div>
        </Row>
      );
    }
    case 'error':
      return (
        <Row node={<Node tone="danger" icon={<AlertTriangle />} />}>
          <div className="rounded-2xl border border-danger/35 bg-danger-soft/50 px-4 py-3">
            <div className="text-[13.5px] font-semibold text-danger">Run error</div>
            <p className="mt-1 text-[13px] leading-relaxed text-foreground/85">{p.message ?? 'Unknown error'}</p>
          </div>
        </Row>
      );
    default:
      return (
        <Row node={<Node tone="neutral" icon={<Bot />} />}>
          <JsonBlock value={event.payload} collapsed />
        </Row>
      );
  }
}

export function RunTimeline({ items, collapseAll, running }: { items: TimelineItem[]; collapseAll: boolean; running: boolean }) {
  return (
    <ol className="relative space-y-4">
      <span aria-hidden className="absolute bottom-4 left-4 top-4 w-px bg-border" />
      {items.map((it) => it.kind === 'tool' ? <ToolCard key={it.key} item={it} collapseAll={collapseAll} running={running} /> : <EventCard key={it.key} event={it.event} />)}
      {running && (
        <li className="relative flex items-center gap-3">
          <Node tone="agent" icon={<Bot />} pulse />
          <span className="flex items-center gap-2 text-[13px] text-muted-foreground"><Spinner className="h-3.5 w-3.5 text-agent" />Agent is working…</span>
        </li>
      )}
    </ol>
  );
}
