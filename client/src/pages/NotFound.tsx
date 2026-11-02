import { useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth, homeFor } from '@/store/auth';

export default function NotFound() {
  const navigate = useNavigate();
  const me = useAuth((s) => s.me);
  return (
    <div className="page flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-muted text-muted-foreground"><Compass className="h-6 w-6" /></div>
      <h1 className="mt-5 text-2xl font-semibold">This page doesn't exist</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">The link may be outdated, or the record you're looking for was removed.</p>
      <Button className="mt-6" onClick={() => navigate(homeFor(me?.user.role))}>Back home</Button>
    </div>
  );
}
