import * as React from 'react';
import { Bot, User as UserIcon, Cpu, ShieldAlert, ShieldCheck, ShieldX, Clock, CheckCircle2, XCircle, PauseCircle, PlayCircle, Archive, FileEdit, AlertTriangle } from 'lucide-react';
import { Badge, type BadgeProps } from './badge';
import { titleCase, cn, platformLabel } from '@/lib/utils';
import type { CampaignStatus, CollaborationStatus, DeliverableStatus, ExecutionStatus, RunStatus, SessionStatus, CheckpointAction } from '@/types';

type Tone = NonNullable<BadgeProps['tone']>;

export const CAMPAIGN_STATUS: Record<CampaignStatus, { tone: Tone; label: string; icon: React.ElementType }> = {
  DRAFT: { tone: 'neutral', label: 'Draft', icon: FileEdit },
  ACTIVE: { tone: 'success', label: 'Active', icon: PlayCircle },
  PAUSED: { tone: 'warning', label: 'Paused', icon: PauseCircle },
  COMPLETED: { tone: 'info', label: 'Completed', icon: CheckCircle2 },
  ARCHIVED: { tone: 'neutral', label: 'Archived', icon: Archive },
};

export const COLLAB_STATUS: Record<CollaborationStatus, { tone: Tone; label: string }> = {
  OFFERED: { tone: 'info', label: 'Offered' },
  COUNTERED: { tone: 'warning', label: 'Countered' },
  ACCEPTED: { tone: 'primary', label: 'Accepted' },
  IN_PROGRESS: { tone: 'primary', label: 'In production' },
  SUBMITTED: { tone: 'warning', label: 'In review' },
  APPROVED: { tone: 'success', label: 'Approved' },
  COMPLETED: { tone: 'success', label: 'Completed' },
  DECLINED: { tone: 'danger', label: 'Declined' },
  CANCELLED: { tone: 'neutral', label: 'Withdrawn' },
};

export const DELIVERABLE_STATUS: Record<DeliverableStatus, { tone: Tone; label: string }> = {
  PENDING: { tone: 'neutral', label: 'Awaiting content' },
  SUBMITTED: { tone: 'warning', label: 'In review' },
  CHANGES_REQUESTED: { tone: 'danger', label: 'Changes requested' },
  APPROVED: { tone: 'success', label: 'Approved' },
  PAID: { tone: 'primary', label: 'Paid' },
};

export const EXEC_STATUS: Record<ExecutionStatus, { tone: Tone; label: string; icon: React.ElementType }> = {
  SUCCESS: { tone: 'success', label: 'Success', icon: ShieldCheck },
  HELD_FOR_APPROVAL: { tone: 'warning', label: 'Held for approval', icon: ShieldAlert },
  REJECTED_BY_GUARDRAIL: { tone: 'danger', label: 'Blocked', icon: ShieldX },
  FAILED: { tone: 'neutral', label: 'Failed', icon: AlertTriangle },
};

export const RUN_STATUS: Record<RunStatus, { tone: Tone; label: string }> = {
  RUNNING: { tone: 'agent', label: 'Running' },
  COMPLETED: { tone: 'success', label: 'Completed' },
  FAILED: { tone: 'danger', label: 'Failed' },
  CANCELLED: { tone: 'neutral', label: 'Cancelled' },
};

export const SESSION_STATUS: Record<SessionStatus, { tone: Tone; label: string }> = {
  ACTIVE: { tone: 'success', label: 'Active' },
  PAUSED: { tone: 'warning', label: 'Paused' },
  REVOKED: { tone: 'danger', label: 'Revoked' },
  COMPLETED: { tone: 'neutral', label: 'Completed' },
};

export const CHECKPOINT_ACTION: Record<CheckpointAction, { label: string; tone: Tone; description: string }> = {
  PAYMENT_ABOVE_THRESHOLD: { label: 'Payment above threshold', tone: 'danger', description: 'A payout larger than the autonomous release limit.' },
  OUT_OF_BAND_RATE: { label: 'Out-of-band rate', tone: 'warning', description: 'An offer above the per-collaboration rate ceiling.' },
  BRIEF_MODIFICATION: { label: 'Brief modification', tone: 'info', description: 'A brief change after a creator already accepted.' },
  AGENT_ESCALATION: { label: 'Agent escalation', tone: 'agent', description: 'The agent asked a human to decide.' },
  BUDGET_EXCEEDED: { label: 'Budget exceeded', tone: 'danger', description: 'Spend beyond the authorised ceiling.' },
};

