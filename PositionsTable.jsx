// src/components/PositionsTable.jsx
import { useState, useEffect } from 'react';
import { useLivePrices } from '../hooks/useLivePrices';

function fmt(n, decimals = 2) {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

function fmtCurrency(n) {
  if (n == null || isNaN(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '+';
  return `${sign}$${fmt(abs)}`;
}

// Market hours (NYSE) in ET
function getMarketStatus() {
  const now = new Date();
  // Convert to ET
  const etOffset = -5; // EST (winter), -4 EDT (summer)
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const et = new Date(utc + 3600000 * etOffset);
  
  const day = et.getDay(); // 0=Sun, 6=Sat
  const h = et.getHours();
  const m = et.getMinutes();
  const time = h * 60 + m;

  if (day === 0 || day === 6) return { status: 'closed', label: 'Closed (Weekend)', color: '#545870' };
  
  // Pre-market: 4:00 - 9:30
  if (time >= 240 && time < 570) return { status: 'pre', label: 'Pre-Market', color: '#f59e0b' };
  // Regular: 9:30 - 16:00
  if (time >= 570 && time < 960) return { status: 'open', label: 'Market Open', color: '#00d4a0' };
  // After-hours: 16:00 - 20:00
  if (time >= 960 && time < 1200) return { status: 'after', label: 'After-Hours', color: '#f59e0b' };
  
  return { status: 'closed', label: 'Market Closed', color: '#545870' };
}

function getTimeUntilOpen() {
  const now = new Date();
  const etOffset = -5;
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const et = new Date(utc + 3600000 * etOffset);
  
  const day = et.getDay();
  const h = et.getHours();
  const m = et.getMinutes();
  const time = h * 60 + m;

  // If market is open, return null
  if (day >= 1 && day <= 5 && time >= 570 && time < 960) return null;

  // Next open: 9:30 ET on next weekday
  let nextOpen = new Date(et);
  nextOpen.setHours(9, 30, 0, 0);

  if (time >= 960 || day === 5) {
    // After close or Friday — next Monday or next day
    do {
      nextOpen.setDate(nextOpen.getDate() + 1);
    } while (nextOpen.getDay() === 0 || nextOpen.getDay() === 6);
    nextOpen.setHours(9, 30, 0, 0);
  } else if (day === 0) {
    nextOpen.setDate(nextOpen.getDate() + 1);
    nextOpen.setHours(9, 30, 0, 0);
  } else if (day === 6) {
    nextOpen.setDate(nextOpen.getDate() + 2);
    nextOpen.setHours(9, 30, 0, 0);
  }

  const diff = nextOpen - et;
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return { hours, mins, secs };
}

function MarketStatusBar() {
  const [status, setStatus] = useState(getMarketStatus());
  const [countdown, setCountdown] = useState(getTimeUntilOpen());

  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(getMarketStatus());
      setCountdown(getTimeUntilOpen());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="market-status-bar">
      <span className="market-dot" style={{ background: status.color }} />
      <span className="market-label" style={{ color: status.color }}>{status.label}</span>
      {countdown && (
        <span className="market-countdown">
          Opens in {String(countdown.hours).padStart(2,'0')}:{String(countdown.mins).padStart(2,'0')}:{String(countdown.secs).padStart(2,'0')}
        </span>
      )}
    </div>
  );
}

const COLUMNS = [
  { key: 'symbol', label: 'Symbol', align: 'left' },
  { key: 'quantity', label: 'Qty', align: 'right' },
  { key: 'avgCost', label: 'Avg Cost', align: 'right' },
  { key: 'livePrice', label: 'Live Price', align: 'right' },
  { key: 'liveValue', label: 'Market Value', align: 'right' },
  { key: 'weight', label: 'Weight', align: 'right' },
  { key: 'livePnl', label: 'P&L', align: 'right' },
  { key: 'pnlPct', label: 'P&L %', align: 'right' },
];

export default function PositionsTable({ positions, totalDeposited }) {
  const symbols = positions.map(p => p.symbol);
  const { prices, extendedPrices, loading, lastUpdated, refresh } = useLivePrices(symbols);
  const [sortKey, setSortKey] = useState('symbol');
  const [sortDir, setSortDir] = useState('asc');

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const enriched = positions.map(p => {
    const livePrice = prices[p.symbol];
    const ext = extendedPrices?.[p.symbol];
    const liveValue = livePrice ? livePrice * p.quantity : p.marketValue;
    const livePnl = livePrice ? (livePrice - p.avgCost) * p.quantity : p.unrealizedPnl;
    const pnlPct = p.avgCost ? ((livePrice || p.avgCost) - p.avgCost) / p.avgCost * 100 : 0;
    return { ...p, livePrice, liveValue, livePnl, pnlPct, ext };
  });

  const totalValue = enriched.reduce((s, p) => s + (p.liveValue || 0), 0);

  const withWeight = enriched.map(p => ({
    ...p,
    weight: totalValue > 0 ? (p.liveValue / totalValue) * 100 : 0,
  }));

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
      <MarketStatusBar />

      <div className="positions-header">
        <div className="positions-summary">
          <div className="summary-item">
            <span className="summary-label">Total Value</span>
            <span className="summary-value">${fmt(totalValue)}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Unrealized P&L</span>
            <span className={`summary-value ${totalPnl >= 0 ? 'positive' : 'negative'}`}>
              {fmtCurrency(totalPnl)}
            </span>
          </div>
          {totalDeposited > 0 && (
            <div className="summary-item">
              <span className="summary-label">Total Deposited</span>
              <span className="summary-value">${fmt(totalDeposited)}</span>
            </div>
          )}
          {totalReturn !== null && (
            <div className="summary-item">
              <span className="summary-label">Total Return</span>
              <span className={`summary-value ${totalReturn >= 0 ? 'positive' : 'negative'}`}>
                {totalReturn >= 0 ? '+' : ''}{fmt(totalReturn)}%
              </span>
            </div>
          )}
          <div className="summary-item">
            <span className="summary-label">Positions</span>
            <span className="summary-value">{positions.length}</span>
          </div>
        </div>
        <div className="refresh-row">
          {lastUpdated && <span className="last-updated">Updated {lastUpdated.toLocaleTimeString()}</span>}
          <button className="refresh-btn" onClick={refresh} disabled={loading}>
            {loading ? '⟳' : '↻'} Refresh
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="positions-table">
          <thead>
            <tr>
              {COLUMNS.map(col => (
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
                      {p.ext?.price && (
                        <span className={`ext-price ${p.ext.price >= p.livePrice ? 'positive' : 'negative'}`}>
                          {' '}({p.ext.type === 'pre' ? 'Pre' : 'After'}: ${fmt(p.ext.price)})
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
                <td className={p.livePnl >= 0 ? 'positive' : 'negative'}>{fmtCurrency(p.livePnl)}</td>
                <td className={p.pnlPct >= 0 ? 'positive' : 'negative'}>
                  {p.pnlPct >= 0 ? '+' : ''}{fmt(p.pnlPct)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
