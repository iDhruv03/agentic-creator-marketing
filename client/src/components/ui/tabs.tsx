import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

export const Tabs = TabsPrimitive.Root;
export const TabsContent = TabsPrimitive.Content;

/** Underlined tab list, used for page-level navigation inside a detail view. */
export function TabsList({ className, children, ...props }: TabsPrimitive.TabsListProps) {
  return (
    <TabsPrimitive.List className={cn('flex items-center gap-1 overflow-x-auto border-b border-border', className)} {...props}>
      {children}
    </TabsPrimitive.List>
  );
}

export function TabsTrigger({ className, children, count, icon, ...props }: TabsPrimitive.TabsTriggerProps & { count?: number; icon?: React.ReactNode }) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'relative -mb-px inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3 text-[13.5px] font-medium text-muted-foreground transition hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground',
        className,
      )}
      {...props}
    >
      {icon && <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
      {children}
      {count !== undefined && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10.5px] font-semibold text-muted-foreground">{count}</span>}
    </TabsPrimitive.Trigger>
  );
}

/** Pill tab list, for compact in-card switching. */
export function PillTabsList({ className, children, ...props }: TabsPrimitive.TabsListProps) {
  return (
    <TabsPrimitive.List className={cn('inline-flex items-center gap-0.5 rounded-xl border border-border bg-surface-muted p-0.5', className)} {...props}>
      {children}
    </TabsPrimitive.List>
  );
}

export function PillTabsTrigger({ className, children, ...props }: TabsPrimitive.TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger className={cn('rounded-[10px] px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:shadow-sm', className)} {...props}>
      {children}
    </TabsPrimitive.Trigger>
  );
}
