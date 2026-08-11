import React from 'react';
import { TrendingUp, TrendingDown, Target, Activity, Zap, Shield, BarChart2, ArrowRight } from 'lucide-react';

const StockCard = ({ stock }) => {
  const isPositive = stock.change24h >= 0;
  
  const formatVolume = (vol) => {
    if (!vol) return 'N/A';
    if (vol >= 10000000) return (vol / 10000000).toFixed(2) + 'Cr';
    if (vol >= 100000) return (vol / 100000).toFixed(2) + 'L';
    if (vol >= 1000) return (vol / 1000).toFixed(2) + 'K';
    return vol.toString();
  };
  
  return (
    <div className="card fade-in">
      <div className="card-header">
        <div>
          <div className="stock-symbol">
            {stock.id.replace('.NS', '')}
            {stock.institutionalBuying && <Zap size={16} className="text-warning" style={{color: '#f59e0b'}} title="Institutional Buying Detected" />}
          </div>
          <div className="stock-name">{stock.name}</div>
          <div className="stock-sector mt-1">{stock.sector}</div>
        </div>
        <div className={`change ${isPositive ? 'positive' : 'negative'}`}>
          {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {Math.abs(stock.change24h).toFixed(2)}%
        </div>
      </div>
      
      <div className="price-section">
        <div className="price">₹{stock.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
      </div>

      <div className="signals">
        {stock.marketCap && (
          <span className="badge" style={{background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.2)'}}>
            {stock.marketCap}
          </span>
        )}
        {stock.algoUpside > 10 && (
          <span className="badge badge-success">
            Algo Upside: {stock.algoUpside}%
          </span>
        )}
        {stock.aboveSma50 && (
          <span className="badge badge-primary">
            &gt; 50 SMA
          </span>
        )}
        {stock.goldenAligned && (
          <span className="badge badge-warning">
            Golden Cross
          </span>
        )}
        {stock.bullishMacd && (
          <span className="badge badge-success">
            MACD Bullish
          </span>
        )}
        {stock.rsRating > 80 && (
          <span className="badge" style={{background: 'rgba(139, 92, 246, 0.1)', color: '#a78bfa', border: '1px solid rgba(139, 92, 246, 0.2)'}}>
            RS {stock.rsRating}
          </span>
        )}
      </div>
      
      <div className="sections-grid">
        
        {/* SECTION 1: Key Price Levels */}
        <div>
          <h4 style={{ color: 'var(--text-secondary)', marginBottom: '0.25rem', marginTop: '0', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Key Price Levels</h4>
          <div className="metrics-grid">
            <div className="metric">
              <span className="metric-label">52-Week High</span>
              <span className="metric-value" style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                ₹{stock.high52w?.toFixed(2) || 'N/A'}
                {stock.distanceToHigh !== undefined && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--danger)' }}>({stock.distanceToHigh.toFixed(1)}%)</span>
                )}
              </span>
            </div>

            <div className="metric">
              <span className="metric-label">52-Week Low</span>
              <span className="metric-value" style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                ₹{stock.low52w?.toFixed(2) || 'N/A'}
                {stock.distanceToLow !== undefined && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--success)' }}>(+{stock.distanceToLow.toFixed(1)}%)</span>
                )}
              </span>
            </div>

            <div className="metric">
              <span className="metric-label">Ideal Entry</span>
              <span className="metric-value">
                <ArrowRight size={14} color="var(--primary)" />
                ₹{stock.idealEntry?.toFixed(2) || stock.price?.toFixed(2) || 'N/A'}
              </span>
            </div>

            <div className="metric">
              <span className="metric-label">Stop Loss</span>
              <span className="metric-value">
                <Shield size={14} color="var(--danger)" />
                ₹{stock.stopLoss?.toFixed(2) || 'N/A'}
              </span>
            </div>
            
            <div className="metric">
              <span className="metric-label">Target Price</span>
              <span className="metric-value">
                <Target size={14} color="var(--success)" />
                ₹{stock.algoTarget?.toFixed(2) || 'N/A'}
              </span>
            </div>
            
            {stock.pivot !== undefined && (
              <>
                <div className="metric">
                  <span className="metric-label">Pivot (P)</span>
                  <span className="metric-value">₹{stock.pivot.toFixed(2)}</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Support (S1)</span>
                  <span className="metric-value" style={{color: 'var(--danger)'}}>₹{stock.s1?.toFixed(2)}</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Resistance (R1)</span>
                  <span className="metric-value" style={{color: 'var(--success)'}}>₹{stock.r1?.toFixed(2)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* SECTION 2: Momentum & Trend */}
        <div>
          <h4 style={{ color: 'var(--text-secondary)', marginBottom: '0.25rem', marginTop: '0', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Momentum & Trend</h4>
          <div className="metrics-grid">
            <div className="metric">
              <span className="metric-label">1W Return</span>
              <span className="metric-value" style={{ color: stock.change1w > 0 ? 'var(--success)' : stock.change1w < 0 ? 'var(--danger)' : 'inherit' }}>
                {stock.change1w > 0 ? '+' : ''}{stock.change1w?.toFixed(1) || '0.0'}%
              </span>
            </div>
            
            <div className="metric">
              <span className="metric-label">1M Return</span>
              <span className="metric-value" style={{ color: stock.change1m > 0 ? 'var(--success)' : stock.change1m < 0 ? 'var(--danger)' : 'inherit' }}>
                {stock.change1m > 0 ? '+' : ''}{stock.change1m?.toFixed(1) || '0.0'}%
              </span>
            </div>
            
            <div className="metric">
              <span className="metric-label">Sector Outperformance</span>
              <span className="metric-value" style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                <span style={{ color: stock.rsSector > 0 ? 'var(--success)' : stock.rsSector < 0 ? 'var(--danger)' : 'inherit' }}>
                  {stock.rsSector > 0 ? '+' : ''}{stock.rsSector?.toFixed(1) || '0.0'}%
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>vs Sector</span>
              </span>
            </div>

            <div className="metric">
              <span className="metric-label">Daily Trend</span>
              <span className="metric-value" style={{ color: stock.consecutiveUp > 0 ? 'var(--success)' : stock.consecutiveDown > 0 ? 'var(--danger)' : 'inherit' }}>
                {stock.consecutiveUp > 0 ? `+${stock.consecutiveUp} Days` : stock.consecutiveDown > 0 ? `-${stock.consecutiveDown} Days` : 'Flat'}
              </span>
            </div>

            <div className="metric">
              <span className="metric-label">MACD (Line | Sig)</span>
              <span className="metric-value">
                {stock.macdLine?.toFixed(2)} | {stock.macdSignal?.toFixed(2)}
              </span>
            </div>

            <div className="metric">
              <span className="metric-label">Beta (1y)</span>
              <span className="metric-value">
                {stock.beta !== undefined ? stock.beta.toFixed(2) : 'N/A'}
              </span>
            </div>

            <div className="metric">
              <span className="metric-label">Delivery %</span>
              <span className="metric-value" style={{ color: stock.deliveryPct > 60 ? 'var(--success)' : stock.deliveryPct < 30 ? 'var(--danger)' : 'inherit' }}>
                {stock.deliveryPct?.toFixed(1) || '0.0'}%
              </span>
            </div>

            <div className="metric">
              <span className="metric-label">OBV Trend</span>
              <span className="metric-value" style={{ color: stock.isAccumulating ? 'var(--success)' : 'var(--danger)' }}>
                {stock.isAccumulating ? 'Accumulation' : 'Distribution'}
              </span>
            </div>
          </div>
        </div>

        {/* SECTION 3: Technicals & MAs */}
        <div>
          <h4 style={{ color: 'var(--text-secondary)', marginBottom: '0.25rem', marginTop: '0', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Technicals & MAs</h4>
          <div className="metrics-grid">
            <div className="metric">
              <span className="metric-label">RSI (14)</span>
              <span className="metric-value">
                <Activity size={14} color={stock.rsi < 30 ? 'var(--success)' : stock.rsi > 70 ? 'var(--danger)' : 'var(--primary)'} />
                {stock.rsi?.toFixed(1) || 'N/A'}
              </span>
            </div>

            <div className="metric">
              <span className="metric-label">Stochastic (%K | %D)</span>
              <span className="metric-value" style={{ color: stock.stochK < 20 ? 'var(--success)' : stock.stochK > 80 ? 'var(--danger)' : 'inherit' }}>
                {stock.stochK?.toFixed(0)} | {stock.stochD?.toFixed(0)}
              </span>
            </div>

            <div className="metric">
              <span className="metric-label">VWAP (Daily)</span>
              <span className="metric-value" style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                ₹{stock.vwap?.toFixed(2) || 'N/A'}
                {stock.vwap && stock.price && (
                  <span style={{ fontSize: '0.7rem', color: stock.price > stock.vwap ? 'var(--success)' : 'var(--danger)' }}>
                    ({(((stock.price - stock.vwap) / stock.vwap) * 100).toFixed(1)}%)
                  </span>
                )}
              </span>
            </div>

            <div className="metric">
              <span className="metric-label">50-Day SMA</span>
              <span className="metric-value" style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                ₹{stock.currentSma50?.toFixed(2) || 'N/A'}
                {stock.distSma50 !== undefined && (
                  <span style={{ fontSize: '0.7rem', color: stock.distSma50 > 0 ? 'var(--success)' : 'var(--danger)' }}>
                    ({stock.distSma50 > 0 ? '+' : ''}{stock.distSma50.toFixed(1)}%)
                  </span>
                )}
              </span>
            </div>

            <div className="metric">
              <span className="metric-label">200-Day SMA</span>
              <span className="metric-value" style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                ₹{stock.currentSma200?.toFixed(2) || 'N/A'}
                {stock.distSma200 !== undefined && (
                  <span style={{ fontSize: '0.7rem', color: stock.distSma200 > 0 ? 'var(--success)' : 'var(--danger)' }}>
                    ({stock.distSma200 > 0 ? '+' : ''}{stock.distSma200.toFixed(1)}%)
                  </span>
                )}
              </span>
            </div>

            <div className="metric">
              <span className="metric-label">1Y Max Drawdown</span>
              <span className="metric-value" style={{ color: 'var(--danger)' }}>
                -{stock.maxDrawdown?.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* SECTION 4: Fundamentals & Valuation */}
        <div>
          <h4 style={{ color: 'var(--text-secondary)', marginBottom: '0.25rem', marginTop: '0', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fundamentals & Valuation</h4>
          <div className="metrics-grid">
            <div className="metric">
              <span className="metric-label">Trailing P/E</span>
              <span className="metric-value">
                {stock.trailingPE ? stock.trailingPE.toFixed(1) : 'N/A'}
              </span>
            </div>

            <div className="metric">
              <span className="metric-label">Forward P/E</span>
              <span className="metric-value">
                {stock.forwardPE ? stock.forwardPE.toFixed(1) : 'N/A'}
              </span>
            </div>

            <div className="metric">
              <span className="metric-label">P/B Ratio</span>
              <span className="metric-value">
                {stock.priceToBook ? stock.priceToBook.toFixed(2) : 'N/A'}
              </span>
            </div>

            <div className="metric">
              <span className="metric-label">Market Cap</span>
              <span className="metric-value">
                {stock.marketCapExact ? `₹${(stock.marketCapExact / 10000000).toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr` : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* SECTION 5: Volatility, Risk, & Liquidity */}
        <div style={{ gridColumn: '1 / -1' }}>
          <h4 style={{ color: 'var(--text-secondary)', marginBottom: '0.25rem', marginTop: '0', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Volatility, Risk & Liquidity</h4>
          <div className="metrics-grid">
            <div className="metric">
              <span className="metric-label">ATR (Volatility)</span>
              <span className="metric-value">
                ₹{stock.currentAtr?.toFixed(2) || 'N/A'}
                {stock.currentAtr && stock.price && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginLeft: '0.25rem' }}>
                    ({((stock.currentAtr / stock.price) * 100).toFixed(1)}%)
                  </span>
                )}
              </span>
            </div>

            <div className="metric">
              <span className="metric-label">Bollinger Bands</span>
              <span className="metric-value">
                {stock.bbUpper?.toFixed(0)} | {stock.bbLower?.toFixed(0)}
              </span>
            </div>

            <div className="metric">
              <span className="metric-label">BB Squeeze</span>
              <span className="metric-value" style={{ color: stock.isSqueezing ? 'var(--warning)' : 'inherit' }}>
                {stock.isSqueezing ? 'Yes ⚡' : 'No'}
              </span>
            </div>

            <div className="metric">
              <span className="metric-label">Daily Turnover</span>
              <span className="metric-value">
                {stock.turnoverCr ? `₹${stock.turnoverCr.toFixed(1)} Cr` : 'N/A'}
              </span>
            </div>

            <div className="metric">
              <span className="metric-label">Volume Spike</span>
              <span className="metric-value" style={{ color: stock.volRatio > 1.5 ? 'var(--success)' : 'inherit' }}>
                {stock.volRatio?.toFixed(1)}x Avg
              </span>
            </div>

            <div className="metric">
              <span className="metric-label">Volume (24h)</span>
              <span className="metric-value">
                <BarChart2 size={14} color="var(--primary)" />
                {formatVolume(stock.volume)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockCard;
