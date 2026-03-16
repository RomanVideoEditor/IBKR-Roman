// src/components/PerformanceChart.jsx
import { useState, useEffect } from 'react';
import { AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

const FINNHUB_KEY = 'd6rv1g9r01qgflm161g0d6rv1g9r01qgflm161gg';

async function fetchSPYHistory(fromDate, toDate) {
  try {
    const from = Math.floor(new Date(fromDate).getTime() / 1000);
    const to = Math.floor(new Date(toDate).getTime() / 1000);
    const res = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=SPY&resolution=M&from=${from}&to=${to}&token=${FINNHUB_KEY}`);
    const d = await res.json();
    if (!d.c || d.s === 'no_data') return [];
    return d.t.map((ts, i) => ({ date: new Date(ts * 1000).toISOString().substring(0, 7), close: d.c[i] }));
  } catch { return []; }
}

const PERIODS = ['1M', '3M', '6M', '1Y', 'ALL'];

export default function PerformanceChart({ navPoints }) {
  const [spyData, setSpyData] = useState([]);
  const [period, setPeriod] = useState('ALL');
  const [view, setView] = useState('performance'); // 'performance' | 'history'

  useEffect(() => {
    if (!navPoints?.length) return;
    const from = navPoints[0].periodStart;
    const to = navPoints[navPoints.length - 1].periodEnd;
    fetchSPYHistory(from, to).then(setSpyData);
  }, [navPoints?.length]);

  if (!navPoints?.length) return (
    <div className="perf-empty">
      <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }}>📈</div>
      <div style={{ color: 'var(--text2)' }}>Upload CSV files to see performance chart</div>
    </div>
  );

  // Build chart data from nav points
  let cumPortfolio = 100;
  const allData = [];

  navPoints.forEach((p, i) => {
    if (i === 0) {
      allData.push({ date: p.periodStart, portfolio: 100, navValue: p.navStart, deposits: 0 });
    }
    cumPortfolio = parseFloat((cumPortfolio * (1 + p.twr / 100)).toFixed(2));
    allData.push({
      date: p.periodEnd,
      portfolio: cumPortfolio,
      navValue: p.navEnd,
      deposits: p.deposits,
    });
  });

  // Add SPY normalized to 100
  const spyMap = {};
  spyData.forEach(d => { spyMap[d.date] = d.close; });
  let spyBase = null;
  allData.forEach(d => {
    const month = d.date.substring(0, 7);
    const spyClose = spyMap[month];
    if (spyClose !== undefined) {
      if (spyBase === null) spyBase = spyClose;
      d.spy = parseFloat(((spyClose / spyBase) * 100).toFixed(2));
    }
  });

  // Filter by period
  const filterData = (data) => {
    const now = new Date();
    const cutoff = {
      '1M': new Date(now.setMonth(now.getMonth() - 1)),
      '3M': new Date(new Date().setMonth(new Date().getMonth() - 3)),
      '6M': new Date(new Date().setMonth(new Date().getMonth() - 6)),
      '1Y': new Date(new Date().setFullYear(new Date().getFullYear() - 1)),
      'ALL': new Date('2000-01-01'),
    }[period];
    return data.filter(d => new Date(d.date) >= cutoff);
  };

  const chartData = filterData(allData);
  const latestPortfolio = chartData[chartData.length - 1]?.portfolio || 100;
  const firstPortfolio = chartData[0]?.portfolio || 100;
  const portfolioChange = latestPortfolio - firstPortfolio;
  const portfolioChangePct = ((latestPortfolio - firstPortfolio) / firstPortfolio * 100).toFixed(2);

  const latestSpy = chartData[chartData.length - 1]?.spy;
  const firstSpy = chartData[0]?.spy;
  const spyChangePct = latestSpy && firstSpy ? ((latestSpy - firstSpy) / firstSpy * 100).toFixed(2) : null;
  const isBeating = spyChangePct !== null && parseFloat(portfolioChangePct) > parseFloat(spyChangePct);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="chart-tooltip">
        <div className="chart-tooltip-date">{label}</div>
        {payload.map(p => (
          <div key={p.name} style={{ color: p.color, display: 'flex', justifyContent: 'space-between', gap: 16 }}>
            <span>{p.name}</span>
            <span>{p.name === 'Deposits' ? `$${p.value?.toLocaleString()}` : `${p.value?.toFixed(1)}`}</span>
          </div>
        ))}
      </div>
    );
  };

  const totalDeposits = navPoints.reduce((s, p) => s + (p.deposits || 0), 0);

  return (
    <div className="perf-container">
      {/* Header stats */}
      <div className="perf-stats-row">
        <div className="perf-stat">
          <div className="perf-stat-label">Portfolio TWR</div>
          <div className={`perf-stat-value ${portfolioChange >= 0 ? 'positive' : 'negative'}`}>
            {portfolioChange >= 0 ? '+' : ''}{portfolioChangePct}%
          </div>
        </div>
        {spyChangePct && (
          <div className="perf-stat">
            <div className="perf-stat-label">S&P 500</div>
            <div className={`perf-stat-value ${parseFloat(spyChangePct) >= 0 ? 'positive' : 'negative'}`}>
              {parseFloat(spyChangePct) >= 0 ? '+' : ''}{spyChangePct}%
            </div>
          </div>
        )}
        {spyChangePct && (
          <div className="perf-stat">
            <div className="perf-stat-label">vs S&P 500</div>
            <div className={`perf-stat-value ${isBeating ? 'positive' : 'negative'}`}>
              {isBeating ? '🏆 Beating' : '📉 Lagging'} by {Math.abs(parseFloat(portfolioChangePct) - parseFloat(spyChangePct)).toFixed(2)}%
            </div>
          </div>
        )}
        <div className="perf-stat">
          <div className="perf-stat-label">Total Deposits</div>
          <div className="perf-stat-value">${totalDeposits.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>
      </div>

      {/* Period selector */}
      <div className="perf-controls">
        <div className="perf-view-tabs">
          <button className={view === 'performance' ? 'view-tab active' : 'view-tab'} onClick={() => setView('performance')}>Performance</button>
          <button className={view === 'history' ? 'view-tab active' : 'view-tab'} onClick={() => setView('history')}>Portfolio Value</button>
        </div>
        <div className="period-tabs">
          {PERIODS.map(p => (
            <button key={p} className={period === p ? 'period-tab active' : 'period-tab'} onClick={() => setPeriod(p)}>{p}</button>
          ))}
        </div>
      </div>

      {/* Main chart */}
      <ResponsiveContainer width="100%" height={300}>
        {view === 'performance' ? (
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4d7cfe" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#4d7cfe" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2235" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: '#545870', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#545870', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}`} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={100} stroke="#1e2235" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="portfolio" name="Portfolio" stroke="#4d7cfe" strokeWidth={2.5} dot={{ fill: '#4d7cfe', r: 5, strokeWidth: 2, stroke: '#0a0b0e' }} activeDot={{ r: 7 }} />
            {spyData.length > 0 && (
              <Line type="monotone" dataKey="spy" name="S&P 500" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 4 }} strokeDasharray="6 3" />
            )}
          </LineChart>
        ) : (
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="navGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00d4a0" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#00d4a0" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2235" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: '#545870', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#545870', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="navValue" name="Portfolio Value" stroke="#00d4a0" strokeWidth={2.5} fill="url(#navGrad)" dot={{ fill: '#00d4a0', r: 5, strokeWidth: 2, stroke: '#0a0b0e' }} />
          </AreaChart>
        )}
      </ResponsiveContainer>

      {/* Deposits bar chart */}
      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 12, color: '#545870', marginBottom: 8 }}>Deposits & Withdrawals (USD)</div>
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={allData.filter(d => d.deposits > 0)} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
            <XAxis dataKey="date" tick={{ fill: '#545870', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="deposits" name="Deposits" fill="#4d7cfe" opacity={0.7} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
