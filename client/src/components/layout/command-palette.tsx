import * as React from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Megaphone, Users, Handshake, ShieldCheck, Bot, Plug, FlaskConical, Wallet, ScrollText, LayoutDashboard, Plus, Sun, Moon, Search } from 'lucide-react';
import { useUi } from '@/store/ui';
import { useUser } from '@/store/auth';
import { useCampaigns, useCreators } from '@/hooks/queries';
import { Avatar } from '@/components/ui/avatar';
import { Kbd } from '@/components/ui/feedback';

export function CommandPalette() {
  const { paletteOpen, setPalette, setTheme } = useUi();
  const navigate = useNavigate();
  const user = useUser();
  const [q, setQ] = React.useState('');
  const campaigns = useCampaigns({});
  const creators = useCreators({ q: q.length >= 2 ? q : undefined, limit: 6 });
  const isCreator = user?.role === 'CREATOR';

  React.useEffect(() => { if (!paletteOpen) setQ(''); }, [paletteOpen]);
  const go = (to: string) => { setPalette(false); navigate(to); };

  const pages = isCreator
    ? [['/creator', 'Home', LayoutDashboard], ['/creator/offers', 'Offers & work', Handshake], ['/creator/wallet', 'Wallet', Wallet], ['/creator/profile', 'Media kit', Users]]
    : [['/', 'Overview', LayoutDashboard], ['/campaigns', 'Campaigns', Megaphone], ['/creators', 'Discover creators', Users], ['/collaborations', 'Collaborations', Handshake], ['/approvals', 'Approvals', ShieldCheck], ['/finance', 'Finance', Wallet], ['/agents', 'Agent sessions', Bot], ['/mcp', 'MCP server', Plug], ['/evaluation', 'Evaluation lab', FlaskConical], ['/audit', 'Audit trail', ScrollText]];

  return (
    <DialogPrimitive.Root open={paletteOpen} onOpenChange={setPalette}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-[2px] animate-fade-in" />
        <DialogPrimitive.Content className="fixed left-1/2 top-[12vh] z-[90] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-overlay animate-scale-in focus:outline-none">
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <Command label="Command palette" shouldFilter={true}>
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Command.Input value={q} onValueChange={setQ} placeholder="Jump to a page, campaign or creator…" className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70" />
              <Kbd>esc</Kbd>
            </div>
            <Command.List className="max-h-[420px] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-8 text-center text-sm text-muted-foreground">No results.</Command.Empty>
              {!isCreator && (
                <Command.Group heading="Actions">
                  <Command.Item onSelect={() => go('/campaigns/new')} value="new campaign create"><Plus className="h-4 w-4 text-primary" />New campaign</Command.Item>
                  <Command.Item onSelect={() => go('/agents?new=1')} value="new agent session authorise"><Bot className="h-4 w-4 text-agent" />Authorise an agent session</Command.Item>
                  <Command.Item onSelect={() => go('/approvals')} value="review approvals checkpoints"><ShieldCheck className="h-4 w-4 text-warning" />Review pending approvals</Command.Item>
                </Command.Group>
              )}
              <Command.Group heading="Pages">
                {pages.map(([to, label, Icon]: any) => (
                  <Command.Item key={to} onSelect={() => go(to)} value={`${label} page`}><Icon className="h-4 w-4 text-muted-foreground" />{label}</Command.Item>
                ))}
              </Command.Group>
              {!isCreator && (campaigns.data?.length ?? 0) > 0 && (
                <Command.Group heading="Campaigns">
                  {campaigns.data!.slice(0, 8).map((c) => (
                    <Command.Item key={c.id} onSelect={() => go(`/campaigns/${c.id}`)} value={`${c.title} ${c.brand_name} campaign`}>
                      <Megaphone className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 truncate">{c.title}</span>
                      <span className="text-xs text-muted-foreground">{c.brand_name}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {!isCreator && (creators.data?.length ?? 0) > 0 && (
                <Command.Group heading="Creators">
                  {creators.data!.slice(0, 6).map((c) => (
                    <Command.Item key={c.id} onSelect={() => go(`/creators/${c.id}`)} value={`${c.name} @${c.handle} ${c.primary_niche} creator`}>
                      <Avatar name={c.name} src={c.avatar_url} size="xs" />
                      <span className="flex-1 truncate">{c.name}</span>
                      <span className="text-xs text-muted-foreground">@{c.handle}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              <Command.Group heading="Appearance">
                <Command.Item onSelect={() => { setTheme('light'); setPalette(false); }} value="light theme"><Sun className="h-4 w-4 text-muted-foreground" />Light theme</Command.Item>
                <Command.Item onSelect={() => { setTheme('dark'); setPalette(false); }} value="dark theme"><Moon className="h-4 w-4 text-muted-foreground" />Dark theme</Command.Item>
              </Command.Group>
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
