import * as React from 'react';
import { ResponsiveContainer, AreaChart, Area, LineChart, Line, Tooltip as RTooltip } from 'recharts';
import { cn, money, num } from '@/lib/utils';

export const CHART = {
  primary: 'hsl(var(--chart-1))',
  teal: 'hsl(var(--chart-2))',
  amber: 'hsl(var(--chart-3))',
  violet: 'hsl(var(--chart-4))',
  rose: 'hsl(var(--chart-5))',
  blue: 'hsl(var(--chart-6))',
  muted: 'hsl(var(--muted-foreground) / 0.35)',
  grid: 'hsl(var(--border))',
};
export const CHART_SERIES = [CHART.primary, CHART.teal, CHART.amber, CHART.violet, CHART.rose, CHART.blue];

/** Shared tooltip body: dark card, label, series rows. */
export function ChartTooltip({ active, payload, label, format, labelFormat }: { active?: boolean; payload?: any[]; label?: any; format?: (v: number, name: string) => string; labelFormat?: (l: any) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[140px] rounded-xl border border-border bg-surface-raised px-3 py-2.5 shadow-overlay">
      {label !== undefined && <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{labelFormat ? labelFormat(label) : String(label)}</div>}
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground"><span className="h-2 w-2 rounded-sm" style={{ background: p.color ?? p.fill }} />{p.name}</span>
            <span className="font-semibold tabular-nums">{format ? format(Number(p.value), String(p.name)) : num(Number(p.value))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const moneyFmt = (v: number) => money(v);
export const numFmt = (v: number) => num(v, { compact: true });

export function ChartFrame({ title, description, children, height = 260, action, className, legend }: { title?: React.ReactNode; description?: React.ReactNode; children: React.ReactElement; height?: number; action?: React.ReactNode; className?: string; legend?: { label: string; color: string }[] }) {
  return (
    <div className={cn('card p-5', className)}>
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && <h3 className="text-[15px] font-semibold">{title}</h3>}
            {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
          </div>
          <div className="flex items-center gap-3">
            {legend && <div className="hidden items-center gap-3 sm:flex">{legend.map((l) => <span key={l.label} className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-sm" style={{ background: l.color }} />{l.label}</span>)}</div>}
            {action}
          </div>
        </div>
      )}
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
    </div>
  );
}

export function Sparkline({ data, dataKey = 'v', color = CHART.primary, height = 36, area = true }: { data: Record<string, any>[]; dataKey?: string; color?: string; height?: number; area?: boolean }) {
  const id = React.useId();
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        {area ? (
          <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
            <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.35} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
            <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.75} fill={`url(#${id})`} isAnimationActive={false} />
            <RTooltip content={() => null} />
          </AreaChart>
        ) : (
          <LineChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}><Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.75} dot={false} isAnimationActive={false} /></LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal bar list — a readable alternative to small pie charts. */
export function BarList({ items, format = (v) => num(v), color = CHART.primary, className, max }: { items: { label: React.ReactNode; value: number; color?: string; hint?: React.ReactNode }[]; format?: (v: number) => string; color?: string; className?: string; max?: number }) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <div className={cn('space-y-2.5', className)}>
      {items.map((it, i) => (
        <div key={i}>
          <div className="mb-1 flex items-center justify-between gap-3 text-[13px]"><span className="truncate text-foreground/90">{it.label}</span><span className="shrink-0 font-medium tabular-nums">{format(it.value)}{it.hint && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{it.hint}</span>}</span></div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${(it.value / top) * 100}%`, background: it.color ?? color }} /></div>
        </div>
      ))}
    </div>
  );
}

export function Donut({ segments, size = 120, thickness = 14, center, className }: { segments: { value: number; color: string; label: string }[]; size?: number; thickness?: number; center?: React.ReactNode; className?: string }) {
  const total = Math.max(1, segments.reduce((a, s) => a + s.value, 0));
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={thickness} />
        {segments.map((s, i) => {
          const len = (s.value / total) * c;
          const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} className="transition-all duration-700" />;
          offset += len;
          return el;
        })}
      </svg>
      {center && <div className="absolute inset-0 flex items-center justify-center text-center">{center}</div>}
    </div>
  );
}
