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
def analyze_single_stock(stock):
    symbol = stock["id"]
    max_retries = 3
    
    for attempt in range(max_retries):
        try:
            ticker = yf.Ticker(symbol)
            # Fetch 6 months of data with a strict timeout
            df = ticker.history(period="6mo", interval="1d", timeout=10)
            
            if df.empty or len(df) < 35:
                return None
            
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)

            df['rsi'] = ta.momentum.RSIIndicator(df['Close'], window=14).rsi()
            bb = ta.volatility.BollingerBands(df['Close'], window=20, window_dev=2)
            df['bb_width'] = (bb.bollinger_hband() - bb.bollinger_lband()) / bb.bollinger_mavg()
            df['vol_sma20'] = df['Volume'].rolling(window=20).mean()
            df = df.dropna()
            
            if df.empty or len(df) < 2: 
                return None

            latest = df.iloc[-1]
            prev = df.iloc[-2]
            high_52w = df['High'].tail(252).max()
            
            price = safe_float(latest['Close'])
            prev_price = safe_float(prev['Close'])
            bb_width = safe_float(latest['bb_width'], default=1.0)
            is_squeeze = bool(bb_width < 0.08)

            return {
                "id": symbol,
                "name": stock["name"],
                "sector": stock["sector"],
                "price": price,
                "change24h": safe_float(((price - prev_price) / prev_price) * 100) if prev_price > 0 else 0.0,
                "rsi": safe_float(latest['rsi'], default=50.0, decimals=1),
                "bollingerSqueeze": is_squeeze,
                "volumeDryUp": bool(safe_float(latest['Volume']) < (0.6 * safe_float(latest['vol_sma20'], default=1.0))),
                "volumeSpikeRatio": safe_float(safe_float(latest['Volume']) / safe_float(latest['vol_sma20'], default=1.0), decimals=1),
                "prox52WkHigh": safe_float(price / safe_float(high_52w, default=price), decimals=2),
                "smaAligned": True,
                "lastPattern": "Volatility Squeeze" if is_squeeze else "Normal Trading"
            }
        except Exception as e:
            # If Yahoo rate limits us (HTTP 429/404), wait and retry instead of dropping!
            if attempt < max_retries - 1:
                sleep_time = 1.5 * (attempt + 1)
                time.sleep(sleep_time)
                continue
            else:
                # Only drop if it fails all 3 consecutive attempts
                return None

# --- 3. API ENDPOINT ---
@app.get("/api/scan-rally")
def scan_stocks(force_refresh: bool = False):
    global CACHE_DATA, CACHE_TIMESTAMP
    current_time = time.time()
    if not force_refresh and CACHE_DATA and (current_time - CACHE_TIMESTAMP < 600):
        print(f"⚡ Serving {len(CACHE_DATA)} stocks from server cache.")
        return CACHE_DATA

    universe = get_nifty_500_universe()
    print(f"\n--- Scanning ALL {len(universe)} Nifty 500 Stocks (with Auto-Retry) ---")
    
    results = []
    # Using 8 threads: Sweet spot for speed without getting IP banned by Yahoo
    with ThreadPoolExecutor(max_workers=8) as executor:
        future_to_stock = {executor.submit(analyze_single_stock, stock): stock for stock in universe}
        
        for future in as_completed(future_to_stock):
            res = future.result()
            if res is not None: 
                results.append(res)
                
    CACHE_DATA = results
    CACHE_TIMESTAMP = current_time
    print(f"✅ Scan Complete! Successfully processed and cached {len(results)} valid stocks.")
    return results

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