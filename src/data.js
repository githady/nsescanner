const fallbackDataPath = '/data/stocks.json';

export function getFallbackDataUrl(baseUrl = window.location.href) {
  try {
    const url = new URL(baseUrl);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return `${url.origin}${fallbackDataPath}`;
    }

    const pathname = url.pathname.replace(/\/+$/, '');
    const basePath = pathname === '' ? '' : pathname;
    return `${url.origin}${basePath}${fallbackDataPath}`;
  } catch {
    return fallbackDataPath;
  }
}

export async function loadStocks() {
  try {
    const response = await fetch(getFallbackDataUrl(), { cache: 'no-store' });
    if (!response.ok) throw new Error(`Failed to load fallback data: ${response.status}`);
    const json = await response.json();
    if (Array.isArray(json)) {
      return json;
    }
    return [];
  } catch (error) {
    console.warn('Unable to load fallback stock data.', error);
    return [];
  }
}
