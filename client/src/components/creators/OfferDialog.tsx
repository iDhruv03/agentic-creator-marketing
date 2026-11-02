import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Lock, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { Creator, Campaign } from '@/types';
import { useCampaigns, useAction } from '@/hooks/queries';
import { api } from '@/lib/api';
import { money, deliverableLabel, fmtDate } from '@/lib/utils';
import { Dialog } from '@/components/ui/overlay';
import { Button } from '@/components/ui/button';
import { Label, Input, Textarea, Select, ChipGroup, FieldError, Hint } from '@/components/ui/field';
import { Avatar } from '@/components/ui/avatar';
import { Callout } from '@/components/ui/feedback';
import { CampaignStatusBadge, PlatformIcons } from '@/components/ui/status';

/** Deliverable type → platform the creator must be on. */
export const DELIVERABLE_PLATFORM: Record<string, string> = { POST: 'instagram', REEL: 'instagram', STORY: 'instagram', YOUTUBE_VIDEO: 'youtube', YOUTUBE_SHORT: 'youtube', TIKTOK_VIDEO: 'tiktok' };
export const DELIVERABLE_TYPES = Object.keys(DELIVERABLE_PLATFORM);

/** Rate-card lookup per deliverable type. */
export function rateForDeliverable(c: Creator, type: string): number {
  switch (type) {
    case 'POST': return c.rate_post;
    case 'STORY': return c.rate_story;
    case 'YOUTUBE_VIDEO': return c.rate_video;
    default: return c.rate_reel; // REEL, YOUTUBE_SHORT, TIKTOK_VIDEO
  }
}

const USAGE_OPTIONS = [
  { value: 'Organic only, 90 days', label: 'Organic only · 90 days' },
  { value: 'Organic + paid amplification, 90 days', label: 'Organic + paid amplification · 90 days' },
  { value: 'Organic + paid amplification, 12 months', label: 'Organic + paid amplification · 12 months' },
  { value: 'Perpetual, all channels', label: 'Perpetual · all channels' },
];

