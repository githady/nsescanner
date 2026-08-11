import React, { useState, useEffect, useMemo } from 'react';
import StockCard from './StockCard';
import { RefreshCw, Play, TrendingUp, TrendingDown, AlertCircle, Search, ArrowUpDown, X, Zap, SlidersHorizontal, Award, Sparkles } from 'lucide-react';
import { fetchMarketData } from '../utils/scanner';

const StocksToBuyReport = () => {
  const [stocks, setStocks] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const [error, setError] = useState(null);
  
  // Dashboard Filters State
  const [searchQuery, setSearchQuery] = useState('');

  // Smart Search Parser
  const parseSmartSearch = (query) => {
    const regex = /(price|rsi|delivery|volume|rs|macd|stoch|beta|atr)\s*(>|<|>=|<=|=|==)\s*([0-9.]+)/ig;
    let match;
    const conditions = [];
    while ((match = regex.exec(query)) !== null) {
      conditions.push({ metric: match[1].toLowerCase(), operator: match[2], value: parseFloat(match[3]) });
    }
    const text = query.replace(regex, '').replace(/and/ig, '').replace(/\s+/g, ' ').trim().toLowerCase();
    return { conditions, text };
  };

  const evaluateCondition = (stock, cond) => {
    let stockVal = null;
    switch(cond.metric) {
      case 'price': stockVal = stock.price; break;
      case 'rsi': stockVal = stock.rsi; break;
      case 'delivery': stockVal = stock.deliveryPct; break;
      case 'volume': stockVal = stock.volume; break;
      case 'rs': stockVal = stock.rsSector; break;
      case 'macd': stockVal = stock.macdLine; break;
      case 'stoch': stockVal = stock.stochK; break;
      case 'beta': stockVal = stock.beta; break;
      case 'atr': stockVal = stock.currentAtr; break;
    }
    if (stockVal === null || stockVal === undefined) return false;
    
    switch(cond.operator) {
      case '>': return stockVal > cond.value;
      case '>=': return stockVal >= cond.value;
      case '<': return stockVal < cond.value;
      case '<=': return stockVal <= cond.value;
      case '=':
      case '==': return Math.abs(stockVal - cond.value) < 0.01;
      default: return false;
    }
  };
  const [mustBeAboveSma50, setMustBeAboveSma50] = useState(false);
  const [mustBeGoldenCross, setMustBeGoldenCross] = useState(false);
  const [mustHaveBullishMacd, setMustHaveBullishMacd] = useState(false);
  const [mustHaveInstBuying, setMustHaveInstBuying] = useState(false);
  const [mustHaveHighDelivery, setMustHaveHighDelivery] = useState(false);
  const [mustBeNearBreakout, setMustBeNearBreakout] = useState(false);
  const [mustBeNearIdealEntry, setMustBeNearIdealEntry] = useState(false);
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

  const aiRecommendation = useMemo(() => {
    if (!stocks || stocks.length === 0 || !availableSectors) return null;

    // Best Sector
    const validSectors = availableSectors.filter(s => s.name !== 'all');
    // already sorted by avgChange in availableSectors useMemo
    const topSector = validSectors.length > 0 ? validSectors[0] : null;

    // Best Stock (Ultimate Formula: Nifty 500, Uptrend, Momentum, Inst Buying, Breakout)
    let candidates = stocks.filter(s => {
      return s.indices && s.indices.includes('Nifty 500') &&
             s.aboveSma50 && 
             s.rsi > 60 && 
             s.institutionalBuying && 
             s.distanceToHigh <= 10;
    });
    
    // Sort by RS Rating first, then Algo Upside
    candidates.sort((a, b) => {
      const rsA = a.rsRating || 0;
      const rsB = b.rsRating || 0;
      if (rsB !== rsA) return rsB - rsA;
      return (b.algoUpside || 0) - (a.algoUpside || 0);
    });

    // Do not slice! We want to show all perfect setups found.
    let topPicks = candidates.map(s => ({ ...s, isPerfectSetup: true }));
    
    // If we don't have 10 strict candidates, fill the rest with the highest RS Rating Nifty 500 stocks
    if (topPicks.length < 10) {
      const fillers = stocks
        .filter(s => s.indices && s.indices.includes('Nifty 500') && !topPicks.find(p => p.id === s.id))
        .sort((a, b) => (b.rsRating || 0) - (a.rsRating || 0))
        .map(s => ({ ...s, isPerfectSetup: false }));
      topPicks = [...topPicks, ...fillers.slice(0, 10 - topPicks.length)];
    }

    return { topSector, topPicks };
  }, [stocks, availableSectors]);

  const filteredAndSortedStocks = useMemo(() => {
    let filtered = [...stocks];

    // 1. Text Search & Smart Search
    if (searchQuery.trim() !== '') {
      const { conditions, text } = parseSmartSearch(searchQuery);
      
      filtered = filtered.filter(s => {
        // Evaluate all smart conditions
        for (let cond of conditions) {
          if (!evaluateCondition(s, cond)) return false;
        }
        
        // Evaluate remaining text search
        if (text) {
          const matchesText = s.id.toLowerCase().includes(text) || 
                              s.name.toLowerCase().includes(text) ||
                              (s.sector && s.sector.toLowerCase().includes(text));
          if (!matchesText) return false;
        }
        
        return true;
      });
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
    if (mustHaveHighDelivery) {
      filtered = filtered.filter(s => s.deliveryPct > 60);
    }
    if (mustBeNearBreakout) {
      filtered = filtered.filter(s => s.distanceToHigh !== undefined && s.distanceToHigh >= -5 && s.distanceToHigh <= 0);
    }
    if (mustBeNearIdealEntry) {
      filtered = filtered.filter(s => s.aboveSma50 && s.price <= s.idealEntry * 1.02);
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
  }, [stocks, searchQuery, mustBeAboveSma50, mustBeGoldenCross, mustHaveBullishMacd, mustHaveInstBuying, mustHaveHighDelivery, mustBeNearBreakout, mustBeNearIdealEntry, mustHaveUptrend, mustHaveDowntrend, mustHaveBbSqueeze, mustHaveObvAccumulation, selectedSector, selectedMarketCap, selectedIndex, sortConfig]);

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
        <>
          {aiRecommendation && aiRecommendation.topPicks && aiRecommendation.topPicks.length > 0 && (
            <div className="ai-banner fade-in" style={{
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              borderRadius: '16px',
              padding: '1.5rem',
              marginBottom: '2rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
              boxShadow: '0 4px 20px -5px rgba(139, 92, 246, 0.15)'
            }}>
              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                <div style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                  width: '50px',
                  height: '50px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)'
                }}>
                  <Sparkles size={24} color="#fff" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>
                      {aiRecommendation.topPicks.filter(p => p.isPerfectSetup).length > 0 
                        ? `AI Perfect Setups (${aiRecommendation.topPicks.filter(p => p.isPerfectSetup).length})`
                        : 'AI Momentum Picks'}
                    </h2>
                    <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.1)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.2)' }}>
                      Top Sector: {aiRecommendation.topSector?.name || 'N/A'}
                    </span>
                  </div>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    {aiRecommendation.topPicks.filter(p => p.isPerfectSetup).length > 0 
                      ? 'These stocks possess the highest mathematical probability setups today based on strict momentum and institutional volume criteria.'
                      : 'No perfect setups found today. Showing the highest Relative Strength momentum stocks instead.'}
                  </p>
                </div>
              </div>
              
              {/* Horizontal Scroll Container */}
              <div style={{
                display: 'flex',
                gap: '1rem',
                overflowX: 'auto',
                paddingBottom: '0.5rem',
                scrollbarWidth: 'thin',
                scrollbarColor: 'var(--text-tertiary) transparent'
              }}>
                {aiRecommendation.topPicks.map((pick, index) => (
                  <div 
                    key={pick.id}
                    style={{
                      background: 'rgba(21, 26, 37, 0.8)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      cursor: 'pointer',
                      minWidth: '220px',
                      transition: 'transform 0.2s, borderColor 0.2s'
                    }}
                    onClick={() => setSelectedStock(pick)}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'var(--primary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>{pick.id}</div>
                          {pick.isPerfectSetup && aiRecommendation.topPicks.some(p => !p.isPerfectSetup) && (
                            <div style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)', fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 700, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                              PERFECT SETUP
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>{pick.name}</div>
                      </div>
                      <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)' }}>
                        #{index + 1}
                      </div>
                    </div>
                    
                    <div style={{ height: '1px', width: '100%', background: 'var(--border)' }}></div>
                                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.25rem' }}>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Price</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff' }}>₹{pick.price?.toFixed(2)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Stop Loss</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--danger)' }}>₹{pick.stopLoss?.toFixed(2)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Target</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--success)' }}>₹{pick.algoTarget?.toFixed(2)}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--success)', background: 'rgba(16, 185, 129, 0.1)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                          +{pick.algoUpside?.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="dashboard-layout" style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', width: '100%' }}>
          
          {/* Left Sidebar */}
          <aside className="sidebar-controls fade-in" style={{ flex: '0 0 280px', position: 'sticky', top: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'var(--surface)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)', maxHeight: 'calc(100vh - 2rem)', overflowY: 'auto' }}>
            
            <div style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Filters</h3>
            </div>

            {/* Search Bar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Search</label>
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0 12px' }}>
                <Search size={16} color="var(--text-secondary)" />
                <input 
                  type="text" 
                  placeholder="Search 'RELIANCE' or 'rsi < 40 and delivery > 60'..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: '#fff', padding: '10px 8px', outline: 'none', width: '100%', fontSize: '0.95rem' }}
                />
              </div>
            </div>

            {/* Dropdowns */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Sector</label>
                <select className="custom-select" value={selectedSector} onChange={(e) => setSelectedSector(e.target.value)}>
                  {availableSectors.map(s => (
                    <option key={s.name} value={s.name}>
                      {s.name === 'all' ? 'All Sectors' : `${s.avgChange > 1.0 ? '🔥 ' : ''}${s.name} (${s.avgChange > 0 ? '+' : ''}${s.avgChange.toFixed(1)}%)`}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Market Cap</label>
                <select className="custom-select" value={selectedMarketCap} onChange={(e) => setSelectedMarketCap(e.target.value)}>
                  <option value="all">All Caps</option>
                  <option value="Large Cap">Large Cap</option>
                  <option value="Mid Cap">Mid Cap</option>
                  <option value="Small Cap">Small Cap</option>
                  <option value="Micro Cap">Micro Cap</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Index</label>
                <select className="custom-select" value={selectedIndex} onChange={(e) => setSelectedIndex(e.target.value)}>
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
            </div>

            {/* Technical Toggles */}
            <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.75rem' }}>Technical Signals</label>
              <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '0.4rem' }}>
                <label className="checkbox-label" style={{ margin: 0, padding: '0.25rem 0.6rem', background: mustBeAboveSma50 ? 'var(--primary-glow)' : 'var(--background)', border: '1px solid var(--border)', borderRadius: '999px', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.75rem', fontWeight: 500 }}>
                  <input type="checkbox" checked={mustBeAboveSma50} onChange={(e) => setMustBeAboveSma50(e.target.checked)} style={{ display: 'none' }} />
                  &gt; 50 SMA
                </label>
                <label className="checkbox-label" style={{ margin: 0, padding: '0.25rem 0.6rem', background: mustBeGoldenCross ? 'var(--primary-glow)' : 'var(--background)', border: '1px solid var(--border)', borderRadius: '999px', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.75rem', fontWeight: 500 }}>
                  <input type="checkbox" checked={mustBeGoldenCross} onChange={(e) => setMustBeGoldenCross(e.target.checked)} style={{ display: 'none' }} />
                  Golden Cross
                </label>
                <label className="checkbox-label" style={{ margin: 0, padding: '0.25rem 0.6rem', background: mustHaveBullishMacd ? 'var(--primary-glow)' : 'var(--background)', border: '1px solid var(--border)', borderRadius: '999px', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.75rem', fontWeight: 500 }}>
                  <input type="checkbox" checked={mustHaveBullishMacd} onChange={(e) => setMustHaveBullishMacd(e.target.checked)} style={{ display: 'none' }} />
                  MACD
                </label>
                <label className="checkbox-label" style={{ margin: 0, padding: '0.25rem 0.6rem', background: mustHaveInstBuying ? 'var(--primary-glow)' : 'var(--background)', border: '1px solid var(--border)', borderRadius: '999px', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.75rem', fontWeight: 500 }}>
                  <input type="checkbox" checked={mustHaveInstBuying} onChange={(e) => setMustHaveInstBuying(e.target.checked)} style={{ display: 'none' }} />
                  Inst. Buying
                </label>
                <label className="checkbox-label" style={{ margin: 0, padding: '0.25rem 0.6rem', background: mustHaveHighDelivery ? 'var(--primary-glow)' : 'var(--background)', border: '1px solid var(--border)', borderRadius: '999px', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.75rem', fontWeight: 500 }}>
                  <input type="checkbox" checked={mustHaveHighDelivery} onChange={(e) => setMustHaveHighDelivery(e.target.checked)} style={{ display: 'none' }} />
                  High Delivery
                </label>
                <label className="checkbox-label" style={{ margin: 0, padding: '0.25rem 0.6rem', background: mustBeNearBreakout ? 'var(--primary-glow)' : 'var(--background)', border: '1px solid var(--border)', borderRadius: '999px', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.75rem', fontWeight: 500 }}>
                  <input type="checkbox" checked={mustBeNearBreakout} onChange={(e) => setMustBeNearBreakout(e.target.checked)} style={{ display: 'none' }} />
                  Near Breakout
                </label>
                <label className="checkbox-label" style={{ margin: 0, padding: '0.25rem 0.6rem', background: mustBeNearIdealEntry ? 'var(--primary-glow)' : 'var(--background)', border: '1px solid var(--border)', borderRadius: '999px', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.75rem', fontWeight: 500 }}>
                  <input type="checkbox" checked={mustBeNearIdealEntry} onChange={(e) => setMustBeNearIdealEntry(e.target.checked)} style={{ display: 'none' }} />
                  Ideal Entry
                </label>
                <label className="checkbox-label" style={{ margin: 0, padding: '0.25rem 0.6rem', background: mustHaveUptrend ? 'var(--primary-glow)' : 'var(--background)', border: '1px solid var(--border)', borderRadius: '999px', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.75rem', fontWeight: 500 }}>
                  <input type="checkbox" checked={mustHaveUptrend} onChange={(e) => { setMustHaveUptrend(e.target.checked); if (e.target.checked) setMustHaveDowntrend(false); }} style={{ display: 'none' }} />
                  Trend + 
                </label>
                <label className="checkbox-label" style={{ margin: 0, padding: '0.25rem 0.6rem', background: mustHaveDowntrend ? 'var(--primary-glow)' : 'var(--background)', border: '1px solid var(--border)', borderRadius: '999px', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.75rem', fontWeight: 500 }}>
                  <input type="checkbox" checked={mustHaveDowntrend} onChange={(e) => { setMustHaveDowntrend(e.target.checked); if (e.target.checked) setMustHaveUptrend(false); }} style={{ display: 'none' }} />
                  Trend - 
                </label>
                <label className="checkbox-label" style={{ margin: 0, padding: '0.25rem 0.6rem', background: mustHaveBbSqueeze ? 'var(--primary-glow)' : 'var(--background)', border: '1px solid var(--border)', borderRadius: '999px', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.75rem', fontWeight: 500 }}>
                  <input type="checkbox" checked={mustHaveBbSqueeze} onChange={(e) => setMustHaveBbSqueeze(e.target.checked)} style={{ display: 'none' }} />
                  BB Squeeze
                </label>
                <label className="checkbox-label" style={{ margin: 0, padding: '0.25rem 0.6rem', background: mustHaveObvAccumulation ? 'var(--primary-glow)' : 'var(--background)', border: '1px solid var(--border)', borderRadius: '999px', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.75rem', fontWeight: 500 }}>
                  <input type="checkbox" checked={mustHaveObvAccumulation} onChange={(e) => setMustHaveObvAccumulation(e.target.checked)} style={{ display: 'none' }} />
                  OBV Accum.
                </label>
              </div>
            </div>
          </aside>

          {/* Main Content Area */}
          <main style={{ flex: 1, minWidth: 0 }}>
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
          </main>
        </div>
        </>
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
    </div>
  );
};

export default StocksToBuyReport;
