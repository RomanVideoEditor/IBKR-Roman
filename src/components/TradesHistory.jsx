// src/components/TradesHistory.jsx
function fmt(n, decimals = 2) {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

export default function TradesHistory({ trades }) {
  if (!trades || trades.length === 0) {
    return <div className="empty-state">No trade history found in this statement.</div>;
  }

  return (
    <div className="table-wrapper">
      <table className="positions-table">
        <thead>
          <tr>
            <th>Date/Time</th>
            <th>Symbol</th>
            <th>Side</th>
            <th>Qty</th>
            <th>Price</th>
            <th>Proceeds</th>
            <th>Commission</th>
            <th>Realized P&L</th>
          </tr>
        </thead>
        <tbody>
          {trades.slice(0, 100).map((t, i) => (
            <tr key={i}>
              <td className="date-cell">{t.dateTime}</td>
              <td className="symbol-cell"><span className="symbol">{t.symbol}</span></td>
              <td>
                <span className={`side-badge ${t.buySell === 'BUY' ? 'buy' : 'sell'}`}>
                  {t.buySell}
                </span>
              </td>
              <td>{fmt(Math.abs(t.quantity), 0)}</td>
              <td>${fmt(t.price)}</td>
              <td>${fmt(Math.abs(t.proceeds))}</td>
              <td className="negative">${fmt(Math.abs(t.commFee))}</td>
              <td className={t.realizedPnl >= 0 ? 'positive' : 'negative'}>
                {t.realizedPnl !== 0 ? (t.realizedPnl >= 0 ? '+' : '') + '$' + fmt(t.realizedPnl) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {trades.length > 100 && (
        <div className="table-footer">Showing 100 of {trades.length} trades</div>
      )}
    </div>
  );
}
