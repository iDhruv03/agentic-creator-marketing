import * as React from 'react';
import { Lock, Hash, AtSign, Ticket } from 'lucide-react';
import type { Campaign, CampaignInput } from '@/types';
import { useNiches } from '@/hooks/queries';
import { money, platformLabel } from '@/lib/utils';
import { Label, Input, Textarea, Select, ChipGroup, TagInput, Slider, FieldError, Hint } from '@/components/ui/field';
import { Callout } from '@/components/ui/feedback';
import { PlatformIcon } from '@/components/ui/status';

export interface CampaignFormState {
  brand_id: string; title: string; target_platforms: string[]; target_niches: string[]; start_date: string; end_date: string;
  brief: string; objectives: string; target_audience: string; content_guidelines: string; required_deliverables: string[];
  budget: string; rate_band_min: string; rate_band_max: string;
}

export const PLATFORMS = ['instagram', 'youtube', 'tiktok'];
export const DELIVERABLE_SUGGESTIONS = ['1x YouTube Video', '1x Instagram Reel', '2x TikTok Video', '4x Instagram Story', '1x Instagram Post', '2x YouTube Short'];
export const RATE_BAND_MAX = 10000;

export function emptyForm(brandId = ''): CampaignFormState {
  return { brand_id: brandId, title: '', target_platforms: [], target_niches: [], start_date: '', end_date: '', brief: '', objectives: '', target_audience: '', content_guidelines: '', required_deliverables: [], budget: '', rate_band_min: '', rate_band_max: '' };
}

export function formFromCampaign(c: Campaign): CampaignFormState {
  return {
    brand_id: c.brand_id, title: c.title, target_platforms: c.target_platforms ?? [], target_niches: c.target_niches ?? [], start_date: c.start_date?.slice(0, 10) ?? '', end_date: c.end_date?.slice(0, 10) ?? '',
    brief: c.brief ?? '', objectives: c.objectives ?? '', target_audience: c.target_audience ?? '', content_guidelines: c.content_guidelines ?? '', required_deliverables: c.required_deliverables ?? [],
    budget: String(c.budget ?? ''), rate_band_min: c.rate_band_min == null ? '' : String(c.rate_band_min), rate_band_max: c.rate_band_max == null ? '' : String(c.rate_band_max),
  };
}

export function formToInput(f: CampaignFormState): Omit<CampaignInput, 'status'> {
  return {
    brand_id: f.brand_id, title: f.title.trim(), brief: f.brief.trim(), objectives: f.objectives.trim(), target_niches: f.target_niches, target_platforms: f.target_platforms, target_audience: f.target_audience.trim(),
    content_guidelines: f.content_guidelines.trim(), required_deliverables: f.required_deliverables, budget: Number(f.budget) || 0,
    rate_band_min: f.rate_band_min === '' ? null : Number(f.rate_band_min), rate_band_max: f.rate_band_max === '' ? null : Number(f.rate_band_max),
    start_date: f.start_date || null, end_date: f.end_date || null,
  };
}

export type FormErrors = Partial<Record<keyof CampaignFormState, string>>;

export function validateStep(step: 1 | 2 | 3, f: CampaignFormState): FormErrors {
  const e: FormErrors = {};
  if (step === 1) {
    if (!f.brand_id) e.brand_id = 'Choose the brand this campaign belongs to.';
    if (f.title.trim().length < 2) e.title = 'Give the campaign a title (at least 2 characters).';
    if (f.title.trim().length > 120) e.title = 'Keep the title under 120 characters.';
    if (!f.target_platforms.length) e.target_platforms = 'Pick at least one platform.';
    if (!f.target_niches.length) e.target_niches = 'Pick at least one niche — matching and agent discovery depend on it.';
    if (f.start_date && f.end_date && f.end_date < f.start_date) e.end_date = 'End date must be after the start date.';
  }
  if (step === 2) {
    if (f.brief.trim().length < 20) e.brief = 'Write a brief of at least 20 characters — creators and agents read this.';
    if (!f.content_guidelines.trim()) e.content_guidelines = 'Add guidelines — the compliance checker enforces the hashtags, handles and codes you list here.';
    if (!f.required_deliverables.length) e.required_deliverables = 'List at least one deliverable.';
  }
  if (step === 3) {
    const budget = Number(f.budget);
    if (!(budget > 0)) e.budget = 'Enter a budget above $0.';
    const min = f.rate_band_min === '' ? null : Number(f.rate_band_min);
    const max = f.rate_band_max === '' ? null : Number(f.rate_band_max);
    if (max != null && !(max > 0)) e.rate_band_max = 'The band ceiling must be above $0.';
    if (min != null && max != null && min > max) e.rate_band_min = 'Minimum cannot exceed the maximum.';
    if (max != null && budget > 0 && max > budget) e.rate_band_max = 'A single rate above the whole budget makes no sense.';
  }
  return e;
}

