import { Link } from 'react-router-dom';
import { CalendarClock, Lock } from 'lucide-react';
import type { Collaboration } from '@/types';
import { money, cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/feedback';
import { CollabStatusBadge, ActorBadge } from '@/components/ui/status';
import { collabRate, deliverableProgress, deadlineInfo } from './collab-utils';

export function CollabCard({ collab }: { collab: Collaboration }) {
  const rate = collabRate(collab);
  const progress = deliverableProgress(collab.deliverables);
  const deadline = deadlineInfo(collab.deadline, collab.status);
  return (
    <Link to={`/collaborations/${collab.id}`} className="card card-hover block p-3.5">
      <div className="flex items-start gap-3">
        <Avatar name={collab.creator_name ?? collab.creator_id} src={collab.creator_avatar} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-semibold leading-tight">{collab.creator_name}</div>
          <div className="truncate text-xs text-muted-foreground">@{collab.creator_handle}</div>
        </div>
        <div className="shrink-0 text-right text-[14px] font-semibold tabular-nums">{money(rate)}</div>
      </div>
      <div className="mt-2.5 truncate text-xs text-muted-foreground">{collab.campaign_title}</div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <CollabStatusBadge status={collab.status} size="sm" />
        {collab.initiated_by === 'AGENT' && <ActorBadge type="AGENT" name="Agent" size="sm" />}
        {collab.agreed_rate == null && <span className="text-[10.5px] text-muted-foreground">proposed</span>}
      </div>
      {progress.total > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{progress.done} of {progress.total} deliverable{progress.total === 1 ? '' : 's'} approved</span>
            {progress.paid > 0 && <span>{progress.paid} paid</span>}
          </div>
          <Progress value={1} segments={[{ value: (progress.paid / progress.total) * 100, tone: 'primary' }, { value: ((progress.done - progress.paid) / progress.total) * 100, tone: 'success' }]} size="xs" />
        </div>
      )}
      <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className={cn('flex items-center gap-1 truncate', deadline.overdue && 'font-medium text-danger')}><CalendarClock className="h-3 w-3 shrink-0" />{deadline.label}</span>
        {collab.escrow_held > 0 && <span className="flex shrink-0 items-center gap-1 text-warning"><Lock className="h-3 w-3" />{money(collab.escrow_held)}</span>}
      </div>
    </Link>
  );
}
