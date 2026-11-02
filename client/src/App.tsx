import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth, homeFor } from '@/store/auth';
import { AppShell } from '@/components/layout/app-shell';
import { LogoMark } from '@/components/ui/logo';
import type { Role } from '@/types';

const Login = lazy(() => import('@/pages/Login'));
const Overview = lazy(() => import('@/pages/Overview'));
const Campaigns = lazy(() => import('@/pages/campaigns/Campaigns'));
const CampaignNew = lazy(() => import('@/pages/campaigns/CampaignNew'));
const CampaignDetail = lazy(() => import('@/pages/campaigns/CampaignDetail'));
const Creators = lazy(() => import('@/pages/creators/Creators'));
const CreatorDetail = lazy(() => import('@/pages/creators/CreatorDetail'));
const Collaborations = lazy(() => import('@/pages/collaborations/Collaborations'));
const CollaborationDetail = lazy(() => import('@/pages/collaborations/CollaborationDetail'));
const Approvals = lazy(() => import('@/pages/governance/Approvals'));
const Finance = lazy(() => import('@/pages/governance/Finance'));
const Audit = lazy(() => import('@/pages/governance/Audit'));
const Agents = lazy(() => import('@/pages/agents/Agents'));
const AgentSessionDetail = lazy(() => import('@/pages/agents/AgentSessionDetail'));
const AgentRun = lazy(() => import('@/pages/agents/AgentRun'));
const McpServer = lazy(() => import('@/pages/agents/McpServer'));
const Evaluation = lazy(() => import('@/pages/agents/Evaluation'));
const AgencyWorkspace = lazy(() => import('@/pages/agency/AgencyWorkspace'));
const Settings = lazy(() => import('@/pages/Settings'));
const CreatorHome = lazy(() => import('@/pages/creator/CreatorHome'));
const CreatorOffers = lazy(() => import('@/pages/creator/CreatorOffers'));
const CreatorOfferDetail = lazy(() => import('@/pages/creator/CreatorOfferDetail'));
const CreatorWallet = lazy(() => import('@/pages/creator/CreatorWallet'));
const CreatorProfile = lazy(() => import('@/pages/creator/CreatorProfile'));
const NotFound = lazy(() => import('@/pages/NotFound'));

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 animate-fade-in">
        <LogoMark size={40} />
        <div className="h-1 w-24 overflow-hidden rounded-full bg-muted"><div className="h-full w-1/2 animate-[shimmer_1.2s_linear_infinite] rounded-full bg-primary" /></div>
      </div>
    </div>
  );
}

function RequireAuth({ roles, children }: { roles?: Role[]; children: React.ReactElement }) {
  const status = useAuth((s) => s.status);
  const me = useAuth((s) => s.me);
  const location = useLocation();
  if (status === 'idle' || status === 'loading') return <Splash />;
  if (status === 'anonymous' || !me) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (roles && !roles.includes(me.user.role) && me.user.role !== 'ADMIN') return <Navigate to={homeFor(me.user.role)} replace />;
  return children;
}

const OPS: Role[] = ['BRAND', 'AGENCY', 'ADMIN'];
const CREATOR: Role[] = ['CREATOR', 'ADMIN'];

export function App() {
  const bootstrap = useAuth((s) => s.bootstrap);
  useEffect(() => { bootstrap(); }, [bootstrap]);

  return (
    <Suspense fallback={<Splash />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route path="/" element={<RequireAuth roles={OPS}><Overview /></RequireAuth>} />
          <Route path="/campaigns" element={<RequireAuth roles={OPS}><Campaigns /></RequireAuth>} />
          <Route path="/campaigns/new" element={<RequireAuth roles={OPS}><CampaignNew /></RequireAuth>} />
          <Route path="/campaigns/:id" element={<RequireAuth roles={OPS}><CampaignDetail /></RequireAuth>} />
          <Route path="/creators" element={<RequireAuth roles={OPS}><Creators /></RequireAuth>} />
          <Route path="/creators/:id" element={<RequireAuth roles={OPS}><CreatorDetail /></RequireAuth>} />
          <Route path="/collaborations" element={<RequireAuth roles={OPS}><Collaborations /></RequireAuth>} />
          <Route path="/collaborations/:id" element={<RequireAuth roles={OPS}><CollaborationDetail /></RequireAuth>} />
          <Route path="/approvals" element={<RequireAuth roles={OPS}><Approvals /></RequireAuth>} />
          <Route path="/finance" element={<RequireAuth roles={OPS}><Finance /></RequireAuth>} />
          <Route path="/audit" element={<RequireAuth roles={OPS}><Audit /></RequireAuth>} />
          <Route path="/agents" element={<RequireAuth roles={OPS}><Agents /></RequireAuth>} />
          <Route path="/agents/sessions/:id" element={<RequireAuth roles={OPS}><AgentSessionDetail /></RequireAuth>} />
          <Route path="/agents/runs/:id" element={<RequireAuth roles={OPS}><AgentRun /></RequireAuth>} />
          <Route path="/mcp" element={<RequireAuth roles={OPS}><McpServer /></RequireAuth>} />
          <Route path="/evaluation" element={<RequireAuth roles={OPS}><Evaluation /></RequireAuth>} />
          <Route path="/agency" element={<RequireAuth roles={['AGENCY', 'ADMIN']}><AgencyWorkspace /></RequireAuth>} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/creator" element={<RequireAuth roles={CREATOR}><CreatorHome /></RequireAuth>} />
          <Route path="/creator/offers" element={<RequireAuth roles={CREATOR}><CreatorOffers /></RequireAuth>} />
          <Route path="/creator/offers/:id" element={<RequireAuth roles={CREATOR}><CreatorOfferDetail /></RequireAuth>} />
          <Route path="/creator/wallet" element={<RequireAuth roles={CREATOR}><CreatorWallet /></RequireAuth>} />
          <Route path="/creator/profile" element={<RequireAuth roles={CREATOR}><CreatorProfile /></RequireAuth>} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