type FieldsProps = { form: CampaignFormState; set: <K extends keyof CampaignFormState>(k: K, v: CampaignFormState[K]) => void; errors: FormErrors };

export function BasicsFields({ form, set, errors, brandOptions, lockedBrandName }: FieldsProps & { brandOptions?: { value: string; label: string; description?: string }[]; lockedBrandName?: string | null }) {
  const niches = useNiches();
  return (
    <div className="space-y-5">
      <div>
        <Label required>Brand</Label>
        {lockedBrandName ? (
          <div className="input items-center gap-2 bg-surface-muted/60 text-foreground/80"><Lock className="h-3.5 w-3.5 text-muted-foreground" />{lockedBrandName}</div>
        ) : (
          <Select value={form.brand_id} onValueChange={(v) => set('brand_id', v)} placeholder="Choose a client brand" options={brandOptions ?? []} />
        )}
        <FieldError>{errors.brand_id}</FieldError>
      </div>
      <div>
        <Label required>Campaign title</Label>
        <Input value={form.title} error={Boolean(errors.title)} onChange={(e) => set('title', e.target.value)} placeholder="e.g. PulseBuds Pro Launch" maxLength={120} />
        <FieldError>{errors.title}</FieldError>
      </div>
      <div>
        <Label required>Target platforms</Label>
        <ChipGroup options={PLATFORMS.map((p) => ({ value: p, label: <span className="inline-flex items-center gap-1.5"><PlatformIcon platform={p} className="h-4 w-4 text-[9px]" />{platformLabel(p)}</span> }))} value={form.target_platforms} onChange={(v) => set('target_platforms', v)} />
        <FieldError>{errors.target_platforms}</FieldError>
      </div>
      <div>
        <Label required hint={niches.isLoading ? 'Loading…' : `${form.target_niches.length} selected`}>Target niches</Label>
        <ChipGroup size="sm" options={(niches.data ?? []).map((n) => ({ value: n, label: n }))} value={form.target_niches} onChange={(v) => set('target_niches', v)} />
        <FieldError>{errors.target_niches}</FieldError>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Start date</Label>
          <Input type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} />
        </div>
        <div>
          <Label>End date</Label>
          <Input type="date" value={form.end_date} error={Boolean(errors.end_date)} min={form.start_date || undefined} onChange={(e) => set('end_date', e.target.value)} />
          <FieldError>{errors.end_date}</FieldError>
        </div>
      </div>
    </div>
  );
}

