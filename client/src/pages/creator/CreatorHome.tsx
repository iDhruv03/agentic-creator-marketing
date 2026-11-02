import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Wallet, Lock, TrendingUp, Inbox, ArrowRight, Eye, Upload, AlertTriangle, Check, Sparkles, UserCircle, Clock } from 'lucide-react';
import { useAuth } from '@/store/auth';
import { useWallet, useCreator, useAction } from '@/hooks/queries';
import { useCreatorCollaborations } from '@/components/creator/hooks';
import { api } from '@/lib/api';
import { money, num, pct, timeAgo, deliverableLabel, fmtDate, cn } from '@/lib/utils';
import type { Collaboration } from '@/types';
import { PageHeader } from '@/components/ui/page-header';
import { Stat, SkeletonCards, SkeletonRows, EmptyState, Progress, Callout } from '@/components/ui/feedback';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, OrgMark } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ChartFrame, ChartTooltip, CHART } from '@/components/ui/charts';
import { CollabStatusBadge, DeliverableStatusBadge, PlatformIcon } from '@/components/ui/status';
import { ConfirmDialog } from '@/components/ui/overlay';
import { KeyValue } from '@/components/ui/data';
import { OfferCard } from '@/components/creator/OfferCard';
import { isInbox, isActive, creatorCanRespond, deliverableProgress, currentRate, deadlineInfo, monthLabel } from '@/components/creator/utils';

