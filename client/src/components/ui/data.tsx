import * as React from 'react';
import { Check, Copy, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip } from './overlay';

export function CopyButton({ value, className, label }: { value: string; className?: string; label?: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Tooltip content={copied ? 'Copied' : label ?? 'Copy'}>
      <button type="button" aria-label={copied ? 'Copied' : label ?? 'Copy to clipboard'} onClick={() => { navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className={cn('inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground', className)}>
        {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </Tooltip>
  );
}

export function Mono({ children, className, copy }: { children: string; className?: string; copy?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1 font-mono text-[12px] text-muted-foreground', className)}>
      {children}
      {copy && <CopyButton value={children} className="h-5 w-5" />}
    </span>
  );
}

export function CodeBlock({ code, language, className, title }: { code: string; language?: string; className?: string; title?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-border bg-[#0d1117] text-[12.5px] text-slate-200', className)}>
      {(title || language) && (
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5 text-[11px] text-slate-400">
          <span>{title ?? language}</span>
          <CopyButton value={code} className="text-slate-400 hover:bg-white/10 hover:text-white" />
        </div>
      )}
      <pre tabIndex={0} role="region" aria-label={title ?? language ?? 'Code'} className="max-h-[420px] overflow-auto p-3.5 font-mono leading-relaxed focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"><code>{code}</code></pre>
    </div>
  );
}

export function JsonView({ value, className, collapsed = false, maxHeight = 320, label = 'JSON payload' }: { value: unknown; className?: string; collapsed?: boolean; maxHeight?: number; label?: string }) {
  const [open, setOpen] = React.useState(!collapsed);
  const text = React.useMemo(() => { try { return JSON.stringify(value, null, 2); } catch { return String(value); } }, [value]);
  return (
    <div className={cn('overflow-hidden rounded-lg border border-border bg-surface-muted/60', className)}>
      <div className="flex items-center justify-between pr-1.5 text-[11px] font-medium text-muted-foreground">
        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex flex-1 items-center gap-1 px-2.5 py-1.5 text-left hover:bg-accent/50">{open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}JSON</button>
        <CopyButton value={text} className="h-5 w-5" />
      </div>
      {open && <pre tabIndex={0} role="region" aria-label={label} className="overflow-auto px-3 pb-3 font-mono text-[11.5px] leading-relaxed text-foreground/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" style={{ maxHeight }}>{text}</pre>}
    </div>
  );
}

export function KeyValue({ items, className, columns = 1 }: { items: { label: React.ReactNode; value: React.ReactNode; mono?: boolean }[]; className?: string; columns?: 1 | 2 | 3 }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-3', columns === 2 && 'sm:grid-cols-2', columns === 3 && 'sm:grid-cols-3', className)}>
      {items.map((it, i) => (
        <div key={i} className="min-w-0">
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{it.label}</dt>
          <dd className={cn('mt-0.5 break-words text-[13.5px] text-foreground', it.mono && 'font-mono text-xs')}>{it.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export interface Column<T> { key: string; header: React.ReactNode; render: (row: T) => React.ReactNode; className?: string; align?: 'left' | 'right' | 'center'; width?: string; sortValue?: (row: T) => number | string }

export function DataTable<T>({ rows, columns, rowKey, onRowClick, empty, className, dense, selectedKey, label }: { rows: T[]; columns: Column<T>[]; rowKey: (row: T) => string; onRowClick?: (row: T) => void; empty?: React.ReactNode; className?: string; dense?: boolean; selectedKey?: string | null; label?: string }) {
  const [sort, setSort] = React.useState<{ key: string; dir: 1 | -1 } | null>(null);
  const sorted = React.useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    return [...rows].sort((a, b) => { const av = col.sortValue!(a); const bv = col.sortValue!(b); return (av < bv ? -1 : av > bv ? 1 : 0) * sort.dir; });
  }, [rows, sort, columns]);
  return (
    <div className={cn('card overflow-hidden p-0', className)}>
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={label ?? `Table: ${columns.map((c) => (typeof c.header === 'string' ? c.header : '')).filter(Boolean).join(', ') || 'data'}`}>
        <table className="table-base">
          <thead>
            <tr>
              {columns.map((c) => {
                const isEmpty = c.header === '' || c.header === null || c.header === undefined;
                const sorted = sort?.key === c.key;
                const toggle = () => setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: 1 }));
                return (
                  <th key={c.key} scope="col" style={{ width: c.width }} aria-sort={c.sortValue ? (sorted ? (sort!.dir === 1 ? 'ascending' : 'descending') : 'none') : undefined} className={cn(c.align === 'right' && 'text-right', c.align === 'center' && 'text-center')}>
                    {isEmpty ? <span className="relative inline-block"><span className="sr-only">Actions</span></span> : c.sortValue ? (
                      <button type="button" onClick={toggle}>{c.header}<ChevronDown aria-hidden className={cn('h-3 w-3 transition', !sorted && 'opacity-0', sorted && sort!.dir === -1 && 'rotate-180')} /></button>
                    ) : (
                      <span className="inline-flex items-center gap-1">{c.header}</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && <tr><td colSpan={columns.length} className="py-10 text-center text-sm text-muted-foreground">{empty ?? 'Nothing here yet.'}</td></tr>}
            {sorted.map((row) => {
              const k = rowKey(row);
              return (
                <tr key={k} onClick={onRowClick ? () => onRowClick(row) : undefined} tabIndex={onRowClick ? 0 : undefined} onKeyDown={onRowClick ? (e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onRowClick(row); } } : undefined} aria-selected={onRowClick ? selectedKey === k : undefined} className={cn('transition', onRowClick && 'cursor-pointer hover:bg-accent/50 focus:outline-none focus-visible:bg-accent/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring', selectedKey === k && 'bg-primary-soft/40')}>
                  {columns.map((c) => <td key={c.key} className={cn(dense && 'py-2', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center', c.className)}>{c.render(row)}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Timeline({ items, className }: { items: { id: string; icon?: React.ReactNode; tone?: 'primary' | 'success' | 'warning' | 'danger' | 'agent' | 'neutral' | 'info'; title: React.ReactNode; body?: React.ReactNode; meta?: React.ReactNode }[]; className?: string }) {
  const tones = { primary: 'bg-primary-soft text-primary', success: 'bg-success-soft text-success', warning: 'bg-warning-soft text-warning', danger: 'bg-danger-soft text-danger', agent: 'bg-agent-soft text-agent', neutral: 'bg-surface-muted text-muted-foreground', info: 'bg-info-soft text-info' };
  return (
    <ol className={cn('relative space-y-0', className)}>
      {items.map((it, i) => (
        <li key={it.id} className="relative flex gap-3 pb-5 last:pb-0">
          {i < items.length - 1 && <span className="absolute left-[15px] top-8 h-[calc(100%-1rem)] w-px bg-border" />}
          <span className={cn('relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full [&>svg]:h-4 [&>svg]:w-4', tones[it.tone ?? 'neutral'])}>{it.icon}</span>
          <div className="min-w-0 flex-1 pt-1">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <div className="text-[13.5px] font-medium text-foreground">{it.title}</div>
              {it.meta && <div className="text-xs text-muted-foreground">{it.meta}</div>}
            </div>
            {it.body && <div className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{it.body}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Collapsible({ title, children, defaultOpen = false, className, right }: { title: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean; className?: string; right?: React.ReactNode }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className={cn('rounded-xl border border-border', className)}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium hover:bg-accent/40">
        <span className="flex items-center gap-2"><ChevronRight className={cn('h-4 w-4 text-muted-foreground transition', open && 'rotate-90')} />{title}</span>
        {right}
      </button>
      {open && <div className="border-t border-border px-4 py-3">{children}</div>}
    </div>
  );
}
