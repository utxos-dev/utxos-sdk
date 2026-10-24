'use client';

const AGENTS = {
  researcher: {
    icon: '🔬',
    label: 'Researcher',
    color: 'text-blue-400',
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/10',
  },
  risk: {
    icon: '⚖️',
    label: 'Risk Analyst',
    color: 'text-purple-400',
    border: 'border-purple-500/30',
    bg: 'bg-purple-500/10',
  },
  cfo: {
    icon: '💼',
    label: 'CFO Agent',
    color: 'text-gold-400',
    border: 'border-gold-500/30',
    bg: 'bg-gold-500/10',
  },
};

export function AgentPanel({ agentLog = [], isLoading, activeAgent }) {
  const allAgents = ['researcher', 'risk', 'cfo'];

  // Derive which agents have completed based on log
  const completed = new Set(agentLog.map(l => l.agent));

  return (
    <div className="glass rounded-xl p-4 space-y-3">
      <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-3">
        Agent Swarm
      </p>

      {allAgents.map((agentKey) => {
        const agent = AGENTS[agentKey];
        const isActive = isLoading && activeAgent === agentKey;
        const isDone = completed.has(agentKey) && !isActive;
        const log = agentLog.filter(l => l.agent === agentKey).pop();

        return (
          <div
            key={agentKey}
            className={`rounded-lg p-3 border transition-all duration-300 ${
              isActive
                ? `${agent.bg} ${agent.border} agent-active`
                : isDone
                ? 'bg-white/5 border-white/10'
                : 'bg-transparent border-white/5'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">{agent.icon}</span>
                <span className={`text-xs font-semibold ${isActive || isDone ? agent.color : 'text-gray-600'}`}>
                  {agent.label}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {isActive && (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-current dot-1" style={{ color: '#f5c842' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-current dot-2" style={{ color: '#f5c842' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-current dot-3" style={{ color: '#f5c842' }} />
                  </>
                )}
                {isDone && <span className="text-green-400 text-xs">✓</span>}
              </div>
            </div>

            {log && (
              <p className="text-xs text-gray-400 mt-1 ml-6 leading-relaxed">
                {log.status}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
