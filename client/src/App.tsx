import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { OverviewTab } from './components/OverviewTab';
import { CampaignsTab } from './components/CampaignsTab';
import { CreatorMarketplaceTab } from './components/CreatorMarketplaceTab';
import { CollaborationsTab } from './components/CollaborationsTab';
import { CheckpointsQueueTab } from './components/CheckpointsQueueTab';
import { FinancialLedgerTab } from './components/FinancialLedgerTab';
import { AuditLogTab } from './components/AuditLogTab';
import { AgentHubTab } from './components/AgentHubTab';
import { EvaluationLabTab } from './components/EvaluationLabTab';
import { AgencyWorkspaceView } from './components/AgencyWorkspaceView';
import { CreatorPortalView } from './components/CreatorPortalView';
import { AgentRunnerModal } from './components/AgentRunnerModal';
import { api } from './services/api';
import {
  Brand,
  Agency,
  Creator,
  Campaign,
  Collaboration,
  ApprovalCheckpoint,
  LedgerEntry,
  AuditLog,
  AgentSession,
  EvaluationBenchmark,
} from './types';

export const App: React.FC = () => {
  // Navigation & Role State
  const [currentRole, setCurrentRole] = useState<'brand' | 'agency' | 'creator' | 'agent'>('brand');
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [isAgentRunnerOpen, setIsAgentRunnerOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Data Store
  const [brands, setBrands] = useState<Brand[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [collaborations, setCollaborations] = useState<Collaboration[]>([]);
  const [checkpoints, setCheckpoints] = useState<ApprovalCheckpoint[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [agentSessions, setAgentSessions] = useState<AgentSession[]>([]);
  const [benchmarks, setBenchmarks] = useState<EvaluationBenchmark[]>([]);

  // Reload all data
  const loadAllData = async () => {
    try {
      const [
        brandsRes,
        agenciesRes,
        creatorsRes,
        campaignsRes,
        collabsRes,
        chkRes,
        ledgerRes,
        auditRes,
        sessionsRes,
        benchmarksRes,
      ] = await Promise.all([
        api.getBrands(),
        api.getAgencies(),
        api.getCreators(),
        api.getCampaigns(),
        api.getCollaborations(),
        api.getCheckpoints(),
        api.getLedger(),
        api.getAuditLogs(),
        api.getAgentSessions(),
        api.getBenchmarks(),
      ]);

      setBrands(brandsRes);
      setAgencies(agenciesRes);
      setCreators(creatorsRes);
      setCampaigns(campaignsRes);
      setCollaborations(collabsRes);
      setCheckpoints(chkRes);
      setLedgerEntries(ledgerRes);
      setAuditLogs(auditRes);
      setAgentSessions(sessionsRes);
      setBenchmarks(benchmarksRes);
    } catch (err) {
      console.error('Failed to load CMI platform data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Handlers
  const handleCreateCampaign = async (campaignData: any) => {
    await api.createCampaign(campaignData);
    await loadAllData();
  };

  const handleSendOffer = async (offerData: any) => {
    await api.callMcpTool('sess_agent_cmi_alpha', 'send_collaboration_offer', offerData);
    await loadAllData();
  };

  const handleSubmitDeliverable = async (
    deliverableId: string,
    data: { content_url: string; caption?: string }
  ) => {
    await api.submitDeliverable(deliverableId, data);
    await loadAllData();
  };

  const handleReleasePayment = async (
    collaborationId: string,
    deliverableId: string,
    amount: number
  ) => {
    await api.callMcpTool('sess_agent_cmi_alpha', 'release_payment', {
      collaboration_id: collaborationId,
      deliverable_id: deliverableId,
      amount,
    });
    await loadAllData();
  };

  const handleResolveCheckpoint = async (
    id: string,
    decision: 'APPROVED' | 'REJECTED',
    notes?: string
  ) => {
    await api.resolveCheckpoint(id, decision, notes);
    await loadAllData();
  };

  const handleRunAgent = async (
    sessionId: string,
    campaignId: string,
    goalPrompt: string
  ) => {
    const summary = await api.runAgent(sessionId, campaignId, goalPrompt);
    await loadAllData();
    return summary;
  };

  const handleCallTool = async (sessionId: string, toolName: string, params: any) => {
    const res = await api.callMcpTool(sessionId, toolName, params);
    await loadAllData();
    return res;
  };

  const handleRunSimulation = async (scenarioName?: string, count?: number) => {
    await api.runSimulation(scenarioName, count);
    await loadAllData();
  };

  const handleRoleChange = (role: 'brand' | 'agency' | 'creator' | 'agent') => {
    setCurrentRole(role);
    if (role === 'agency') {
      setActiveTab('agency_workspace');
    } else if (role === 'creator') {
      setActiveTab('creator_portal');
    } else if (role === 'agent') {
      setActiveTab('agent_hub');
    } else {
      setActiveTab('overview');
    }
  };

  const pendingCheckpointsCount = checkpoints.filter((c) => c.status === 'PENDING').length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans">
      {/* Top Navigation */}
      <Navbar
        currentRole={currentRole}
        setCurrentRole={handleRoleChange}
        pendingCheckpointsCount={pendingCheckpointsCount}
        onOpenAgentRunner={() => setIsAgentRunnerOpen(true)}
        onSelectTab={setActiveTab}
      />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Left Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            if (tab === 'agent_hub') setCurrentRole('agent');
          }}
          pendingCheckpointsCount={pendingCheckpointsCount}
        />

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
              <span className="w-4 h-4 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin mr-2"></span>
              Initializing Creator Marketing Infrastructure Core...
            </div>
          ) : (
            <>
              {/* Role-Specific Overrides */}
              {activeTab === 'agency_workspace' && (
                <AgencyWorkspaceView
                  agencies={agencies}
                  brands={brands}
                  campaigns={campaigns}
                  onSelectTab={setActiveTab}
                />
              )}

              {activeTab === 'creator_portal' && (
                <CreatorPortalView
                  creators={creators}
                  collaborations={collaborations}
                  onRespondCollab={async (id, status) => {
                    await api.respondCollaboration(id, status);
                    await loadAllData();
                  }}
                  onSubmitDeliverable={handleSubmitDeliverable}
                />
              )}

              {/* Standard Platform Tabs */}
              {activeTab === 'overview' && (
                <OverviewTab
                  campaigns={campaigns}
                  checkpoints={checkpoints}
                  auditLogs={auditLogs}
                  onOpenAgentRunner={() => setIsAgentRunnerOpen(true)}
                  onSelectTab={setActiveTab}
                />
              )}

              {activeTab === 'campaigns' && (
                <CampaignsTab
                  campaigns={campaigns}
                  brands={brands}
                  onCreateCampaign={handleCreateCampaign}
                  onSelectTab={setActiveTab}
                />
              )}

              {activeTab === 'creators' && (
                <CreatorMarketplaceTab
                  creators={creators}
                  campaigns={campaigns}
                  onSendOffer={handleSendOffer}
                  onSelectTab={setActiveTab}
                />
              )}

              {activeTab === 'collaborations' && (
                <CollaborationsTab
                  collaborations={collaborations}
                  onSubmitDeliverable={handleSubmitDeliverable}
                  onReleasePayment={handleReleasePayment}
                  onSelectTab={setActiveTab}
                />
              )}

              {activeTab === 'checkpoints' && (
                <CheckpointsQueueTab
                  checkpoints={checkpoints}
                  onResolveCheckpoint={handleResolveCheckpoint}
                />
              )}

              {activeTab === 'ledger' && (
                <FinancialLedgerTab ledgerEntries={ledgerEntries} />
              )}

              {activeTab === 'audit' && (
                <AuditLogTab auditLogs={auditLogs} />
              )}

              {activeTab === 'agent_hub' && (
                <AgentHubTab
                  agentSessions={agentSessions}
                  onOpenAgentRunner={() => setIsAgentRunnerOpen(true)}
                  onCallTool={handleCallTool}
                />
              )}

              {activeTab === 'evaluation' && (
                <EvaluationLabTab
                  benchmarks={benchmarks}
                  onRunSimulation={handleRunSimulation}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Autonomous AI Marketing Agent Modal */}
      <AgentRunnerModal
        isOpen={isAgentRunnerOpen}
        onClose={() => setIsAgentRunnerOpen(false)}
        campaigns={campaigns}
        agentSessions={agentSessions}
        onRunAgent={handleRunAgent}
        onSelectTab={setActiveTab}
      />
    </div>
  );
};

export default App;