function defaultDeadline(campaign: Campaign | undefined): string {
  if (campaign?.end_date) return campaign.end_date.slice(0, 10);
  const d = new Date(); d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

function buildTerms(creator: Creator, campaign: Campaign | undefined, deliverables: string[], deadline: string): string {
  const list = deliverables.map((d) => `1× ${deliverableLabel(d)}`).join(', ') || 'the agreed deliverables';
  return `@${creator.handle} produces ${list} for "${campaign?.title ?? 'the campaign'}", delivered by ${deadline ? fmtDate(deadline) : 'the agreed deadline'}. Content follows the campaign guidelines (disclosure, tags, mandatory mentions) and is submitted through CMI for compliance review. Payment is held in escrow on acceptance and released to the creator wallet when each deliverable is approved.`;
}

export function OfferDialog({ creator, defaultCampaignId, open, onOpenChange }: { creator: Creator; defaultCampaignId?: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const campaigns = useCampaigns({});
  const eligible = React.useMemo(() => (campaigns.data ?? []).filter((c) => ['ACTIVE', 'DRAFT', 'PAUSED'].includes(c.status)), [campaigns.data]);

  const [campaignId, setCampaignId] = React.useState(defaultCampaignId ?? '');
  const [deliverables, setDeliverables] = React.useState<string[]>([]);
  const [rate, setRate] = React.useState('');
  const [rateTouched, setRateTouched] = React.useState(false);
  const [deadline, setDeadline] = React.useState('');
  const [terms, setTerms] = React.useState('');
  const [termsTouched, setTermsTouched] = React.useState(false);
  const [usage, setUsage] = React.useState(USAGE_OPTIONS[0]!.value);
  const [exclusivity, setExclusivity] = React.useState('30');
  const [message, setMessage] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const campaign = eligible.find((c) => c.id === campaignId);
  const available = React.useMemo(() => DELIVERABLE_TYPES.filter((t) => creator.platforms.includes(DELIVERABLE_PLATFORM[t]!)), [creator.platforms]);

  // Reset when (re)opened
  React.useEffect(() => {
    if (!open) return;
    const cid = defaultCampaignId ?? (eligible.length === 1 ? eligible[0]!.id : '');
    setCampaignId(cid);
    const c = eligible.find((x) => x.id === cid);
    const initial = available.filter((t) => (c?.target_platforms?.length ? c.target_platforms.includes(DELIVERABLE_PLATFORM[t]!) : true)).slice(0, 1);
    setDeliverables(initial);
    setRateTouched(false); setTermsTouched(false);
    setDeadline(defaultDeadline(c));
    setMessage(`Hi ${creator.name.split(' ')[0]} — we'd love to have you on board for ${c?.title ?? 'our upcoming campaign'}. The brief and guidelines are attached; happy to talk through the deliverables.`);
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultCampaignId, eligible.length]);

  // Prefill rate from the rate card unless the user edited it
  const suggested = React.useMemo(() => deliverables.reduce((sum, d) => sum + rateForDeliverable(creator, d), 0), [deliverables, creator]);
  React.useEffect(() => { if (!rateTouched) setRate(suggested ? String(suggested) : ''); }, [suggested, rateTouched]);
  React.useEffect(() => { if (!termsTouched) setTerms(buildTerms(creator, campaign, deliverables, deadline)); }, [creator, campaign, deliverables, deadline, termsTouched]);
  React.useEffect(() => { if (campaign) setDeadline((d) => d || defaultDeadline(campaign)); }, [campaign]);

  const rateNum = Number(rate) || 0;
  const bandMin = campaign?.rate_band_min ?? null;
  const bandMax = campaign?.rate_band_max ?? null;
  const inBand = bandMax == null ? null : rateNum <= bandMax && (bandMin == null || rateNum >= bandMin);
  const exceedsAvailable = campaign ? rateNum > campaign.financials.available : false;

  const send = useAction(api.collaborations.offer, {
    invalidate: ['collaborations', 'campaign', 'campaigns', 'ledger', 'creator', 'overview', 'audit'],
    success: (r) => `Offer of ${money(r.proposed_rate)} sent to @${r.creator_handle ?? creator.handle}`,
    onSuccess: (r) => { onOpenChange(false); navigate(`/collaborations/${r.id}`); },
  });

  const submit = () => {
    const e: Record<string, string> = {};
    if (!campaignId) e.campaign = 'Pick the campaign this offer belongs to.';
    if (!deliverables.length) e.deliverables = 'Select at least one deliverable.';
    if (!(rateNum > 0)) e.rate = 'Enter a proposed rate above $0.';
    if (exceedsAvailable) e.rate = `Only ${money(campaign!.financials.available)} is available in this campaign budget.`;
    setErrors(e);
    if (Object.keys(e).length) return;
    send.mutate([{ campaign_id: campaignId, creator_id: creator.id, proposed_rate: rateNum, deliverables, deadline: deadline || null, terms, usage_rights: usage, exclusivity_days: Number(exclusivity) || 0, message: message.trim() || undefined }]);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={<span className="flex items-center gap-2.5"><Avatar name={creator.name} src={creator.avatar_url} size="sm" />Send an offer to {creator.name}</span>}
      description={<span>@{creator.handle} · {creator.primary_niche} · <PlatformIcons platforms={creator.platforms} className="align-middle" /></span>}
      footer={<>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button leftIcon={<Send className="h-4 w-4" />} loading={send.isPending} onClick={submit}>Send offer{rateNum > 0 ? ` · ${money(rateNum)}` : ''}</Button>
      </>}
    >
      <div className="space-y-5">
        <div>
          <Label required>Campaign</Label>
          <Select value={campaignId} onValueChange={(v) => { setCampaignId(v); setErrors((e) => ({ ...e, campaign: '' })); }} placeholder={campaigns.isLoading ? 'Loading campaigns…' : 'Choose a campaign'} options={eligible.map((c) => ({ value: c.id, label: <span className="flex items-center gap-2">{c.title}<CampaignStatusBadge status={c.status} size="sm" /></span>, description: `${c.brand_name ?? ''} · ${money(c.financials.available)} available` }))} />
          <FieldError>{errors.campaign}</FieldError>
          {!campaigns.isLoading && eligible.length === 0 && <Hint>No open campaigns. Create one first, then come back to send offers.</Hint>}
        </div>

        <div>
          <Label required hint={`Only formats ${creator.name.split(' ')[0]} publishes`}>Deliverables</Label>
          <ChipGroup options={available.map((t) => ({ value: t, label: `${deliverableLabel(t)} · ${money(rateForDeliverable(creator, t))}` }))} value={deliverables} onChange={(v) => { setDeliverables(v); setErrors((e) => ({ ...e, deliverables: '' })); }} />
          <FieldError>{errors.deliverables}</FieldError>
          {campaign && campaign.required_deliverables.length > 0 && <Hint>Brief asks for: {campaign.required_deliverables.join(', ')}</Hint>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label required hint={suggested ? `Rate card: ${money(suggested)}` : undefined}>Proposed rate (USD)</Label>
            <Input type="number" min={0} step={50} value={rate} error={Boolean(errors.rate)} onChange={(e) => { setRate(e.target.value); setRateTouched(true); setErrors((er) => ({ ...er, rate: '' })); }} leftIcon={<span className="text-sm">$</span>} />
            <FieldError>{errors.rate}</FieldError>
            {campaign && bandMax != null && (
              <p className={`mt-1.5 flex items-center gap-1.5 text-xs ${inBand ? 'text-success' : 'text-warning'}`}>
                {inBand ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                {inBand ? 'Inside' : 'Outside'} the campaign rate band {money(bandMin ?? 0)}–{money(bandMax)}{!inBand && rateNum > bandMax ? ' — an agent sending this would hit an out-of-band checkpoint' : ''}
              </p>
            )}
            {campaign && bandMax == null && <Hint>This campaign has no rate band — any rate goes straight through.</Hint>}
          </div>
          <div>
            <Label required>Deadline</Label>
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} max={campaign?.end_date ?? undefined} />
            {campaign?.end_date && <Hint>Campaign ends {fmtDate(campaign.end_date)}</Hint>}
          </div>
        </div>

        <div>
          <Label>Terms</Label>
          <Textarea value={terms} onChange={(e) => { setTerms(e.target.value); setTermsTouched(true); }} rows={4} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Usage rights</Label>
            <Select value={usage} onValueChange={setUsage} options={USAGE_OPTIONS} />
          </div>
          <div>
            <Label hint="0 = none">Exclusivity (days)</Label>
            <Input type="number" min={0} step={1} value={exclusivity} onChange={(e) => setExclusivity(e.target.value)} />
          </div>
        </div>

        <div>
          <Label>Personal message</Label>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Why this creator, what you love about their work…" />
        </div>

        {campaign && rateNum > 0 && (
          <Callout tone={exceedsAvailable ? 'danger' : 'warning'} icon={Lock} title={exceedsAvailable ? `Exceeds available budget (${money(campaign.financials.available)})` : `${money(rateNum)} will be locked in escrow`}>
            Sending this offer moves {money(rateNum)} from the campaign's available budget into escrow until the creator responds. Declined or withdrawn offers refund escrow automatically.
          </Callout>
        )}
      </div>
    </Dialog>
  );
}
