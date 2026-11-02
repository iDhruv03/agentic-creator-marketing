import * as React from 'react';
import { Inbox, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Progress({ value, max = 100, tone = 'primary', className, size = 'md', segments }: { value: number; max?: number; tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'agent'; className?: string; size?: 'xs' | 'sm' | 'md'; segments?: { value: number; tone: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'agent' | 'muted' }[] }) {
  const tones = { primary: 'bg-primary', success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger', info: 'bg-info', agent: 'bg-agent', muted: 'bg-muted-foreground/40' };
  const heights = { xs: 'h-1', sm: 'h-1.5', md: 'h-2' };
  const pctOf = (v: number) => `${Math.max(0, Math.min(100, (v / (max || 1)) * 100))}%`;
  return (
    <div className={cn('flex w-full overflow-hidden rounded-full bg-muted', heights[size], className)}>
      {segments ? segments.map((s, i) => <div key={i} className={cn('h-full transition-all duration-500', tones[s.tone])} style={{ width: pctOf(s.value) }} />) : <div className={cn('h-full rounded-full transition-all duration-500', tones[tone])} style={{ width: pctOf(value) }} />}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

export function SkeletonRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-1/3" /><Skeleton className="h-3 w-2/3" /></div>
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-4', className)}>
      {Array.from({ length: count }).map((_, i) => <div key={i} className="card space-y-3 p-5"><Skeleton className="h-3 w-1/2" /><Skeleton className="h-7 w-2/3" /><Skeleton className="h-3 w-1/3" /></div>)}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, className, compact }: { icon?: LucideIcon; title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; className?: string; compact?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-2xl border border-dashed border-border text-center', compact ? 'px-4 py-8' : 'px-6 py-14', className)}>
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-surface-muted text-muted-foreground"><Icon className="h-5 w-5" /></div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, delta, hint, icon: Icon, tone = 'neutral', className, onClick, size = 'md' }: { label: React.ReactNode; value: React.ReactNode; delta?: { value: string; positive?: boolean | null }; hint?: React.ReactNode; icon?: LucideIcon; tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'agent'; className?: string; onClick?: () => void; size?: 'sm' | 'md' }) {
  const tones = { neutral: 'bg-surface-muted text-muted-foreground', primary: 'bg-primary-soft text-primary', success: 'bg-success-soft text-success', warning: 'bg-warning-soft text-warning', danger: 'bg-danger-soft text-danger', info: 'bg-info-soft text-info', agent: 'bg-agent-soft text-agent' };
  const Comp: any = onClick ? 'button' : 'div';
  return (
    <Comp onClick={onClick} className={cn('card flex w-full flex-col text-left', size === 'sm' ? 'p-4' : 'p-5', onClick && 'card-hover cursor-pointer', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        {Icon && <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', tones[tone])}><Icon className="h-3.5 w-3.5" /></span>}
      </div>
      <div className={cn('mt-2 font-display font-semibold tabular-nums tracking-tight', size === 'sm' ? 'text-xl' : 'text-[26px] leading-none')}>{value}</div>
      {(delta || hint) && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          {delta && <span className={cn('font-semibold', delta.positive === true ? 'text-success' : delta.positive === false ? 'text-danger' : 'text-muted-foreground')}>{delta.value}</span>}
          {hint && <span className="text-muted-foreground">{hint}</span>}
        </div>
      )}
    </Comp>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cn('inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent', className)} />;
}

export function PulseDot({ tone = 'success', className }: { tone?: 'success' | 'warning' | 'danger' | 'primary' | 'agent'; className?: string }) {
  const tones = { success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger', primary: 'bg-primary', agent: 'bg-agent' };
  return (
    <span className={cn('relative inline-flex h-2 w-2', className)}>
      <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-75 animate-pulse-ring', tones[tone])} />
      <span className={cn('relative inline-flex h-2 w-2 rounded-full', tones[tone])} />
    </span>
  );
}

export function Callout({ tone = 'info', title, children, icon: Icon, className, action }: { tone?: 'info' | 'success' | 'warning' | 'danger' | 'agent' | 'neutral'; title?: React.ReactNode; children?: React.ReactNode; icon?: LucideIcon; className?: string; action?: React.ReactNode }) {
  const tones = { info: 'border-info/25 bg-info-soft text-info', success: 'border-success/25 bg-success-soft text-success', warning: 'border-warning/30 bg-warning-soft text-warning', danger: 'border-danger/25 bg-danger-soft text-danger', agent: 'border-agent/25 bg-agent-soft text-agent', neutral: 'border-border bg-surface-muted text-muted-foreground' };
  return (
    <div className={cn('flex items-start gap-3 rounded-xl border px-4 py-3', tones[tone], className)}>
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0" />}
      <div className="min-w-0 flex-1 text-[13px] leading-relaxed text-foreground/90">
        {title && <div className="font-semibold">{title}</div>}
        {children && <div className={cn(title && 'mt-0.5', 'text-foreground/80')}>{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function Score({ value, size = 'md', label }: { value: number; size?: 'sm' | 'md' | 'lg'; label?: string }) {
  const tone = value >= 80 ? 'text-success' : value >= 60 ? 'text-warning' : 'text-danger';
  const stroke = value >= 80 ? 'hsl(var(--success))' : value >= 60 ? 'hsl(var(--warning))' : 'hsl(var(--danger))';
  const dims = { sm: 32, md: 44, lg: 64 }[size];
  const r = (dims - 6) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: dims, height: dims }} title={label}>
      <svg width={dims} height={dims} className="-rotate-90">
        <circle cx={dims / 2} cy={dims / 2} r={r} stroke="hsl(var(--muted))" strokeWidth={3} fill="none" />
        <circle cx={dims / 2} cy={dims / 2} r={r} stroke={stroke} strokeWidth={3} fill="none" strokeDasharray={c} strokeDashoffset={c - (c * Math.min(100, value)) / 100} strokeLinecap="round" className="transition-all duration-700" />
      </svg>
      <span className={cn('absolute font-semibold tabular-nums', tone, size === 'sm' ? 'text-[10px]' : size === 'md' ? 'text-xs' : 'text-base')}>{Math.round(value)}</span>
    </div>
  );
}
