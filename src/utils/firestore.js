// src/utils/firestore.js
import { db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export async function savePortfolio(userId, { positions, trades, totalDeposited, periodEnd, uploadedAt }) {
  const posRef = doc(db, 'users', userId, 'portfolios', 'current');
  const existing = await getDoc(posRef);

  const existingPeriodEnd = existing.exists() ? existing.data().periodEnd : null;
  const newPeriodEnd = periodEnd ? periodEnd.toISOString() : uploadedAt.toISOString();
  const isNewer = !existingPeriodEnd || new Date(newPeriodEnd) >= new Date(existingPeriodEnd);

  if (isNewer) {
    await setDoc(posRef, {
      positions,
      periodEnd: newPeriodEnd,
      uploadedAt: uploadedAt.toISOString(),
    });
  }

  const depositsRef = doc(db, 'users', userId, 'portfolios', 'deposits');
  const existingDep = await getDoc(depositsRef);
  let allDeposits = existingDep.exists() ? (existingDep.data().deposits || []) : [];
  
  const depKey = newPeriodEnd.substring(0, 10);
  const alreadyExists = allDeposits.find(d => d.periodEnd === depKey);
  if (!alreadyExists && totalDeposited > 0) {
    allDeposits.push({ periodEnd: depKey, amount: totalDeposited });
  }
  const totalDepositedAll = allDeposits.reduce((s, d) => s + d.amount, 0);
  await setDoc(depositsRef, { deposits: allDeposits, total: totalDepositedAll });

  if (trades && trades.length > 0) {
    const tradesRef = doc(db, 'users', userId, 'portfolios', 'trades');
    const existingTrades = await getDoc(tradesRef);
    let allTrades = trades;
    if (existingTrades.exists())
