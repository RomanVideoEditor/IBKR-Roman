// src/hooks/useLivePrices.js
import { useState, useEffect, useCallback } from 'react';

const FINNHUB_KEY = 'd6rv1g9r01qgflm161g0d6rv1g9r01qgflm161gg';
const CACHE = {};
const CACHE_TTL = 60 * 1000;

function isMarketHours() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const et = new Date(utc - 5 * 3600000);
  const day = et.getDay();
  const time = et.getHours() * 60 + et.getMinutes();
  return day >= 1 && day <= 5 && time >= 570 && time < 960;
}

async function fetchPrice(symbol) {
  const now = Date.now();
  if (CACHE[symbol] && now - CACHE[symbol].ts < CACHE_TTL) return CACHE[symbol];
  try {
    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`);
    const d = await res.json();
    // c=current, pc=prev close, dp=day change %
    const price = d?.c || null;
    const dayChangePct = d?.dp ?? null;
    if (price) CACHE[symbol] = { price, dayChangePct, ts: now };
    return CACHE[symbol] || null;
  } catch { return null; }
}

export function useLivePrices(symbols) {
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const refresh = useCallback(async () => {
    if (!symbols?.length) return;
    setLoading(true);
    try {
      const results = await Promise.all(symbols.map(async sym => ({ sym, data: await fetchPrice(sym) })));
      const map = {};
      results.forEach(({ sym, data }) => { if (data?.price) map[sym] = data; });
      setPrices(map);
      setLastUpdated(new Date());
    } finally { setLoading(false); }
  }, [symbols?.join(',')]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { prices, loading, lastUpdated, refresh };
}