export function BriefFields({ form, set, errors }: FieldsProps) {
  return (
    <div className="space-y-5">
      <div>
        <Label required>Brief</Label>
        <Textarea value={form.brief} error={Boolean(errors.brief)} onChange={(e) => set('brief', e.target.value)} rows={5} placeholder="What is the product, who is it for, and what should creators show? Be concrete — agents use this to pick and pitch creators." />
        <FieldError>{errors.brief}</FieldError>
      </div>
      <div>
        <Label>Objectives</Label>
        <Textarea value={form.objectives} onChange={(e) => set('objectives', e.target.value)} rows={3} placeholder="e.g. 4,000 pre-orders in 30 days; ≥4.5% engagement; ≥1.5% click-through on tracked links." />
      </div>
      <div>
        <Label>Target audience</Label>
        <Textarea value={form.target_audience} onChange={(e) => set('target_audience', e.target.value)} rows={2} placeholder="e.g. 22–38, urban commuters in the US, UK and Canada who already own premium headphones." />
        <Hint>Naming countries here improves audience-fit scoring for creators whose top market matches.</Hint>
      </div>
      <div>
        <Label required>Content guidelines</Label>
        <Textarea value={form.content_guidelines} error={Boolean(errors.content_guidelines)} onChange={(e) => set('content_guidelines', e.target.value)} rows={4} placeholder="Disclose with #ad in the first line. Tag @yourbrand and use #YourHashtag. Mention the code SAVE20 within the first 3 lines. No competitor comparisons." />
        <FieldError>{errors.content_guidelines}</FieldError>
        <Callout tone="info" className="mt-2" title="The compliance checker reads this text">
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1"><Hash className="h-3.5 w-3.5" />#hashtags</span>
            <span className="inline-flex items-center gap-1"><AtSign className="h-3.5 w-3.5" />@handles</span>
            <span className="inline-flex items-center gap-1"><Ticket className="h-3.5 w-3.5" />discount codes</span>
            you mention here are enforced on every submitted caption, and disclosure (#ad) is always required.
          </span>
        </Callout>
      </div>
      <div>
        <Label required hint="Enter or comma to add">Required deliverables</Label>
        <TagInput value={form.required_deliverables} onChange={(v) => set('required_deliverables', v)} placeholder="e.g. 1x YouTube Video" />
        <FieldError>{errors.required_deliverables}</FieldError>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {DELIVERABLE_SUGGESTIONS.filter((s) => !form.required_deliverables.includes(s)).map((s) => (
            <button key={s} type="button" onClick={() => set('required_deliverables', [...form.required_deliverables, s])} className="rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary">+ {s}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function BudgetFields({ form, set, errors }: FieldsProps) {
  const min = form.rate_band_min === '' ? 0 : Number(form.rate_band_min);
  const max = form.rate_band_max === '' ? RATE_BAND_MAX : Number(form.rate_band_max);
  const hasBand = form.rate_band_max !== '';
  return (
    <div className="space-y-6">
      <div>
        <Label required>Total budget (USD)</Label>
        <Input type="number" min={0} step={500} value={form.budget} error={Boolean(errors.budget)} onChange={(e) => set('budget', e.target.value)} leftIcon={<span className="text-sm">$</span>} placeholder="25000" />
        <FieldError>{errors.budget}</FieldError>
        <Hint>Allocated to the campaign ledger on creation. Offers lock escrow against it; payouts move escrow to creator wallets.</Hint>
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label className="mb-0">Per-collaboration rate band</Label>
          {hasBand ? <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => { set('rate_band_min', ''); set('rate_band_max', ''); }}>Clear band</button> : <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => { set('rate_band_min', '500'); set('rate_band_max', '2000'); }}>Set a band</button>}
        </div>
        <div className="mt-3 rounded-xl border border-border bg-surface-muted/40 p-4">
          <Slider min={0} max={RATE_BAND_MAX} step={50} value={[Math.min(min, max), max]} onValueChange={([a, b]) => { set('rate_band_min', String(a ?? 0)); set('rate_band_max', String(b ?? RATE_BAND_MAX)); }} format={(v) => money(v)} />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Minimum</Label>
              <Input type="number" min={0} step={50} value={form.rate_band_min} error={Boolean(errors.rate_band_min)} onChange={(e) => set('rate_band_min', e.target.value)} leftIcon={<span className="text-sm">$</span>} placeholder="0" />
              <FieldError>{errors.rate_band_min}</FieldError>
            </div>
            <div>
              <Label>Maximum</Label>
              <Input type="number" min={0} step={50} value={form.rate_band_max} error={Boolean(errors.rate_band_max)} onChange={(e) => set('rate_band_max', e.target.value)} leftIcon={<span className="text-sm">$</span>} placeholder="No ceiling" />
              <FieldError>{errors.rate_band_max}</FieldError>
            </div>
          </div>
        </div>
        <Callout tone="agent" className="mt-3" title="How agents use the band">
          Offers inside {hasBand ? `${money(min)}–${money(max)}` : 'the band'} go through autonomously (within the session's rate ceiling). Anything above the maximum raises an <strong>out-of-band rate checkpoint</strong> that a human must approve before the offer is sent — nothing is written until then. Without a band, only the session ceilings apply.
        </Callout>
      </div>
    </div>
  );
}
