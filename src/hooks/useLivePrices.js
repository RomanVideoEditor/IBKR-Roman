// src/hooks/useLivePrices.js
import { useState, useEffect, useCallback } from 'react';

const FINNHUB_KEY = 'd6rv1g9r01qgflm161g0d6rv1g9r01qgflm161gg';
const CACHE = {};
const CACHE_TTL = 60 * 1000;

async function fetchPrice(symbol) {
  const now = Date.now();
  if (CACHE[symbol] && now - CACHE[symbol].ts < CACHE_TTL) return CACHE[symbol];
  try {
    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`);
    const data = await res.json();
    const price = data?.c || null;
    // Extended hours via Finnhub: if market closed, show previous close vs current as indicator
    const prePost = data?.dp != null ? data.dp : null;
    if (price) {
      CACHE[symbol] = { price, prePost, ts: now };
    }
    return CACHE[symbol] || null;
  } catch (e) {
    return null;
  }
}

export function useLivePrices(symbols) {
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const refresh = useCallback(async () => {
    if (!symbols || symbols.length === 0) return;
    setLoading(true);
    try {
      const results = await Promise.all(symbols.map(async sym => ({ sym, data: await fetchPrice(sym) })));
      const priceMap = {};
      results.forEach(({ sym, data }) => { if (data?.price) priceMap[sym] = data; });
      setPrices(priceMap);
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
