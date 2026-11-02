import * as React from 'react';
import { Check, Search, Briefcase, ShieldCheck } from 'lucide-react';
import { useBrands, useCampaigns, useScopes } from '@/hooks/queries';
import { useAuth } from '@/store/auth';
import { cn, money } from '@/lib/utils';
import { Label, Input, Textarea, Select, ChipGroup, Hint } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { ToolChip } from '@/components/ui/status';
import type { RoleScope, SessionInput } from '@/types';
import { SCOPE_META, SCOPE_ORDER } from './shared';

export interface SessionFormValue {
  name: string;
  brand_id: string;
  campaign_id: string;
  role_scope: RoleScope;
  allowed_tools: string[];
  budget_ceiling: string;
  rate_ceiling: string;
  model: string;
  instructions: string;
}

export const emptySessionForm = (brandId = ''): SessionFormValue => ({ name: '', brand_id: brandId, campaign_id: '', role_scope: 'CAMPAIGN_MANAGER', allowed_tools: [], budget_ceiling: '5000', rate_ceiling: '1000', model: 'claude-opus-5-5', instructions: '' });

export function toSessionInput(v: SessionFormValue, scopeTools: Record<RoleScope, string[]> | undefined): SessionInput {
  const all = scopeTools?.[v.role_scope] ?? [];
  const tools = v.allowed_tools.length ? v.allowed_tools : all;
  return {
    name: v.name.trim(),
    brand_id: v.brand_id || undefined,
    campaign_id: v.campaign_id || null,
    role_scope: v.role_scope,
    allowed_tools: tools,
    budget_ceiling: Number(v.budget_ceiling) || 0,
    rate_ceiling: Number(v.rate_ceiling) || 0,
    model: v.model.trim() || 'claude-opus-5-5',
    instructions: v.instructions.trim(),
  };
}

export function validateSessionForm(v: SessionFormValue): Record<string, string> {
  const e: Record<string, string> = {};
  if (v.name.trim().length < 2) e.name = 'Give the session a name (at least 2 characters).';
  if (!(Number(v.budget_ceiling) >= 0)) e.budget_ceiling = 'Budget ceiling must be a non-negative number.';
  if (!(Number(v.rate_ceiling) >= 0)) e.rate_ceiling = 'Rate ceiling must be a non-negative number.';
  if (Number(v.rate_ceiling) > Number(v.budget_ceiling) && Number(v.budget_ceiling) > 0) e.rate_ceiling = 'Rate ceiling cannot exceed the budget ceiling.';
  return e;
}

const SCOPE_ICON: Record<RoleScope, React.ElementType> = { DISCOVERY_ONLY: Search, CAMPAIGN_MANAGER: Briefcase, FULL_OPERATOR: ShieldCheck };

/**
 * Shared session policy form: used by the create dialog and the edit sheet.
 * `lockBrand` hides the brand picker (BRAND users and edits).
 */
