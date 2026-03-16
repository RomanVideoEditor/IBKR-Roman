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
  const [cashBalance, setCashBalance] = useState(0);
  const [trades, setTrades] = useState([]);
  const [totalDeposited, setTotalDeposited] = useState(0);
  const [uploadedAt, setUploadedAt] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [p, t] = await Promise.all([loadPortfolio(user.uid), loadTrades(user.uid)]);
        if (p) {
          setPortfolio(p.positions);
          setCashBalance(p.cashBalance || 0);
          setTotalDeposited(p.totalDeposited || 0);
          setUploadedAt(p.uploadedAt);
        }
        if (t) setTrades(t.trades || []);
      } catch (e) { console.error(e); }
      finally { setLoadingData(false); }
    }
    load();
  }, [user.uid]);

  const handleUploaded = ({ positions, cashBalance, totalDeposited, uploadedAt }) => {
    setPortfolio(positions);
    setCashBalance(cashBalance || 0);
    setTotalDeposited(totalDeposited || 0);
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
        {loadingData ? <div className="loading-state">Loading...</div> : (
          <>
            <div className="dash-toolbar">
              <div className="tabs">
                <button className={tab === 'positions' ? 'tab active' : 'tab'} onClick={() => setTab('positions')}>Positions</button>
                <button className={tab === 'trades' ? 'tab active' : 'tab'} onClick={() => setTab('trades')}>Trade History</button>
              </div>
              <div className="toolbar-right">
                {uploadedAt && <span className="statement-date">Statement: {new Date(uploadedAt).toLocaleDateString()}</span>}
                <button className="upload-btn" onClick={() => setShowUpload(!showUpload)}>↑ Upload CSV</button>
              </div>
            </div>
            {showUpload && <div className="upload-section"><CsvUpload onUploaded={handleUploaded} /></div>}
            {!portfolio ? (
              <div className="empty-portfolio">
                <div className="empty-icon">◈</div>
                <h2>No portfolio loaded yet</h2>
                <p>Upload your IBKR Activity Statement CSV</p>
                <CsvUpload onUploaded={handleUploaded} />
              </div>
            ) : (
              <>
                {tab === 'positions' && <PositionsTable positions={portfolio} cashBalance={cashBalance} totalDeposited={totalDeposited} />}
                {tab === 'trades' && <TradesHistory trades={trades} />}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
