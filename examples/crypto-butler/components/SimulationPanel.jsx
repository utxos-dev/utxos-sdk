'use client';
import { useState } from 'react';

export function SimulationPanel({ simulation }) {
  const [expanded, setExpanded] = useState(false);

  if (!simulation) return null;

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <p className="text-xs font-semibold text-green-400 uppercase tracking-widest">
            Testnet Simulation
          </p>
        </div>
        <span className="text-xs text-gray-500 font-mono">{simulation.network}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-white/5 rounded-lg p-2">
          <p className="text-xs text-gray-500">Transactions</p>
          <p className="text-base font-bold text-white">{simulation.totalTransactions}</p>
        </div>
        <div className="bg-white/5 rounded-lg p-2">
          <p className="text-xs text-gray-500">Est. Gas</p>
          <p className="text-base font-bold text-white">{simulation.totalGasEstimate}</p>
        </div>
      </div>

      {/* Transaction list */}
      <div className="space-y-2">
        {simulation.transactions.slice(0, expanded ? undefined : 2).map((tx, i) => (
          <div key={i} className="bg-white/5 rounded-lg p-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-300 leading-snug">{tx.action}</p>
                <p className="text-xs text-gray-600 font-mono mt-1 truncate">{tx.txHash}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                <span className="text-xs text-green-400">{tx.status}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {simulation.transactions.length > 2 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-gold-400 hover:text-gold-300 mt-2 transition-colors"
        >
          {expanded ? 'Show less' : `+${simulation.transactions.length - 2} more transactions`}
        </button>
      )}

      <p className="text-xs text-gray-600 mt-3 italic">{simulation.disclaimer}</p>
    </div>
  );
}
