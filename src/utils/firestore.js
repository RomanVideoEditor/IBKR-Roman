// src/utils/firestore.js
import { db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export async function savePortfolio(userId, { positions, trades, cashBalance, totalDeposited, periodEnd, uploadedAt }) {
  const posRef = doc(db, 'users', userId, 'portfolios', 'current');
  const existing = await getDoc(posRef);

  const existingPeriodEnd = existing.exists() ? existing.data().periodEnd : null;
  const newPeriodEnd = periodEnd ? periodEnd.toISOString() : uploadedAt.toISOString();
  const isNewer = !existingPeriodEnd || new Date(newPeriodEnd) >= new Date(existingPeriodEnd);

  if (isNewer) {
    await setDoc(posRef, {
      positions,
      cashBalance: cashBalance || 0,
      periodEnd: newPeriodEnd,
      uploadedAt: uploadedAt.toISOString(),
    });
  }

  // Deposits: accumulate, no duplicates per period
  const depositsRef = doc(db, 'users', userId, 'portfolios', 'deposits');
  const existingDep = await getDoc(depositsRef);
  let allDeposits = existingDep.exists() ? (existingDep.data().deposits || []) : [];
  const depKey = newPeriodEnd.substring(0, 10);
  if (!allDeposits.find(d => d.periodEnd === depKey) && totalDeposited > 0) {
    allDeposits.push({ periodEnd: depKey, amount: totalDeposited });
  }
  const totalDepositedAll = allDeposits.reduce((s, d) => s + d.amount, 0);
  await setDoc(depositsRef, { deposits: allDeposits, total: totalDepositedAll });

  // Trades: merge, no duplicates
  if (trades && trades.length > 0) {
    const tradesRef = doc(db, 'users', userId, 'portfolios', 'trades');
    const existingTrades = await getDoc(tradesRef);
    let allTrades = trades;
    if (existingTrades.exists()) {
      const prevTrades = existingTrades.data().trades || [];
      const existingKeys = new Set(prevTrades.map(t => `${t.symbol}_${t.dateTime}_${t.quantity}`));
      const newTrades = trades.filter(t => !existingKeys.has(`${t.symbol}_${t.dateTime}_${t.quantity}`));
      allTrades = [...prevTrades, ...newTrades].sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
    }
    await setDoc(doc(db, 'users', userId, 'portfolios', 'trades'), {
      trades: allTrades, updatedAt: uploadedAt.toISOString()
    });
  }

  return { isNewer, totalDepositedAll };
}

export async function loadPortfolio(userId) {
  const [posSnap, depSnap] = await Promise.all([
    getDoc(doc(db, 'users', userId, 'portfolios', 'current')),
    getDoc(doc(db, 'users', userId, 'portfolios', 'deposits')),
  ]);
  if (!posSnap.exists()) return null;
  return {
    ...posSnap.data(),
    totalDeposited: depSnap.exists() ? depSnap.data().total : 0,
  };
}

export async function loadTrades(userId) {
  const ref = doc(db, 'users', userId, 'portfolios', 'trades');
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data();
}
