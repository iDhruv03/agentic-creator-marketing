import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNowStrict, format, parseISO, isValid } from 'date-fns';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function money(n: number | null | undefined, opts: { compact?: boolean; cents?: boolean } = {}): string {
  const v = Number(n ?? 0);
  if (opts.compact && Math.abs(v) >= 10000) {
    return `$${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v)}`;
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: opts.cents ? 2 : 0, minimumFractionDigits: opts.cents ? 2 : 0 }).format(v);
}

export function num(n: number | null | undefined, opts: { compact?: boolean; decimals?: number } = {}): string {
  const v = Number(n ?? 0);
  if (opts.compact && Math.abs(v) >= 1000) return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v);
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: opts.decimals ?? 0 }).format(v);
}

export function pct(n: number | null | undefined, decimals = 1): string {
  return `${Number(n ?? 0).toFixed(decimals)}%`;
}

export function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const d = value.includes('T') ? parseISO(value) : parseISO(value.replace(' ', 'T') + (value.length === 10 ? 'T00:00:00' : 'Z'));
  return isValid(d) ? d : null;
}

export function timeAgo(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return '—';
  return formatDistanceToNowStrict(d, { addSuffix: true });
}

export function fmtDate(value: string | Date | null | undefined, pattern = 'd MMM yyyy'): string {
  const d = toDate(value);
  return d ? format(d, pattern) : '—';
}

export function fmtDateTime(value: string | Date | null | undefined): string {
  return fmtDate(value, 'd MMM, HH:mm');
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
}

export function titleCase(s: string | null | undefined): string {
  if (!s) return '';
  return s.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function duration(sec: number): string {
  if (sec < 60) return `${Math.round(sec)}s`;
  if (sec < 3600) return `${(sec / 60).toFixed(sec < 600 ? 1 : 0)} min`;
  if (sec < 86400) return `${(sec / 3600).toFixed(1)} h`;
  return `${(sec / 86400).toFixed(1)} d`;
}

export function minutes(min: number): string {
  if (min < 60) return `${Math.round(min)} min`;
  return `${(min / 60).toFixed(1)} h`;
}

export function hashHue(seed: string): number {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 360;
}

export function platformLabel(p: string): string {
  return ({ instagram: 'Instagram', youtube: 'YouTube', tiktok: 'TikTok' } as Record<string, string>)[p] ?? titleCase(p);
}

export function deliverableLabel(t: string): string {
  return ({ POST: 'Instagram Post', REEL: 'Instagram Reel', STORY: 'Instagram Story', YOUTUBE_VIDEO: 'YouTube Video', YOUTUBE_SHORT: 'YouTube Short', TIKTOK_VIDEO: 'TikTok Video' } as Record<string, string>)[t] ?? titleCase(t);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export const CHART_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--chart-6))'];
