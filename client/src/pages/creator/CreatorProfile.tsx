import * as React from 'react';
import { Plus, Trash2, Save, RotateCcw, Eye, Pencil } from 'lucide-react';
import { useAuth } from '@/store/auth';
import { useCreator, useNiches, useAction } from '@/hooks/queries';
import { api } from '@/lib/api';
import type { Creator, PortfolioItem } from '@/types';
import { platformLabel, cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label, Input, Textarea, Select, Switch, ChipGroup, TagInput, Hint, SegmentedControl } from '@/components/ui/field';
import { SkeletonRows, EmptyState, Callout } from '@/components/ui/feedback';
import { ConfirmDialog } from '@/components/ui/overlay';
import { BenchmarkPanel } from '@/components/creator/BenchmarkPanel';
import { MediaKitPreview } from '@/components/creator/MediaKitPreview';
import { RATE_FIELDS } from '@/components/creator/utils';

interface FormState {
  name: string; bio: string; location: string; primary_niche: string; secondary_niches: string[]; content_tags: string[]; available: boolean; response_time_hours: string;
  rate_post: string; rate_reel: string; rate_video: string; rate_story: string; portfolio: PortfolioItem[];
}

/** api.ts types `available` as number & boolean (never); keep our own shape and cast on send. */
type Patch = Omit<Partial<Creator>, 'available'> & { available?: boolean };
const sendPatch = (patch: Patch) => api.creators.updateProfile(patch as unknown as Parameters<typeof api.creators.updateProfile>[0]);

function toForm(c: Creator): FormState {
  return {
    name: c.name, bio: c.bio ?? '', location: c.location ?? '', primary_niche: c.primary_niche, secondary_niches: [...c.secondary_niches], content_tags: [...c.content_tags], available: Boolean(c.available), response_time_hours: String(c.response_time_hours),
    rate_post: String(c.rate_post), rate_reel: String(c.rate_reel), rate_video: String(c.rate_video), rate_story: String(c.rate_story), portfolio: c.portfolio.map((p) => ({ ...p })),
  };
}

const sameArr = (a: unknown[], b: unknown[]) => JSON.stringify(a) === JSON.stringify(b);

/** Only fields that differ from the saved record. */
function diff(c: Creator, f: FormState): Patch {
  const p: Patch = {};
  if (f.name.trim() && f.name.trim() !== c.name) p.name = f.name.trim();
  if (f.bio !== (c.bio ?? '')) p.bio = f.bio;
  if (f.location !== (c.location ?? '')) p.location = f.location;
  if (f.primary_niche && f.primary_niche !== c.primary_niche) p.primary_niche = f.primary_niche;
  if (!sameArr(f.secondary_niches, c.secondary_niches)) p.secondary_niches = f.secondary_niches;
  if (!sameArr(f.content_tags, c.content_tags)) p.content_tags = f.content_tags;
  if (f.available !== Boolean(c.available)) p.available = f.available;
  const rt = Number(f.response_time_hours);
  if (rt > 0 && rt !== c.response_time_hours) p.response_time_hours = rt;
  for (const r of RATE_FIELDS) { const v = Number(f[r.field]); if (Number.isFinite(v) && v >= 0 && v !== c[r.field]) p[r.field] = v; }
  const cleanPortfolio = f.portfolio.filter((x) => x.title.trim() || x.url.trim()).map((x) => ({ title: x.title.trim(), platform: x.platform, url: x.url.trim(), ...(x.views ? { views: Number(x.views) } : {}), ...(x.brand?.trim() ? { brand: x.brand.trim() } : {}) }));
  if (!sameArr(cleanPortfolio, c.portfolio)) p.portfolio = cleanPortfolio;
  return p;
}

/** Form → preview creator object (what brands would see after saving). */
function previewOf(c: Creator, f: FormState): Creator {
  return { ...c, name: f.name || c.name, bio: f.bio, location: f.location, primary_niche: f.primary_niche || c.primary_niche, secondary_niches: f.secondary_niches, content_tags: f.content_tags, available: f.available ? 1 : 0, response_time_hours: Number(f.response_time_hours) || c.response_time_hours, rate_post: Number(f.rate_post) || 0, rate_reel: Number(f.rate_reel) || 0, rate_video: Number(f.rate_video) || 0, rate_story: Number(f.rate_story) || 0, portfolio: f.portfolio };
}

const PLATFORM_OPTIONS = ['youtube', 'instagram', 'tiktok'].map((p) => ({ value: p, label: platformLabel(p) }));

