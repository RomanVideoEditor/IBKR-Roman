// src/hooks/useLivePrices.js
import { useState, useEffect, useCallback } from 'react';

const FINNHUB_KEY = 'd6rv1g9r01qgflm161g0d6rv1g9r01qgflm161gg';
const CACHE = {};
const CACHE_TTL = 60 * 1000;

async function fetchPrice(symbol) {
  const now = Date.now();
  if (CACHE[symbol] && now - CACHE[symbol].ts < CACHE_TTL) {
    return CACHE[symbol];
  }
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`
    );
    const data = await res.json();
    // c = current, pc = prev close, dp = pre/post market price
    const price = data?.c || null;
    
    // Extended hours: Finnhub returns 'dp' for pre/post market change
    // We use 'o' (open) vs 'c' (current) to detect extended
    let ext = null;
    if (data?.dp != null && data?.c) {
      // Check if market is closed — use the difference between current and prev close
      const isExtended = Math.abs(data.c - data.pc) < 0.001 && data.dp !== 0;
      if (isExtended) {
        // Extended price = current + change from extended
        const extPrice = data.c * (1 + data.dp / 100);
        const now_h = new Date().getHours();
        ext = {
          price: extPrice,
          type: now_h < 9 ? 'pre' : 'after'
        };
      }
    }

    if (price) {
      CACHE[symbol] = { price, ext, ts: now };
    }
    return CACHE[symbol] || null;
  } catch (e) {
    console.warn(`Failed to fetch price for ${symbol}`, e);
    return null;
  }
}

export function useLivePrices(symbols) {
  const [prices, setPrices] = useState({});
  const [extendedPrices, setExtendedPrices] = useState({});
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const refresh = useCallback(async () => {
    if (!symbols || symbols.length === 0) return;
    setLoading(true);
    try {
      const results = await Promise.all(
        symbols.map(async (sym) => ({ sym, data: await fetchPrice(sym) }))
      );
      const priceMap = {};
      const extMap = {};
      results.forEach(({ sym, data }) => {
        if (data?.price) priceMap[sym] = data.price;
        if (data?.ext) extMap[sym] = data.ext;
      });
      setPrices(priceMap);
      setExtendedPrices(extMap);
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

  return { prices, extendedPrices, loading, lastUpdated, refresh };
}
