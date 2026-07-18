import React, { useState, useMemo, useEffect } from 'react';
import { 
  TrendingUp, 
  Activity, 
  Search, 
  Filter, 
  AlertCircle, 
  CheckCircle2, 
  BarChart3, 
  ArrowUpRight,
  HelpCircle,
  RefreshCw,
  Server,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Flame,
  Zap,
  Award
} from 'lucide-react';

const calculateRallyScore = (stock) => {
  let score = 0;
  
  // 1. RSI Sweet Spot Alignment
  if (stock.rsi >= 55 && stock.rsi <= 68) score += 25;
  else if (stock.rsi > 68 && stock.rsi <= 75) score += 15;

  // 2. Bollinger Band Squeeze Flag
  if (stock.bollingerSqueeze) score += 25;

  // 3. Institutional Volume Dynamics 
  if (stock.volumeDryUp) score += 20;
  else if (stock.volumeSpikeRatio >= 2.0) score += 20;

  // 4. Proximity to 52-Week High
  if (stock.prox52WkHigh >= 0.95) score += 20;
  else if (stock.prox52WkHigh >= 0.90) score += 10;

  // 5. Trend Alignment
  if (stock.smaAligned) score += 10;
  
  return Math.min(100, score);
};

export default function App() {
  const [stocks, setStocks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSector, setSelectedSector] = useState('All');
  const [minScore, setMinScore] = useState(0);
  const [selectedStock, setSelectedStock] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [apiStatus, setApiStatus] = useState('Connecting...');
  const [sortConfig, setSortConfig] = useState({ key: 'rallyScore', direction: 'descending' });

  // Change this function inside your frontend/src/App.jsx:
  const fetchStockData = async (force = false) => {
    setIsLoading(true);
    setApiStatus('Scanning Nifty 500...');
    try {
      // OLD CODE: const url = `http://localhost:8000/api/scan-rally${force ? '?force_refresh=true' : ''}`;
      
      // NEW UPDATED CODE: Use relative pathing for unified hosting
      const url = `/api/scan-rally${force ? '?force_refresh=true' : ''}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      setStocks(data);
      setApiStatus('Live Unified Nifty 500 Feed');
    } catch (error) {
      console.warn("Could not connect to consolidated API server.", error);
      setApiStatus('Offline (Check Server Status)');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStockData();
  }, []);

  // 1. DYNAMIC SECTORS LIST
  const sectors = useMemo(() => {
    const uniqueSectors = new Set(stocks.map(s => s.sector || 'General Equities'));
    return ['All', ...Array.from(uniqueSectors)].sort();
  }, [stocks]);

  // 2. MATHEMATICAL SECTOR OUTPERFORMANCE ENGINE
  // Ranks sectors based on average rally score, percentage of stocks squeezing, and momentum
  const sectorRankings = useMemo(() => {
    const sectorMap = {};

    stocks.forEach(stock => {
      const sec = stock.sector || 'General Equities';
      if (!sectorMap[sec]) {
        sectorMap[sec] = { name: sec, count: 0, totalScore: 0, squeezeCount: 0, totalRsi: 0, totalProx: 0 };
      }
      const score = calculateRallyScore(stock);
      sectorMap[sec].count += 1;
      sectorMap[sec].totalScore += score;
      if (stock.bollingerSqueeze) sectorMap[sec].squeezeCount += 1;
      sectorMap[sec].totalRsi += stock.rsi;
      sectorMap[sec].totalProx += stock.prox52WkHigh;
    });

    return Object.values(sectorMap)
      .map(s => ({
        name: s.name,
        stockCount: s.count,
        avgScore: Math.round(s.totalScore / s.count),
        squeezePercent: Math.round((s.squeezeCount / s.count) * 100),
        avgRsi: (s.totalRsi / s.count).toFixed(1),
        avgProx: ((s.totalProx / s.count) * 100).toFixed(1)
      }))
      // Sort primarily by highest average Rally Probability Score
      .sort((a, b) => b.avgScore - a.avgScore);
  }, [stocks]);

  const topOutperformingSector = sectorRankings[0] || { name: 'Analyzing...', avgScore: 0, squeezePercent: 0, avgRsi: 0 };

  // 3. TABLE SORTING & FILTERING
  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown className="w-3.5 h-3.5 ml-1 opacity-40 inline" />;
    return sortConfig.direction === 'ascending' 
      ? <ArrowUp className="w-3.5 h-3.5 ml-1 text-indigo-400 inline" /> 
      : <ArrowDown className="w-3.5 h-3.5 ml-1 text-indigo-400 inline" />;
  };

  const processedStocks = useMemo(() => {
    let filtered = stocks.map(stock => ({
      ...stock,
      rallyScore: calculateRallyScore(stock)
    })).filter(stock => {
      const matchesSearch = stock.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            stock.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSector = selectedSector === 'All' || stock.sector === selectedSector;
      const matchesScore = stock.rallyScore >= minScore;
      return matchesSearch && matchesSector && matchesScore;
    });

    if (sortConfig.key !== null) {
      filtered.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];
        if (typeof aValue === 'string') aValue = aValue.toLowerCase();
        if (typeof bValue === 'string') bValue = bValue.toLowerCase();
        if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  }, [stocks, searchTerm, selectedSector, minScore, sortConfig]);

  const getScoreBadge = (score) => {
    if (score >= 80) return { label: 'Strong Buy Setup', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
    if (score >= 60) return { label: 'Accumulation', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
    return { label: 'Neutral / Weak', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600/20 rounded-lg border border-indigo-500/30">
              <TrendingUp className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
                Nifty 500 Rally Prediction Engine
              </h1>
              <p className="text-xs text-slate-400">Quantitative Pre-Breakout & Sector Outperformance Scanner</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800">
              <Server className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-slate-400">Universe:</span>
              <span className={apiStatus.includes('Live') ? "text-emerald-400 font-medium" : "text-amber-400 font-medium"}>
                {apiStatus}
              </span>
            </div>
            
            <button 
              onClick={() => fetchStockData(true)}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium border border-slate-700 transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
              <span>{isLoading ? 'Scanning...' : 'Force Recalculate'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-8">
        {/* NEW: PREDICTIVE SECTOR OUTPERFORMANCE BANNER */}
        <div className="bg-gradient-to-r from-indigo-950/60 via-slate-900 to-emerald-950/40 border border-indigo-500/30 rounded-2xl p-6 mb-8 relative overflow-hidden shadow-2xl">
          <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold tracking-wide uppercase">
                <Flame className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                Algorithmic Sector Prediction
              </div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-2">
                Outperforming Rally Sector: <span className="text-emerald-400 underline decoration-indigo-500 decoration-wavy underline-offset-4">{topOutperformingSector.name}</span>
              </h2>
              <p className="text-slate-300 text-xs md:text-sm max-w-2xl">
                Based on live data from <strong className="text-white">{topOutperformingSector.stockCount} constituent stocks</strong>, this sector exhibits the highest aggregate institutional accumulation, volatility compression, and momentum synchronization.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl min-w-[280px]">
              <div className="text-center border-r border-slate-800 pr-3">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Avg Rally Score</div>
                <div className="text-lg font-black text-emerald-400 mt-0.5">{topOutperformingSector.avgScore}%</div>
              </div>
              <div className="text-center border-r border-slate-800 pr-3">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">VCP Squeezes</div>
                <div className="text-lg font-black text-indigo-400 mt-0.5">{topOutperformingSector.squeezePercent}%</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Avg RSI (14)</div>
                <div className="text-lg font-black text-amber-400 mt-0.5">{topOutperformingSector.avgRsi}</div>
              </div>
            </div>
          </div>

          {/* Sector Leaderboard Chips */}
          <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs font-bold text-slate-400 shrink-0 flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-indigo-400" /> Top Ranked Sectors:
            </span>
            {sectorRankings.slice(0, 5).map((sec, idx) => (
              <button
                key={sec.name}
                onClick={() => setSelectedSector(sec.name)}
                className={`text-xs px-3 py-1 rounded-lg border transition-all shrink-0 flex items-center gap-1.5 ${
                  selectedSector === sec.name 
                    ? 'bg-indigo-600 text-white border-indigo-500 font-semibold shadow-lg shadow-indigo-600/20' 
                    : 'bg-slate-900/90 text-slate-300 border-slate-700/80 hover:bg-slate-800'
                }`}
              >
                <span className="text-[10px] font-bold opacity-60">#{idx + 1}</span>
                <span>{sec.name}</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-bold">{sec.avgScore}%</span>
              </button>
            ))}
          </div>
        </div>

        {/* Search, Sector Filter & Min Score Toolbar */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              placeholder="Search Nifty 500 Symbol..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs text-slate-400">Filter Sector:</span>
              <select 
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
                className="bg-transparent text-slate-200 focus:outline-none text-sm max-w-[180px]"
              >
                {sectors.map(sec => <option key={sec} value={sec} className="bg-slate-900">{sec}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm">
              <span className="text-slate-400 text-xs">Min Score:</span>
              <select 
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="bg-transparent text-slate-200 focus:outline-none text-sm font-medium"
              >
                <option value={0} className="bg-slate-900">All Setups</option>
                <option value={60} className="bg-slate-900">Moderate (60+)</option>
                <option value={80} className="bg-slate-900">Strong Buy (80+)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Nifty 500 Interactive Sortable Table */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-900/90 select-none">
                  <th onClick={() => requestSort('id')} className="py-3.5 px-4 cursor-pointer hover:bg-slate-800/50 transition-colors">
                    Stock Symbol {getSortIcon('id')}
                  </th>
                  <th onClick={() => requestSort('price')} className="py-3.5 px-4 cursor-pointer hover:bg-slate-800/50 transition-colors">
                    Price (₹) {getSortIcon('price')}
                  </th>
                  <th onClick={() => requestSort('rsi')} className="py-3.5 px-4 cursor-pointer hover:bg-slate-800/50 transition-colors">
                    RSI (14) {getSortIcon('rsi')}
                  </th>
                  <th className="py-3.5 px-4">Technical Setup</th>
                  <th onClick={() => requestSort('volumeSpikeRatio')} className="py-3.5 px-4 cursor-pointer hover:bg-slate-800/50 transition-colors">
                    Volume Metric {getSortIcon('volumeSpikeRatio')}
                  </th>
                  <th onClick={() => requestSort('rallyScore')} className="py-3.5 px-4 text-center cursor-pointer hover:bg-slate-800/50 transition-colors">
                    Rally Probability {getSortIcon('rallyScore')}
                  </th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm font-normal">
                {isLoading ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                      Crunching Nifty 500 technical setups across multi-threaded engine...
                    </td>
                  </tr>
                ) : processedStocks.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-slate-500">
                      No Nifty 500 stocks found matching the active sorting/filter combinations.
                    </td>
                  </tr>
                ) : (
                  processedStocks.map((stock) => {
                    const badge = getScoreBadge(stock.rallyScore);
                    const isTopSector = stock.sector === topOutperformingSector.name;
                    return (
                      <tr 
                        key={stock.id}
                        className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                        onClick={() => setSelectedStock(stock)}
                      >
                        <td className="py-4 px-4">
                          <div className="font-bold text-white group-hover:text-indigo-400 transition-colors flex items-center gap-1.5">
                            {stock.id}
                            {isTopSector && (
                              <span title="Belongs to predicted outperforming sector" className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1 rounded font-normal">
                                🔥 Top Sector
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 truncate max-w-[180px]">
                            {stock.name} ({stock.sector})
                          </div>
                        </td>
                        
                        <td className="py-4 px-4 font-medium">
                          <div>₹{stock.price.toLocaleString('en-IN')}</div>
                          <div className={`text-xs font-semibold flex items-center ${stock.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {stock.change24h >= 0 ? '+' : ''}{stock.change24h}%
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <div className="font-semibold text-slate-200">{stock.rsi}</div>
                          <div className="text-[11px] text-slate-400">
                            {stock.rsi >= 55 && stock.rsi <= 68 ? '🔥 Accumulation' : stock.rsi > 70 ? '⚠️ Overbought' : 'Neutral'}
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <div className="text-slate-200 text-xs font-medium bg-slate-800/80 border border-slate-700/60 rounded px-2 py-1 inline-block">
                            {stock.lastPattern}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1">
                            {stock.bollingerSqueeze ? '⚡ Band Squeeze Active' : 'Bands Expanded'}
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          {stock.volumeDryUp ? (
                            <span className="text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                              📉 Compression Dry-Up
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
                              📊 {stock.volumeSpikeRatio}x Spike
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-4 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <span className="text-lg font-extrabold text-white">
                              {stock.rallyScore}%
                            </span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.color} mt-0.5`}>
                              {badge.label}
                            </span>
                          </div>
                        </td>

                        <td className="py-4 px-4 text-right">
                          <button className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-3 py-1.5 rounded-lg transition-all shadow-lg shadow-indigo-600/20">
                            Analyze
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Detail Modal Overlay */}
      {selectedStock && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4 mb-4">
              <div>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">
                  {selectedStock.sector}
                </span>
                <h3 className="text-xl font-bold text-white mt-1.5 flex items-center gap-2">
                  {selectedStock.name} ({selectedStock.id})
                </h3>
              </div>
              <button onClick={() => setSelectedStock(null)} className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800">✕</button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">Algorithmic Rally Score</div>
                  <div className="text-2xl font-black text-white mt-0.5">{selectedStock.rallyScore} / 100</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Current Market Price</div>
                  <div className="text-lg font-bold text-indigo-400">₹{selectedStock.price.toLocaleString('en-IN')}</div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-indigo-400" /> Why Did The Algorithm Flag This Stock?
                </h4>
                <ul className="space-y-2 bg-slate-800/30 p-3 rounded-xl border border-slate-800 text-slate-300 text-xs">
                  <li className="flex items-center gap-2">
                    <span className={selectedStock.bollingerSqueeze ? "text-emerald-400" : "text-slate-500"}>●</span>
                    <strong>Volatility Contraction:</strong> {selectedStock.bollingerSqueeze ? "Yes — Bollinger Bands are squeezed tightly, indicating imminent price breakout." : "No — Bands are currently wide."}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className={selectedStock.volumeDryUp ? "text-emerald-400" : "text-slate-500"}>●</span>
                    <strong>Volume Signature:</strong> {selectedStock.volumeDryUp ? "Volume has dried up significantly during consolidation (smart money accumulation)." : `Active volume spike detected (${selectedStock.volumeSpikeRatio}x average).`}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className={selectedStock.rsi >= 55 && selectedStock.rsi <= 68 ? "text-emerald-400" : "text-amber-400"}>●</span>
                    <strong>Momentum RSI (14):</strong> Sitting at {selectedStock.rsi}. {selectedStock.rsi >= 55 && selectedStock.rsi <= 68 ? "Within the optimal 55-68 bullish accumulation zone." : "Monitor for overbought exhaustion."}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400">●</span>
                    <strong>52-Week High Proximity:</strong> Trading within {((1 - selectedStock.prox52WkHigh) * 100).toFixed(1)}% of its 52-week peak.
                  </li>
                </ul>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300/90 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <span>
                  <strong>Risk Management Note:</strong> Quantitative backtests show applying a strict <strong>10% stop-loss</strong> below the consolidation base dramatically increases Sharpe ratio when trading VCP setups.
                </span>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={() => setSelectedStock(null)} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/25">
                Add to Watchlist & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}