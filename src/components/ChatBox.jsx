import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MessageSquare, X, Send, Bot, User } from 'lucide-react';
import Fuse from 'fuse.js';

const ChatBox = ({ stocks, onSelectStock }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, sender: 'system', text: 'Hi! I am your trading assistant. You can ask me things like "show me large cap IT stocks with rs rating above 80" or "price below 500 and macd bullish"!' }
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  // Initialize Fuse.js for dynamic fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(stocks, {
      keys: ['id', 'name', 'sector', 'marketCap'],
      threshold: 0.3, // 0.0 is perfect match, 1.0 is match anything
      ignoreLocation: true,
      minMatchCharLength: 3
    });
  }, [stocks]);

  // NLP Parser Logic
  const parseQuery = (query) => {
    let q = query.toLowerCase();
    
    // 1. Pre-process natural language operators to math symbols
    const replacements = [
      { regex: /greater than or equal to/g, op: '>=' },
      { regex: /less than or equal to/g, op: '<=' },
      { regex: /greater than|above|more than|over/g, op: '>' },
      { regex: /less than|below|under|lower than/g, op: '<' },
      { regex: /equal to|exactly/g, op: '==' },
    ];
    replacements.forEach(r => { q = q.replace(r.regex, r.op); });

    // 2. Define property mappings for dynamic search
    const propMap = {
      'price': 'price',
      'rsi': 'rsi',
      'volume': 'currentVol',
      'atr': 'currentAtr',
      'change': 'change24h',
      'bb width': 'bbWidth',
      'bbwidth': 'bbWidth',
      '50 sma': 'currentSma50',
      'sma 50': 'currentSma50',
      '200 sma': 'currentSma200',
      'sma 200': 'currentSma200',
      'macd': 'macdLine',
      'rs rating': 'rsRating',
      'rs': 'rsRating',
      'relative strength': 'rsRating',
      'upside': 'algoUpside',
      'target': 'algoTarget',
      'stoploss': 'stopLoss',
      'trend': 'consecutiveUp',
      'uptrend': 'consecutiveUp',
      'downtrend': 'consecutiveDown'
    };

    // 3. Extract Math Filters
    const dynamicFilters = [];
    const fieldsPattern = Object.keys(propMap).join('|');
    const mathRegex = new RegExp('(' + fieldsPattern + ')\\s*([<>=]+)\\s*(-?\\d+(\\.\\d+)?)', 'g');
    let matchArr;
    while ((matchArr = mathRegex.exec(q)) !== null) {
      let field = matchArr[1].trim();
      const op = matchArr[2];
      const val = parseFloat(matchArr[3]);
      const mappedProp = propMap[field];
      if (mappedProp) {
        dynamicFilters.push({ prop: mappedProp, op, val });
      }
    }

    // 4. Categorical Extraction
    const sectors = ['information technology', 'financial services', 'banks', 'bank', 'oil', 'pharma', 'auto', 'fmcg', 'metal', 'power', 'telecom', 'realty', 'it'];
    const marketCaps = ['large', 'mid', 'small', 'micro'];
    
    let targetSectors = sectors.filter(s => q.includes(s + ' sector') || q.includes(s + ' stocks') || q.match(new RegExp('\\\\b' + s + '\\\\b')));
    if (targetSectors.includes('it')) targetSectors.push('information technology');
    if (targetSectors.includes('bank') || targetSectors.includes('banks')) targetSectors.push('financial services');
    
    let targetCaps = marketCaps.filter(c => q.includes(c + ' cap'));

    let hasKeywords = q.includes('golden cross') || q.includes('squeeze') || q.includes('macd') || 
                      q.includes('volume') || q.includes('accumulation') || q.includes('oversold') || 
                      q.includes('overbought') || q.includes('52 week low') || q.includes('52 week high') || 
                      dynamicFilters.length > 0 || targetSectors.length > 0 || targetCaps.length > 0;

    // 5. Filtering logic
    const results = stocks.filter(stock => {
      let match = true;
      
      // Keywords
      if (q.includes('golden cross')) match = match && stock.goldenAligned;
      if (q.includes('squeeze') || q.includes('squeezing')) match = match && stock.isSqueezing;
      if (q.includes('macd bullish') || q.includes('bullish macd')) match = match && stock.bullishMacd;
      if (q.includes('volume spike') || q.includes('high volume') || q.includes('institutional')) match = match && stock.institutionalBuying;
      if (q.includes('accumulation') || q.includes('obv')) match = match && stock.isAccumulating;
      if (q.includes('oversold')) match = match && stock.rsi < 35;
      if (q.includes('overbought')) match = match && stock.rsi > 70;
      if (q.includes('52 week low')) match = match && stock.distanceToLow < 5;
      if (q.includes('52 week high')) match = match && stock.distanceToHigh < 5;
      
      // Sectors
      if (targetSectors.length > 0) {
        if (!stock.sector) match = false;
        else {
          const sMatch = targetSectors.some(ts => stock.sector.toLowerCase().includes(ts));
          if (!sMatch) match = false;
        }
      }
      
      // Market Cap
      if (targetCaps.length > 0) {
        if (!stock.marketCap) match = false;
        else {
          const capMatch = targetCaps.some(c => stock.marketCap.toLowerCase() === c);
          if (!capMatch) match = false;
        }
      }

      // Dynamic Math
      for (const filter of dynamicFilters) {
        const stockVal = stock[filter.prop];
        if (stockVal === undefined || stockVal === null) {
           match = false;
           break;
        }
        if (filter.op === '<') match = match && stockVal < filter.val;
        else if (filter.op === '<=') match = match && stockVal <= filter.val;
        else if (filter.op === '>') match = match && stockVal > filter.val;
        else if (filter.op === '>=') match = match && stockVal >= filter.val;
        else if (filter.op === '=' || filter.op === '==' || filter.op === '===') match = match && stockVal === filter.val;
      }
      
      return match;
    });

    // 6. Determine what to say back
    let responseText = '';
    let foundStocks = [];

    // Try to find a stock by symbol or name regardless of keywords
    const cleanQ = q.replace(/\s+/g, '');
    const symbolMatch = stocks.find(s => {
      const cleanName = s.name.toLowerCase().replace(/\s+(limited|ltd\.?|corporation|corp\.?|company|co\.?|l\.?|inc\.?)$/gi, '');
      const cleanId = s.id.toLowerCase().replace('.ns', '');
      return q.includes(cleanName) || cleanQ.includes(cleanId);
    });

    if (symbolMatch && !hasKeywords) {
      // Check if they are asking about specific data points
      let requestedProps = [];
      for (const [key, value] of Object.entries(propMap)) {
        // Avoid duplicate properties (e.g. 'rs rating' and 'rs' map to same value)
        if (q.includes(key) && !requestedProps.some(p => p.value === value)) {
          requestedProps.push({ key, value });
        }
      }

      if (requestedProps.length > 0) {
        let answers = requestedProps.map(p => {
          let val = symbolMatch[p.value];
          if (val === undefined || val === null) return 'N/A';
          if (p.value === 'consecutiveUp') return val > 0 ? val + ' days up' : 'neutral or down';
          if (p.value === 'consecutiveDown') return val > 0 ? val + ' days down' : 'neutral or up';
          if (typeof val === 'number' && !Number.isInteger(val)) return val.toFixed(2);
          return val;
        });
        
        let propsString = requestedProps.map(p => p.key).join(' and ');
        let answersString = answers.join(' and ');
        responseText = `For ${symbolMatch.name}, the ${propsString} is ${answersString}.`;
      } else {
        responseText = `Here is the data for ${symbolMatch.name}.`;
      }
      foundStocks = [symbolMatch];
    } else if (!hasKeywords) {
      // Fallback to fuzzy search over all data!
      const fuseResults = fuse.search(query);
      if (fuseResults.length > 0) {
        responseText = `I couldn't find specific criteria, but here are the best matches for "${query}":`;
        foundStocks = fuseResults.map(r => r.item).slice(0, 10);
      } else {
        responseText = `I'm sorry, I couldn't find anything matching "${query}".`;
      }
    } else {
      // If we had a specific symbol but also keywords, filter the results to just that symbol
      if (symbolMatch) {
        const intersection = results.filter(s => s.id === symbolMatch.id);
        if (intersection.length > 0) {
           responseText = `Yes, ${symbolMatch.name} matches your criteria!`;
           foundStocks = intersection;
        } else {
           responseText = `No, ${symbolMatch.name} does not match those criteria.`;
           foundStocks = [];
        }
      } else {
        if (results.length === 0) {
          responseText = `I couldn't find any stocks matching those criteria right now.`;
        } else if (results.length === stocks.length) {
          responseText = `I couldn't identify specific criteria. Try asking for "oversold stocks", "price < 500", or "large cap IT stocks with rs rating above 80".`;
        } else {
          responseText = `I found ${results.length} stocks matching your criteria.`;
          // Limit to 10 so we don't flood chat
          foundStocks = results.slice(0, 10);
          if (results.length > 10) responseText += ` Here are the top 10:`;
        }
      }
    }

    return { responseText, foundStocks };
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = { id: Date.now(), sender: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    // Simulate thinking delay
    setTimeout(() => {
      const { responseText, foundStocks } = parseQuery(userMsg.text);
      const sysMsg = { id: Date.now(), sender: 'system', text: responseText, stocks: foundStocks };
      setMessages(prev => [...prev, sysMsg]);
    }, 400);
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button 
          className="chat-fab pulse-animation" 
          onClick={() => setIsOpen(true)}
          title="Ask Trading Assistant"
        >
          <MessageSquare size={24} />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="chat-window fade-in">
          <div className="chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Bot size={18} color="var(--primary)" />
              <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>Trading Assistant</h3>
            </div>
            <button className="chat-close" onClick={() => setIsOpen(false)}>
              <X size={18} />
            </button>
          </div>

          <div className="chat-messages">
            {messages.map(msg => (
              <div key={msg.id} className={`chat-bubble-container ${msg.sender}`}>
                <div className="chat-avatar">
                  {msg.sender === 'system' ? <Bot size={14} /> : <User size={14} />}
                </div>
                <div className={`chat-bubble ${msg.sender}`}>
                  {msg.text}
                  {msg.stocks && msg.stocks.length > 0 && (
                    <div className="chat-stocks">
                      {msg.stocks.map(s => (
                        <button 
                          key={s.id} 
                          className="chat-stock-chip"
                          onClick={() => onSelectStock(s)}
                        >
                          {s.id.replace('.NS', '')}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form className="chat-input-area" onSubmit={handleSend}>
            <input
              type="text"
              placeholder="Ask me something..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="chat-input"
            />
            <button type="submit" className="chat-send-btn" disabled={!input.trim()}>
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default ChatBox;
