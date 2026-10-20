import React, { useState } from 'react';
import {
  WalletCards,
  ArrowDownLeft,
  ArrowUpRight,
  Lock,
  DollarSign,
  Filter,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { LedgerEntry } from '../types';

interface FinancialLedgerTabProps {
  ledgerEntries: LedgerEntry[];
}

export const FinancialLedgerTab: React.FC<FinancialLedgerTabProps> = ({ ledgerEntries }) => {
  const [filterType, setFilterType] = useState<string>('ALL');

  const totalAllocated = ledgerEntries
    .filter((e) => e.entry_type === 'BUDGET_ALLOCATION')
    .reduce((acc, e) => acc + e.amount, 0);

  const totalEscrow = ledgerEntries
    .filter((e) => e.entry_type === 'ESCROW_HOLD')
    .reduce((acc, e) => acc + e.amount, 0);

  const totalPayouts = ledgerEntries
    .filter((e) => e.entry_type === 'PAYOUT_RELEASE')
    .reduce((acc, e) => acc + e.amount, 0);

  const filteredEntries = ledgerEntries.filter((e) => {
    if (filterType !== 'ALL' && e.entry_type !== filterType) return false;
    return true;
  });

  const getEntryBadge = (type: string) => {
    switch (type) {
      case 'BUDGET_ALLOCATION':
        return { label: 'ALLOCATION', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' };
      case 'ESCROW_HOLD':
        return { label: 'ESCROW HOLD', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
      case 'PAYOUT_RELEASE':
        return { label: 'PAYOUT RELEASE', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
      default:
        return { label: type, color: 'bg-slate-800 text-slate-400 border-slate-700' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <WalletCards className="w-5 h-5 text-emerald-400" />
            <span>Financial Ledger & Escrow Accounting</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable financial records linking every budget deposit, escrow hold, and creator payout to initiating actors.
          </p>
        </div>

        {/* Filter */}
        <div className="flex items-center space-x-2">
          {['ALL', 'BUDGET_ALLOCATION', 'ESCROW_HOLD', 'PAYOUT_RELEASE'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                filterType === type
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 bg-slate-900 border border-slate-800 hover:text-white'
              }`}
            >
              {type.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Capital Position Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl glass-panel border border-slate-800">
          <span className="text-xs text-slate-500 uppercase tracking-wider">Total Capital Allocated</span>
          <div className="text-2xl font-extrabold text-white mt-1 font-mono">
            ${totalAllocated.toLocaleString()}
          </div>
          <span className="text-[11px] text-indigo-400 mt-1 block">Deposited via corporate accounts</span>
        </div>

        <div className="p-5 rounded-2xl glass-panel border border-slate-800">
          <span className="text-xs text-slate-500 uppercase tracking-wider">Escrow Commitments</span>
          <div className="text-2xl font-extrabold text-amber-400 mt-1 font-mono">
            ${totalEscrow.toLocaleString()}
          </div>
          <span className="text-[11px] text-amber-400/80 mt-1 block">Locked pending deliverable approval</span>
        </div>

        <div className="p-5 rounded-2xl glass-panel border border-slate-800">
          <span className="text-xs text-slate-500 uppercase tracking-wider">Released Payouts</span>
          <div className="text-2xl font-extrabold text-emerald-400 mt-1 font-mono">
            ${totalPayouts.toLocaleString()}
          </div>
          <span className="text-[11px] text-emerald-400/80 mt-1 block">Disbursed to verified creator wallets</span>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="rounded-2xl glass-panel border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Transaction ID</th>
                <th className="py-3 px-4">Campaign</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Post-Balance</th>
                <th className="py-3 px-4">Audit Memo</th>
                <th className="py-3 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300">
              {filteredEntries.map((entry) => {
                const badge = getEntryBadge(entry.entry_type);
                const isAgent = entry.actor_type === 'AGENT';

                return (
                  <tr key={entry.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3 px-4 font-mono text-emerald-400 font-medium">
                      {entry.id}
                    </td>
                    <td className="py-3 px-4 font-medium text-white max-w-[180px] truncate">
                      {entry.campaign_title || entry.campaign_id}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          isAgent
                            ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        {isAgent ? 'AGENT' : 'HUMAN'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.color}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-white">
                      ${entry.amount.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">
                      ${entry.balance_after?.toLocaleString() || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px] max-w-[240px] truncate">
                      {entry.note}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                      {entry.created_at}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