export default function CreatorProfile() {
  const me = useAuth((s) => s.me);
  const refresh = useAuth((s) => s.refresh);
  const creator = useCreator(me?.user.creator_id ?? undefined);
  const niches = useNiches();
  const [form, setForm] = React.useState<FormState | null>(null);
  const [loadedFor, setLoadedFor] = React.useState<string | null>(null);
  const [discarding, setDiscarding] = React.useState(false);
  const [mobileView, setMobileView] = React.useState<'edit' | 'preview'>('edit');

  // Seed the form once per creator record (do not clobber edits on background refetch).
  React.useEffect(() => { if (creator.data && loadedFor !== creator.data.id) { setForm(toForm(creator.data)); setLoadedFor(creator.data.id); } }, [creator.data, loadedFor]);

  const save = useAction((patch: Patch) => sendPatch(patch), { invalidate: ['creator', 'creators', 'benchmark'], success: 'Media kit saved', onSuccess: (c) => { setForm(toForm(c)); refresh(); } });

  if (creator.isLoading || !form || !creator.data) {
    return <div className="page"><PageHeader title="Media kit" description="How brands and their agents see you." /><div className="grid gap-6 lg:grid-cols-5"><div className="space-y-6 lg:col-span-3"><div className="card p-5"><SkeletonRows rows={4} /></div><div className="card p-5"><SkeletonRows rows={4} /></div></div><div className="lg:col-span-2"><div className="card p-5"><SkeletonRows rows={6} /></div></div></div></div>;
  }
  const c = creator.data;
  const patch = diff(c, form);
  const changed = Object.keys(patch);
  const dirty = changed.length > 0;
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const nicheOptions = (niches.data ?? []).map((n) => ({ value: n, label: n }));
  const secondaryOptions = Array.from(new Set([...(niches.data ?? []), ...c.secondary_niches, ...form.secondary_niches])).filter((n) => n !== form.primary_niche).map((n) => ({ value: n, label: n }));
  const followerCount = c.follower_count;

  const updatePortfolio = (i: number, p: Partial<PortfolioItem>) => set('portfolio', form.portfolio.map((x, j) => (j === i ? { ...x, ...p } : x)));

  const editor = (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Profile" description="The basics agents match on: niche, tags and availability" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="pf-name" required>Display name</Label><Input id="pf-name" value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
            <div><Label htmlFor="pf-location">Location</Label><Input id="pf-location" value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="City, Country" /></div>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="pf-bio" hint={<span className={form.bio.length > 600 ? 'text-danger' : undefined}>{form.bio.length}/600</span>}>Bio</Label>
            <Textarea id="pf-bio" value={form.bio} onChange={(e) => set('bio', e.target.value.slice(0, 600))} rows={4} placeholder="What you make, who watches, and why a brand should care." />
          </div>
          <div><Label>Primary niche</Label><Select value={form.primary_niche} onValueChange={(v) => set('primary_niche', v)} options={nicheOptions} placeholder="Choose a niche" /></div>
          <div><Label htmlFor="pf-rt" hint="hours">Typical response time</Label><Input id="pf-rt" type="number" min={1} inputMode="numeric" value={form.response_time_hours} onChange={(e) => set('response_time_hours', e.target.value)} /></div>
          <div className="sm:col-span-2"><Label>Secondary niches</Label><ChipGroup options={secondaryOptions} value={form.secondary_niches} onChange={(v) => set('secondary_niches', v)} size="sm" /></div>
          <div className="sm:col-span-2"><Label>Content tags</Label><TagInput value={form.content_tags} onChange={(v) => set('content_tags', v)} placeholder="long-form, teardown, studio-quality…" /><Hint>Agents use tags to match briefs. Press Enter after each.</Hint></div>
          <div className="sm:col-span-2 rounded-xl border border-border px-4 py-3"><Switch checked={form.available} onCheckedChange={(v) => set('available', v)} label="Accepting offers" description={form.available ? 'Brands and agents can send you offers.' : 'You are hidden from offer flows until switched back on.'} /></div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Rate card" description="Your starting point for offers. Benchmarks come from creators in your follower band and niche." />
        <div className="space-y-5">
          {RATE_FIELDS.map((r) => (
            <div key={r.key} className="grid gap-3 sm:grid-cols-[200px_1fr] sm:items-start">
              <div><Label htmlFor={`rate-${r.key}`}>{r.label}</Label><Input id={`rate-${r.key}`} type="number" min={0} step={25} inputMode="numeric" value={form[r.field]} onChange={(e) => set(r.field, e.target.value)} leftIcon={<span className="text-sm">$</span>} /><Hint>{r.hint}</Hint></div>
              <div className="rounded-xl border border-border bg-surface-muted/50 px-3 py-2.5 sm:mt-6"><BenchmarkPanel followerCount={followerCount} deliverable={r.key} niche={form.primary_niche || c.primary_niche} rate={Number(form[r.field]) || 0} compact /></div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Portfolio" description="Your best sponsored and organic work" action={<Button size="sm" variant="secondary" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => set('portfolio', [...form.portfolio, { title: '', platform: 'instagram', url: '' }])}>Add item</Button>} />
        {form.portfolio.length === 0 ? <EmptyState compact title="No portfolio items" description="Add a few links so brands can see your work before they offer." action={<Button size="sm" onClick={() => set('portfolio', [{ title: '', platform: 'instagram', url: '' }])}>Add your first</Button>} /> : (
          <div className="space-y-3">
            {form.portfolio.map((p, i) => (
              <div key={i} className="rounded-xl border border-border p-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
                  <div><Label htmlFor={`pf-t-${i}`}>Title</Label><Input id={`pf-t-${i}`} value={p.title} onChange={(e) => updatePortfolio(i, { title: e.target.value })} placeholder="Best ANC earbuds of the year" /></div>
                  <div><Label>Platform</Label><Select value={p.platform} onValueChange={(v) => updatePortfolio(i, { platform: v })} options={PLATFORM_OPTIONS} /></div>
                  <div className="sm:col-span-2"><Label htmlFor={`pf-u-${i}`}>URL</Label><Input id={`pf-u-${i}`} value={p.url} onChange={(e) => updatePortfolio(i, { url: e.target.value })} placeholder="https://…" inputMode="url" /></div>
                  <div><Label htmlFor={`pf-v-${i}`}>Views</Label><Input id={`pf-v-${i}`} type="number" min={0} inputMode="numeric" value={p.views ?? ''} onChange={(e) => updatePortfolio(i, { views: e.target.value === '' ? undefined : Number(e.target.value) })} /></div>
                  <div><Label htmlFor={`pf-b-${i}`}>Brand <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id={`pf-b-${i}`} value={p.brand ?? ''} onChange={(e) => updatePortfolio(i, { brand: e.target.value })} placeholder="Sponsor, if any" /></div>
                </div>
                <div className="mt-2 flex justify-end"><Button size="xs" variant="ghost" className="text-danger hover:bg-danger-soft" leftIcon={<Trash2 className="h-3 w-3" />} onClick={() => set('portfolio', form.portfolio.filter((_, j) => j !== i))}>Remove</Button></div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );

  const preview = (
    <div className="lg:sticky lg:top-20">
      <div className="mb-3 flex items-center justify-between"><div><h2 className="text-base font-semibold">How brands see you</h2><p className="text-[13px] text-muted-foreground">Live preview of your public media kit{dirty ? ' (unsaved edits shown)' : ''}</p></div>{dirty && <Badge tone="warning" size="sm" dot>Unsaved</Badge>}</div>
      <MediaKitPreview creator={previewOf(c, form)} />
    </div>
  );

  return (
    <div className="page">
      <PageHeader
        title="Media kit"
        description="What brands and their agents read when they shortlist you. Platform stats and audience data sync from your connected accounts."
        meta={dirty ? <Badge tone="warning" dot>{changed.length} unsaved change{changed.length === 1 ? '' : 's'}</Badge> : <Badge tone="success" dot>Saved</Badge>}
        actions={<>
          <Button variant="ghost" leftIcon={<RotateCcw className="h-4 w-4" />} disabled={!dirty} onClick={() => setDiscarding(true)}>Discard changes</Button>
          <Button leftIcon={<Save className="h-4 w-4" />} disabled={!dirty || form.bio.length > 600} loading={save.isPending} onClick={() => save.mutate([patch])}>Save media kit</Button>
        </>}
      />
      {!form.available && <Callout tone="warning" className="mb-6" title="You are not accepting offers">Agents skip unavailable creators when they shortlist. Flip "Accepting offers" on when you are ready.</Callout>}

      {/* One DOM tree for both breakpoints: on mobile a segmented control toggles which column is visible. */}
      <SegmentedControl className="mb-4 lg:hidden" size="sm" value={mobileView} onChange={setMobileView} options={[{ value: 'edit', label: 'Edit', icon: <Pencil className="h-3.5 w-3.5" /> }, { value: 'preview', label: 'Preview', icon: <Eye className="h-3.5 w-3.5" /> }]} />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className={cn('lg:col-span-3', mobileView !== 'edit' && 'hidden lg:block')}>{editor}</div>
        <div className={cn('lg:col-span-2', mobileView !== 'preview' && 'hidden lg:block')}>{preview}</div>
      </div>

      <ConfirmDialog open={discarding} onOpenChange={setDiscarding} title="Discard unsaved changes?" description={`${changed.length} field${changed.length === 1 ? '' : 's'} will revert to the saved media kit.`} confirmLabel="Discard" tone="danger" onConfirm={() => { setForm(toForm(c)); setDiscarding(false); }} />
    </div>
  );
}