export function CampaignStatusBadge({ status, size }: { status: CampaignStatus; size?: BadgeProps['size'] }) {
  const s = CAMPAIGN_STATUS[status] ?? { tone: 'neutral', label: titleCase(status) };
  return <Badge tone={s.tone} size={size} dot>{s.label}</Badge>;
}

export function CollabStatusBadge({ status, size }: { status: CollaborationStatus; size?: BadgeProps['size'] }) {
  const s = COLLAB_STATUS[status] ?? { tone: 'neutral', label: titleCase(status) };
  return <Badge tone={s.tone} size={size} dot>{s.label}</Badge>;
}

export function DeliverableStatusBadge({ status, size }: { status: DeliverableStatus; size?: BadgeProps['size'] }) {
  const s = DELIVERABLE_STATUS[status] ?? { tone: 'neutral', label: titleCase(status) };
  return <Badge tone={s.tone} size={size}>{s.label}</Badge>;
}

export function ExecStatusBadge({ status, size }: { status: ExecutionStatus; size?: BadgeProps['size'] }) {
  const s = EXEC_STATUS[status] ?? { tone: 'neutral', label: titleCase(status), icon: Cpu };
  const Icon = s.icon;
  return <Badge tone={s.tone} size={size}><Icon className="h-3 w-3" />{s.label}</Badge>;
}

export function RunStatusBadge({ status, size }: { status: RunStatus; size?: BadgeProps['size'] }) {
  const s = RUN_STATUS[status];
  return <Badge tone={s.tone} size={size} dot>{status === 'RUNNING' ? <span className="animate-pulse">Running</span> : s.label}</Badge>;
}

export function SessionStatusBadge({ status, size }: { status: SessionStatus; size?: BadgeProps['size'] }) {
  const s = SESSION_STATUS[status];
  return <Badge tone={s.tone} size={size} dot>{s.label}</Badge>;
}

export function CheckpointStatusBadge({ status, size }: { status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED'; size?: BadgeProps['size'] }) {
  const map = { PENDING: { tone: 'warning' as Tone, label: 'Pending', icon: Clock }, APPROVED: { tone: 'success' as Tone, label: 'Approved', icon: CheckCircle2 }, REJECTED: { tone: 'danger' as Tone, label: 'Rejected', icon: XCircle }, EXPIRED: { tone: 'neutral' as Tone, label: 'Expired', icon: Clock } };
  const s = map[status];
  const Icon = s.icon;
  return <Badge tone={s.tone} size={size}><Icon className="h-3 w-3" />{s.label}</Badge>;
}

export function RiskBadge({ level, size }: { level: 'LOW' | 'MEDIUM' | 'HIGH'; size?: BadgeProps['size'] }) {
  const tone: Tone = level === 'HIGH' ? 'danger' : level === 'MEDIUM' ? 'warning' : 'neutral';
  return <Badge tone={tone} size={size}>{titleCase(level)} risk</Badge>;
}

export function ActorBadge({ type, name, size }: { type: 'HUMAN' | 'AGENT' | 'SYSTEM' | string; name?: string | null; size?: BadgeProps['size'] }) {
  if (type === 'AGENT') return <Badge tone="agent" size={size}><Bot className="h-3 w-3" />{name ?? 'AI agent'}</Badge>;
  if (type === 'SYSTEM') return <Badge tone="neutral" size={size}><Cpu className="h-3 w-3" />{name ?? 'System'}</Badge>;
  return <Badge tone="outline" size={size}><UserIcon className="h-3 w-3" />{name ?? 'Human'}</Badge>;
}

export function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  const base = cn('inline-flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold text-white', className);
  const a11y = { role: 'img' as const, 'aria-label': platformLabel(platform) };
  if (platform === 'youtube') return <span {...a11y} className={cn(base, 'bg-[#ff0033]')}>▶</span>;
  if (platform === 'tiktok') return <span {...a11y} className={cn(base, 'bg-black dark:bg-white dark:text-black')}>♪</span>;
  if (platform === 'instagram') return <span {...a11y} className={cn(base, 'bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]')}>◎</span>;
  return <span {...a11y} className={cn(base, 'bg-muted-foreground')}>{platform[0]?.toUpperCase()}</span>;
}

export function PlatformIcons({ platforms, className }: { platforms: string[]; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1', className)}>{platforms.map((p) => <PlatformIcon key={p} platform={p} />)}</span>;
}

export function ToolChip({ name, className }: { name: string; className?: string }) {
  return <code className={cn('rounded-md border border-border bg-surface-muted px-1.5 py-0.5 font-mono text-[11.5px] text-foreground/85', className)}>{name}</code>;
}
