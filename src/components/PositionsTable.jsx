// src/components/PositionsTable.jsx
import { useState, useEffect } from 'react';
import { useLivePrices } from '../hooks/useLivePrices';

function fmt(n, d = 2) {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
}
function fmtPnl(n) {
  if (n == null || isNaN(n)) return '—';
  return `${n >= 0 ? '+' : '-'}$${fmt(Math.abs(n))}`;
}

function getMarketStatus() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const et = new Date(utc + 3600000 * -5);
  const day = et.getDay();
  const time = et.getHours() * 60 + et.getMinutes();
  if (day === 0 || day === 6) return { status: 'closed', label: 'Closed — Weekend', color: '#545870' };
  if (time >= 240 && time < 570) return { status: 'pre', label: '🟡 Pre-Market (4:00–9:30 ET)', color: '#f59e0b' };
  if (time >= 570 && time < 960) return { status: 'open', label: '🟢 Market Open', color: '#00d4a0' };
  if (time >= 960 && time < 1200) return { status: 'after', label: '🟡 After-Hours (16:00–20:00 ET)', color: '#f59e0b' };
  return { status: 'closed', label: '🔴 Market Closed', color: '#545870' };
}

function getCountdown() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const et = new Date(utc + 3600000 * -5);
  const day = et.getDay();
  const time = et.getHours() * 60 + et.getMinutes();
  if (day >= 1 && day <= 5 && time >= 570 && time < 960) return null;
  let next = new Date(et);
  next.setHours(9, 30, 0, 0);
  if (time >= 570 || day === 0 || day === 6) {
    do { next.setDate(next.getDate() + 1); } while (next.getDay() === 0 || next.getDay() === 6);
    next.setHours(9, 30, 0, 0);
  }
  const diff = next - et;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function MarketBar() {
  const [status, setStatus] = useState(getMarketStatus());
  const [countdown, setCountdown] = useState(getCountdown());
  useEffect(() => {
    const t = setInterval(() => { setStatus(getMarketStatus()); setCountdown(getCountdown()); }, 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="market-status-bar">
      <span className="market-label" style={{ color: status.color }}>{status.label}</span>
      {countdown && <span className="market-countdown">פתיחה בעוד {countdown}</span>}
    </div>
  );
}

const COLS = [
  { key: 'symbol', label: 'Symbol', align: 'left' },
  { key: 'quantity', label: 'Qty', align: 'right' },
  { key: 'avgCost', label: 'Avg Cost', align: 'right' },
  { key: 'livePrice', label: 'Live Price', align: 'right' },
  { key: 'liveValue', label: 'Market Value', align: 'right' },
  { key: 'weight', label: 'Weight', align: 'right' },
  { key: 'livePnl', label: 'P&L', align: 'right' },
  { key: 'pnlPct', label: 'P&L %', align: 'right' },
];

export default function PositionsTable({ positions, cashBalance, totalDeposited }) {
  const symbols = positions.map(p => p.symbol);
  const { prices, loading, lastUpdated, refresh } = useLivePrices(symbols);
  const [sortKey, setSortKey] = useState('liveValue');
  const [sortDir, setSortDir] = useState('desc');

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const enriched = positions.map(p => {
    const data = prices[p.symbol];
    const livePrice = data?.price || null;
    const prePost = data?.prePost;
    const liveValue = livePrice ? livePrice * p.quantity : p.marketValue;
    const livePnl = livePrice ? (livePrice - p.avgCost) * p.quantity : p.unrealizedPnl;
    const pnlPct = p.avgCost ? ((livePrice || p.avgCost) - p.avgCost) / p.avgCost * 100 : 0;
    return { ...p, livePrice, liveValue, livePnl, pnlPct, prePost };
  });

  const totalStocksValue = enriched.reduce((s, p) => s + (p.liveValue || 0), 0);
  const totalValue = totalStocksValue + (cashBalance || 0);

  const withWeight = enriched.map(p => ({
    ...p,
    weight: totalValue > 0 ? (p.liveValue / totalValue) * 100 : 0,
  }));

  const cashWeight = totalValue > 0 ? (cashBalance / totalValue) * 100 : 0;

  const sorted = [...withWeight].sort((a, b) => {
    const av = a[sortKey]; const bv = b[sortKey];
    if (av == null) return 1; if (bv == null) return -1;
    const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const totalPnl = enriched.reduce((s, p) => s + (p.livePnl || 0), 0);
  const totalReturn = totalDeposited ? ((totalValue - totalDeposited) / totalDeposited * 100) : null;

  return (
    <div className="positions-container">
      <MarketBar />
      <div className="positions-header">
        <div className="positions-summary">
          <div className="summary-item">
            <span className="summary-label">Total Value</span>
            <span className="summary-value">${fmt(totalValue)}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Unrealized P&L</span>
            <span className={`summary-value ${totalPnl >= 0 ? 'positive' : 'negative'}`}>{fmtPnl(totalPnl)}</span>
          </div>
          {totalDeposited > 0 && <>
            <div className="summary-item">
              <span className="summary-label">Total Deposited</span>
              <span className="summary-value">${fmt(totalDeposited)}</span>
            </div>
            {totalReturn !== null && (
              <div className="summary-item">
                <span className="summary-label">Total Return</span>
                <span className={`summary-value ${totalReturn >= 0 ? 'positive' : 'negative'}`}>
                  {totalReturn >= 0 ? '+' : ''}{fmt(totalReturn)}%
                </span>
              </div>
            )}
          </>}
          <div className="summary-item">
            <span className="summary-label">Cash</span>
            <span className="summary-value">${fmt(cashBalance)}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Positions</span>
            <span className="summary-value">{positions.length}</span>
          </div>
        </div>
        <div className="refresh-row">
          {lastUpdated && <span className="last-updated">Updated {lastUpdated.toLocaleTimeString()}</span>}
          <button className="refresh-btn" onClick={refresh} disabled={loading}>{loading ? '⟳' : '↻'} Refresh</button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="positions-table">
          <thead>
            <tr>
              {COLS.map(col => (
                <th key={col.key} style={{ textAlign: col.align, cursor: 'pointer' }} onClick={() => handleSort(col.key)}>
                  {col.label}{sortKey === col.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(p => (
              <tr key={p.symbol}>
                <td className="symbol-cell">
                  <span className="symbol">{p.symbol}</span>
                  <span className="asset-class">{p.assetClass}</span>
                </td>
                <td>{fmt(p.quantity, 0)}</td>
                <td>${fmt(p.avgCost)}</td>
                <td className="live-price">
                  {p.livePrice ? (
                    <span>
                      ${fmt(p.livePrice)}
                      {p.prePost != null && p.prePost !== 0 && (
                        <span className={`ext-price ${p.prePost >= 0 ? 'positive' : 'negative'}`}>
                          {' '}({p.prePost >= 0 ? '+' : ''}{fmt(p.prePost, 2)}%)
                        </span>
                      )}
                    </span>
                  ) : '—'}
                </td>
                <td>${fmt(p.liveValue)}</td>
                <td>
                  <div className="weight-cell">
                    <span>{fmt(p.weight, 1)}%</span>
                    <div className="weight-bar-bg">
                      <div className="weight-bar-fill" style={{ width: `${Math.min(p.weight, 100)}%` }} />
                    </div>
                  </div>
                </td>
                <td className={p.livePnl >= 0 ? 'positive' : 'negative'}>{fmtPnl(p.livePnl)}</td>
                <td className={p.pnlPct >= 0 ? 'positive' : 'negative'}>
                  {p.pnlPct >= 0 ? '+' : ''}{fmt(p.pnlPct)}%
                </td>
              </tr>
            ))}
            {/* Cash row */}
            {cashBalance > 0 && (
              <tr className="cash-row">
                <td className="symbol-cell">
                  <span className="symbol">CASH</span>
                  <span className="asset-class">USD</span>
                </td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
                <td>${fmt(cashBalance)}</td>
                <td>
                  <div className="weight-cell">
                    <span>{fmt(cashWeight, 1)}%</span>
                    <div className="weight-bar-bg">
                      <div className="weight-bar-fill" style={{ width: `${Math.min(cashWeight, 100)}%`, background: 'var(--text3)' }} />
                    </div>
                  </div>
                </td>
                <td>—</td>
                <td>—</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
