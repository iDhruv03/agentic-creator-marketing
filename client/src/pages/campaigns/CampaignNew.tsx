import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, FileEdit, Rocket, Building2, FileText, Wallet, ClipboardCheck } from 'lucide-react';
import { useBrands, useAction } from '@/hooks/queries';
import { useAuth } from '@/store/auth';
import { api } from '@/lib/api';
import { money, fmtDate, platformLabel, cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { KeyValue } from '@/components/ui/data';
import { Callout } from '@/components/ui/feedback';
import { PlatformIcons } from '@/components/ui/status';
import { emptyForm, formToInput, validateStep, BasicsFields, BriefFields, BudgetFields, type CampaignFormState, type FormErrors } from '@/components/campaigns/campaign-form';

const STEPS = [
  { n: 1, label: 'Basics', description: 'Brand, title, platforms, niches', icon: Building2 },
  { n: 2, label: 'Brief', description: 'What creators should make', icon: FileText },
  { n: 3, label: 'Budget & policy', description: 'Spend limits agents respect', icon: Wallet },
  { n: 4, label: 'Review', description: 'Save as draft or activate', icon: ClipboardCheck },
] as const;

export default function CampaignNew() {
  const navigate = useNavigate();
  const me = useAuth((s) => s.me);
  const isBrand = me?.user.role === 'BRAND';
  const brands = useBrands();
  const [step, setStep] = React.useState<1 | 2 | 3 | 4>(1);
  const [form, setForm] = React.useState<CampaignFormState>(() => emptyForm(isBrand ? me?.user.brand_id ?? '' : ''));
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [furthest, setFurthest] = React.useState(1);

  React.useEffect(() => { if (isBrand && me?.user.brand_id && !form.brand_id) setForm((f) => ({ ...f, brand_id: me.user.brand_id! })); }, [isBrand, me, form.brand_id]);

  const set = React.useCallback(<K extends keyof CampaignFormState>(k: K, v: CampaignFormState[K]) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e)); }, []);

  const brandName = isBrand ? me?.org?.name : (brands.data ?? []).find((b) => b.id === form.brand_id)?.name;

  const next = () => {
    if (step === 4) return;
    const e = validateStep(step, form);
    setErrors(e);
    if (Object.keys(e).length) return;
    const n = (step + 1) as 1 | 2 | 3 | 4;
    setStep(n); setFurthest((f) => Math.max(f, n));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const goTo = (n: 1 | 2 | 3 | 4) => { if (n <= furthest) { setStep(n); setErrors({}); } };

  const create = useAction(api.campaigns.create, {
    invalidate: ['campaigns', 'overview', 'brands', 'ledger', 'audit'],
    success: (c) => (c.status === 'ACTIVE' ? `"${c.title}" is live` : `"${c.title}" saved as draft`),
    onSuccess: (c) => navigate(`/campaigns/${c.id}`),
  });

  const allErrors = { ...validateStep(1, form), ...validateStep(2, form), ...validateStep(3, form) };
  const canSubmit = Object.keys(allErrors).length === 0;
  const submit = (status: 'DRAFT' | 'ACTIVE') => { if (!canSubmit) { setErrors(allErrors); return; } create.mutate([{ ...formToInput(form), status }]); };
  const submitting = (s: 'DRAFT' | 'ACTIVE') => create.isPending && create.variables?.[0]?.status === s;

  const budget = Number(form.budget) || 0;
  const bandMin = form.rate_band_min === '' ? null : Number(form.rate_band_min);
  const bandMax = form.rate_band_max === '' ? null : Number(form.rate_band_max);

  return (
    <div className="page">
      <PageHeader crumbs={[{ label: 'Campaigns', to: '/campaigns' }, { label: 'New campaign' }]} title="New campaign" description="Set up the brief and the spending policy. Agents can only source and negotiate inside the limits you define here." />

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Stepper */}
        <ol className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-1">
          {STEPS.map((s) => {
            const state = s.n === step ? 'current' : s.n < furthest || (s.n < step) ? 'done' : s.n <= furthest ? 'reachable' : 'locked';
            const Icon = s.icon;
            return (
              <li key={s.n} className="shrink-0">
                <button type="button" disabled={state === 'locked'} onClick={() => goTo(s.n)} className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition', state === 'current' ? 'bg-primary-soft text-primary' : state === 'locked' ? 'cursor-not-allowed opacity-50' : 'hover:bg-accent/50')}>
                  <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold', state === 'current' ? 'border-primary bg-primary text-primary-foreground' : state === 'done' ? 'border-success bg-success-soft text-success' : 'border-border bg-surface text-muted-foreground')}>{state === 'done' ? <Check className="h-4 w-4" /> : s.n}</span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-[13.5px] font-medium"><Icon className="h-3.5 w-3.5 opacity-70" />{s.label}</span>
                    <span className="hidden text-xs text-muted-foreground lg:block">{s.description}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        {/* Step body */}
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader title={`Step ${step} of 4 · ${STEPS[step - 1]!.label}`} description={step === 1 ? 'Who the campaign is for and where it runs.' : step === 2 ? 'Everything a creator (or an agent pitching a creator) needs to know.' : step === 3 ? 'Hard limits: the budget is allocated to a ledger; the rate band gates agent offers.' : 'Check the summary, then save as a draft or go live.'} />
            {step === 1 && <BasicsFields form={form} set={set} errors={errors} lockedBrandName={isBrand ? brandName : undefined} brandOptions={(brands.data ?? []).map((b) => ({ value: b.id, label: b.name, description: b.industry }))} />}
            {step === 2 && <BriefFields form={form} set={set} errors={errors} />}
            {step === 3 && <BudgetFields form={form} set={set} errors={errors} />}
            {step === 4 && (
              <div className="space-y-5">
                {!canSubmit && <Callout tone="danger" title="Some required fields are missing">{Object.values(allErrors).filter(Boolean).join(' ')}</Callout>}
                <div className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div><div className="text-base font-semibold">{form.title || 'Untitled campaign'}</div><div className="text-[13px] text-muted-foreground">{brandName ?? '—'}</div></div>
                    <PlatformIcons platforms={form.target_platforms} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">{form.target_niches.map((n) => <Badge key={n} tone="outline" size="sm">{n}</Badge>)}</div>
                </div>
                <KeyValue columns={3} items={[
                  { label: 'Budget', value: <span className="font-semibold tabular-nums">{money(budget)}</span> },
                  { label: 'Rate band', value: bandMax == null ? 'No band (session ceilings only)' : `${money(bandMin ?? 0)} – ${money(bandMax)}` },
                  { label: 'Dates', value: form.start_date || form.end_date ? `${fmtDate(form.start_date)} → ${fmtDate(form.end_date)}` : 'Not set' },
                  { label: 'Platforms', value: form.target_platforms.map(platformLabel).join(', ') || '—' },
                  { label: 'Deliverables', value: form.required_deliverables.join(', ') || '—' },
                  { label: 'Audience', value: form.target_audience || '—' },
                ]} />
                <div className="grid gap-4 md:grid-cols-2">
                  <div><div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Brief</div><p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed">{form.brief || '—'}</p></div>
                  <div><div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Objectives</div><p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed">{form.objectives || '—'}</p></div>
                  <div className="md:col-span-2"><div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Content guidelines</div><p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed">{form.content_guidelines || '—'}</p></div>
                </div>
                <Callout tone="neutral" title="What happens on create">
                  {money(budget)} is allocated to the campaign ledger as a <strong>BUDGET_ALLOCATION</strong> entry and the action is written to the audit trail. A draft is invisible to agents; an active campaign can be bound to agent sessions immediately.
                </Callout>
              </div>
            )}
          </Card>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>{step > 1 && <Button variant="ghost" leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => goTo((step - 1) as 1 | 2 | 3 | 4)}>Back</Button>}</div>
            <div className="flex flex-wrap justify-end gap-2">
              {step < 4 ? (
                <>
                  <Button variant="ghost" onClick={() => navigate('/campaigns')}>Cancel</Button>
                  <Button rightIcon={<ArrowRight className="h-4 w-4" />} onClick={next}>Continue</Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" leftIcon={<FileEdit className="h-4 w-4" />} loading={submitting('DRAFT')} disabled={create.isPending} onClick={() => submit('DRAFT')}>Save as draft</Button>
                  <Button variant="success" leftIcon={<Rocket className="h-4 w-4" />} loading={submitting('ACTIVE')} disabled={create.isPending} onClick={() => submit('ACTIVE')}>Create & activate</Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
