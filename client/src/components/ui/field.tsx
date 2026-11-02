import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Label({ className, children, hint, required, ...props }: React.LabelHTMLAttributes<HTMLLabelElement> & { hint?: React.ReactNode; required?: boolean }) {
  return (
    <label className={cn('label flex items-center justify-between', className)} {...props}>
      <span>{children}{required && <span className="ml-0.5 text-danger">*</span>}</span>
      {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
    </label>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { leftIcon?: React.ReactNode; rightSlot?: React.ReactNode; error?: boolean }>(({ className, leftIcon, rightSlot, error, ...props }, ref) => (
  <div className="relative">
    {leftIcon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{leftIcon}</span>}
    <input ref={ref} className={cn('input', leftIcon && 'pl-9', rightSlot && 'pr-10', error && 'border-danger focus:border-danger focus:ring-danger/15', className)} {...props} />
    {rightSlot && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">{rightSlot}</span>}
  </div>
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }>(({ className, error, ...props }, ref) => (
  <textarea ref={ref} className={cn('textarea', error && 'border-danger', className)} {...props} />
));
Textarea.displayName = 'Textarea';

export function SearchInput({ value, onChange, placeholder = 'Search…', className, autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; autoFocus?: boolean }) {
  return (
    <Input
      value={value}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      leftIcon={<Search className="h-4 w-4" />}
      className={className}
      rightSlot={value ? <button type="button" onClick={() => onChange('')} className="rounded p-0.5 hover:bg-accent"><X className="h-3.5 w-3.5" /></button> : undefined}
    />
  );
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="mt-1.5 text-xs text-danger">{children}</p>;
}

export function Hint({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="hint">{children}</p>;
}

/* ---------------------------------------------------------------- Select */
export interface SelectOption { value: string; label: React.ReactNode; description?: string; disabled?: boolean }

export function Select({ value, onValueChange, options, placeholder = 'Select…', className, size = 'md', disabled, allowEmpty }: { value: string | undefined; onValueChange: (v: string) => void; options: SelectOption[]; placeholder?: string; className?: string; size?: 'sm' | 'md'; disabled?: boolean; allowEmpty?: string }) {
  return (
    <SelectPrimitive.Root value={value || undefined} onValueChange={(v) => onValueChange(v === '__empty__' ? '' : v)} disabled={disabled}>
      <SelectPrimitive.Trigger className={cn('input items-center justify-between gap-2 text-left data-[placeholder]:text-muted-foreground/70', size === 'sm' && 'h-8 rounded-lg px-2.5 text-[13px]', className)}>
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon><ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /></SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content position="popper" sideOffset={6} className="z-[60] max-h-[320px] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-border bg-surface-raised p-1 shadow-overlay animate-scale-in">
          <SelectPrimitive.Viewport>
            {allowEmpty !== undefined && (
              <SelectPrimitive.Item value="__empty__" className="relative flex cursor-pointer select-none items-center rounded-lg py-2 pl-8 pr-3 text-sm text-muted-foreground outline-none data-[highlighted]:bg-accent">
                <SelectPrimitive.ItemText>{allowEmpty}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            )}
            {options.map((o) => (
              <SelectPrimitive.Item key={o.value} value={o.value} disabled={o.disabled} className="relative flex cursor-pointer select-none flex-col items-start rounded-lg py-2 pl-8 pr-3 text-sm outline-none data-[highlighted]:bg-accent data-[disabled]:opacity-50">
                <SelectPrimitive.ItemIndicator className="absolute left-2.5 top-2.5"><Check className="h-3.5 w-3.5 text-primary" /></SelectPrimitive.ItemIndicator>
                <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                {o.description && <span className="text-xs text-muted-foreground">{o.description}</span>}
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

/* ---------------------------------------------------------------- Switch */
export function Switch({ checked, onCheckedChange, label, description, disabled }: { checked: boolean; onCheckedChange: (v: boolean) => void; label?: React.ReactNode; description?: React.ReactNode; disabled?: boolean }) {
  return (
    <label className={cn('flex cursor-pointer items-center justify-between gap-4', disabled && 'cursor-not-allowed opacity-60')}>
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-sm font-medium">{label}</span>}
          {description && <span className="block text-xs text-muted-foreground">{description}</span>}
        </span>
      )}
      <SwitchPrimitive.Root checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} className="relative h-6 w-11 shrink-0 rounded-full bg-muted transition-colors data-[state=checked]:bg-primary">
        <SwitchPrimitive.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px]" />
      </SwitchPrimitive.Root>
    </label>
  );
}

/* ---------------------------------------------------------------- Slider */
export function Slider({ value, onValueChange, min = 0, max = 100, step = 1, className, format }: { value: number[]; onValueChange: (v: number[]) => void; min?: number; max?: number; step?: number; className?: string; format?: (v: number) => string }) {
  return (
    <div className={cn('space-y-2', className)}>
      <SliderPrimitive.Root value={value} onValueChange={onValueChange} min={min} max={max} step={step} className="relative flex h-5 w-full touch-none select-none items-center">
        <SliderPrimitive.Track className="relative h-1.5 w-full grow rounded-full bg-muted"><SliderPrimitive.Range className="absolute h-full rounded-full bg-primary" /></SliderPrimitive.Track>
        {value.map((_, i) => <SliderPrimitive.Thumb key={i} className="block h-4 w-4 rounded-full border-2 border-primary bg-surface shadow transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20" />)}
      </SliderPrimitive.Root>
      {format && <div className="flex justify-between text-xs text-muted-foreground"><span>{format(value[0]!)}</span>{value.length > 1 && <span>{format(value[value.length - 1]!)}</span>}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- Chips */
export function ChipGroup({ options, value, onChange, multiple = true, size = 'md' }: { options: { value: string; label: React.ReactNode }[]; value: string[]; onChange: (v: string[]) => void; multiple?: boolean; size?: 'sm' | 'md' }) {
  const toggle = (v: string) => {
    if (multiple) onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
    else onChange(value.includes(v) ? [] : [v]);
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = value.includes(o.value);
        return (
          <button key={o.value} type="button" onClick={() => toggle(o.value)} className={cn('rounded-full border font-medium transition', size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-[13px]', active ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface text-muted-foreground hover:border-foreground/25 hover:text-foreground')}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function SegmentedControl<V extends string>({ options, value, onChange, size = 'md', className }: { options: { value: V; label: React.ReactNode; icon?: React.ReactNode; disabled?: boolean }[]; value: V; onChange: (v: V) => void; size?: 'sm' | 'md'; className?: string }) {
  return (
    <div className={cn('inline-flex rounded-xl border border-border bg-surface-muted p-0.5', className)}>
      {options.map((o) => (
        <button key={o.value} type="button" disabled={o.disabled} onClick={() => onChange(o.value)} className={cn('inline-flex items-center gap-1.5 rounded-[10px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50', size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-[13px]', value === o.value ? 'bg-surface text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
          {o.icon}{o.label}
        </button>
      ))}
    </div>
  );
}

export function TagInput({ value, onChange, placeholder = 'Add and press Enter' }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = React.useState('');
  const commit = () => { const v = draft.trim(); if (v && !value.includes(v)) onChange([...value, v]); setDraft(''); };
  return (
    <div className="input h-auto min-h-10 flex-wrap gap-1.5 py-1.5">
      {value.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-md bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">
          {v}<button type="button" onClick={() => onChange(value.filter((x) => x !== v))} className="rounded hover:bg-primary/10"><X className="h-3 w-3" /></button>
        </span>
      ))}
      <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); } if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1)); }} onBlur={commit} placeholder={value.length ? '' : placeholder} className="min-w-[120px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70" />
    </div>
  );
}
