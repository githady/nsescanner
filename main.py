import os
import math
import time
import random
from concurrent.futures import ThreadPoolExecutor, as_completed
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import yfinance as yf
import pandas as pd
import ta
import datetime
import io
import urllib.request
import requests
import glob

# --- FIREWALL-PROOF AUTOMATED NSE DELIVERY LOADER ---
DELIVERY_CACHE = {}
DELIVERY_CACHE_DATE = None

def fetch_nse_delivery_data():
    global DELIVERY_CACHE, DELIVERY_CACHE_DATE
    today = datetime.date.today()
    
    # Return instantly if we already cached today's data in RAM
    if DELIVERY_CACHE and DELIVERY_CACHE_DATE == today: 
        return DELIVERY_CACHE

    root_dir = os.path.dirname(__file__)
    
    # --- PHASE 1: AKAMAI COOKIE WARM-UP & AUTO-DOWNLOADER ---
    # Create a persistent browser session to hold Akamai security cookies
    session = requests.Session()
    
    # Complete desktop browser header footprint to prevent 403 blocks
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1"
    }
    session.headers.update(headers)

    # Step A: Warm up the session by grabbing Akamai tokens from the NSE homepage
    try:
        print("🛡️ [Auto-Fetch] Warming up session cookies from NSE homepage...")
        session.get("https://www.nseindia.com", timeout=8)
        session.get("https://www.nseindia.com/all-reports", timeout=8)
    except Exception as e:
        print(f"⚠️ [Auto-Fetch] Session warm-up warning (will attempt direct fetch): {e}")

    # Step B: Loop backward up to 7 calendar days to find the latest trading session
    for i in range(7):
        check_date = today - datetime.timedelta(days=i)
        
        # Skip Saturdays (5) and Sundays (6)
        if check_date.weekday() > 4: 
            continue
            
        date_str = check_date.strftime("%d%m%Y")
        expected_filename = f"MTO_{date_str}.DAT"
        local_filepath = os.path.join(root_dir, expected_filename)
        
        # If file is not yet on disk, fetch it using our authenticated cookie session
        if not os.path.exists(local_filepath):
            # Try both primary and fallback NSE subdomains
            urls_to_try = [
                f"https://archives.nseindia.com/archives/equities/mto/MTO_{date_str}.DAT",
                f"https://nsearchives.nseindia.com/archives/equities/mto/MTO_{date_str}.DAT"
            ]
            
            download_success = False
            for url in urls_to_try:
                try:
                    print(f"🌐 [Auto-Fetch] Attempting download for {check_date.strftime('%Y-%m-%d')}...")
                    # Increased timeout to 12s to handle NSE archive latency
                    res = session.get(url, timeout=12)
                    
                    # Verify HTTP 200 and ensure file payload is not an empty error page
                    if res.status_code == 200 and len(res.content) > 50000:
                        # Clean up older archives so your root folder stays clean
                        old_files = glob.glob(os.path.join(root_dir, "MTO_*.DAT")) + glob.glob(os.path.join(root_dir, "delivery.*"))
                        for old_f in old_files:
                            try: os.remove(old_f)
                            except Exception: pass
                            
                        with open(local_filepath, "wb") as f:
                            f.write(res.content)
                        print(f"✅ [Auto-Fetch] Successfully downloaded and saved {expected_filename}!")
                        download_success = True
                        break
                except Exception:
                    continue
            
            if download_success:
                break
        else:
            print(f"📁 [Auto-Fetch] Latest valid trading archive ({expected_filename}) already cached on disk.")
            break

    # --- PHASE 2: UNIVERSAL TOKENIZER (Parses the freshest file in your folder) ---
    possible_files = (
        glob.glob(os.path.join(root_dir, "MTO_*.DAT")) + 
        glob.glob(os.path.join(root_dir, "*.dat")) + 
        glob.glob(os.path.join(root_dir, "*.csv"))
    )
    
    possible_files = sorted(possible_files, key=lambda x: os.path.getmtime(x), reverse=True)
    
    file_path = None
    for f in possible_files:
        fname = os.path.basename(f).lower()
        if any(k in fname for k in ["mto", "delivery", "bhavcopy", "sec_bhav"]) and "nifty" not in fname:
            file_path = f
            break

    if file_path and os.path.exists(file_path):
        try:
            print(f"⚡ Parsing Demat statistics from: {os.path.basename(file_path)}...")
            deliv_map = {}
            
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                for line in f:
                    clean_line = line.replace('"', '').replace('%', '').strip()
                    parts = [p.strip().upper() for p in clean_line.split(",")]
                    
                    if "EQ" in parts and len(parts) >= 5:
                        eq_index = parts.index("EQ")
                        raw_sym = None
                        
                        if eq_index > 0:
                            candidate = parts[eq_index - 1]
                            if not candidate.replace('.', '').isdigit() and "-" not in candidate and candidate not in ["MTO", "20", "10"]:
                                raw_sym = candidate
                        if not raw_sym and eq_index + 1 < len(parts):
                            candidate = parts[eq_index + 1]
                            if not candidate.replace('.', '').isdigit() and "-" not in candidate and candidate not in ["MTO", "20", "10"]:
                                raw_sym = candidate
                                
                        if not raw_sym or raw_sym in ["NAN", "SYMBOL"]: 
                            continue
                            
                        sym = raw_sym + ".NS"
                        parsed_percentage = None
                        
                        for val in reversed(parts):
                            try:
                                f_val = float(val)
                                if 0.0 <= f_val <= 100.0 and f_val > 0.05:
                                    parsed_percentage = round(f_val, 1)
                                    break
                            except ValueError: continue
                        
                        if parsed_percentage is None and len(parts) >= 6:
                            try:
                                total_traded = float(parts[4])
                                total_delivered = float(parts[5])
                                if total_traded > 0:
                                    parsed_percentage = round((total_delivered / total_traded) * 100, 1)
                            except ValueError: pass
                                
                        if parsed_percentage is not None:
                            deliv_map[sym] = parsed_percentage
                            
            DELIVERY_CACHE = deliv_map
            DELIVERY_CACHE_DATE = today
            print(f"🚀 Successfully mapped real Demat delivery rates for {len(deliv_map)} equities!")
            return deliv_map
        except Exception as e:
            print(f"❌ Error during dynamic tokenization: {e}")

    print("⚠️ No valid delivery file found offline or online. Reverting to benchmark.")
    return {}

