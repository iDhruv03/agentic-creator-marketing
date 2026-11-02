import { useQueries } from '@tanstack/react-query';
import { useCollaborations } from '@/hooks/queries';
import { api } from '@/lib/api';
import type { Collaboration } from '@/types';

/**
 * The creator's collaborations, with COUNTERED ones hydrated with their message thread so the UI can tell
 * who made the last counter (the list endpoint omits messages). Uses the same ['collaboration', id] key as
 * useCollaboration so the SSE feed keeps it live.
 */
export function useCreatorCollaborations(): { data: Collaboration[]; isLoading: boolean; isError: boolean; error: unknown; refetch: () => unknown } {
  const list = useCollaborations();
  const countered = (list.data ?? []).filter((c) => c.status === 'COUNTERED');
  const details = useQueries({ queries: countered.map((c) => ({ queryKey: ['collaboration', c.id], queryFn: () => api.collaborations.get(c.id) })) });
  const byId = new Map<string, Collaboration>();
  details.forEach((q) => { if (q.data) byId.set(q.data.id, q.data); });
  return { data: (list.data ?? []).map((c) => byId.get(c.id) ?? c), isLoading: list.isLoading, isError: list.isError, error: list.error, refetch: list.refetch };
}
