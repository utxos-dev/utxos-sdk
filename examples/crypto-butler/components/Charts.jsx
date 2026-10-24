'use client';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';

const COLORS = ['#f5c842', '#60a5fa', '#34d399', '#a78bfa', '#fb923c', '#f472b6'];

export function AllocationChart({ allocation }) {
  const data = allocation.map((a, i) => ({
    name: `${a.protocol} ${a.pool}`,
    value: a.percentage,
    amount: a.amountUsd,
    apy: a.apy,
    color: COLORS[i % COLORS.length],
  }));

  return (
    <div className="flex flex-col md:flex-row gap-6 items-center">
      {/* Pie Chart */}
      <div className="w-48 h-48 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={72}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: '#060d1f', border: '1px solid rgba(245,200,66,0.2)', borderRadius: 8, fontSize: 12 }}
              formatter={(value, name) => [`${value}%`, name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex-1 space-y-2">
        {data.map((item, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
              <span className="text-xs text-gray-300 truncate">{item.name}</span>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-xs font-mono text-gold-400">{item.apy}%</span>
              <span className="text-xs text-gray-400">${item.amount?.toFixed(0)}</span>
              <span className="text-xs font-semibold text-white">{item.value}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProjectionChart({ projections, initialAmount }) {
  const data = [
    { month: 'Now', value: initialAmount },
    { month: '3mo', value: projections.months3 },
    { month: '6mo', value: projections.months6 },
    { month: '12mo', value: projections.months12 },
  ];

  const gain = projections.months12 - initialAmount;
  const gainPct = ((gain / initialAmount) * 100).toFixed(1);

  return (
    <div>
      <div className="flex items-end justify-between mb-4">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider">Projected at 12mo</p>
          <p className="text-2xl font-display font-bold text-white">
            ${projections.months12?.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Total gain</p>
          <p className="text-lg font-semibold text-green-400">+${gain.toFixed(0)} <span className="text-sm">({gainPct}%)</span></p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f5c842" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f5c842" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
          />
          <Tooltip
            contentStyle={{ background: '#060d1f', border: '1px solid rgba(245,200,66,0.2)', borderRadius: 8, fontSize: 12 }}
            formatter={(v) => [`$${v.toFixed(0)}`, 'Portfolio Value']}
          />
          <Area type="monotone" dataKey="value" stroke="#f5c842" strokeWidth={2} fill="url(#goldGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
