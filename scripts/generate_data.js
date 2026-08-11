import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Papa from 'papaparse';
import { RSI, SMA, ATR, MACD, BollingerBands, Stochastic } from 'technicalindicators';
import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const delay = (ms) => new Promise(res => setTimeout(res, ms));

const fetchStockData = async (symbol) => {
  const targetUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`;
  
  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    if (!response.ok) {
       if (response.status === 429) console.warn(`Rate limited on ${symbol}`);
       return null;
    }
    const data = await response.json();
    return processChartData(data);
  } catch (e) {
    return null;
  }
};

const processChartData = (data) => {
  const result = data.chart?.result;
  if (!result || result.length === 0) return null;
  
  const quote = result[0].indicators.quote[0];
  const closes = quote.close || [];
  const highs = quote.high || [];
  const lows = quote.low || [];
  const volumes = quote.volume || [];
  const timestamps = result[0].timestamp || [];
  
  const cleanCloses = [];
  const cleanHighs = [];
  const cleanLows = [];
  const cleanVols = [];
  const cleanTimestamps = [];
  
  for (let i = 0; i < closes.length; i++) {
    if (closes[i] !== null) {
      cleanCloses.push(closes[i]);
      cleanHighs.push(highs[i]);
      cleanLows.push(lows[i]);
      cleanVols.push(volumes[i]);
      cleanTimestamps.push(timestamps[i]);
    }
  }
  
  if (cleanCloses.length < 50) return null;

  return { closes: cleanCloses, highs: cleanHighs, lows: cleanLows, vols: cleanVols, timestamps: cleanTimestamps };
};

const getDayString = (ts) => {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

const fetchBenchmarkReturns = async () => {
  const data = await fetchStockData('^NSEI');
  if (!data) return null;
  const returns = {};
  for (let i = 1; i < data.closes.length; i++) {
    const dailyReturn = (data.closes[i] - data.closes[i-1]) / data.closes[i-1];
    returns[getDayString(data.timestamps[i])] = dailyReturn;
  }
  return returns;
};

const analyzeStock = (stock, marketData, benchmarkReturns, indexDict = {}, bhavcopyDict = {}, fundamentals = {}) => {
  if (!marketData) return null;
  
  const { closes, highs, lows, vols, timestamps } = marketData;
  
  const currentPrice = closes[closes.length - 1];
  const prevPrice = closes[closes.length - 2];
  
  const change24h = ((currentPrice - prevPrice) / prevPrice) * 100;
  
  const rsi = RSI.calculate({ period: 14, values: closes });
  const sma50 = SMA.calculate({ period: 50, values: closes });
  const sma200 = closes.length >= 200 ? SMA.calculate({ period: 200, values: closes }) : [];
  const atr = ATR.calculate({ period: 14, high: highs, low: lows, close: closes });
  
  const macdResult = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false
  });
  
  const volSma20 = SMA.calculate({ period: 20, values: vols });
  
  const currentRsi = rsi.length > 0 ? rsi[rsi.length - 1] : 50;
  const currentSma50 = sma50.length > 0 ? sma50[sma50.length - 1] : currentPrice;
  const currentSma200 = sma200.length > 0 ? sma200[sma200.length - 1] : 0;
  const currentAtr = atr.length > 0 ? atr[atr.length - 1] : currentPrice * 0.02;
  
  const currentMacd = macdResult.length > 0 ? macdResult[macdResult.length - 1] : { MACD: 0, signal: 0 };
  const bullishMacd = currentMacd.MACD !== undefined && currentMacd.signal !== undefined && currentMacd.MACD > currentMacd.signal;
  
  const aboveSma50 = currentPrice > currentSma50;
  const goldenAligned = currentSma200 > 0 && currentPrice > currentSma50 && currentSma50 > currentSma200;
  
  const idealEntry = (aboveSma50 && currentSma50 > 0) ? currentSma50 : currentPrice;
  const stopLoss = currentPrice - (1.5 * currentAtr);
  const algoTarget = currentPrice + (3.0 * currentAtr);
  const algoUpside = currentPrice > 0 ? ((algoTarget - currentPrice) / currentPrice) * 100 : 0;
  
  const currentVol = vols[vols.length - 1];
  const avgVol = volSma20.length > 0 ? volSma20[volSma20.length - 1] : 1;
  const volRatio = currentVol / (avgVol || 1);
  const institutionalBuying = volRatio > 1.5;
  
  const high52w = Math.max(...highs);
  const low52w = Math.min(...lows);
  const distanceToHigh = high52w > 0 ? ((high52w - currentPrice) / currentPrice) * 100 : 0;
  const distanceToLow = low52w > 0 ? ((currentPrice - low52w) / low52w) * 100 : 0;
  const maxDrawdown = high52w > 0 ? ((high52w - low52w) / high52w) * 100 : 0;
  
  const distSma50 = currentSma50 > 0 ? ((currentPrice - currentSma50) / currentSma50) * 100 : 0;
  const distSma200 = currentSma200 > 0 ? ((currentPrice - currentSma200) / currentSma200) * 100 : 0;
  
  const bb = BollingerBands.calculate({ period: 20, stdDev: 2, values: closes });
  const currentBb = bb.length > 0 ? bb[bb.length - 1] : { upper: 0, lower: 0, pb: 0 };
  const bbWidth = currentBb.upper && currentBb.lower ? ((currentBb.upper - currentBb.lower) / currentSma50) * 100 : 0;
  const isSqueezing = bbWidth > 0 && bbWidth < 5;
  
  const stoch = Stochastic.calculate({ high: highs, low: lows, close: closes, period: 14, signalPeriod: 3 });
  const currentStoch = stoch.length > 0 ? stoch[stoch.length - 1] : { k: 50, d: 50 };
  
  let consecutiveUp = 0;
  let consecutiveDown = 0;
  for (let i = closes.length - 1; i > 0; i--) {
    if (closes[i] > closes[i-1]) {
      if (consecutiveDown > 0) break;
      consecutiveUp++;
    } else if (closes[i] < closes[i-1]) {
      if (consecutiveUp > 0) break;
      consecutiveDown++;
    } else {
      break;
    }
  }
  
  const rawRsScore = closes.length > 125 
    ? ((closes[closes.length - 1] - closes[closes.length - 126]) / closes[closes.length - 126]) * 100 
    : ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100;
  
  let cumObv = 0;
  const obv = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i-1]) cumObv += vols[i];
    else if (closes[i] < closes[i-1]) cumObv -= vols[i];
    obv.push(cumObv);
  }
  const obvSma20 = SMA.calculate({ period: 20, values: obv });
  const currentObvSma = obvSma20.length > 0 ? obvSma20[obvSma20.length - 1] : 0;
  const isAccumulating = cumObv > currentObvSma;
  
  let beta = 1.0;
  if (benchmarkReturns && closes.length > 20) {
    let meanS = 0; let meanB = 0;
    const matchedS = []; const matchedB = [];
    
    for (let i = 1; i < closes.length; i++) {
      const day = getDayString(timestamps[i]);
      const retB = benchmarkReturns[day];
      if (retB !== undefined) {
        const retS = (closes[i] - closes[i-1]) / closes[i-1];
        matchedS.push(retS);
        matchedB.push(retB);
        meanS += retS;
        meanB += retB;
      }
    }
    
    if (matchedS.length > 20) {
      meanS /= matchedS.length;
      meanB /= matchedS.length;
      let cov = 0; let varB = 0;
      for (let i = 0; i < matchedS.length; i++) {
        const devS = matchedS[i] - meanS;
        const devB = matchedB[i] - meanB;
        cov += devS * devB;
        varB += devB * devB;
      }
      if (varB > 0) beta = cov / varB;
    }
  }
  const change1w = closes.length > 5 ? ((closes[closes.length - 1] - closes[closes.length - 6]) / closes[closes.length - 6]) * 100 : 0;
  const change1m = closes.length > 20 ? ((closes[closes.length - 1] - closes[closes.length - 21]) / closes[closes.length - 21]) * 100 : 0;
  const turnoverCr = (currentVol * currentPrice) / 10000000;
  
  let marketCap = 'Micro Cap';
  const indices = indexDict[stock.id] || [];
  
  if (indices.includes('Nifty 50') || indices.includes('Nifty Next 50')) {
    marketCap = 'Large Cap';
  } else if (indices.includes('Nifty Midcap 150')) {
    marketCap = 'Mid Cap';
  } else if (indices.includes('Nifty Smallcap 250')) {
    marketCap = 'Small Cap';
  } else if (indices.includes('Nifty 500')) {
    marketCap = 'Small Cap'; // Fallback for Nifty 500
  } else {
    // Fallback for non-index stocks using turnover proxy
    if (turnoverCr > 150) {
        marketCap = 'Large Cap';
    } else if (turnoverCr > 25) {
        marketCap = 'Mid Cap';
    } else if (turnoverCr > 2) {
        marketCap = 'Small Cap';
    }
  }
  
  // Pivot Points Calculation (using the most recent daily candle)
  const lastHigh = highs[highs.length - 1];
  const lastLow = lows[lows.length - 1];
  const pivot = (lastHigh + lastLow + currentPrice) / 3;
  const s1 = (pivot * 2) - lastHigh;
  const r1 = (pivot * 2) - lastLow;

  // Delivery Percentage and VWAP from Bhavcopy (if available)
  const bhavData = bhavcopyDict[stock.id] || {};
  let deliveryPct = bhavData.deliveryPct || 0;
  // Use official NSE VWAP if available, otherwise fallback to standard calculation
  let vwap = bhavData.vwap && bhavData.vwap > 0 ? bhavData.vwap : pivot; 

  return {
    ...stock,
    price: currentPrice,
    change24h,
    change1w,
    change1m,
    marketCap,
    turnoverCr,
    deliveryPct,
    vwap,
    pivot,
    s1,
    r1,
    rsi: currentRsi,
    macdLine: currentMacd.MACD,
    macdSignal: currentMacd.signal,
    bullishMacd,
    currentSma50,
    currentSma200,
    aboveSma50,
    goldenAligned,
    currentAtr,
    idealEntry,
    stopLoss,
    algoTarget,
    algoUpside,
    volume: currentVol,
    avgVol,
    volRatio,
    institutionalBuying,
    high52w,
    low52w,
    distanceToHigh,
    distanceToLow,
    maxDrawdown,
    distSma50,
    distSma200,
    bbUpper: currentBb.upper,
    bbLower: currentBb.lower,
    isSqueezing,
    stochK: currentStoch.k,
    stochD: currentStoch.d,
    consecutiveUp,
    consecutiveDown,
    rawRsScore,
    isAccumulating,
    beta,
    indices: stock.indices || [],
    trailingPE: fundamentals.trailingPE,
    forwardPE: fundamentals.forwardPE,
    priceToBook: fundamentals.priceToBook,
    marketCapExact: fundamentals.marketCapExact
  };
};

const fetchLatestBhavcopy = async () => {
  console.log('Fetching latest NSE Bhavcopy for Delivery Percentage...');
  const d = new Date();
  for(let i=0; i<7; i++) {
    const pad = (n) => n.toString().padStart(2, '0');
    const dStr = pad(d.getDate()) + pad(d.getMonth()+1) + d.getFullYear();
    const url = 'https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_' + dStr + '.csv';
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (res.ok) {
         console.log('Found latest bhavcopy for ' + dStr);
         const text = await res.text();
         const dict = {};
         await new Promise((resolve) => {
           Papa.parse(text, {
             header: true, skipEmptyLines: true,
             transformHeader: h => h.trim(),
             transform: v => v.trim(),
             complete: (results) => {
               results.data.forEach(row => {
                 let sym = row['SYMBOL'];
                 let series = row['SERIES'] || '';
                 if (sym && ['EQ', 'BE', 'SM', 'ST', 'BZ'].includes(series)) {
                   sym = sym.toUpperCase() + '.NS';
                   let delivery = row['DELIV_PER'];
                   
                   // BE and BZ series are Trade-to-Trade. The user prefers to keep them at 0%
                   // so they don't pollute the "High Delivery" filter on the dashboard.
                   if (['BE', 'BZ'].includes(series) && (!delivery || delivery === '-')) {
                     delivery = 0;
                   } else {
                     delivery = parseFloat(delivery || 0);
                   }

                   dict[sym] = {
                     deliveryPct: isNaN(delivery) ? 0 : delivery,
                     vwap: parseFloat(row['AVG_PRICE'] || 0)
                   };
                 }
               });
               resolve();
             }
           });
         });
         return dict;
      }
    } catch (e) {}
    d.setDate(d.getDate() - 1);
  }
  console.warn('Could not fetch any recent Bhavcopy.');
  return {};
};

async function generateData() {
  const publicDir = path.join(__dirname, '../public');
  const indexDict = {};
  const bhavcopyDict = await fetchLatestBhavcopy();
  
  // 1. Build Nifty 500 Dictionary for Accurate Sectors and Market Caps
  console.log('Fetching Nifty 500 Sector dictionary from NSE...');
  let nifty500Text = '';
  try {
    const res = await fetch('https://nsearchives.nseindia.com/content/indices/ind_nifty500list.csv');
    if (res.ok) {
      nifty500Text = await res.text();
    }
  } catch (e) {
    console.warn('Failed to fetch Nifty 500 list from NSE, will proceed without sector mapping.');
  }

  const niftyDict = {};
  if (nifty500Text) {
    await new Promise((resolve) => {
      Papa.parse(nifty500Text, {
        header: true, skipEmptyLines: true,
        complete: (results) => {
          results.data.forEach((row, index) => {
            let sym = row['Symbol'] || row['symbol'];
              if (sym) {
                sym = sym.trim().toUpperCase() + '.NS';
                niftyDict[sym] = {
                  sector: row['Industry'] || row['industry'] || 'General Equities'
                };
                if (!indexDict[sym]) indexDict[sym] = [];
                indexDict[sym].push('Nifty 500');
              }
          });
          resolve();
        }
      });
    });
  }
  const indexUrls = {
    'Nifty 50': 'https://nsearchives.nseindia.com/content/indices/ind_nifty50list.csv',
    'Nifty Next 50': 'https://nsearchives.nseindia.com/content/indices/ind_niftynext50list.csv',
    'Nifty Midcap 150': 'https://nsearchives.nseindia.com/content/indices/ind_niftymidcap150list.csv',
    'Nifty Smallcap 250': 'https://nsearchives.nseindia.com/content/indices/ind_niftysmallcap250list.csv',
    'Nifty Bank': 'https://nsearchives.nseindia.com/content/indices/ind_niftybanklist.csv',
    'Nifty IT': 'https://nsearchives.nseindia.com/content/indices/ind_niftyitlist.csv',
    'Nifty Auto': 'https://nsearchives.nseindia.com/content/indices/ind_niftyautolist.csv',
    'Nifty Metal': 'https://nsearchives.nseindia.com/content/indices/ind_niftymetallist.csv',
    'Nifty Pharma': 'https://nsearchives.nseindia.com/content/indices/ind_niftypharmalist.csv'
  };
  
  for (const [indexName, url] of Object.entries(indexUrls)) {
    console.log(`Fetching ${indexName}...`);
    try {
      const res = await fetch(url);
      if (res.ok) {
        const text = await res.text();
        Papa.parse(text, {
          header: true, skipEmptyLines: true,
          complete: (results) => {
            results.data.forEach(row => {
              let sym = row['Symbol'] || row['symbol'];
              if (sym) {
                sym = sym.trim().toUpperCase() + '.NS';
                if (!indexDict[sym]) indexDict[sym] = [];
                indexDict[sym].push(indexName);
              }
            });
          }
        });
      }
    } catch (e) {
      console.warn(`Failed to fetch ${indexName}`);
    }
  }
  console.log('Fetching master equity list from NSE...');
  const nseUrl = 'https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv';
  
  let csvText = '';
  try {
    const res = await fetch(nseUrl);
    if (!res.ok) throw new Error('Failed to fetch NSE list');
    csvText = await res.text();
  } catch (e) {
    console.warn('Failed to fetch from NSE, falling back to local nifty500.csv');
    csvText = nifty500Text;
  }
  
  const universe = await new Promise((resolve) => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const list = [];
        for (let row of results.data) {
          const keys = Object.keys(row);
          const symCol = keys.find(k => ['symbol', 'trading_symbol'].includes(k.trim().toLowerCase()));
          const nameCol = keys.find(k => ['name of company', 'company name', 'name'].includes(k.trim().toLowerCase()));
          const seriesCol = keys.find(k => ['series', ' series'].includes(k));
          
          if (seriesCol && row[seriesCol] && row[seriesCol].trim() !== 'EQ') {
             continue;
          }
          
          if (symCol && row[symCol]) {
            let symbol = row[symCol].trim().toUpperCase();
            if (!symbol.endsWith('.NS')) symbol += '.NS';
            
            const nifInfo = niftyDict[symbol];
            
            // Only include equity series (EQ, BE, BZ, etc. are handled, mostly EQ)
            // Or if falling back to nifty500, they are all valid
            if (row['Series'] !== 'GB' && row['Series'] !== 'IL') {
              list.push({
                id: symbol,
                name: (nameCol && row[nameCol]) ? row[nameCol].trim() : symbol.replace('.NS', ''),
                sector: nifInfo ? nifInfo.sector : 'Other / Small Cap Equities',
                indices: indexDict[symbol] || []
              });
            }
          }
        }
        resolve(list);
      }
    });
  });

  console.log(`Loaded ${universe.length} stocks. Fetching benchmark...`);
  const benchmarkReturns = await fetchBenchmarkReturns();

  console.log('Fetching stock data in batches...');
  const batchSize = 50;
  const results = [];
  
  for (let i = 0; i < universe.length; i += batchSize) {
    const batch = universe.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i/batchSize) + 1} / ${Math.ceil(universe.length/batchSize)}`);
    
    let quotes = [];
    try {
      const symbols = batch.map(s => s.id);
      quotes = await yahooFinance.quote(symbols);
    } catch (e) {
      console.warn('Failed to fetch quotes for batch:', e.message);
    }

    const batchPromises = batch.map(async (stock) => {
      const data = await fetchStockData(stock.id);
      if (data) {
        const quote = quotes.find(q => q.symbol === stock.id) || {};
        const fundamentals = {
          trailingPE: quote.trailingPE,
          forwardPE: quote.forwardPE,
          priceToBook: quote.priceToBook,
          marketCapExact: quote.marketCap
        };
        return analyzeStock(stock, data, benchmarkReturns, indexDict, bhavcopyDict, fundamentals);
      }
      return null;
    });
    
    const batchResults = await Promise.all(batchPromises);
    batchResults.forEach(res => {
      if (res) results.push(res);
    });
    
    if (i + batchSize < universe.length) {
       await delay(500); // 500ms delay between batches
    }
  }

  // Calculate Sector Relative Strength (1-Month Return vs Sector Average)
  const sectorAverages = {};
  const sectorCounts = {};
  results.forEach(s => {
    if (!sectorAverages[s.sector]) {
      sectorAverages[s.sector] = 0;
      sectorCounts[s.sector] = 0;
    }
    sectorAverages[s.sector] += (s.change1m || 0);
    sectorCounts[s.sector] += 1;
  });
  
  Object.keys(sectorAverages).forEach(sec => {
    sectorAverages[sec] = sectorAverages[sec] / sectorCounts[sec];
  });
  
  results.forEach(s => {
    s.rsSector = (s.change1m || 0) - (sectorAverages[s.sector] || 0);
  });

  // Compute True RS Rating (Percentile 1-99)
  const validStocks = results.filter(s => s.rawRsScore !== undefined).sort((a, b) => a.rawRsScore - b.rawRsScore);
  validStocks.forEach((s, index) => {
    // Math.max to ensure it's at least 1, Math.ceil to map to 1-99
    s.rsRating = validStocks.length > 1 ? Math.max(1, Math.ceil((index / (validStocks.length - 1)) * 99)) : 99;
    delete s.rawRsScore;
  });

  // Sort by rsRating descending by default for the JSON output
  results.sort((a, b) => (b.rsRating || 0) - (a.rsRating || 0));

  const outputPath = path.join(publicDir, 'market_data.json');
  await fs.writeFile(outputPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`Successfully generated market_data.json with ${results.length} stocks.`);
}

generateData().catch(console.error);
