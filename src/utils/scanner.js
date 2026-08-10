// New lightweight scanner.js that simply fetches the pre-computed market_data.json
export const fetchUniverse = async () => {
  // Not strictly needed in the UI anymore, but keep for compatibility if needed elsewhere
  return [];
};

export const fetchDeliveryData = async () => {
  return {};
};

export const fetchBenchmarkReturns = async () => {
  return null;
};

export const fetchStockData = async () => {
  return null;
};

export const analyzeStock = () => {
  return null;
};

// This is the new primary function
export const fetchMarketData = async () => {
  const baseUrl = import.meta.env.BASE_URL || '/';
  try {
    const response = await fetch(`${baseUrl}market_data.json?t=${Date.now()}`);
    if (!response.ok) throw new Error("Could not load market data");
    return await response.json();
  } catch (error) {
    console.error("Error loading market data:", error);
    return [];
  }
};
