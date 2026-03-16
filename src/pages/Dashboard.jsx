// src/pages/Dashboard.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { loadPortfolio, loadTrades } from '../utils/firestore';
import CsvUpload from '../components/CsvUpload';
import PositionsTable from '../components/PositionsTable';
import TradesHistory from '../components/TradesHistory';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState('positions');
  const [portfolio, setPortfolio] = useState(null);
  const [trades, setTrades] = useState([]);
  const [uploadedAt, setUploadedAt] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [p, t] = await Promise.all([
          loadPortfolio(user.uid),
          loadTrades(user.uid),
        ]);
        if (p) {
          setPortfolio(p.positions);
          setUploadedAt(p.uploadedAt);
        }
        if (t) setTrades(t.trades || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingData(false);
      }
    }
    load();
  }, [user.uid]);

  const handleUploaded = ({ positions, trades, uploadedAt }) => {
    setPortfolio(positions);
    setTrades(trades);
    setUploadedAt(uploadedAt.toISOString());
    setShowUpload(false);
  };

  return (
    <div className="dashboard">
      <header className="dash-header">
        <div className="dash-logo">◈ IBKR Tracker</div>
        <div className="dash-user">
          <span>{user.displayName || user.email}</span>
          <button className="logout-btn" onClick={logout}>Sign Out</button>
        </div>
      </header>

      <main className="dash-main">
        {loadingData ? (
          <div className="loading-state">Loading portfolio...</div>
        ) : (
          <>
            <div className="dash-toolbar">
              <div className="tabs">
                <button className={tab === 'positions' ? 'tab active' : 'tab'} onClick={() => setTab('positions')}>
                  Positions
                </button>
                <button className={tab === 'trades' ? 'tab active' : 'tab'} onClick={() => setTab('trades')}>
                  Trade History
                </button>
              </div>
              <div className="toolbar-right">
                {uploadedAt && (
                  <span className="statement-date">
                    Statement: {new Date(uploadedAt).toLocaleDateString()}
                  </span>
                )}
                <button className="upload-btn" onClick={() => setShowUpload(!showUpload)}>
                  ↑ Upload New CSV
                </button>
              </div>
            </div>

            {showUpload && (
              <div className="upload-section">
                <CsvUpload onUploaded={handleUploaded} />
              </div>
            )}

            {!portfolio ? (
              <div className="empty-portfolio">
                <div className="empty-icon">◈</div>
                <h2>No portfolio loaded yet</h2>
                <p>Upload your IBKR Activity Statement CSV to get started</p>
                <CsvUpload onUploaded={handleUploaded} />
              </div>
            ) : (
              <>
                {tab === 'positions' && <PositionsTable positions={portfolio} />}
                {tab === 'trades' && <TradesHistory trades={trades} />}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
