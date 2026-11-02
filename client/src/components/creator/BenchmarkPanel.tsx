import * as React from 'react';
import { useBenchmark } from '@/hooks/queries';
import { money, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/feedback';
import { Tooltip } from '@/components/ui/overlay';
import type { RateBenchmark } from '@/types';
import type { BenchmarkKey } from './utils';

export function benchmarkPosition(rate: number, b: RateBenchmark): { label: string; tone: 'warning' | 'success' | 'info' } {
  if (rate < b.p25) return { label: 'Below market', tone: 'warning' };
  if (rate <= b.p75) return { label: 'In range', tone: 'success' };
  return { label: 'Above p75', tone: 'info' };
}

/** p25–p75 band with the median tick and the creator's own rate marked on it. */
export function BenchmarkBar({ rate, benchmark, className }: { rate: number; benchmark: RateBenchmark; className?: string }) {
  const lo = Math.min(benchmark.p25, rate) * 0.75;
  const hi = Math.max(benchmark.p75, rate) * 1.2;
  const x = (v: number) => `${Math.max(0, Math.min(100, ((v - lo) / (hi - lo || 1)) * 100))}%`;
  return (
    <div className={cn('relative h-7', className)}>
      <div className="absolute inset-x-0 top-3 h-1.5 rounded-full bg-muted" />
      <Tooltip content={`Creators your size: ${money(benchmark.p25)} – ${money(benchmark.p75)}`}>
        <div className="absolute top-3 h-1.5 rounded-full bg-primary/35" style={{ left: x(benchmark.p25), width: `calc(${x(benchmark.p75)} - ${x(benchmark.p25)})` }} />
      </Tooltip>
      <Tooltip content={`Median ${money(benchmark.median)}`}>
        <div className="absolute top-2 h-3.5 w-0.5 -translate-x-1/2 rounded-full bg-primary" style={{ left: x(benchmark.median) }} />
      </Tooltip>
      <Tooltip content={`Your rate ${money(rate)}`}>
        <div className="absolute top-[7px] h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-surface bg-foreground shadow-raised" style={{ left: x(rate) }} />
      </Tooltip>
    </div>
  );
}

export function BenchmarkPanel({ followerCount, deliverable, niche, rate, compact }: { followerCount: number; deliverable: BenchmarkKey; niche?: string; rate: number; compact?: boolean }) {
  const q = useBenchmark(followerCount > 0 ? { follower_count: followerCount, deliverable, niche } : null);
  if (q.isLoading) return <div className="space-y-2"><Skeleton className="h-3 w-2/3" /><Skeleton className="h-2 w-full" /></div>;
  const b = q.data;
  if (!b) return <p className="text-xs text-muted-foreground">No benchmark available yet.</p>;
  const pos = benchmarkPosition(rate, b);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>Creators your size charge <span className="font-medium text-foreground tabular-nums">{money(b.p25)}</span> · <span className="font-medium text-foreground tabular-nums">{money(b.median)}</span> · <span className="font-medium text-foreground tabular-nums">{money(b.p75)}</span><span className="hidden sm:inline"> (p25 · median · p75)</span></span>
        <Badge tone={pos.tone} size="sm">{pos.label}</Badge>
      </div>
      <BenchmarkBar rate={rate} benchmark={b} className="mt-1.5" />
      {!compact && <div className="flex justify-between text-[11px] text-muted-foreground"><span>{b.tier} tier · {b.sample_size} comparable creators</span><span>Suggested {money(b.suggested)}</span></div>}
    </div>
  );
}
