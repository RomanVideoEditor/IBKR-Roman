// src/hooks/useLivePrices.js
import { useState, useEffect, useCallback } from 'react';

const CACHE = {};
const CACHE_TTL = 60 * 1000; // 1 minute

async function fetchPrice(symbol) {
  const now = Date.now();
  if (CACHE[symbol] && now - CACHE[symbol].ts < CACHE_TTL) {
    return CACHE[symbol].price;
  }

  try {
    // Using Yahoo Finance v8 (no API key needed, delayed ~15min)
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`,
      { headers: { 'Accept': 'application/json' } }
    );
    const data = await res.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice || null;
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
    const interval = setInterval(refresh, 60000); // refresh every 60s
    return () => clearInterval(interval);
  }, [refresh]);

  return { prices, loading, lastUpdated, refresh };
}
