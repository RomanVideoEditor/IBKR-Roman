// src/components/PerformanceChart.jsx
import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar, ResponsiveContainer } from 'recharts';

const FINNHUB_KEY = 'd6rv1g9r01qgflm161g0d6rv1g9r01qgflm161gg';

async function fetchSPY(from, to) {
  try {
    const fromTs = Math.floor(new Date(from).getTime() / 1000);
    const toTs = Math.floor(new Date(to).getTime() / 1000);
    const res = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=SPY&resolution=M&from=${fromTs}&to=${toTs}&token=${FINNHUB_KEY}`);
    const d = await res.json();
    if (!d.c || d.s === 'no_data') return [];
    return d.t.map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().substring(0, 10),
      close: d.c[i],
    }));
  } catch { return []; }
}

export default function PerformanceChart({ navPoints }) {
  const [spyData, setSpyData] = useState([]);
  const [period, setPeriod] = useState('all');

  useEffect(() => {
    if (!navPoints?.length) return;
    const from = navPoints[0].periodStart;
    const to = navPoints[navPoints.length - 1].periodEnd;
    fetchSPY(from, to).then(setSpyData);
  }, [navPoints?.length]);

  if (!navPoints?.length) return (
    <div className="empty-state">Upload at least one CSV to see performance chart.</div>
  );

  // Build cumulative TWR chart data from nav points
  let cumTwr = 100;
  const chartData = [];

  navPoints.forEach((p, i) => {
    if (i === 0) {
      chartData.push({ date: p.periodStart, portfolio: 100, deposits: p.deposits });
    }
    cumTwr = cumTwr * (1 + p.twr / 100);
    chartData.push({ date: p.periodEnd, portfolio: parseFloat(cumTwr.toFixed(2)), deposits: p.deposits });
  });

  // Add SPY normalized to 100
  let spyBase = null;
  const spyMap = {};
  spyData.forEach(d => { spyMap[d.date.substring(0, 7)] = d.close; });

  chartData.forEach(d => {
    const month = d.date.substring(0, 7);
    const spyClose = spyMap[month];
    if (spyClose) {
      if (!spyBase) spyBase = spyClose;
      d.spy = parseFloat(((spyClose / spyBase) * 100).toFixed(2));
    }
  });

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: '#161924', border: '1px solid #1e2235', padding: '12px', borderRadius: '8px', fontSize: '13px' }}>
        <div style={{ color: '#8b90aa', marginBottom: '6px' }}>{label}</div>
        {payload.map(p => (
          <div key={p.name} style={{ color: p.color }}>
            {p.name}: {p.value?.toFixed(2)}{p.name !== 'Deposits ($)' ? '' : ''}
            {p.name === 'Portfolio' || p.name === 'S&P 500' ? '%' : ''}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="perf-chart-container">
      <div className="chart-header">
        <h3>Portfolio Performance</h3>
        <div className="period-tabs">
          {['1m','3m','6m','1y','all'].map(p => (
            <button key={p} className={period === p ? 'period-tab active' : 'period-tab'} onClick={() => setPeriod(p)}>
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '8px', fontSize: '11px', color: '#545870' }}>
        Normalized to 100 — Time Weighted Return (excludes deposits/withdrawals)
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2235" />
          <XAxis dataKey="date" tick={{ fill: '#8b90aa', fontSize: 11 }} />
          <YAxis tick={{ fill: '#8b90aa', fontSize: 11 }} tickFormatter={v => `${v}`} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: '12px', color: '#8b90aa' }} />
          <Line type="monotone" dataKey="portfolio" name="Portfolio" stroke="#4d7cfe" strokeWidth={2} dot={{ fill: '#4d7cfe', r: 4 }} />
          {spyData.length > 0 && (
            <Line type="monotone" dataKey="spy" name="S&P 500" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 4 }} strokeDasharray="5 5" />
          )}
        </LineChart>
      </ResponsiveContainer>

      <div style={{ marginTop: '24px', marginBottom: '8px', fontSize: '11px', color: '#545870' }}>
        Deposits & Withdrawals (USD)
      </div>

      <ResponsiveContainer width="100%" height={100}>
        <BarChart data={chartData.filter(d => d.deposits)} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2235" />
          <XAxis dataKey="date" tick={{ fill: '#8b90aa', fontSize: 11 }} />
          <YAxis tick={{ fill: '#8b90aa', fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="deposits" name="Deposits ($)" fill="#00d4a0" opacity={0.7} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