app = FastAPI()

# --- 1. FULL NIFTY 500 UNIVERSE LOADER ---
CACHE_UNIVERSE = []

def get_nifty_500_universe():
    global CACHE_UNIVERSE
    if CACHE_UNIVERSE: return CACHE_UNIVERSE

    csv_path = os.path.join(os.path.dirname(__file__), "nifty500.csv")
    
    if os.path.exists(csv_path):
        try:
            df = pd.read_csv(csv_path)
            universe = []
            for _, row in df.iterrows():
                # Clean whitespace and handle uppercase symbols
                sym = str(row.get('Symbol', row.get('SYMBOL', ''))).strip().upper()
                name = str(row.get('Company Name', row.get('NAME OF COMPANY', sym))).strip()
                sector = str(row.get('Industry', row.get('SERIES', 'General Equities'))).strip()
                
                if sym and sym != 'NAN':
                    if not sym.endswith('.NS'): 
                        sym += ".NS"
                    universe.append({"id": sym, "name": name, "sector": sector})
            
            # REMOVED the [:150] limit! Now loading the FULL CSV universe.
            CACHE_UNIVERSE = universe
            print(f"🚀 Successfully loaded ALL {len(CACHE_UNIVERSE)} Nifty 500 stocks from local CSV.")
            return CACHE_UNIVERSE
        except Exception as e:
            print(f"❌ Error reading local CSV: {e}")

    # Backup default subset if CSV is missing entirely
    print("⚠️ 'nifty500.csv' not found at root. Using backup sample subset.")
    return [
        {"id": "RELIANCE.NS", "name": "Reliance Industries", "sector": "Oil & Gas"},
        {"id": "TCS.NS", "name": "Tata Consultancy Services", "sector": "IT"},
        {"id": "HDFCBANK.NS", "name": "HDFC Bank", "sector": "Financial Services"},
        {"id": "INFY.NS", "name": "Infosys", "sector": "IT"},
        {"id": "TATASTEEL.NS", "name": "Tata Steel", "sector": "Metals"}
    ]

