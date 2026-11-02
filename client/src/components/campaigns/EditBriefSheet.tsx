import * as React from 'react';
import { Save } from 'lucide-react';
import type { Campaign } from '@/types';
import { useAction } from '@/hooks/queries';
import { api } from '@/lib/api';
import { money } from '@/lib/utils';
import { Sheet } from '@/components/ui/overlay';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, PillTabsList, PillTabsTrigger } from '@/components/ui/tabs';
import { Callout } from '@/components/ui/feedback';
import { formFromCampaign, formToInput, validateStep, BasicsFields, BriefFields, BudgetFields, type CampaignFormState, type FormErrors } from '@/components/campaigns/campaign-form';

export function EditBriefSheet({ campaign, open, onOpenChange, initialTab = 'brief' }: { campaign: Campaign; open: boolean; onOpenChange: (o: boolean) => void; initialTab?: 'basics' | 'brief' | 'budget' }) {
  const [form, setForm] = React.useState<CampaignFormState>(() => formFromCampaign(campaign));
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [tab, setTab] = React.useState<string>(initialTab);

  // Reset from the latest campaign only when the sheet opens — live refetches must not wipe in-progress edits.
  const latest = React.useRef(campaign);
  latest.current = campaign;
  React.useEffect(() => { if (open) { setForm(formFromCampaign(latest.current)); setErrors({}); setTab(initialTab); } }, [open, initialTab]);

  const set = React.useCallback(<K extends keyof CampaignFormState>(k: K, v: CampaignFormState[K]) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e)); }, []);

  const save = useAction((patch: Parameters<typeof api.campaigns.update>[1]) => api.campaigns.update(campaign.id, patch), {
    invalidate: ['campaign', 'campaigns', 'campaign-analytics', 'audit', 'creators'],
    success: 'Campaign updated',
    onSuccess: () => onOpenChange(false),
  });

  const hasAccepted = (campaign.collaborations ?? []).some((c) => ['ACCEPTED', 'IN_PROGRESS', 'SUBMITTED'].includes(c.status));

  const submit = () => {
    const e = { ...validateStep(1, form), ...validateStep(2, form), ...validateStep(3, form) };
    setErrors(e);
    if (Object.keys(e).length) { setTab(e.brand_id || e.title || e.target_platforms || e.target_niches || e.end_date ? 'basics' : e.brief || e.content_guidelines || e.required_deliverables ? 'brief' : 'budget'); return; }
    const { brand_id: _brand, ...patch } = formToInput(form);
    save.mutate([patch]);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} width="lg" title={`Edit ${campaign.title}`} description="Changes apply immediately and are written to the audit trail."
      footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button leftIcon={<Save className="h-4 w-4" />} loading={save.isPending} onClick={submit}>Save changes</Button></>}
    >
      <div className="space-y-4 px-6 py-5">
        {hasAccepted && <Callout tone="warning" title="Creators have already accepted">Changing the brief or guidelines after acceptance is the same event agents raise a brief-modification checkpoint for — let affected creators know.</Callout>}
        <Tabs value={tab} onValueChange={setTab}>
          <PillTabsList>
            <PillTabsTrigger value="basics">Basics</PillTabsTrigger>
            <PillTabsTrigger value="brief">Brief</PillTabsTrigger>
            <PillTabsTrigger value="budget">Budget & band</PillTabsTrigger>
          </PillTabsList>
          <TabsContent value="basics" className="mt-4"><BasicsFields form={form} set={set} errors={errors} lockedBrandName={campaign.brand_name ?? 'Brand'} /></TabsContent>
          <TabsContent value="brief" className="mt-4"><BriefFields form={form} set={set} errors={errors} /></TabsContent>
          <TabsContent value="budget" className="mt-4">
            {campaign.financials.committed > 0 && <Callout tone="info" className="mb-4">Budget cannot drop below the {money(campaign.financials.committed)} already committed (escrow + paid). The difference is posted as a budget adjustment in the ledger.</Callout>}
            <BudgetFields form={form} set={set} errors={errors} />
          </TabsContent>
        </Tabs>
      </div>
    </Sheet>
  );
}
