import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { PlatformEvent, RunEvent } from '@/types';
import { useAuth } from '@/store/auth';

/** Which query keys each platform event should invalidate. */
const INVALIDATIONS: Record<string, string[]> = {
  'campaign.updated': ['campaigns', 'campaign', 'overview', 'brands', 'agencies'],
  'shortlist.updated': ['campaign', 'shortlist'],
  'collaboration.updated': ['collaborations', 'collaboration', 'campaign', 'overview', 'wallet', 'creator'],
  'deliverable.updated': ['collaborations', 'collaboration', 'campaign', 'campaign-analytics'],
  'checkpoint.created': ['checkpoints', 'checkpoint', 'campaign', 'overview', 'sessions', 'me'],
  'checkpoint.resolved': ['checkpoints', 'checkpoint', 'campaign', 'collaborations', 'collaboration', 'ledger', 'overview', 'sessions', 'audit'],
  'ledger.posted': ['ledger', 'campaign', 'campaigns', 'overview', 'wallet', 'trial-balance'],
  'audit.appended': ['audit', 'audit-verify', 'overview'],
  'notification.created': ['notifications', 'me'],
  'agent.run': ['runs', 'run', 'sessions', 'campaign'],
  'session.updated': ['sessions', 'session'],
  'evaluation.recorded': ['evaluation'],
};

/**
 * Keep the dashboard live: subscribe to the platform event stream and
 * invalidate the affected queries. Debounced so bursts (an agent run) don't
 * thrash the network.
 */
export function usePlatformEvents(onEvent?: (e: PlatformEvent) => void) {
  const qc = useQueryClient();
  const token = useAuth((s) => s.token);
  const status = useAuth((s) => s.status);
  const cb = useRef(onEvent);
  cb.current = onEvent;
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token || status !== 'ready') return;
    const es = new EventSource(api.eventsUrl());
    const pending = new Set<string>();
    let timer: number | null = null;
    const flush = () => {
      timer = null;
      for (const key of pending) qc.invalidateQueries({ queryKey: [key] });
      pending.clear();
    };
    const handle = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data) as PlatformEvent;
        for (const k of INVALIDATIONS[data.type] ?? []) pending.add(k);
        if (!timer) timer = window.setTimeout(flush, 250);
        cb.current?.(data);
      } catch { /* ignore */ }
    };
    for (const type of Object.keys(INVALIDATIONS)) es.addEventListener(type, handle as EventListener);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    return () => { es.close(); if (timer) clearTimeout(timer); };
  }, [token, status, qc]);

  return connected;
}

export interface RunStreamState {
  events: RunEvent[];
  status: 'connecting' | 'live' | 'ended' | 'error';
  endStatus?: string;
}

/** Replay + live tail of an agent run via SSE. */
export function useRunStream(runId: string | null | undefined, enabled = true): RunStreamState {
  const [state, setState] = useState<RunStreamState>({ events: [], status: 'connecting' });

  useEffect(() => {
    if (!runId || !enabled) return;
    setState({ events: [], status: 'connecting' });
    const es = new EventSource(api.agents.runStreamUrl(runId));
    const types = ['status', 'thinking', 'text', 'tool_call', 'tool_result', 'checkpoint', 'guardrail', 'done', 'error'];
    const push = (ev: MessageEvent) => {
      try {
        const e = JSON.parse(ev.data) as RunEvent;
        setState((s) => (s.events.some((x) => x.seq === e.seq) ? s : { ...s, status: 'live', events: [...s.events, e].sort((a, b) => a.seq - b.seq) }));
      } catch { /* ignore */ }
    };
    for (const t of types) es.addEventListener(t, push as EventListener);
    es.addEventListener('end', ((ev: MessageEvent) => {
      let endStatus: string | undefined;
      try { endStatus = JSON.parse(ev.data).status; } catch { /* ignore */ }
      setState((s) => ({ ...s, status: 'ended', endStatus }));
      es.close();
    }) as EventListener);
    es.onopen = () => setState((s) => ({ ...s, status: s.status === 'ended' ? 'ended' : 'live' }));
    es.onerror = () => setState((s) => (s.status === 'ended' ? s : { ...s, status: 'error' }));
    return () => es.close();
  }, [runId, enabled]);

  return state;
}
