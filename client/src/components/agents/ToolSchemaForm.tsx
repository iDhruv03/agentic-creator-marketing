import * as React from 'react';
import { Label, Input, Textarea, Select, Switch, TagInput, Hint } from '@/components/ui/field';

export interface SchemaProperty { type?: string; description?: string; enum?: string[]; items?: { type?: string; enum?: string[] }; minimum?: number; maximum?: number; nullable?: boolean; properties?: Record<string, SchemaProperty> }
export interface JsonSchemaObject { type?: string; properties?: Record<string, SchemaProperty>; required?: string[] }

export const schemaProps = (schema: JsonSchemaObject | undefined | null): [string, SchemaProperty][] => Object.entries(schema?.properties ?? {});

/** Turn the form's raw values into tool params: drop blanks, coerce numbers, parse JSON for objects. */
export function buildParams(schema: JsonSchemaObject | undefined, values: Record<string, unknown>): { params: Record<string, unknown>; errors: Record<string, string> } {
  const params: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  for (const [key, prop] of schemaProps(schema)) {
    const v = values[key];
    const required = schema?.required?.includes(key);
    const t = prop.type;
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) {
      if (required && t !== 'boolean') errors[key] = 'Required';
      else if (t === 'boolean' && typeof v === 'boolean') params[key] = v;
      continue;
    }
    if (t === 'number' || t === 'integer') {
      const n = Number(v);
      if (Number.isNaN(n)) { errors[key] = 'Must be a number'; continue; }
      if (t === 'integer' && !Number.isInteger(n)) { errors[key] = 'Must be an integer'; continue; }
      params[key] = n;
    } else if (t === 'boolean') params[key] = Boolean(v);
    else if (t === 'array') params[key] = Array.isArray(v) ? v : String(v).split(',').map((s) => s.trim()).filter(Boolean);
    else if (t === 'object' || (!t && typeof v === 'string' && v.trim().startsWith('{'))) {
      try { params[key] = typeof v === 'string' ? JSON.parse(v) : v; } catch { errors[key] = 'Invalid JSON'; }
    } else params[key] = v;
  }
  return { params, errors };
}

export function ToolSchemaForm({ schema, values, onChange, errors = {} }: { schema: JsonSchemaObject | undefined; values: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void; errors?: Record<string, string> }) {
  const props = schemaProps(schema);
  const set = (k: string, v: unknown) => onChange({ ...values, [k]: v });
  if (props.length === 0) return <p className="text-[13px] text-muted-foreground">This tool takes no parameters.</p>;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {props.map(([key, prop]) => {
        const required = schema?.required?.includes(key);
        const t = prop.type;
        const id = `tp-${key}`;
        const err = errors[key];
        const wide = t === 'object' || t === 'array' || (t === 'string' && /brief|guideline|rationale|details|terms|message|caption|reason|objectives/.test(key));
        let control: React.ReactNode;
        if (t === 'boolean') {
          control = <div className="input h-auto items-center py-2"><Switch checked={Boolean(values[key])} onCheckedChange={(v) => set(key, v)} label={<span className="text-[13px] font-normal">{values[key] ? 'true' : 'false'}</span>} /></div>;
        } else if (prop.enum) {
          control = <Select value={typeof values[key] === 'string' ? (values[key] as string) : ''} onValueChange={(v) => set(key, v)} options={prop.enum.map((e) => ({ value: e, label: e }))} allowEmpty={required ? undefined : '(not set)'} placeholder="Choose…" />;
        } else if (t === 'number' || t === 'integer') {
          control = <Input id={id} type="number" value={typeof values[key] === 'number' || typeof values[key] === 'string' ? (values[key] as string | number) : ''} onChange={(e) => set(key, e.target.value)} min={prop.minimum} max={prop.maximum} step={t === 'integer' ? 1 : 'any'} error={Boolean(err)} placeholder={t} />;
        } else if (t === 'array' && (!prop.items?.type || prop.items.type === 'string')) {
          control = <TagInput value={Array.isArray(values[key]) ? (values[key] as string[]) : []} onChange={(v) => set(key, v)} placeholder={prop.items?.enum ? `One of ${prop.items.enum.join(', ')}` : 'Add value and press Enter'} />;
        } else if (t === 'object' || t === 'array') {
          control = <Textarea id={id} value={typeof values[key] === 'string' ? (values[key] as string) : values[key] ? JSON.stringify(values[key], null, 2) : ''} onChange={(e) => set(key, e.target.value)} placeholder={t === 'array' ? '[ … ]' : '{ "key": "value" }'} className="min-h-[72px] font-mono text-[12.5px]" error={Boolean(err)} />;
        } else if (wide) {
          control = <Textarea id={id} value={typeof values[key] === 'string' ? (values[key] as string) : ''} onChange={(e) => set(key, e.target.value)} className="min-h-[72px]" error={Boolean(err)} />;
        } else {
          control = <Input id={id} value={typeof values[key] === 'string' ? (values[key] as string) : ''} onChange={(e) => set(key, e.target.value)} error={Boolean(err)} placeholder={prop.type ?? 'string'} />;
        }
        return (
          <div key={key} className={wide ? 'sm:col-span-2' : ''}>
            <Label htmlFor={id} required={required} hint={<span className="font-mono">{t ?? 'any'}</span>}><span className="font-mono text-[12.5px]">{key}</span></Label>
            {control}
            {err ? <p className="mt-1.5 text-xs text-danger">{err}</p> : prop.description ? <Hint>{prop.description}</Hint> : null}
          </div>
        );
      })}
    </div>
  );
}
