'use client';
import { useState, useRef, useEffect } from 'react';
import { AllocationChart, ProjectionChart } from '../components/Charts';
import { AgentPanel } from '../components/AgentPanel';
import { SimulationPanel } from '../components/SimulationPanel';
import WalletConnect from '../components/WalletConnect';

const EXAMPLE_PROMPTS = [
  "Grow my $5,000 USDC at moderate risk over 12 months",
  "I have $10K and want to preserve capital while earning yield",
  "Aggressive strategy for $2,000 USDC — I can handle risk",
  "Saving $8K for a car in 6 months, low risk only",
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning.";
  if (hour < 17) return "Good afternoon.";
  return "Good evening.";
}

export default function Home() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [agentLog, setAgentLog] = useState([]);
  const [activeAgent, setActiveAgent] = useState(null);
  const [currentResult, setCurrentResult] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  async function sendMessage(text) {
    const msg = text || input.trim();
    if (!msg || isLoading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setIsLoading(true);
    setAgentLog([]);
    setCurrentResult(null);
    setActiveAgent('researcher');

    // Simulate agent progression
    const agentTimer1 = setTimeout(() => setActiveAgent('risk'), 2500);
    const agentTimer2 = setTimeout(() => setActiveAgent('cfo'), 5000);

    try {
      const res = await fetch('/api/butler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });

      const data = await res.json();

      clearTimeout(agentTimer1);
      clearTimeout(agentTimer2);
      setActiveAgent(null);

      if (!res.ok) throw new Error(data.error);

      setAgentLog(data.agentLog || []);
      setCurrentResult(data);

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.recommendation,
        simulation: data.simulation,
        riskProfile: data.riskProfile,
        yieldsAnalyzed: data.yieldsAnalyzed,
      }]);

    } catch (err) {
      clearTimeout(agentTimer1);
      clearTimeout(agentTimer2);
      setActiveAgent(null);
      setMessages(prev => [...prev, {
        role: 'error',
        content: err.message || 'Something went wrong. Please try again.',
      }]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── HEADER ── */}
      <header className="border-b border-white/5 bg-navy-900/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-gold-400 to-gold-600 rounded-lg flex items-center justify-center shadow-lg shadow-gold-500/20">
              <span className="text-navy-900 font-bold text-sm">B</span>
            </div>
            <div>
              <h1 className="font-display font-bold text-white tracking-tight leading-none">
                Crypto Butler
              </h1>
              <p className="text-xs text-gray-500">Your DeFi Wealth Agent · Cardano Preprod</p>
            </div>
          </div>
          <WalletConnect onConnected={() => setWalletConnected(true)} />
        </div>
      </header>

      {/* ── MAIN ── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 flex gap-6">

        {/* ── LEFT: Chat ── */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Welcome state */}
          {messages.length === 0 && !isLoading && (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-gold-400/20 to-gold-600/10 rounded-2xl border border-gold-500/20 flex items-center justify-center mb-6">
                <span className="text-3xl">🎩</span>
              </div>
              <h2 className="font-display text-3xl font-bold text-white mb-3">
                {getGreeting()}
              </h2>
              <p className="text-gray-400 max-w-md mb-8 leading-relaxed">
                Tell me your financial goal and I will deploy a team of AI agents to find the best DeFi strategy for you — live yields, risk-adjusted, ready to execute.
              </p>

              {!walletConnected && (
                <div className="glass rounded-xl px-5 py-3 mb-8 text-sm text-gold-400 border border-gold-500/20">
                  💡 Connect your wallet to simulate on Cardano Preprod testnet
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl w-full">
                {EXAMPLE_PROMPTS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(p)}
                    className="glass text-left text-sm text-gray-300 hover:text-white hover:border-gold-500/40 px-4 py-3 rounded-xl transition-all hover:bg-gold-500/5"
                  >
                    <span className="text-gold-500 mr-2">›</span>{p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 space-y-6 overflow-y-auto pb-4">
            {messages.map((msg, i) => (
              <div key={i} className="msg-enter">
                {msg.role === 'user' && (
                  <div className="flex justify-end">
                    <div className="bg-gold-500/10 border border-gold-500/20 rounded-2xl rounded-tr-sm px-4 py-3 max-w-lg">
                      <p className="text-sm text-gray-100">{msg.content}</p>
                    </div>
                  </div>
                )}

                {msg.role === 'assistant' && (
                  <AssistantMessage
                    rec={msg.content}
                    simulation={msg.simulation}
                    riskProfile={msg.riskProfile}
                  />
                )}

                {msg.role === 'error' && (
                  <div className="glass rounded-xl p-4 border border-red-500/20">
                    <p className="text-sm text-red-400">⚠️ {msg.content}</p>
                  </div>
                )}
              </div>
            ))}

            {/* Loading state */}
            {isLoading && (
              <div className="msg-enter glass rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-7 h-7 bg-gold-500/20 rounded-lg flex items-center justify-center">
                    <span className="text-sm">🎩</span>
                  </div>
                  <span className="text-sm font-semibold text-gold-400">Butler is thinking...</span>
                </div>
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-gold-400 dot-1" />
                  <span className="w-2 h-2 rounded-full bg-gold-400 dot-2" />
                  <span className="w-2 h-2 rounded-full bg-gold-400 dot-3" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="mt-4 glass-bright rounded-2xl p-2 flex gap-2 sticky bottom-4">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Tell me your goal... e.g. 'Grow $5K at moderate risk over 12 months'"
              className="flex-1 bg-transparent px-4 py-3 text-sm text-white placeholder-gray-600 outline-none"
              disabled={isLoading}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              className="bg-gold-500 hover:bg-gold-400 disabled:bg-white/10 disabled:cursor-not-allowed text-navy-900 disabled:text-gray-600 font-semibold text-sm px-5 py-2.5 rounded-xl transition-all"
            >
              {isLoading ? '...' : 'Ask'}
            </button>
          </div>
        </div>

        {/* ── RIGHT: Panels ── */}
        <div className="w-72 flex-shrink-0 hidden lg:flex flex-col gap-4">
          <AgentPanel
            agentLog={agentLog}
            isLoading={isLoading}
            activeAgent={activeAgent}
          />
          {currentResult?.simulation && (
            <SimulationPanel simulation={currentResult.simulation} />
          )}
        </div>
      </main>
    </div>
  );
}

// ── ASSISTANT MESSAGE ────────────────────────────────────────────
function AssistantMessage({ rec, simulation, riskProfile }) {
  const [tab, setTab] = useState('strategy');

  if (!rec) return null;

  const tabs = [
    { id: 'strategy', label: 'Strategy' },
    { id: 'allocation', label: 'Allocation' },
    { id: 'projection', label: 'Projection' },
    ...(simulation ? [{ id: 'simulate', label: 'Testnet' }] : []),
  ];

  return (
    <div className="glass rounded-2xl overflow-hidden">
      {/* Butler header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <div className="w-7 h-7 bg-gold-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-sm">🎩</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{rec.greeting}</p>
          {riskProfile && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 bg-gold-500/10 border border-gold-500/20 rounded-full text-gold-400 capitalize">
                {riskProfile.tolerance} risk
              </span>
              <span className="text-xs text-gray-500">{riskProfile.timeHorizonMonths}mo horizon</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex px-5 gap-1 border-b border-white/5">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`text-xs px-3 py-2 font-medium transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'border-gold-400 text-gold-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-5">

        {/* STRATEGY */}
        {tab === 'strategy' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-300 leading-relaxed">{rec.summary}</p>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">Blended APY</p>
                <p className="text-xl font-bold text-gold-400">{rec.projections?.blendedApy?.toFixed(1)}%</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">Protocols</p>
                <p className="text-xl font-bold text-white">{rec.allocation?.length}</p>
              </div>
            </div>

            {rec.risks?.length > 0 && (
              <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-3">
                <p className="text-xs font-semibold text-orange-400 mb-2">⚠️ Key Risks</p>
                <ul className="space-y-1">
                  {rec.risks.map((r, i) => (
                    <li key={i} className="text-xs text-gray-400">• {r}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs text-gray-500 italic border-t border-white/5 pt-3">
              "{rec.butlerNote}"
            </p>
          </div>
        )}

        {/* ALLOCATION */}
        {tab === 'allocation' && rec.allocation && (
          <div className="space-y-4">
            <AllocationChart allocation={rec.allocation} />
            <div className="space-y-2 mt-4">
              {rec.allocation.map((a, i) => (
                <div key={i} className="flex items-start gap-3 bg-white/5 rounded-xl p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-white capitalize">
                        {a.protocol} <span className="text-gray-400">{a.pool}</span>
                      </p>
                      <span className="text-xs font-mono text-gold-400 font-bold">{a.apy}% APY</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{a.role} · {a.chain}</p>
                    <p className="text-xs text-gray-400 mt-1">{a.reasoning}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PROJECTION */}
        {tab === 'projection' && rec.projections && (
          <ProjectionChart
            projections={rec.projections}
            initialAmount={riskProfile?.targetAmountUsd || 5000}
          />
        )}

        {/* SIMULATE */}
        {tab === 'simulate' && simulation && (
          <div className="lg:hidden">
            <SimulationPanel simulation={simulation} />
          </div>
        )}
        {tab === 'simulate' && simulation && (
          <div className="hidden lg:block">
            <p className="text-xs text-gray-500">See the Testnet panel on the right →</p>
          </div>
        )}
      </div>
    </div>
  );
}
