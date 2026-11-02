import { AlertTriangle } from 'lucide-react';
import { EmptyState } from '@/components/ui/feedback';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/hooks/queries';

/** Error branch for a page's primary query: EmptyState + Retry (calls `refetch`). */
export function QueryError({ what, error, refetch, compact, className }: { what: string; error: unknown; refetch: () => unknown; compact?: boolean; className?: string }) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title={`Couldn't load ${what}`}
      description={errorMessage(error)}
      action={<Button size="sm" variant="secondary" onClick={() => refetch()}>Retry</Button>}
      compact={compact}
      className={className}
    />
  );
}
