const checkAlloriginsGet = async () => {
  const url = 'https://api.allorigins.win/get?url=' + encodeURIComponent('https://query2.finance.yahoo.com/v8/finance/chart/TCS.NS?interval=1d&range=1y');
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.contents) {
      const parsed = JSON.parse(data.contents);
      console.log('allorigins GET success:', !!parsed.chart.result);
    } else {
      console.log('allorigins GET no contents');
    }
  } catch (e) {
    console.log('allorigins GET error', e);
  }
};

const checkThingproxy = async () => {
  const url = 'https://thingproxy.freeboard.io/fetch/https://query2.finance.yahoo.com/v8/finance/chart/TCS.NS?interval=1d&range=1y';
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log('thingproxy success:', !!data.chart.result);
  } catch (e) {
    console.log('thingproxy error', e);
  }
};

checkAlloriginsGet();
checkThingproxy();
