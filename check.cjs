const fs = require('fs');
const text = fs.readFileSync('public/nifty500.csv', 'utf8');
const lines = text.split('\n').slice(1).filter(l => l.trim().length > 0);
const symbols = lines.map(l => {
  const parts = l.split(',');
  return parts[2].replace(/"/g, '').trim() + '.NS';
});
console.log('Total symbols:', symbols.length);
console.log('Sample symbols:', symbols.slice(0,5));

const checkSymbols = async () => {
  let success = 0;
  let noData = 0;
  let httpError = 0;
  for (let i = 0; i < 20; i++) {
    const symbol = symbols[i];
    try {
      const res = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (!res.ok) {
        httpError++;
        continue;
      }
      const data = await res.json();
      const result = data.chart.result;
      if (!result || result.length === 0 || !result[0].indicators.quote[0].close) {
        noData++;
      } else {
        success++;
      }
    } catch (e) {
      httpError++;
    }
  }
  console.log(`Out of 20: success=${success}, noData=${noData}, httpError=${httpError}`);
};
checkSymbols();