export function SessionForm({ value, onChange, errors = {}, lockBrand, brandLabel }: { value: SessionFormValue; onChange: (v: SessionFormValue) => void; errors?: Record<string, string>; lockBrand?: boolean; brandLabel?: string | null }) {
  const me = useAuth((s) => s.me);
  const scopes = useScopes();
  const brands = useBrands();
  const campaigns = useCampaigns({});
  const set = <K extends keyof SessionFormValue>(k: K, val: SessionFormValue[K]) => onChange({ ...value, [k]: val });

  const scopeTools = scopes.data?.scopes;
  const toolsForScope = scopeTools?.[value.role_scope] ?? [];
  const activeTools = value.allowed_tools.length ? value.allowed_tools : toolsForScope;
  const brandCampaigns = (campaigns.data ?? []).filter((c) => !value.brand_id || c.brand_id === value.brand_id);
  const threshold = scopes.data?.payment_threshold;

  const chooseScope = (s: RoleScope) => onChange({ ...value, role_scope: s, allowed_tools: [] });

  return (
    <div className="space-y-5">
      <div>
        <Label htmlFor="sess-name" required>Session name</Label>
        <Input id="sess-name" value={value.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Spring launch operator" error={Boolean(errors.name)} />
        {errors.name && <p className="mt-1.5 text-xs text-danger">{errors.name}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Brand</Label>
          {lockBrand || me?.user.role === 'BRAND' ? (
            <div className="input items-center bg-surface-muted text-sm text-muted-foreground">{brandLabel ?? me?.org?.name ?? value.brand_id ?? '—'}</div>
          ) : (
            <Select value={value.brand_id} onValueChange={(v) => onChange({ ...value, brand_id: v, campaign_id: '' })} options={(brands.data ?? []).map((b) => ({ value: b.id, label: b.name, description: b.industry }))} placeholder="Choose a client brand" />
          )}
          <Hint>The agent acts on behalf of this brand.</Hint>
        </div>
        <div>
          <Label>Campaign binding</Label>
          <Select value={value.campaign_id} onValueChange={(v) => set('campaign_id', v)} options={brandCampaigns.map((c) => ({ value: c.id, label: c.title, description: `${c.status.toLowerCase()} · ${money(c.budget)}` }))} allowEmpty="Any campaign of this brand" placeholder="Any campaign of this brand" />
          <Hint>Binding to one campaign blocks actions on any other.</Hint>
        </div>
      </div>

      <div>
        <Label>Permission scope</Label>
        <div className="grid gap-3 sm:grid-cols-3">
          {SCOPE_ORDER.map((s) => {
            const m = SCOPE_META[s];
            const Icon = SCOPE_ICON[s];
            const active = value.role_scope === s;
            const tools = scopeTools?.[s] ?? [];
            return (
              <button key={s} type="button" onClick={() => chooseScope(s)} className={cn('relative flex flex-col rounded-xl border p-3 text-left transition', active ? 'border-primary bg-primary-soft/50 ring-4 ring-primary/10' : 'border-border bg-surface hover:border-foreground/25')}>
                <div className="flex items-center justify-between gap-2">
                  <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', active ? 'bg-primary text-primary-foreground' : 'bg-surface-muted text-muted-foreground')}><Icon className="h-3.5 w-3.5" /></span>
                  {active && <Check className="h-4 w-4 text-primary" />}
                </div>
                <div className="mt-2 text-[13.5px] font-semibold">{m.label}</div>
                <div className="mt-0.5 text-xs leading-snug text-muted-foreground">{m.description}</div>
                <div className="mt-2 text-[11px] font-medium text-muted-foreground">{tools.length} tools</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {tools.slice(0, 5).map((t) => <ToolChip key={t} name={t} className="text-[10px]" />)}
                  {tools.length > 5 && <Badge tone="outline" size="sm">+{tools.length - 5}</Badge>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label hint={`${activeTools.length} of ${toolsForScope.length} enabled`}>Allowed tools</Label>
        <ChipGroup size="sm" options={toolsForScope.map((t) => ({ value: t, label: <span className="font-mono text-[11.5px]">{t}</span> }))} value={activeTools} onChange={(v) => set('allowed_tools', v.length === toolsForScope.length ? [] : v)} />
        <Hint>Toggle individual tools off to narrow the scope further. The server never grants a tool outside the chosen scope.</Hint>
        {activeTools.length === 0 && <p className="mt-1.5 text-xs text-warning">No tools enabled — the server will fall back to the full scope list.</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="sess-budget" required>Budget ceiling (USD)</Label>
          <Input id="sess-budget" type="number" min={0} step={100} value={value.budget_ceiling} onChange={(e) => set('budget_ceiling', e.target.value)} error={Boolean(errors.budget_ceiling)} />
          {errors.budget_ceiling ? <p className="mt-1.5 text-xs text-danger">{errors.budget_ceiling}</p> : <Hint>Hard cap on total spend this session can commit. Exceeding it is a guardrail block.</Hint>}
        </div>
        <div>
          <Label htmlFor="sess-rate" required>Rate ceiling (USD)</Label>
          <Input id="sess-rate" type="number" min={0} step={50} value={value.rate_ceiling} onChange={(e) => set('rate_ceiling', e.target.value)} error={Boolean(errors.rate_ceiling)} />
          {errors.rate_ceiling ? <p className="mt-1.5 text-xs text-danger">{errors.rate_ceiling}</p> : <Hint>Per-collaboration cap; offers above it are held for your approval.{threshold !== undefined && <> Payouts above {money(threshold)} always need approval.</>}</Hint>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="sess-model">Model</Label>
          <Input id="sess-model" value={value.model} onChange={(e) => set('model', e.target.value)} placeholder="claude-opus-5-5" className="font-mono text-[13px]" />
          <Hint>Used when runs execute with Claude; the simulated planner ignores it.</Hint>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="sess-instr">Standing instructions</Label>
          <Textarea id="sess-instr" value={value.instructions} onChange={(e) => set('instructions', e.target.value)} placeholder="e.g. Prioritise US/UK audiences. Never exceed the campaign rate band. Escalate competitor mentions." maxLength={2000} />
          <Hint>Prepended to every run as the agent's operating guidance.</Hint>
        </div>
      </div>
    </div>
  );
}
