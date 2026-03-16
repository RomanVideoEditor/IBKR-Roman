// src/hooks/useLivePrices.js
import { useState, useEffect, useCallback } from 'react';

const FINNHUB_KEY = 'd6rv1g9r01qgflm161g0d6rv1g9r01qgflm161gg';
const CACHE = {};
const CACHE_TTL = 60 * 1000;

async function fetchPrice(symbol) {
  const now = Date.now();
  if (CACHE[symbol] && now - CACHE[symbol].ts < CACHE_TTL) {
    return CACHE[symbol].price;
  }
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`
    );
    const data = await res.json();
    const price = data?.c || null; // c = current price
    if (price) {
      CACHE[symbol] = { price, ts: now };
    }
    return price;
  } catch (e) {
    console.warn(`Failed to fetch price for ${symbol}`, e);
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
      const results = await Promise.all(
        symbols.map(async (sym) => ({ sym, price: await fetchPrice(sym) }))
      );
      const map = {};
      results.forEach(({ sym, price }) => { if (price) map[sym] = price; });
      setPrices(map);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, [symbols?.join(',')]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { prices, loading, lastUpdated, refresh };
}
