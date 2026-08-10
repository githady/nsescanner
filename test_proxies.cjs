const fetchTest = async (url, proxy) => {
  try {
    const res = await fetch(proxy + encodeURIComponent(url));
    if (proxy.includes('allorigins.win/get')) {
       const json = await res.json();
       return json.contents ? 'success' : 'fail';
    }
    const json = await res.json();
    return json.chart.result ? 'success' : 'fail';
  } catch (e) {
    return 'error';
  }
};
(async () => {
  const url = 'https://query2.finance.yahoo.com/v8/finance/chart/TCS.NS?interval=1d&range=1y';
  console.log('codetabs:', await fetchTest(url, 'https://api.codetabs.com/v1/proxy?quest='));
  console.log('allorigins:', await fetchTest(url, 'https://api.allorigins.win/get?url='));
  console.log('corsproxy:', await fetchTest(url, 'https://corsproxy.io/?'));
})();
