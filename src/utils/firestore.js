// src/utils/firestore.js
import { db } from '../firebase';
import {
  doc, setDoc, getDoc, collection, getDocs, query, orderBy, limit
} from 'firebase/firestore';

export async function savePortfolio(userId, { positions, trades, uploadedAt }) {
  const ref = doc(db, 'users', userId, 'portfolios', 'current');
  await setDoc(ref, { positions, uploadedAt: uploadedAt.toISOString() });

  // Save trades snapshot
  if (trades && trades.length > 0) {
    const tradesRef = doc(db, 'users', userId, 'portfolios', 'trades');
    await setDoc(tradesRef, { trades, uploadedAt: uploadedAt.toISOString() });
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
