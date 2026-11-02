import * as React from 'react';
import { Collapsible, CopyButton } from '@/components/ui/data';

/**
 * JSON block built from the kit's Collapsible + CopyButton. The kit's JsonView nests
 * a <button> (CopyButton) inside its header <button>, which React flags as invalid DOM
 * nesting; this keeps the copy control inside the content instead.
 */
export function JsonPanel({ value, title = 'JSON', collapsed = false, maxHeight = 320 }: { value: unknown; title?: React.ReactNode; collapsed?: boolean; maxHeight?: number }) {
  const text = React.useMemo(() => { try { return JSON.stringify(value, null, 2); } catch { return String(value); } }, [value]);
  return (
    <Collapsible title={<span className="text-[12px] font-medium text-muted-foreground">{title}</span>} defaultOpen={!collapsed} className="bg-surface-muted/50">
      <div className="relative">
        <CopyButton value={text} className="absolute right-0 top-0 bg-surface-muted/80" />
        <pre className="overflow-auto pr-7 font-mono text-[11.5px] leading-relaxed text-foreground/85" style={{ maxHeight }}>{text}</pre>
      </div>
    </Collapsible>
  );
}
