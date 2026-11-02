import * as React from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import type { Creator } from '@/types';
import { useCampaigns, useAction } from '@/hooks/queries';
import { api } from '@/lib/api';
import { money } from '@/lib/utils';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/overlay';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Label, Select, Textarea, FieldError } from '@/components/ui/field';
import { CampaignStatusBadge } from '@/components/ui/status';

export function ShortlistButton({ creator, defaultCampaignId, size = 'sm', variant = 'secondary', label = 'Shortlist', className }: { creator: Creator; defaultCampaignId?: string; size?: ButtonProps['size']; variant?: ButtonProps['variant']; label?: string; className?: string }) {
  const [open, setOpen] = React.useState(false);
  const campaigns = useCampaigns({});
  const eligible = React.useMemo(() => (campaigns.data ?? []).filter((c) => ['ACTIVE', 'DRAFT', 'PAUSED'].includes(c.status)), [campaigns.data]);
  const [campaignId, setCampaignId] = React.useState(defaultCampaignId ?? '');
  const [rationale, setRationale] = React.useState('');
  const [error, setError] = React.useState('');
  const [done, setDone] = React.useState(false);

  React.useEffect(() => { if (open) { setCampaignId(defaultCampaignId ?? (eligible.length === 1 ? eligible[0]!.id : '')); setRationale(''); setError(''); } }, [open, defaultCampaignId, eligible]);

  const add = useAction(api.campaigns.addToShortlist, {
    invalidate: ['campaign', 'campaigns', 'shortlist', 'creators', 'audit'],
    success: (e) => `@${e.creator.handle} added to the shortlist`,
    onSuccess: () => { setOpen(false); setDone(true); setTimeout(() => setDone(false), 2500); },
  });

  const submit = () => {
    if (!campaignId) { setError('Pick a campaign.'); return; }
    add.mutate([campaignId, creator.id, rationale.trim() || undefined]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size={size} variant={done ? 'success' : variant} className={className} leftIcon={done ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />} onClick={(e) => e.stopPropagation()}>{done ? 'Shortlisted' : label}</Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-3">
          <div>
            <div className="text-sm font-semibold">Shortlist {creator.name.split(' ')[0]}</div>
            <div className="text-xs text-muted-foreground">Adds a <em>suggested</em> entry you can approve or reject on the campaign.</div>
          </div>
          <div>
            <Label required>Campaign</Label>
            <Select size="sm" value={campaignId} onValueChange={(v) => { setCampaignId(v); setError(''); }} placeholder={campaigns.isLoading ? 'Loading…' : 'Choose a campaign'} options={eligible.map((c) => ({ value: c.id, label: <span className="flex items-center gap-2">{c.title}<CampaignStatusBadge status={c.status} size="sm" /></span>, description: `${c.brand_name ?? ''} · ${money(c.financials.available)} available` }))} />
            <FieldError>{error}</FieldError>
          </div>
          <div>
            <Label>Rationale <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Textarea rows={2} className="min-h-[64px]" value={rationale} onChange={(e) => setRationale(e.target.value)} placeholder={`Why @${creator.handle} fits this brief…`} />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" loading={add.isPending} onClick={submit}>Add to shortlist</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