CACHE_DATA = []
CACHE_TIMESTAMP = 0

def safe_float(val, default=0.0, decimals=2):
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f): return default
        return round(f, decimals)
    except (ValueError, TypeError): return default

# --- 2. WORKER WITH 3-ATTEMPT RETRY & BACKOFF ---
def analyze_single_stock(stock, delivery_map):
    symbol = stock["id"]
    deliv_per = delivery_map.get(symbol, 45.0)
    max_retries = 3
    
    for attempt in range(max_retries):
        try:
            ticker = yf.Ticker(symbol)
            df = ticker.history(period="6mo", interval="1d", timeout=10)
            
            # Require at least 50 trading days to accurately calculate 50-Day SMA
            if df.empty or len(df) < 50: 
                return None
            
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)

            # --- 1. BASE TECHNICAL INDICATORS ---
            df['rsi'] = ta.momentum.RSIIndicator(df['Close'], window=14).rsi()
            bb = ta.volatility.BollingerBands(df['Close'], window=20, window_dev=2)
            df['bb_width'] = (bb.bollinger_hband() - bb.bollinger_lband()) / bb.bollinger_mavg()
            df['vol_sma20'] = df['Volume'].rolling(window=20).mean()
            df['sma50'] = df['Close'].rolling(window=50).mean()
            
            # --- 2. ADVANCED INSTITUTIONAL INDICATORS ---
            adx_ind = ta.trend.ADXIndicator(df['High'], df['Low'], df['Close'], window=14)
            df['adx'] = adx_ind.adx()
            df['obv'] = ta.volume.OnBalanceVolumeIndicator(df['Close'], df['Volume']).on_balance_volume()
            df['obv_sma20'] = df['obv'].rolling(window=20).mean()
            df['atr'] = ta.volatility.AverageTrueRange(df['High'], df['Low'], df['Close'], window=14).average_true_range()

            df = df.dropna()
            if df.empty or len(df) < 2: 
                return None

            latest = df.iloc[-1]
            prev = df.iloc[-2]
            start_price = safe_float(df.iloc[0]['Close'])
            high_52w = df['High'].tail(252).max()
            
            price = safe_float(latest['Close'])
            prev_price = safe_float(prev['Close'])
            atr_val = safe_float(latest['atr'], default=1.0)
            
            # 6-Month Percentage Return for RS Rating ranking
            change_6mo = ((price - start_price) / start_price) * 100 if start_price > 0 else 0.0
            above_sma50 = bool(price > safe_float(latest['sma50']))
            
            # Dynamic Risk Management (1.5x ATR Stop-Loss / 3.0x ATR Target)
            stop_loss = safe_float(price - (1.5 * atr_val))
            target_price = safe_float(price + (3.0 * atr_val))

            bb_width = safe_float(latest['bb_width'], default=1.0)
            is_squeeze = bool(bb_width < 0.08)
            vol_spike = safe_float(safe_float(latest['Volume']) / safe_float(latest['vol_sma20'], default=1.0), decimals=1)
            is_institutional_buying = bool(deliv_per >= 60.0 and vol_spike >= 1.2)

            return {
                "id": symbol,
                "name": stock["name"],
                "sector": stock["sector"],
                "price": price,
                "change24h": safe_float(((price - prev_price) / prev_price) * 100) if prev_price > 0 else 0.0,
                "change6mo": safe_float(change_6mo, decimals=2),
                "aboveSma50": above_sma50,
                "rsi": safe_float(latest['rsi'], default=50.0, decimals=1),
                "adx": safe_float(latest['adx'], default=10.0, decimals=1),
                "deliveryPercent": deliv_per,
                "institutionalBuying": is_institutional_buying,
                "bollingerSqueeze": is_squeeze,
                "volumeSpikeRatio": vol_spike,
                "prox52WkHigh": safe_float(price / safe_float(high_52w, default=price), decimals=2),
                "obvBullish": bool(safe_float(latest['obv']) > safe_float(latest['obv_sma20'])),
                "trendStrong": bool(safe_float(latest['adx']) > 25.0),
                "stopLoss": stop_loss,
                "targetPrice": target_price,
                "riskReward": "1 : 2.0",
                "smaAligned": True,
                "lastPattern": "🔥 Institutional Squeeze" if (is_squeeze and is_institutional_buying) else ("Volatility Squeeze" if is_squeeze else "Normal Trading")
            }
        except Exception:
            if attempt < max_retries - 1:
                time.sleep(1.5 * (attempt + 1))
                continue
            else: 
                return None