export default function CreatorHome() {
  const navigate = useNavigate();
  const me = useAuth((s) => s.me);
  const creator = useCreator(me?.user.creator_id ?? undefined);
  const wallet = useWallet();
  const collabs = useCreatorCollaborations();
  const [accepting, setAccepting] = React.useState<Collaboration | null>(null);
  const accept = useAction((id: string) => api.collaborations.accept(id), { invalidate: ['collaboration', 'collaborations', 'wallet', 'creator', 'notifications'], success: 'Offer accepted — funds are secured in escrow', onSuccess: () => setAccepting(null) });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const all = collabs.data ?? [];
  const offers = all.filter(isInbox);
  const actionableOffers = offers.filter(creatorCanRespond);
  const active = all.filter(isActive);
  const awaitingContent = active.flatMap((c) => c.deliverables.filter((d) => d.status === 'PENDING' && (c.status === 'ACCEPTED' || c.status === 'IN_PROGRESS')).map((d) => ({ c, d })));
  const changes = active.flatMap((c) => c.deliverables.filter((d) => d.status === 'CHANGES_REQUESTED').map((d) => ({ c, d })));
  const attention = actionableOffers.length + awaitingContent.length + changes.length;
  const analytics = wallet.data?.analytics ?? creator.data?.analytics;
  const earnings = (wallet.data?.analytics.earnings_by_month ?? []).map((e) => ({ ...e, label: monthLabel(e.month) }));

  return (
    <div className="page">
      <PageHeader
        title={<span className="flex items-center gap-3"><Avatar name={me?.user.name ?? ''} src={me?.org?.avatar_url ?? me?.user.avatar_url} size="lg" ring /><span>{greeting}, {me?.user.name.split(' ')[0]}</span></span>}
        description={attention > 0 ? `${attention} thing${attention === 1 ? '' : 's'} need${attention === 1 ? 's' : ''} your attention today.` : 'You are all caught up. New offers land here the moment a brand or its agent sends one.'}
        actions={<>
          <Button variant="secondary" leftIcon={<UserCircle className="h-4 w-4" />} onClick={() => navigate('/creator/profile')}>Edit media kit</Button>
          <Button leftIcon={<Inbox className="h-4 w-4" />} onClick={() => navigate('/creator/offers')}>Offers & work</Button>
        </>}
      />

      {wallet.isLoading ? <SkeletonCards /> : wallet.data && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Wallet balance" value={money(wallet.data.balance)} icon={Wallet} tone="primary" hint="Available to pay out" onClick={() => navigate('/creator/wallet')} />
          <Stat label="In escrow" value={money(wallet.data.pending_escrow)} icon={Lock} tone="warning" hint="Locked by brands for your open work" onClick={() => navigate('/creator/wallet')} />
          <Stat label="Lifetime earnings" value={money(wallet.data.lifetime_earnings)} icon={TrendingUp} tone="success" hint={`${analytics?.offers.accepted ?? 0} offer${analytics?.offers.accepted === 1 ? '' : 's'} accepted`} onClick={() => navigate('/creator/wallet')} />
          <Stat label="Open offers" value={num(offers.length)} icon={Inbox} tone="info" hint={actionableOffers.length ? `${actionableOffers.length} waiting on you` : 'Nothing waiting on you'} onClick={() => navigate('/creator/offers')} />
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {/* Needs your attention */}
          <section className="space-y-3">
            <div className="flex items-end justify-between gap-4">
              <div><h2 className="text-base font-semibold">Needs your attention</h2><p className="text-[13px] text-muted-foreground">Offers to answer and content the brand is waiting on</p></div>
              {attention > 0 && <Badge tone="warning" size="lg">{attention}</Badge>}
            </div>
            {collabs.isLoading ? <SkeletonRows rows={3} /> : attention === 0 ? (
              <EmptyState compact icon={Check} title="All clear" description="No open offers or outstanding deliverables. Keep your media kit fresh so agents can find you." action={<Button size="sm" variant="secondary" onClick={() => navigate('/creator/profile')}>Update media kit</Button>} />
            ) : (
              <div className="space-y-3">
                {actionableOffers.map((c) => (
                  <OfferCard key={c.id} collab={c} actions={<Button size="xs" variant="success" leftIcon={<Check className="h-3 w-3" />} onClick={() => setAccepting(c)}>Accept {money(currentRate(c))}</Button>} />
                ))}
                {changes.map(({ c, d }) => (
                  <Link key={d.id} to={`/creator/offers/${c.id}`} className="card card-hover flex items-start gap-3 border-danger/30 p-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-danger-soft text-danger"><AlertTriangle className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[14px] font-medium"><PlatformIcon platform={d.platform} className="h-4 w-4 text-[9px]" />{deliverableLabel(d.deliverable_type)}<DeliverableStatusBadge status={d.status} size="sm" /></div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{c.brand_name} · {c.campaign_title}</div>
                      {d.review_notes && <div className="mt-1.5 line-clamp-2 text-[13px] text-foreground/80">{d.review_notes}</div>}
                    </div>
                    <span className="hidden shrink-0 items-center gap-1 text-xs text-primary sm:flex">Resubmit<ArrowRight className="h-3.5 w-3.5" /></span>
                  </Link>
                ))}
                {awaitingContent.map(({ c, d }) => {
                  const dl = deadlineInfo(c.deadline);
                  return (
                    <Link key={d.id} to={`/creator/offers/${c.id}`} className="card card-hover flex items-start gap-3 p-4">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><Upload className="h-4 w-4" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-[14px] font-medium"><PlatformIcon platform={d.platform} className="h-4 w-4 text-[9px]" />{deliverableLabel(d.deliverable_type)}<DeliverableStatusBadge status={d.status} size="sm" /></div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{c.brand_name} · {c.campaign_title}{dl && <span className={cn(dl.past ? 'text-danger font-medium' : dl.soon ? 'text-warning' : '')}> · due {dl.label}</span>}</div>
                      </div>
                      <span className="hidden shrink-0 items-center gap-1 text-xs text-primary sm:flex">{c.status === 'ACCEPTED' ? 'Start' : 'Submit'}<ArrowRight className="h-3.5 w-3.5" /></span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* Active work */}
          <Card padded={false}>
            <div className="flex items-center justify-between px-5 pt-5">
              <div><h3 className="text-[15px] font-semibold">Active work</h3><p className="text-[13px] text-muted-foreground">Accepted collaborations and deliverable progress</p></div>
              <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="h-3.5 w-3.5" />} onClick={() => navigate('/creator/offers?tab=active')}>All work</Button>
            </div>
            <div className="mt-3 divide-y divide-border/70">
              {collabs.isLoading && <div className="px-5 pb-5"><SkeletonRows rows={2} /></div>}
              {!collabs.isLoading && active.length === 0 && <div className="px-5 pb-5"><EmptyState compact icon={Sparkles} title="No active work" description="Accepted offers show up here with their deliverable progress." /></div>}
              {active.map((c) => {
                const p = deliverableProgress(c);
                const dl = deadlineInfo(c.deadline);
                return (
                  <Link key={c.id} to={`/creator/offers/${c.id}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-5 py-3.5 transition hover:bg-accent/40 sm:grid-cols-[auto_1.4fr_1fr_auto] sm:gap-4">
                    <OrgMark name={c.brand_name ?? 'Brand'} src={c.brand_logo} size="sm" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><span className="truncate text-[14px] font-medium">{c.campaign_title}</span><CollabStatusBadge status={c.status} size="sm" /></div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{c.brand_name}{dl && <span className={cn(dl.past ? ' text-danger font-medium' : '')}> · due {dl.label}</span>}</div>
                    </div>
                    <div className="hidden sm:block">
                      <div className="mb-1 flex justify-between text-[11px] text-muted-foreground"><span>{p.done}/{p.total} deliverables approved</span><span>{p.pct}%</span></div>
                      <Progress value={p.pct} tone="success" size="sm" />
                    </div>
                    <div className="text-right text-[13px] font-semibold tabular-nums">{money(currentRate(c))}</div>
                  </Link>
                );
              })}
            </div>
          </Card>

          {/* Earnings */}
          <ChartFrame title="Earnings" description="Payouts released to your wallet, by month" height={200}>
            {earnings.length === 0 ? (
              <div className="flex h-full items-center justify-center"><EmptyState compact icon={TrendingUp} title="No payouts yet" description="Approved deliverables release escrow to your wallet and show up here." className="w-full border-0" /></div>
            ) : (
              <AreaChart data={earnings} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
                <defs><linearGradient id="cr-earn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CHART.teal} stopOpacity={0.35} /><stop offset="100%" stopColor={CHART.teal} stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => money(v, { compact: true })} width={56} />
                <Tooltip content={<ChartTooltip format={(v) => money(v)} />} />
                <Area type="monotone" dataKey="amount" name="Paid out" stroke={CHART.teal} strokeWidth={2} fill="url(#cr-earn)" />
              </AreaChart>
            )}
          </ChartFrame>
        </div>

        <div className="space-y-6">
          {analytics && (
            <Card className="bg-gradient-to-br from-primary-soft/70 to-surface">
              <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-wider text-muted-foreground"><Eye className="h-3.5 w-3.5" />Reach on sponsored content</div>
              <div className="mt-2 font-display text-[26px] font-semibold tabular-nums">{num(analytics.reach.views, { compact: true })} <span className="text-base font-medium text-muted-foreground">views</span></div>
              <div className="mt-1 text-[13px] text-muted-foreground">{pct(analytics.reach.engagement_rate)} engagement · {num(analytics.reach.clicks, { compact: true })} link clicks</div>
              <KeyValue className="mt-4" columns={3} items={[{ label: 'Likes', value: num(analytics.reach.likes, { compact: true }) }, { label: 'Comments', value: num(analytics.reach.comments, { compact: true }) }, { label: 'Shares', value: num(analytics.reach.shares, { compact: true }) }]} />
            </Card>
          )}

          <Card>
            <CardHeader title="Offer history" description="How brands and agents have engaged you" />
            {analytics ? (
              <KeyValue columns={2} items={[{ label: 'Total offers', value: analytics.offers.total }, { label: 'Open', value: analytics.offers.open }, { label: 'Accepted', value: analytics.offers.accepted }, { label: 'Declined', value: analytics.offers.declined }]} />
            ) : <SkeletonRows rows={2} />}
            {creator.data && !creator.data.available && <Callout tone="warning" className="mt-4" title="You are not accepting offers">Brands and agents cannot send you new offers until you switch availability back on in your media kit.</Callout>}
          </Card>

          <Card>
            <CardHeader title="Recent activity" description="Latest movement on your collaborations" action={<Button variant="ghost" size="sm" onClick={() => navigate('/creator/offers')}>All</Button>} />
            <div className="space-y-2.5">
              {(analytics?.recent ?? []).length === 0 && <EmptyState compact icon={Clock} title="No activity yet" />}
              {(analytics?.recent ?? []).slice(0, 5).map((r) => (
                <Link key={r.id} to={`/creator/offers/${r.id}`} className="flex items-center gap-3 rounded-xl px-1 py-1 transition hover:bg-accent/40">
                  <OrgMark name={r.brand_name} size="sm" />
                  <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-medium">{r.campaign_title}</div><div className="text-xs text-muted-foreground">{r.brand_name} · {timeAgo(r.updated_at)}</div></div>
                  <CollabStatusBadge status={r.status} size="sm" />
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <ConfirmDialog open={Boolean(accepting)} onOpenChange={(o) => { if (!o) setAccepting(null); }} title="Accept this offer?" description="Acceptance is binding. Escrow is released to your wallet as each deliverable is approved." confirmLabel={accepting ? `Accept ${money(currentRate(accepting))}` : 'Accept'} tone="success" loading={accept.isPending} onConfirm={() => accepting && accept.mutate([accepting.id])}>
        {accepting && <KeyValue columns={2} items={[{ label: 'Brand', value: accepting.brand_name }, { label: 'Campaign', value: accepting.campaign_title }, { label: 'Rate', value: <span className="font-semibold tabular-nums">{money(currentRate(accepting))}</span> }, { label: 'Deadline', value: accepting.deadline ? fmtDate(accepting.deadline) : 'Not set' }, { label: 'Deliverables', value: accepting.deliverables.map((d) => deliverableLabel(d.deliverable_type)).join(', ') }]} />}
      </ConfirmDialog>
    </div>
  );
}
