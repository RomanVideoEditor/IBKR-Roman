// src/components/PositionsTable.jsx
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

export default function PositionsTable({ positions }) {
  const symbols = positions.map(p => p.symbol);
  const { prices, loading, lastUpdated, refresh } = useLivePrices(symbols);

  const enriched = positions.map(p => {
    const livePrice = prices[p.symbol];
    const liveValue = livePrice ? livePrice * p.quantity : p.marketValue;
    const livePnl = livePrice
      ? (livePrice - p.avgCost) * p.quantity
      : p.unrealizedPnl;
    const pnlPct = p.avgCost ? ((livePrice || p.avgCost) - p.avgCost) / p.avgCost * 100 : 0;
    return { ...p, livePrice, liveValue, livePnl, pnlPct };
  });

  const totalValue = enriched.reduce((s, p) => s + (p.liveValue || 0), 0);
  const totalPnl = enriched.reduce((s, p) => s + (p.livePnl || 0), 0);

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
          <div className="summary-item">
            <span className="summary-label">Positions</span>
            <span className="summary-value">{positions.length}</span>
          </div>
        </div>
        <div className="refresh-row">
          {lastUpdated && (
            <span className="last-updated">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
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
              <th>Symbol</th>
              <th>Qty</th>
              <th>Avg Cost</th>
              <th>Live Price</th>
              <th>Market Value</th>
              <th>P&L</th>
              <th>P&L %</th>
            </tr>
          </thead>
          <tbody>
            {enriched.map(p => (
              <tr key={p.symbol}>
                <td className="symbol-cell">
                  <span className="symbol">{p.symbol}</span>
                  <span className="asset-class">{p.assetClass}</span>
                </td>
                <td>{fmt(p.quantity, 0)}</td>
                <td>${fmt(p.avgCost)}</td>
                <td className="live-price">
                  {p.livePrice ? `$${fmt(p.livePrice)}` : '—'}
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
