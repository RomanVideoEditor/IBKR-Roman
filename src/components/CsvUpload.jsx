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
    if (!file?.name.endsWith('.csv')) { setError('Please upload a .csv file from IBKR'); return; }
    setStatus('Parsing...'); setError('');
    try {
      const text = await file.text();
      const parsed = parseIBKRCsv(text);
      const positions = extractPositions(parsed.positions);
      const trades = extractTrades(parsed.trades);
      if (positions.length === 0) { setError('No positions found in this CSV.'); setStatus(''); return; }
      setStatus('Saving...');
      const uploadedAt = new Date();
      const result = await savePortfolio(user.uid, { ...parsed, positions, trades, uploadedAt });
      setStatus(result.isNewer ? `✓ ${positions.length} positions updated` : `✓ Trades merged`);
      onUploaded({ positions, cashBalance: parsed.cashBalance, totalDeposited: result.totalDepositedAll, uploadedAt });
    } catch (err) { setError('Error: ' + err.message); setStatus(''); }
  };

  const onDrop = (e) => { e.preventDefault(); setDragging(false); processFile(e.dataTransfer.files[0]); };

  return (
    <div className={`csv-upload ${dragging ? 'dragging' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}>
      <input ref={inputRef} type="file" accept=".csv" style={{ display: 'none' }}
        onChange={e => processFile(e.target.files[0])} />
      <div className="upload-icon">↑</div>
      <div className="upload-title">{status || 'Upload IBKR Statement'}</div>
      <div className="upload-sub">{error ? <span className="error-msg">{error}</span> : 'Drag & drop or click — any order works'}</div>
    </div>
  );
}
