import React, { useState, useEffect, useMemo } from 'react';
import StockCard from './StockCard';
import { RefreshCw, Play, TrendingUp, TrendingDown, AlertCircle, Search, ArrowUpDown, X, Zap, SlidersHorizontal } from 'lucide-react';
import { fetchMarketData } from '../utils/scanner';
import ChatBox from './ChatBox';

const StocksToBuyReport = () => {
  const [stocks, setStocks] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const [error, setError] = useState(null);
  
  // Dashboard Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [mustBeAboveSma50, setMustBeAboveSma50] = useState(false);
  const [mustBeGoldenCross, setMustBeGoldenCross] = useState(false);
  const [mustHaveBullishMacd, setMustHaveBullishMacd] = useState(false);
  const [mustHaveInstBuying, setMustHaveInstBuying] = useState(false);
  const [mustHaveUptrend, setMustHaveUptrend] = useState(false);
  const [mustHaveDowntrend, setMustHaveDowntrend] = useState(false);
  const [mustHaveBbSqueeze, setMustHaveBbSqueeze] = useState(false);
  const [mustHaveObvAccumulation, setMustHaveObvAccumulation] = useState(false);
  const [selectedSector, setSelectedSector] = useState('all');
  const [selectedMarketCap, setSelectedMarketCap] = useState('all');
  const [selectedIndex, setSelectedIndex] = useState('all');
  
  // Modal State
  const [selectedStock, setSelectedStock] = useState(null);
  
  // Sorting State
  const [sortConfig, setSortConfig] = useState({ key: 'rsRating', direction: 'desc' });

  // Load static JSON file automatically when component mounts
  useEffect(() => {
    startScan();
  }, []);

  const startScan = async () => {
    if (scanning) return;
    setScanning(true);
    setError(null);
    setScanStatus('Loading static market data...');
    setStocks([]);

    try {
      const data = await fetchMarketData();
      if (data && data.length > 0) {
        setStocks(data);
        setScanStatus('Data loaded.');
      } else {
        setError('No data found. Is market_data.json generated?');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred loading the static data.');
    } finally {
      setScanning(false);
    }
  };

  // Keyboard listener for Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setSelectedStock(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Compute unique sectors for the dropdown dynamically, with performance metrics
  const availableSectors = useMemo(() => {
    const sectorStats = {};
    
    stocks.forEach(s => {
      if (!s.sector) return;
      if (!sectorStats[s.sector]) sectorStats[s.sector] = { totalChange: 0, count: 0 };
      sectorStats[s.sector].totalChange += (s.change24h || 0);
      sectorStats[s.sector].count += 1;
    });

    const sorted = Object.keys(sectorStats).map(sector => ({
      name: sector,
      avgChange: sectorStats[sector].totalChange / sectorStats[sector].count
    })).sort((a, b) => b.avgChange - a.avgChange);
    
    return [{ name: 'all', avgChange: 0 }, ...sorted];
  }, [stocks]);

  const filteredAndSortedStocks = useMemo(() => {
    let filtered = [...stocks];

    // 1. Text Search
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        s.id.toLowerCase().includes(q) || 
        s.name.toLowerCase().includes(q) ||
        (s.sector && s.sector.toLowerCase().includes(q))
      );
    }
    
    // 2. Technical Signals
    if (mustBeAboveSma50) {
      filtered = filtered.filter(s => s.aboveSma50);
    }
    if (mustBeGoldenCross) {
      filtered = filtered.filter(s => s.goldenAligned);
    }
    if (mustHaveBullishMacd) {
      filtered = filtered.filter(s => s.bullishMacd);
    }
    if (mustHaveInstBuying) {
      filtered = filtered.filter(s => s.institutionalBuying);
    }
    if (mustHaveUptrend) {
      filtered = filtered.filter(s => s.consecutiveUp >= 2);
    }
    if (mustHaveDowntrend) {
      filtered = filtered.filter(s => s.consecutiveDown >= 5);
    }
    if (mustHaveBbSqueeze) {
      filtered = filtered.filter(s => s.isSqueezing);
    }
    if (mustHaveObvAccumulation) {
      filtered = filtered.filter(s => s.isAccumulating);
    }
    
    // 2. Sector Filter
    if (selectedSector !== 'all') {
      filtered = filtered.filter(s => s.sector === selectedSector);
    }
    
    // 3. Market Cap Filter
    if (selectedMarketCap !== 'all') {
      filtered = filtered.filter(s => s.marketCap === selectedMarketCap);
    }

    // 4. Index Filter
    if (selectedIndex !== 'all') {
      filtered = filtered.filter(s => s.indices && s.indices.includes(selectedIndex));
    }

    // 7. Sorting logic
    filtered.sort((a, b) => {
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];
      
      // Handle string comparisons for symbol
      if (sortConfig.key === 'id') {
        return sortConfig.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      
      // Default numeric comparison
      if (valA === undefined || valA === null) valA = -Infinity;
      if (valB === undefined || valB === null) valB = -Infinity;
      
      return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
    });

    return filtered;
  }, [stocks, searchQuery, mustBeAboveSma50, mustBeGoldenCross, mustHaveBullishMacd, mustHaveInstBuying, mustHaveUptrend, mustHaveDowntrend, mustHaveBbSqueeze, mustHaveObvAccumulation, selectedSector, selectedMarketCap, selectedIndex, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  const formatVolume = (vol) => {
    if (!vol) return 'N/A';
    if (vol >= 10000000) return (vol / 10000000).toFixed(2) + 'Cr';
    if (vol >= 100000) return (vol / 100000).toFixed(2) + 'L';
    if (vol >= 1000) return (vol / 1000).toFixed(2) + 'K';
    return vol.toString();
  };

  return (
    <div className="report-container fade-in">
      <div className="header">
        
        {/* Left Column: Titles */}
        <div style={{ justifySelf: 'start' }}>
          <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Pro Trading Dashboard</h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Automated Backend Analysis.</p>
        </div>

        {/* Center Column: Jai Jinendra */}
        <div style={{ justifySelf: 'center', color: '#f97316', fontWeight: 'bold', fontSize: '1.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Jai Jinendra 🙏
        </div>

        {/* Right Column: Scan Button */}
        <div style={{ justifySelf: 'end', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button 
            onClick={startScan}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '0.5rem', 
              background: scanning ? 'var(--surface-elevated)' : 'var(--primary)', 
              color: scanning ? 'var(--text-secondary)' : '#fff', 
              border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: scanning ? 'not-allowed' : 'pointer', fontWeight: 600 
            }}
            disabled={scanning}
          >
            {scanning ? <RefreshCw size={16} className="spinner" style={{width: 16, height: 16, border: 'none'}} /> : <RefreshCw size={16} />} 
            {scanning ? 'Loading...' : 'Reload Data'}
          </button>
        </div>
      </div>

      {scanning && (
        <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', border: '1px solid var(--border)', textAlign: 'center' }}>
          <span style={{ fontWeight: 600 }}>{scanStatus}</span>
        </div>
      )}

      {error && (
        <div style={{ background: 'var(--warning)', color: '#000', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {!scanning && stocks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)', background: 'var(--surface)', borderRadius: '16px', border: '1px dashed var(--border)' }}>
          <Play size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
          <h3>Ready to Scan</h3>
          <p style={{ marginTop: '0.5rem' }}>Click "Start Scan" to fetch and analyze real-time market data.</p>
        </div>
      ) : (
        <div style={{ width: '100%' }}>
          
          <div className="topbar-controls" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem', background: 'var(--surface)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
            
            {/* Top Row: Search and Dropdowns */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
              
              {/* Search Bar */}
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0 12px', flex: '2 1 250px', minWidth: '250px' }}>
                <Search size={16} color="var(--text-secondary)" />
                <input 
                  type="text" 
                  placeholder="Search symbol, name, or sector..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: '#fff', padding: '10px 8px', outline: 'none', width: '100%', fontSize: '0.95rem' }}
                />
              </div>

              {/* Sector Performance Dropdown */}
              <select className="custom-select" style={{ flex: '1 1 180px', minWidth: '180px' }} value={selectedSector} onChange={(e) => setSelectedSector(e.target.value)}>
                {availableSectors.map(s => (
                  <option key={s.name} value={s.name}>
                    {s.name === 'all' ? 'All Sectors' : `${s.avgChange > 1.0 ? '🔥 ' : ''}${s.name} (${s.avgChange > 0 ? '+' : ''}${s.avgChange.toFixed(1)}%)`}
                  </option>
                ))}
              </select>
              
              {/* Market Cap Dropdown */}
              <select className="custom-select" style={{ flex: '1 1 130px', minWidth: '130px' }} value={selectedMarketCap} onChange={(e) => setSelectedMarketCap(e.target.value)}>
                <option value="all">All Caps</option>
                <option value="Large Cap">Large Cap</option>
                <option value="Mid Cap">Mid Cap</option>
                <option value="Small Cap">Small Cap</option>
                <option value="Micro Cap">Micro Cap</option>
              </select>
              
              {/* Index Dropdown */}
              <select className="custom-select" style={{ flex: '1 1 130px', minWidth: '130px' }} value={selectedIndex} onChange={(e) => setSelectedIndex(e.target.value)}>
                <option value="all">All Indices</option>
                <option value="Nifty 50">Nifty 50</option>
                <option value="Nifty Next 50">Nifty Next 50</option>
                <option value="Nifty 500">Nifty 500</option>
                <option value="Nifty Midcap 150">Nifty Midcap 150</option>
                <option value="Nifty Smallcap 250">Nifty Smallcap 250</option>
                <option value="Nifty Bank">Nifty Bank</option>
                <option value="Nifty IT">Nifty IT</option>
                <option value="Nifty Auto">Nifty Auto</option>
                <option value="Nifty Metal">Nifty Metal</option>
                <option value="Nifty Pharma">Nifty Pharma</option>
              </select>
            </div>

            {/* Bottom Row: Technical Toggles */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', paddingTop: '0.5rem', borderTop: '1px dashed var(--border)' }}>
              <label className="checkbox-label" style={{ margin: 0, padding: '0.5rem 1rem', background: mustBeAboveSma50 ? 'var(--primary-glow)' : 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}>
                <input type="checkbox" checked={mustBeAboveSma50} onChange={(e) => setMustBeAboveSma50(e.target.checked)} style={{ display: 'none' }} />
                Above 50 SMA
              </label>
              <label className="checkbox-label" style={{ margin: 0, padding: '0.5rem 1rem', background: mustBeGoldenCross ? 'var(--primary-glow)' : 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}>
                <input type="checkbox" checked={mustBeGoldenCross} onChange={(e) => setMustBeGoldenCross(e.target.checked)} style={{ display: 'none' }} />
                Golden Cross
              </label>
              <label className="checkbox-label" style={{ margin: 0, padding: '0.5rem 1rem', background: mustHaveBullishMacd ? 'var(--primary-glow)' : 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}>
                <input type="checkbox" checked={mustHaveBullishMacd} onChange={(e) => setMustHaveBullishMacd(e.target.checked)} style={{ display: 'none' }} />
                Bullish MACD
              </label>
              <label className="checkbox-label" style={{ margin: 0, padding: '0.5rem 1rem', background: mustHaveInstBuying ? 'var(--primary-glow)' : 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}>
                <input type="checkbox" checked={mustHaveInstBuying} onChange={(e) => setMustHaveInstBuying(e.target.checked)} style={{ display: 'none' }} />
                Volume Spike
              </label>
              <label className="checkbox-label" style={{ margin: 0, padding: '0.5rem 1rem', background: mustHaveUptrend ? 'var(--primary-glow)' : 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}>
                <input type="checkbox" checked={mustHaveUptrend} onChange={(e) => { setMustHaveUptrend(e.target.checked); if (e.target.checked) setMustHaveDowntrend(false); }} style={{ display: 'none' }} />
                Daily Trend + (+2 Days)
              </label>
              <label className="checkbox-label" style={{ margin: 0, padding: '0.5rem 1rem', background: mustHaveDowntrend ? 'var(--primary-glow)' : 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}>
                <input type="checkbox" checked={mustHaveDowntrend} onChange={(e) => { setMustHaveDowntrend(e.target.checked); if (e.target.checked) setMustHaveUptrend(false); }} style={{ display: 'none' }} />
                Daily Trend - (-5 Days)
              </label>
              <label className="checkbox-label" style={{ margin: 0, padding: '0.5rem 1rem', background: mustHaveBbSqueeze ? 'var(--primary-glow)' : 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}>
                <input type="checkbox" checked={mustHaveBbSqueeze} onChange={(e) => setMustHaveBbSqueeze(e.target.checked)} style={{ display: 'none' }} />
                BB Squeeze
              </label>
              <label className="checkbox-label" style={{ margin: 0, padding: '0.5rem 1rem', background: mustHaveObvAccumulation ? 'var(--primary-glow)' : 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}>
                <input type="checkbox" checked={mustHaveObvAccumulation} onChange={(e) => setMustHaveObvAccumulation(e.target.checked)} style={{ display: 'none' }} />
                OBV Accumulation
              </label>
            </div>
            
          </div>

          <div style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Showing {filteredAndSortedStocks.length} of {stocks.length} stocks
          </div>

          {filteredAndSortedStocks.length === 0 && stocks.length > 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              No stocks match your advanced filter criteria.
            </div>
          ) : (
            <div className="table-container fade-in">
              <table className="stocks-table">
                  <thead>
                    <tr>
                      <th onClick={() => handleSort('id')} style={{cursor:'pointer'}}>Symbol {getSortIcon('id')}</th>
                      <th onClick={() => handleSort('price')} style={{cursor:'pointer'}}>Price {getSortIcon('price')}</th>
                      <th onClick={() => handleSort('change24h')} style={{cursor:'pointer'}}>24h Chg {getSortIcon('change24h')}</th>
                      <th onClick={() => handleSort('rsRating')} style={{cursor:'pointer'}}>RS Score {getSortIcon('rsRating')}</th>
                      <th onClick={() => handleSort('beta')} style={{cursor:'pointer'}}>Beta {getSortIcon('beta')}</th>
                      <th onClick={() => handleSort('algoTarget')} style={{cursor:'pointer'}}>Algo Target {getSortIcon('algoTarget')}</th>
                      <th onClick={() => handleSort('algoUpside')} style={{cursor:'pointer'}}>Upside {getSortIcon('algoUpside')}</th>
                      <th onClick={() => handleSort('rsi')} style={{cursor:'pointer'}}>RSI {getSortIcon('rsi')}</th>
                      <th onClick={() => handleSort('volume')} style={{cursor:'pointer'}}>Vol (24h) {getSortIcon('volume')}</th>
                      <th>Signals</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSortedStocks.map((stock) => {
                      const isPositive = stock.change24h >= 0;
                      return (
                        <tr key={stock.id} onClick={() => setSelectedStock(stock)}>
                          <td>
                            <div className="table-symbol">
                              {stock.id.replace('.NS', '')}
                              {stock.institutionalBuying && <Zap size={14} style={{color: '#f59e0b'}} title="Vol Spike" />}
                            </div>
                            <div className="table-name">{stock.name}</div>
                          </td>
                          <td style={{ fontWeight: 500 }}>₹{stock.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td style={{ color: isPositive ? 'var(--success)' : 'var(--danger)', fontWeight: 500 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                              {Math.abs(stock.change24h).toFixed(2)}%
                            </div>
                          </td>
                          <td style={{ color: stock.rsRating > 80 ? '#a78bfa' : 'inherit', fontWeight: stock.rsRating > 80 ? 600 : 'normal' }}>
                            {stock.rsRating || 'N/A'}
                          </td>
                          <td>
                            {stock.beta !== undefined ? stock.beta.toFixed(2) : 'N/A'}
                          </td>
                          <td>₹{stock.algoTarget?.toFixed(2) || 'N/A'}</td>
                          <td style={{ color: stock.algoUpside > 10 ? 'var(--success)' : 'inherit', fontWeight: stock.algoUpside > 10 ? 600 : 'normal' }}>
                            {stock.algoUpside?.toFixed(1)}%
                          </td>
                          <td style={{ color: stock.rsi < 35 ? 'var(--success)' : stock.rsi > 70 ? 'var(--danger)' : 'inherit' }}>
                            {stock.rsi?.toFixed(1)}
                          </td>
                          <td>{formatVolume(stock.volume)}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                              {stock.aboveSma50 && <span className="badge badge-primary" style={{ padding: '2px 6px', fontSize: '0.65rem' }}>&gt; 50 SMA</span>}
                              {stock.goldenAligned && <span className="badge badge-warning" style={{ padding: '2px 6px', fontSize: '0.65rem' }}>Golden Cross</span>}
                              {stock.bullishMacd && <span className="badge badge-success" style={{ padding: '2px 6px', fontSize: '0.65rem' }}>MACD</span>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      )}
      
      {/* Modal Overlay for Stock Card */}
      {selectedStock && (
        <div className="modal-overlay" onClick={() => setSelectedStock(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setSelectedStock(null)}>
              <X size={18} />
            </button>
            <StockCard stock={selectedStock} />
          </div>
        </div>
      )}
      {/* ChatBox Floating Assistant */}
      {!scanning && stocks.length > 0 && (
        <ChatBox stocks={stocks} onSelectStock={setSelectedStock} />
      )}
    </div>
  );
};

export default StocksToBuyReport;
