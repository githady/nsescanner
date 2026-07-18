import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Zap, Filter, Search, X } from 'lucide-react';
import { loadStocks } from './data';

export default function App() {
  const [stocks, setStocks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState('Initializing Quant Engine...');
  const [sortField, setSortField] = useState('rsRating');
  const [sortDirection, setSortDirection] = useState('desc');
  const [activeTab, setActiveTab] = useState('ALL');
  
  // --- NEW STATE: REAL-TIME TEXT SEARCH INTERFACE ---
  const [searchQuery, setSearchQuery] = useState('');

  const fetchStockData = async (force = false) => {
    setIsLoading(true);
    setApiStatus('Scanning Nifty 500 Market Breadth...');
    try {
      const data = await loadStocks();
      setStocks(data);
      setApiStatus(data.length ? 'Live Institutional Quant Feed' : 'Offline (Check Data Source)');
    } catch (error) {
      console.warn('Quant data unavailable.', error);
      setApiStatus('Offline (Check Data Source)');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStockData();
  }, []);

  // --- UPGRADED RALLY SCORING ENGINE ---
  const calculateRallyScore = (stock) => {
    let score = 0;
    
    // 1. Relative Strength Rating (25 pts - Market Leadership)
    if (stock.rsRating >= 85) score += 25;
    else if (stock.rsRating >= 70) score += 15;
    else if (stock.rsRating >= 50) score += 5;

    // 2. Official Demat Delivery Absorption (20 pts - Smart Money)
    if (stock.deliveryPercent >= 65.0) score += 20;
    else if (stock.deliveryPercent >= 50.0) score += 10;

    // 3. Volatility Squeeze & Institutional Volume (20 pts)
    if (stock.bollingerSqueeze) score += 10;
    if (stock.institutionalBuying || stock.volumeSpikeRatio >= 2.0) score += 10;

    // 4. Sector Breadth Rotation Alignment (20 pts)
    if (stock.sectorBreadth >= 50.0 && stock.sectorBreadth <= 70.0) score += 20;
    else if (stock.sectorBreadth < 30.0) score += 10; 

    // 5. Trend Strength ADX Confirmation (15 pts)
    if (stock.trendStrong || stock.adx >= 25.0) score += 15;

    return Math.min(100, score);
  };

  // --- DUAL SEARCH & STRATEGY FILTERING ENGINE ---
  const filteredAndSortedStocks = useMemo(() => {
    let filtered = [...stocks];

    // Phase 1: Quant Strategy Presets Filtering
    if (activeTab === 'LAUNCHPAD') {
      filtered = filtered.filter(s => s.bollingerSqueeze && s.deliveryPercent >= 60.0 && s.rsi >= 48 && s.rsi <= 65);
    } else if (activeTab === 'MOMENTUM') {
      filtered = filtered.filter(s => s.rsRating >= 80 && (s.trendStrong || s.adx >= 25) && s.volumeSpikeRatio >= 1.5 && s.prox52WkHigh >= 0.92);
    } else if (activeTab === 'DIP_BUY') {
      filtered = filtered.filter(s => s.rsi <= 40.0 && s.deliveryPercent >= 60.0 && s.rsRating >= 60);
    }

    // Phase 2: Case-Insensitive Multi-Column Text Filtering (Symbol, Name, or Sector)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(query) ||
        s.id.toLowerCase().includes(query) ||
        s.sector.toLowerCase().includes(query)
      );
    }

    // Phase 3: Column Sorting Calculations
    return filtered.sort((a, b) => {
      let aValue = sortField === 'score' ? calculateRallyScore(a) : a[sortField];
      let bValue = sortField === 'score' ? calculateRallyScore(b) : b[sortField];
      
      if (typeof aValue === 'string') {
        return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      return sortDirection === 'asc' ? (aValue || 0) - (bValue || 0) : (bValue || 0) - (aValue || 0);
    });
  }, [stocks, activeTab, searchQuery, sortField, sortDirection]);

  const requestSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return <span className="text-slate-600 ml-1 text-[10px]">↕</span>;
    return sortDirection === 'asc' ? <span className="text-indigo-400 ml-1 text-[10px]">▲</span> : <span className="text-indigo-400 ml-1 text-[10px]">▼</span>;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Terminal Header Dashboard Area */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/60 p-5 rounded-xl border border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="h-6 w-6 text-amber-400" />
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">
                NSE QUANTITATIVE TRADING TERMINAL
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {apiStatus} • Total Cached Assets: {stocks.length}
            </p>
          </div>

          <button
            onClick={() => fetchStockData(true)}
            disabled={isLoading}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white px-4 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-indigo-500/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Crunching Breadth...' : 'Force Recalculate'}
          </button>
        </div>

        {/* --- DUAL INTERFACE ROW: SEARCH PIPELINE & QUANT PRESETS --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-center bg-slate-900/40 p-3 rounded-xl border border-slate-800/80">
          
          {/* Section A: Strategy Controls */}
          <div className="lg:col-span-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-400 px-2 flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-indigo-400" /> Strategies:
            </span>
            {[
              { id: 'ALL', label: '🌐 All Valid Assets' },
              { id: 'LAUNCHPAD', label: '🔥 Institutional Launchpad' },
              { id: 'MOMENTUM', label: '🚀 Monster Momentum' },
              { id: 'DIP_BUY', label: '🛡️ Smart-Money Dip Buy' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-extrabold border border-indigo-400/30'
                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1 py-0.2 rounded ${activeTab === tab.id ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-900 text-slate-500'}`}>
                  {tab.id === 'ALL' ? stocks.length : stocks.filter(s => {
                    if (tab.id === 'LAUNCHPAD') return s.bollingerSqueeze && s.deliveryPercent >= 60.0 && s.rsi >= 48 && s.rsi <= 65;
                    if (tab.id === 'MOMENTUM') return s.rsRating >= 80 && (s.trendStrong || s.adx >= 25) && s.volumeSpikeRatio >= 1.5 && s.prox52WkHigh >= 0.92;
                    if (tab.id === 'DIP_BUY') return s.rsi <= 40.0 && s.deliveryPercent >= 60.0 && s.rsRating >= 60;
                    return true;
                  }).length}
                </span>
              </button>
            ))}
          </div>

          {/* --- NEW SECTION B: LIVE SEARCH INPUT BOX --- */}
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-500" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ticker, company name, or industry..."
              className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-9 pr-8 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/30 transition-all font-medium"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-2.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

        </div>

        {/* Quantitative Data Grid Table */}
        <div className="bg-slate-900/60 rounded-xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900 text-slate-400 text-xs uppercase font-extrabold tracking-wider">
                  <th onClick={() => requestSort('name')} className="py-3.5 px-4 cursor-pointer hover:text-white select-none">Stock / Sector {getSortIcon('name')}</th>
                  <th onClick={() => requestSort('rsRating')} className="py-3.5 px-4 cursor-pointer hover:text-white select-none">RS Rating (1-99) {getSortIcon('rsRating')}</th>
                  <th onClick={() => requestSort('sectorBreadth')} className="py-3.5 px-4 cursor-pointer hover:text-white select-none">Sector Breadth {getSortIcon('sectorBreadth')}</th>
                  <th onClick={() => requestSort('price')} className="py-3.5 px-4 cursor-pointer hover:text-white select-none">Price (₹) {getSortIcon('price')}</th>
                  <th onClick={() => requestSort('deliveryPercent')} className="py-3.5 px-4 cursor-pointer hover:text-white select-none">Demat Delivery {getSortIcon('deliveryPercent')}</th>
                  <th onClick={() => requestSort('rsi')} className="py-3.5 px-4 cursor-pointer hover:text-white select-none">RSI / Trend {getSortIcon('rsi')}</th>
                  <th onClick={() => requestSort('score')} className="py-3.5 px-4 cursor-pointer hover:text-white select-none">Rally Score {getSortIcon('score')}</th>
                  <th className="py-3.5 px-4">Algorithmic Setups</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm font-medium">
                {filteredAndSortedStocks.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-slate-500 text-xs">
                      No assets found matching strategy <span className="text-indigo-400 font-bold">[{activeTab}]</span> or search filter <span className="text-amber-400 font-bold">"{searchQuery}"</span>.
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedStocks.map((stock) => {
                    const score = calculateRallyScore(stock);
                    return (
                      <tr key={stock.id} className="hover:bg-slate-800/40 transition-colors">
                        
                        {/* Ticker & Sector */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-white flex items-center gap-1.5">
                            {stock.name}
                            <span className="text-[10px] text-slate-500 font-mono">({stock.id.replace('.NS', '')})</span>
                          </div>
                          <div className="text-xs text-indigo-400 font-semibold mt-0.5">{stock.sector}</div>
                        </td>

                        {/* Relative Strength Percentile Badge */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-black ${
                              stock.rsRating >= 85 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/20' :
                              stock.rsRating >= 70 ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' :
                              'bg-slate-800 text-slate-400'
                            }`}>
                              {stock.rsRating}
                            </span>
                            {stock.rsRating >= 85 && <span className="text-[10px] text-amber-400 font-bold">🏆 Leader</span>}
                          </div>
                        </td>

                        {/* Sector Breadth Tracking Meter */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-12 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${stock.sectorBreadth >= 70 ? 'bg-amber-400' : stock.sectorBreadth >= 50 ? 'bg-emerald-400' : 'bg-rose-400'}`} 
                                style={{ width: `${stock.sectorBreadth}%` }}
                              ></div>
                            </div>
                            <span className="font-bold text-xs text-slate-300">{stock.sectorBreadth}%</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{stock.sectorStatus}</div>
                        </td>

                        {/* Price Fields */}
                        <td className="py-3.5 px-4 font-mono">
                          <div className="text-slate-100 font-bold">₹{stock.price.toLocaleString('en-IN')}</div>
                          <div className={`text-xs ${stock.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {stock.change24h >= 0 ? '+' : ''}{stock.change24h}%
                          </div>
                        </td>

                        {/* Demat Delivery Accumulation */}
                        <td className="py-3.5 px-4">
                          <span className={`font-extrabold ${stock.deliveryPercent >= 65.0 ? 'text-emerald-400' : stock.deliveryPercent >= 50.0 ? 'text-indigo-300' : 'text-slate-400'}`}>
                            {stock.deliveryPercent}%
                          </span>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {stock.institutionalBuying ? '⚡ Smart-Money Vaulting' : 'Normal Turnover'}
                          </div>
                        </td>

                        {/* Trend Tracking Engine */}
                        <td className="py-3.5 px-4">
                          <div className="text-slate-200 font-bold">RSI: {stock.rsi}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            ADX: <span className={stock.trendStrong ? 'text-emerald-400 font-bold' : 'text-slate-400'}>{stock.adx}</span>
                          </div>
                        </td>

                        {/* Normalized Composite Score */}
                        <td className="py-3.5 px-4">
                          <span className={`px-2.5 py-1 rounded-md font-black text-xs ${
                            score >= 75 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                            score >= 50 ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' :
                            'bg-slate-800 text-slate-400'
                          }`}>
                            {score}/100
                          </span>
                        </td>

                        {/* Algorithmic Tag Badges */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1">
                            {stock.bollingerSqueeze && (
                              <span className="bg-purple-500/10 text-purple-300 border border-purple-500/20 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                🔒 Vol Squeeze
                              </span>
                            )}
                            {stock.institutionalBuying && (
                              <span className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                💎 Inst. Accumulation
                              </span>
                            )}
                            {stock.rsRating >= 85 && (
                              <span className="bg-amber-500/10 text-amber-300 border border-amber-500/20 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                ⚡ Market Leader
                              </span>
                            )}
                          </div>
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}