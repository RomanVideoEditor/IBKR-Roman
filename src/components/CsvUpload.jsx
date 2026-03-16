// src/components/CsvUpload.jsx
import { useState, useRef } from 'react';
import { parseIBKRCsv, extractPositions, extractTrades } from '../utils/parseIBKR';
import { savePortfolio } from '../utils/firestore';
import { useAuth } from '../hooks/useAuth';

export default function CsvUpload({ onUploaded }) {
  const { user } = useAuth();
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef();

  const processFile = async (file) => {
    if (!file || !file.name.endsWith('.csv')) {
      setError('Please upload a .csv file from IBKR');
      return;
    }
    setStatus('Parsing...');
    setError('');
    try {
      const text = await file.text();
      const { positions: rawPos, trades: rawTrades, totalDeposited, periodEnd } = parseIBKRCsv(text);
      const positions = extractPositions(rawPos);
      const trades = extractTrades(rawTrades);

      if (positions.length === 0) {
        setError('No positions found. Make sure this is an IBKR Activity Statement CSV.');
        setStatus('');
        return;
      }

      setStatus('Saving to cloud...');
      const uploadedAt = new Date();
      const result = await savePortfolio(user.uid, { positions, trades, totalDeposited, periodEnd, uploadedAt });
      
      const msg = result.isNewer 
        ? `✓ ${positions.length} positions updated` 
        : `✓ Trades merged (positions unchanged — older file)`;
      setStatus(msg);
      onUploaded({ positions, trades, totalDeposited: result.totalDepositedAll, uploadedAt });
    } catch (err) {
      setError('Failed to parse file: ' + err.message);
      setStatus('');
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    processFile(e.dataTransfer.files[0]);
  };

  return (
    <div
      className={`csv-upload ${dragging ? 'dragging' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDraggi
