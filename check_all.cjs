const fs = require('fs');
const text = fs.readFileSync('public/nifty500.csv', 'utf8');
const lines = text.split('\n').slice(1).filter(l => l.trim().length > 0);
const symbols = lines.map(l => {
  const parts = l.split(',');
  return parts[2].replace(/"/g, '').trim() + '.NS';
});

console.log('Testing all ' + symbols.length + ' symbols...');

const checkAll = async () => {
  let success = 0, noData = 0, httpError = 0;
  for (let i = 0; i < symbols.length; i += 10) {
    const batch = symbols.slice(i, i + 10);
    const promises = batch.map(async (symbol) => {
      try {
        const res = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (!res.ok) return 'httpError';
        const data = await res.json();
        if (!data.chart.result || data.chart.result.length === 0 || !data.chart.result[0].indicators.quote[0].close) {
          return 'noData';
        }
        return 'success';
      } catch (e) {
        return 'httpError';
      }
    });
    const results = await Promise.all(promises);
    results.forEach(r => {
      if (r === 'success') success++;
      else if (r === 'noData') noData++;
      else httpError++;
    });
    // small delay to emulate what we just put in
    await new Promise(r => setTimeout(r, 800));
  }
  console.log(`Results: success=${success}, noData=${noData}, httpError=${httpError}`);
};
checkAll();
