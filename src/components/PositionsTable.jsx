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

function getMarketStatus() {
  const now = new Date();
  const etOffset = -5;
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const et = new Date(utc + 3600000 * etOffset);
  const day = et.getDay();
  const time = et.getHours() * 60 + et.getMinutes();
  if (day === 0 || day === 6) return { status: 'closed', label: 'Closed (Weekend)', color: '#545870' };
  if (time >= 240 && time < 570) return { status: 'pre', label: 'Pre-Market', color: '#f59e0b' };
  if (time >= 570 && time < 960) return { status: 'open', label: 'Market Open', color: '#00d4a0' };
  if (time >= 960 && time < 1200) return { status: 'after', label: 'After-Hours', color: '#f59e0b' };
  return { status: 'closed', label: 'Market Closed', color: '#545870' };
}

function getTimeUntilOpen() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const et = new Date(utc + 3600000 * -5);
  const day = et.getDay();
  const time = et.getHours() * 60 + et.getMinutes();
  if (day >= 1 && day <= 5 && time >= 570 && time < 960) return null;
  let nextOpen = new Date(et);
  nextOpen.setHours(9, 30, 0, 0);
  if (time >= 570) {
    do { nextOpen.setDate(nextOpen.getDate() + 1); }
    while (nextOpen.getDay() === 0 || nextOpen.getDay() === 6);
    nextOpen.setHours(9, 30, 0, 0);
  } else if (day === 0) { nextOpen.setDate(nextOpen.getDate() + 1); nextOpen.setHours(9,30,0,0); }
  else if (day === 6) { nextOpen.setDate(nextOpen.getDate() + 2); nextOpen.setHours(9,30,0,0); }
  const diff = nextOpen - et;
  return {
    hours: Math.floor(diff / 3600000),
    mins: Math.floor((diff % 3600000) / 60000),
    secs: Math.floor((diff % 60000) / 1000),
  };
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
  const totalReturn = totalDeposited ? (
