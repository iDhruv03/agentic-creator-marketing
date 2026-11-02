import * as React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Inbox, Hammer, CheckCircle2, XCircle, UserCircle, type LucideIcon } from 'lucide-react';
import { useCreatorCollaborations } from '@/components/creator/hooks';
import type { Collaboration } from '@/types';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { SkeletonRows, EmptyState } from '@/components/ui/feedback';
import { Button } from '@/components/ui/button';
import { OfferCard } from '@/components/creator/OfferCard';
import { isInbox, isActive } from '@/components/creator/utils';

type TabKey = 'inbox' | 'active' | 'completed' | 'declined';

const TABS: { key: TabKey; label: string; icon: LucideIcon; match: (c: Collaboration) => boolean; empty: { title: string; description: string } }[] = [
  { key: 'inbox', label: 'Inbox', icon: Inbox, match: isInbox, empty: { title: 'No open offers', description: 'When a brand — or its AI agent — sends you an offer it lands here with the rate, deliverables and deadline.' } },
  { key: 'active', label: 'Active', icon: Hammer, match: isActive, empty: { title: 'Nothing in production', description: 'Accepted offers move here. Submit deliverables from the offer page as you publish them.' } },
  { key: 'completed', label: 'Completed', icon: CheckCircle2, match: (c) => c.status === 'COMPLETED', empty: { title: 'No completed collaborations yet', description: 'Collaborations land here once every deliverable is approved and paid.' } },
  { key: 'declined', label: 'Declined', icon: XCircle, match: (c) => c.status === 'DECLINED' || c.status === 'CANCELLED', empty: { title: 'Nothing declined', description: 'Offers you passed on, or that a brand withdrew, are kept here for reference.' } },
];

export default function CreatorOffers() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const collabs = useCreatorCollaborations();
  const all = collabs.data ?? [];
  const tab = (TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'inbox') as TabKey;
  const counts = Object.fromEntries(TABS.map((t) => [t.key, all.filter(t.match).length])) as Record<TabKey, number>;

  return (
    <div className="page">
      <PageHeader title="Offers & work" description="Every offer you have received, what is in production and what is done. Escrow is locked by the brand before an offer reaches you." actions={<Button variant="secondary" leftIcon={<UserCircle className="h-4 w-4" />} onClick={() => navigate('/creator/profile')}>Media kit</Button>} />
      <Tabs value={tab} onValueChange={(v) => setParams(v === 'inbox' ? {} : { tab: v }, { replace: true })}>
        <TabsList className="mb-5">
          {TABS.map((t) => <TabsTrigger key={t.key} value={t.key} count={counts[t.key]} icon={<t.icon />}>{t.label}</TabsTrigger>)}
        </TabsList>
        {TABS.map((t) => {
          const rows = all.filter(t.match);
          return (
            <TabsContent key={t.key} value={t.key} className="focus:outline-none">
              {collabs.isLoading ? <SkeletonRows rows={3} /> : rows.length === 0 ? (
                <EmptyState icon={t.icon} title={t.empty.title} description={t.empty.description} action={t.key === 'inbox' ? <Button size="sm" variant="secondary" onClick={() => navigate('/creator/profile')}>Keep your media kit current</Button> : undefined} />
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">{rows.map((c) => <OfferCard key={c.id} collab={c} />)}</div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
