// src/components/CsvUpload.jsx
import { useState, useRef } from 'react';
import { parseIBKRCsv, extractPositions, extractTrades, extractTotalDeposited } from '../utils/parseIBKR';
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
      const { positions: rawPos, trades: rawTrades, deposits: rawDeposits } = parseIBKRCsv(text);
      const positions = extractPositions(rawPos);
      const trades = extractTrades(rawTrades);
      const totalDeposited = extractTotalDeposited(rawDeposits);

      if (positions.length === 0) {
        setError('No positions found. Make sure this is an IBKR Activity Statement CSV.');
        setStatus('');
        return;
      }

      setStatus('Saving to cloud...');
      const uploadedAt = new Date();
      await savePortfolio(user.uid, { positions, trades, totalDeposited, uploadedAt });
      setStatus(`✓ ${positions.length} positions loaded`);
      onUploaded({ positions, trades, totalDeposited, uploadedAt });
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
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef} type="file" accept=".csv" style={{ display: 'none' }}
        onChange={e => processFile(e.target.files[0])}
      />
      <div className="upload-icon">↑</div>
      <div className="upload-title">{status || 'Upload IBKR Statement'}</div>
      <div className="upload-sub">
        {error
          ? <span className="error-msg">{error}</span>
          : 'Drag & drop or click — Activity Statement CSV'}
      </div>
    </div>
  );
}
