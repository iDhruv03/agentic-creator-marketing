import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

/* ---------------------------------------------------------------- Dialog */
export function Dialog({ open, onOpenChange, title, description, children, footer, size = 'md', className }: { open: boolean; onOpenChange: (o: boolean) => void; title: React.ReactNode; description?: React.ReactNode; children?: React.ReactNode; footer?: React.ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] animate-fade-in" />
        <DialogPrimitive.Content className={cn('fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-border bg-surface-raised shadow-overlay animate-scale-in focus:outline-none', widths[size], className)}>
          <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
            <div>
              <DialogPrimitive.Title className="text-base font-semibold">{title}</DialogPrimitive.Title>
              {description && <DialogPrimitive.Description className="mt-1 text-[13px] text-muted-foreground">{description}</DialogPrimitive.Description>}
            </div>
            <DialogPrimitive.Close className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"><X className="h-4 w-4" /></DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/* ---------------------------------------------------------------- Sheet (side drawer) */
export function Sheet({ open, onOpenChange, title, description, children, footer, side = 'right', width = 'md', className }: { open: boolean; onOpenChange: (o: boolean) => void; title?: React.ReactNode; description?: React.ReactNode; children?: React.ReactNode; footer?: React.ReactNode; side?: 'right' | 'left'; width?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const widths = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' };
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] animate-fade-in" />
        <DialogPrimitive.Content className={cn('fixed inset-y-0 z-50 flex w-full flex-col border-border bg-surface shadow-overlay focus:outline-none', side === 'right' ? 'right-0 border-l' : 'left-0 border-r', widths[width], className)} style={{ animation: `${side === 'right' ? 'sheet-in-right' : 'sheet-in-left'} 240ms cubic-bezier(0.16,1,0.3,1)` }}>
          {(title || description) && (
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
              <div className="min-w-0">
                {title && <DialogPrimitive.Title className="truncate text-base font-semibold">{title}</DialogPrimitive.Title>}
                {description && <DialogPrimitive.Description className="mt-0.5 text-[13px] text-muted-foreground">{description}</DialogPrimitive.Description>}
              </div>
              <DialogPrimitive.Close className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"><X className="h-4 w-4" /></DialogPrimitive.Close>
            </div>
          )}
          {!title && !description && <DialogPrimitive.Title className="sr-only">Panel</DialogPrimitive.Title>}
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          {footer && <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
      <style>{`@keyframes sheet-in-right{from{transform:translateX(24px);opacity:0}to{transform:none;opacity:1}}@keyframes sheet-in-left{from{transform:translateX(-24px);opacity:0}to{transform:none;opacity:1}}`}</style>
    </DialogPrimitive.Root>
  );
}

/* ---------------------------------------------------------------- Confirm */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = 'Confirm', tone = 'primary', loading, onConfirm, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: React.ReactNode; description?: React.ReactNode; confirmLabel?: string; tone?: 'primary' | 'danger' | 'success'; loading?: boolean; onConfirm: () => void; children?: React.ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description} size="sm" footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant={tone} loading={loading} onClick={onConfirm}>{confirmLabel}</Button></>}>
      {children}
    </Dialog>
  );
}

/* ---------------------------------------------------------------- Dropdown */
export const Dropdown = DropdownPrimitive.Root;
export const DropdownTrigger = DropdownPrimitive.Trigger;

export function DropdownContent({ className, align = 'end', children, ...props }: DropdownPrimitive.DropdownMenuContentProps) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content align={align} sideOffset={6} className={cn('z-[60] min-w-[200px] rounded-xl border border-border bg-surface-raised p-1.5 shadow-overlay animate-scale-in', className)} {...props}>
        {children}
      </DropdownPrimitive.Content>
    </DropdownPrimitive.Portal>
  );
}

export function DropdownItem({ className, icon, destructive, children, ...props }: DropdownPrimitive.DropdownMenuItemProps & { icon?: React.ReactNode; destructive?: boolean }) {
  return (
    <DropdownPrimitive.Item className={cn('flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] outline-none transition data-[highlighted]:bg-accent data-[disabled]:opacity-50', destructive && 'text-danger data-[highlighted]:bg-danger-soft', className)} {...props}>
      {icon && <span className="text-muted-foreground [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
      {children}
    </DropdownPrimitive.Item>
  );
}

export function DropdownLabel({ children }: { children: React.ReactNode }) {
  return <DropdownPrimitive.Label className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</DropdownPrimitive.Label>;
}

export const DropdownSeparator = () => <DropdownPrimitive.Separator className="my-1 h-px bg-border" />;

/* ---------------------------------------------------------------- Tooltip */
export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <TooltipPrimitive.Provider delayDuration={250}>{children}</TooltipPrimitive.Provider>;
}

export function Tooltip({ content, children, side = 'top', asChild = true }: { content: React.ReactNode; children: React.ReactElement; side?: 'top' | 'bottom' | 'left' | 'right'; asChild?: boolean }) {
  if (!content) return children;
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild={asChild}>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content side={side} sideOffset={6} className="z-[70] max-w-xs rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-medium text-background shadow-raised animate-fade-in">
          {content}
          <TooltipPrimitive.Arrow className="fill-foreground" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

/* ---------------------------------------------------------------- Popover */
export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export function PopoverContent({ className, align = 'start', children, ...props }: PopoverPrimitive.PopoverContentProps) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content align={align} sideOffset={6} className={cn('z-[60] w-72 rounded-xl border border-border bg-surface-raised p-4 shadow-overlay animate-scale-in focus:outline-none', className)} {...props}>
        {children}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
}
