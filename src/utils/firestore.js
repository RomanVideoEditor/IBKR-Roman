// src/utils/firestore.js
import { db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export async function savePortfolio(userId, data) {
  const { positions, trades, cashBalance, totalDeposited, depositRows, periodStart, periodEnd, navStart, navEnd, twr, uploadedAt } = data;

  const newPeriodEnd = periodEnd ? periodEnd.toISOString() : uploadedAt.toISOString();
  const newPeriodStart = periodStart ? periodStart.toISOString() : newPeriodEnd;

  // Positions — only overwrite if newer
  const posRef = doc(db, 'users', userId, 'portfolios', 'current');
  const existing = await getDoc(posRef);
  const existingEnd = existing.exists() ? existing.data().periodEnd : null;
  const isNewer = !existingEnd || new Date(newPeriodEnd) >= new Date(existingEnd);
  if (isNewer) {
    await setDoc(posRef, { positions, cashBalance: cashBalance || 0, periodEnd: newPeriodEnd, uploadedAt: uploadedAt.toISOString() });
  }

  // Deposits — accumulate per period, no duplicates
  const depRef = doc(db, 'users', userId, 'portfolios', 'deposits');
  const depSnap = await getDoc(depRef);
  let allDeposits = depSnap.exists() ? (depSnap.data().deposits || []) : [];
  const depKey = newPeriodEnd.substring(0, 10);
  if (!allDeposits.find(d => d.periodEnd === depKey) && totalDeposited > 0) {
    allDeposits.push({ periodEnd: depKey, periodStart: newPeriodStart.substring(0, 10), amount: totalDeposited, rows: depositRows || [] });
  }
  const totalDepositedAll = allDeposits.reduce((s, d) => s + d.amount, 0);
  await setDoc(depRef, { deposits: allDeposits, total: totalDepositedAll });

  // NAV snapshots — for graph
  const navRef = doc(db, 'users', userId, 'portfolios', 'nav');
  const navSnap = await getDoc(navRef);
  let navPoints = navSnap.exists() ? (navSnap.data().points || []) : [];
  if (!navPoints.find(p => p.periodEnd === depKey)) {
    navPoints.push({ periodStart: newPeriodStart.substring(0, 10), periodEnd: depKey, navStart, navEnd, twr, deposits: totalDeposited });
  }
  navPoints.sort((a, b) => new Date(a.periodEnd) - new Date(b.periodEnd));
  await setDoc(navRef, { points: navPoints });

  // Trades — merge, no duplicates
  if (trades && trades.length > 0) {
    const trRef = doc(db, 'users', userId, 'portfolios', 'trades');
    const trSnap = await getDoc(trRef);
    let allTrades = trades;
    if (trSnap.exists()) {
      const prev = trSnap.data().trades || [];
      const keys = new Set(prev.map(t => `${t.symbol}_${t.dateTime}_${t.quantity}`));
      allTrades = [...prev, ...trades.filter(t => !keys.has(`${t.symbol}_${t.dateTime}_${t.quantity}`))];
      allTrades.sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
    }
    await setDoc(trRef, { trades: allTrades, updatedAt: uploadedAt.toISOString() });
  }

  return { isNewer, totalDepositedAll };
}

export async function loadPortfolio(userId) {
  const [posSnap, depSnap] = await Promise.all([
    getDoc(doc(db, 'users', userId, 'portfolios', 'current')),
    getDoc(doc(db, 'users', userId, 'portfolios', 'deposits')),
  ]);
  if (!posSnap.exists()) return null;
  return { ...posSnap.data(), totalDeposited: depSnap.exists() ? depSnap.data().total : 0 };
}

export async function loadTrades(userId) {
  const snap = await getDoc(doc(db, 'users', userId, 'portfolios', 'trades'));
  return snap.exists() ? snap.data() : null;
}

export async function loadNav(userId) {
  const snap = await getDoc(doc(db, 'users', userId, 'portfolios', 'nav'));
  return snap.exists() ? snap.data() : null;
}
