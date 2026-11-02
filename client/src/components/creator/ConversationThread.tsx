import * as React from 'react';
import { Send, MessageSquare } from 'lucide-react';
import type { Collaboration, NegotiationMessage } from '@/types';
import { api } from '@/lib/api';
import { useAction } from '@/hooks/queries';
import { money, fmtDateTime, cn } from '@/lib/utils';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import { ActorBadge } from '@/components/ui/status';
import { EmptyState } from '@/components/ui/feedback';

const KIND_LABEL: Record<NegotiationMessage['kind'], string> = { MESSAGE: '', OFFER: 'Offer', COUNTER: 'Counter-offer', ACCEPT: 'Accepted', DECLINE: 'Declined', SYSTEM: '' };

function Bubble({ m, brand }: { m: NegotiationMessage; brand?: string }) {
  const mine = m.sender_type === 'CREATOR';
  if (m.kind === 'SYSTEM') {
    return (
      <div className="flex justify-center px-6">
        <div className="max-w-md text-center text-[12px] text-muted-foreground"><span>{m.body}</span><span className="ml-1.5 whitespace-nowrap">· {fmtDateTime(m.created_at)}</span></div>
      </div>
    );
  }
  const amountCard = m.kind === 'OFFER' || m.kind === 'COUNTER' || m.kind === 'ACCEPT';
  const actorType = m.sender_type === 'AGENT' ? 'AGENT' : 'HUMAN';
  const actorName = m.sender_type === 'AGENT' ? `${brand ?? 'Brand'} agent` : m.sender_name || (m.sender_type === 'CREATOR' ? 'You' : brand ?? 'Brand');
  return (
    <div className={cn('flex flex-col gap-1', mine ? 'items-end' : 'items-start')}>
      {!mine && <ActorBadge type={actorType} name={actorName} size="sm" />}
      <div className={cn('max-w-[88%] sm:max-w-[75%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed', mine ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md border border-border bg-surface-muted/70 text-foreground')}>
        {amountCard && (
          <div className={cn('mb-1.5 flex items-center justify-between gap-4 rounded-xl px-3 py-2', mine ? 'bg-primary-foreground/10' : 'bg-surface')}>
            <span className={cn('text-[11px] font-semibold uppercase tracking-wider', mine ? 'text-primary-foreground' : m.kind === 'ACCEPT' ? 'text-success' : m.kind === 'COUNTER' ? 'text-warning' : 'text-info')}>{KIND_LABEL[m.kind]}</span>
            {m.amount != null && <span className="font-display text-lg font-semibold tabular-nums">{money(m.amount)}</span>}
          </div>
        )}
        {m.kind === 'DECLINE' && <div className={cn('mb-1 text-[11px] font-semibold uppercase tracking-wider', mine ? 'text-primary-foreground' : 'text-danger')}>{mine ? 'Declined' : 'Offer withdrawn'}</div>}
        <div className="whitespace-pre-wrap break-words">{m.body}</div>
      </div>
      <div className="text-[11px] text-muted-foreground">{mine ? 'You' : ''}{mine ? ' · ' : ''}{fmtDateTime(m.created_at)}</div>
    </div>
  );
}

export function ConversationThread({ collab }: { collab: Collaboration }) {
  const [draft, setDraft] = React.useState('');
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const messages = collab.messages ?? [];
  const send = useAction((body: string) => api.collaborations.message(collab.id, body), { invalidate: ['collaboration', 'collaborations'], success: 'Message sent', onSuccess: () => setDraft('') });
  const closed = collab.status === 'DECLINED' || collab.status === 'CANCELLED' || collab.status === 'COMPLETED';

  React.useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'nearest' }); }, [messages.length]);

  const submit = () => { const b = draft.trim(); if (b) send.mutate([b]); };

  return (
    <Card padded={false}>
      <div className="px-5 pt-5"><CardHeader title="Conversation" description={`Negotiation and updates with ${collab.brand_name ?? 'the brand'}`} className="mb-0" /></div>
      <div tabIndex={0} role="region" aria-label="Conversation" className="max-h-[520px] space-y-4 overflow-y-auto px-5 py-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
        {messages.length === 0 && <EmptyState compact icon={MessageSquare} title="No messages yet" description="Say hello or ask a question about the brief." />}
        {messages.map((m) => <Bubble key={m.id} m={m} brand={collab.brand_name} />)}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-border px-5 py-3">
        <div className="flex items-end gap-2">
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={closed ? 'This collaboration is closed.' : 'Write a message… (⌘/Ctrl + Enter to send)'} disabled={closed} className="min-h-[44px] flex-1 py-2.5" rows={1} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submit(); } }} />
          <Button onClick={submit} disabled={closed || !draft.trim()} loading={send.isPending} size="icon" aria-label="Send message"><Send className="h-4 w-4" /></Button>
        </div>
      </div>
    </Card>
  );
}
