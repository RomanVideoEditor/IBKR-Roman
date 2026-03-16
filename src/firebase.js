// src/utils/firestore.js
import { db } from '../firebase';
import { doc, setDoc, getDoc, arrayUnion } from 'firebase/firestore';

export async function savePortfolio(userId, { positions, trades, uploadedAt }) {
  // Positions: always overwrite with latest
  const posRef = doc(db, 'users', userId, 'portfolios', 'current');
  await setDoc(posRef, { positions, uploadedAt: uploadedAt.toISOString() });

  // Trades: merge new trades with existing ones (no duplicates)
  if (trades && trades.length > 0) {
    const tradesRef = doc(db, 'users', userId, 'portfolios', 'trades');
    const existing = await getDoc(tradesRef);
    
    let allTrades = trades;
    if (existing.exists()) {
      const existingTrades = existing.data().trades || [];
      // Deduplicate by symbol+dateTime+quantity
      const existingKeys = new Set(
        existingTrades.map(t => `${t.symbol}_${t.dateTime}_${t.quantity}`)
      );
      const newTrades = trades.filter(
        t => !existingKeys.has(`${t.symbol}_${t.dateTime}_${t.quantity}`)
      );
      allTrades = [...existingTrades, ...newTrades]
        .sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
    }

    await setDoc(tradesRef, { 
      trades: allTrades, 
      updatedAt: uploadedAt.toISOString() 
    });
  }
}

export async function loadPortfolio(userId) {
  const ref = doc(db, 'users', userId, 'portfolios', 'current');
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data();
}

export async function loadTrades(userId) {
  const ref = doc(db, 'users', userId, 'portfolios', 'trades');
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data();
}
