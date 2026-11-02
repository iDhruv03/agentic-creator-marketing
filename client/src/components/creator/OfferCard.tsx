import * as React from 'react';
import { Link } from 'react-router-dom';
import { Bot, CalendarClock, Lock, ChevronRight, ArrowLeftRight } from 'lucide-react';
import type { Collaboration } from '@/types';
import { money, deliverableLabel, cn, fmtDate } from '@/lib/utils';
import { OrgMark } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { CollabStatusBadge, DeliverableStatusBadge, PlatformIcon } from '@/components/ui/status';
import { Tooltip } from '@/components/ui/overlay';
import { currentRate, deadlineInfo, lastCounter } from './utils';

export function AgentOfferBadge({ brand, className }: { brand?: string; className?: string }) {
  return (
    <Tooltip content={`Sent by ${brand ?? 'the brand'}'s AI agent — a human reviewer approves anything above policy`}>
      <span className={className}><Badge tone="agent" size="sm"><Bot className="h-3 w-3" />AI agent</Badge></span>
    </Tooltip>
  );
}

export function OfferCard({ collab, actions, className }: { collab: Collaboration; actions?: React.ReactNode; className?: string }) {
  const dl = deadlineInfo(collab.deadline);
  const counter = lastCounter(collab);
  const open = collab.status === 'OFFERED' || collab.status === 'COUNTERED';
  return (
    <div className={cn('card card-hover relative flex flex-col gap-3 p-4 sm:p-5', className)}>
      <Link to={`/creator/offers/${collab.id}`} className="absolute inset-0 z-0 rounded-2xl" aria-label={`Open ${collab.campaign_title}`} />
      <div className="relative z-10 pointer-events-none flex items-start gap-3">
        <OrgMark name={collab.brand_name ?? 'Brand'} src={collab.brand_logo} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[13px] font-medium text-muted-foreground">{collab.brand_name}</span>
            {collab.initiated_by === 'AGENT' && <AgentOfferBadge brand={collab.brand_name} className="pointer-events-auto" />}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <span className="truncate text-[15px] font-semibold">{collab.campaign_title}</span>
            <CollabStatusBadge status={collab.status} size="sm" />
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-display text-lg font-semibold tabular-nums leading-tight">{money(currentRate(collab))}</div>
          <div className="text-[11px] text-muted-foreground">{collab.agreed_rate != null ? 'agreed' : 'proposed'}</div>
        </div>
      </div>

      {collab.status === 'COUNTERED' && (
        <div className="relative z-10 pointer-events-none flex items-center gap-1.5 text-xs text-warning">
          <ArrowLeftRight className="h-3.5 w-3.5" />
          {counter ? (counter.sender_type === 'CREATOR' ? 'You countered — waiting for the brand' : `${counter.sender_type === 'AGENT' ? `${collab.brand_name}'s agent` : collab.brand_name} countered — your move`) : 'Counter-offer in play'}
        </div>
      )}

      <div className="relative z-10 pointer-events-none flex flex-wrap gap-1.5">
        {collab.deliverables.map((d) => (
          <span key={d.id} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-muted/60 py-1 pl-1.5 pr-2 text-xs">
            <PlatformIcon platform={d.platform} />
            <span className="font-medium">{deliverableLabel(d.deliverable_type)}</span>
            {!open && <DeliverableStatusBadge status={d.status} size="sm" />}
          </span>
        ))}
      </div>

      <div className="relative z-10 pointer-events-none flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {dl && (
            <span className={cn('flex items-center gap-1', dl.past && !(collab.status === 'COMPLETED' || collab.status === 'DECLINED' || collab.status === 'CANCELLED') ? 'font-medium text-danger' : dl.soon ? 'text-warning' : '')}>
              <CalendarClock className="h-3.5 w-3.5" />{dl.past ? `Due ${dl.label}` : `Due ${dl.label}`} · {fmtDate(collab.deadline)}
            </span>
          )}
          {collab.escrow_held > 0 && <span className="flex items-center gap-1 text-success"><Lock className="h-3.5 w-3.5" />{money(collab.escrow_held)} secured in escrow</span>}
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          {actions}
          <span className="flex items-center gap-0.5 text-foreground/70">View<ChevronRight className="h-3.5 w-3.5" /></span>
        </div>
      </div>
    </div>
  );
}
