import * as React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CopyButton } from '@/components/ui/data';

/**
 * Same look as the kit's JsonView, but the copy button is a sibling of the
 * toggle rather than nested inside it (the kit version nests <button> in
 * <button>, which React flags as invalid DOM nesting).
 */
export function JsonBlock({ value, className, collapsed = false, maxHeight = 320, label = 'JSON' }: { value: unknown; className?: string; collapsed?: boolean; maxHeight?: number; label?: string }) {
  const [open, setOpen] = React.useState(!collapsed);
  const text = React.useMemo(() => { try { return JSON.stringify(value, null, 2); } catch { return String(value); } }, [value]);
  return (
    <div className={cn('overflow-hidden rounded-lg border border-border bg-surface-muted/60', className)}>
      <div className="flex items-center justify-between pr-1.5 text-[11px] font-medium text-muted-foreground">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex flex-1 items-center gap-1 px-2.5 py-1.5 text-left hover:bg-accent/50">
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}{label}
        </button>
        <CopyButton value={text} className="h-5 w-5" />
      </div>
      {open && <pre className="overflow-auto px-3 pb-3 font-mono text-[11.5px] leading-relaxed text-foreground/85" style={{ maxHeight }}>{text}</pre>}
    </div>
  );
}