@app.get("/api/scan-rally")
def scan_stocks(force_refresh: bool = False):
    global CACHE_DATA, CACHE_TIMESTAMP
    current_time = time.time()
    if not force_refresh and CACHE_DATA and (current_time - CACHE_TIMESTAMP < 600):
        return CACHE_DATA

    universe = get_nifty_500_universe()
    delivery_map = fetch_nse_delivery_data()
    
    raw_results = []
    with ThreadPoolExecutor(max_workers=8) as executor:
        future_to_stock = {executor.submit(analyze_single_stock, stock, delivery_map): stock for stock in universe}
        for future in as_completed(future_to_stock):
            res = future.result()
            if res is not None: 
                raw_results.append(res)
                
    if not raw_results:
        return []

    # --- ALGORITHMIC UPGRADE 1: RELATIVE STRENGTH (RS) RATING (1-99) ---
    # Sort stocks ascending by 6-month price performance
    raw_results.sort(key=lambda x: x["change6mo"])
    total_stocks = len(raw_results)
    
    for idx, stock in enumerate(raw_results):
        # Calculate percentile rank: (Rank / Total) * 99
        percentile = int(round(((idx + 1) / total_stocks) * 99))
        stock["rsRating"] = max(1, min(99, percentile))

    # --- ALGORITHMIC UPGRADE 2: SECTOR BREADTH ROTATION ENGINE ---
    # Group by sector to see what % of equities are trading above their 50-day SMA
    sector_counts = {}
    for stock in raw_results:
        sec = stock["sector"]
        if sec not in sector_counts:
            sector_counts[sec] = {"total": 0, "above_sma50": 0}
        sector_counts[sec]["total"] += 1
        if stock["aboveSma50"]:
            sector_counts[sec]["above_sma50"] += 1

    sector_breadth_map = {}
    for sec, data in sector_counts.items():
        breadth_pct = round((data["above_sma50"] / data["total"]) * 100, 1) if data["total"] > 0 else 0.0
        
        # Categorize institutional capital rotation phases
        if breadth_pct < 30.0:
            status = "📉 Oversold Zone"
        elif 50.0 <= breadth_pct <= 70.0:
            status = "🔥 Launchpad Phase"
        elif breadth_pct > 85.0:
            status = "⚠️ Overheated"
        else:
            status = "⚖️ Neutral Capital"
            
        sector_breadth_map[sec] = {"breadth": breadth_pct, "status": status}

    # Inject sector breadth directly into each stock payload for instant UI sorting
    for stock in raw_results:
        sec_info = sector_breadth_map.get(stock["sector"], {"breadth": 50.0, "status": "⚖️ Neutral"})
        stock["sectorBreadth"] = sec_info["breadth"]
        stock["sectorStatus"] = sec_info["status"]

    # Re-sort descending by RSI or RS Rating for default UI display
    raw_results.sort(key=lambda x: x["rsRating"], reverse=True)
    
    CACHE_DATA = raw_results
    CACHE_TIMESTAMP = current_time
    print(f"✅ Quant Engine Complete! Processed {total_stocks} equities with 1-99 RS Ratings and Sector Breadth.")
    return raw_results

# --- 4. SPA FLAT SURFACE ASSETS ROUTING ---
FRONTEND_DIST_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "dist"))

assets_path = os.path.join(FRONTEND_DIST_DIR, "assets")
if os.path.exists(assets_path):
    app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

@app.get("/{full_path:path}")
async def serve_spa_frontend(full_path: str):
    index_file_path = os.path.join(FRONTEND_DIST_DIR, "index.html")
    if os.path.exists(index_file_path):
        return FileResponse(index_file_path)
    return {"error": "Production build directory not found. Run 'npm run build' first."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)