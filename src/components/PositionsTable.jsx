// src/components/PositionsTable.jsx
import { useState } from 'react';
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

const COLUMNS = [
  { key: 'symbol', label: 'Symbol', align: 'left' },
  { key: 'quantity', label: 'Qty', align: 'right' },
  { key: 'avgCost', label: 'Avg Cost', align: 'right' },
  { key: 'livePrice', label: 'Live Price', align: 'right' },
  { key: 'liveValue', label: 'Market Value', align: 'right' },
  { key: 'livePnl', label: 'P&L', align: 'right' },
  { key: 'pnlPct', label: 'P&L %', align: 'right' },
];

export default function PositionsTable({ positions, totalDeposited }) {
  const symbols = positions.map(p => p.symbol);
  const { prices, extendedPrices, loading, lastUpdated, refresh } = useLivePrices(symbols);
  const [sortKey, setSortKey] = useState('symbol');
  const [sortDir, setSortDir] = useState('asc');

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const enriched = positions.map(p => {
    const livePrice = prices[p.symbol];
    const ext = extendedPrices?.[p.symbol];
    const liveValue = livePrice ? livePrice * p.quantity : p.marketValue;
    const livePnl = livePrice ? (livePrice - p.avgCost) * p.quantity : p.unrealizedPnl;
    const pnlPct = p.avgCost ? ((livePrice || p.avgCost) - p.avgCost) / p.avgCost * 100 : 0;
    return { ...p, livePrice, liveValue, livePnl, pnlPct, ext };
  });

  const sorted = [...enriched].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const totalValue = enriched.reduce((s, p) => s + (p.liveValue || 0), 0);
  const totalPnl = enriched.reduce((s, p) => s + (p.livePnl || 0), 0);
  const totalReturn = totalDeposited ? ((totalValue - totalDeposited) / totalDeposited * 100) : null;

  return (
    <div className="positions-container">
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
          {lastUpdated && (
            <span className="last-updated">Updated {lastUpdated.toLocaleTimeString()}</span>
          )}
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
                <th
                  key={col.key}
                  style={{ textAlign: col.align, cursor: 'pointer' }}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  {sortKey === col.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
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
                      {p.ext && p.ext.price && (
                        <span className={`ext-price ${p.ext.price >= p.livePrice ? 'positive' : 'negative'}`}>
                          {' '}({p.ext.type === 'pre' ? 'Pre' : 'After'}: ${fmt(p.ext.price)})
                        </span>
                      )}
                    </span>
                  ) : '—'}
                </td>
                <td>${fmt(p.liveValue)}</td>
                <td className={p.livePnl >= 0 ? 'positive' : 'negative'}>
                  {fmtCurrency(p.livePnl)}
                </td>
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
