import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User } from 'lucide-react';

const ChatBox = ({ stocks, onSelectStock }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, sender: 'system', text: 'Hi! I am your trading assistant. Ask me to find stocks with a golden cross, high volume, squeezing Bollinger bands, or specific RSI levels!' }
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  // NLP Parser Logic
  const parseQuery = (query) => {
    const q = query.toLowerCase();
    
    // Define property mappings for dynamic search
    const propMap = {
      price: 'price',
      rsi: 'rsi',
      upside: 'algoUpside',
      target: 'algoTarget',
      stoploss: 'stopLoss',
      beta: 'beta',
      volume: 'currentVol',
      atr: 'currentAtr',
      change: 'change24h',
      bbwidth: 'bbWidth',
      trend: 'consecutiveUp',
      uptrend: 'consecutiveUp',
      downtrend: 'consecutiveDown',
      sma50: 'currentSma50',
      sma200: 'currentSma200',
      macd: 'macdLine',
      macdsignal: 'macdSignal',
      rs: 'rsRating',
      high52: 'high52w',
      low52: 'low52w',
      distancetohigh: 'distanceToHigh',
      distancetolow: 'distanceToLow',
      distsma50: 'distSma50',
      distsma200: 'distSma200'
    };

    // Find all dynamic math patterns in query (e.g. "price < 500")
    const mathRegex = /([a-z0-9_]+)\s*([<>=]+)\s*(-?\d+(\.\d+)?)/g;
    const dynamicFilters = [];
    let matchArr;
    while ((matchArr = mathRegex.exec(q)) !== null) {
      const field = matchArr[1];
      const op = matchArr[2];
      const val = parseFloat(matchArr[3]);
      
      const mappedProp = propMap[field] || field; // use mapping, or fallback to exact property name if user knows it
      dynamicFilters.push({ prop: mappedProp, op, val });
    }

    let hasKeywords = q.includes('golden cross') || q.includes('squeeze') || q.includes('macd') || 
                        q.includes('volume') || q.includes('accumulation') || q.includes('oversold') || 
                        q.includes('overbought') || dynamicFilters.length > 0;

    // Filtering logic
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
      
      // Dynamic comparisons
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
        else if (filter.op === '=' || filter.op === '==') match = match && stockVal === filter.val;
      }
      
      return match;
    });

    // Determine what to say back
    let responseText = '';
    let foundStocks = [];

    if (!hasKeywords) {
      // Try to find a stock by symbol
      const symbolMatch = stocks.find(s => s.id.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
      if (symbolMatch) {
        responseText = `I found a stock matching "${query}".`;
        foundStocks = [symbolMatch];
      } else {
        responseText = `I'm sorry, I didn't understand that. Try asking for "oversold stocks", "price < 500", or "rsi < 30".`;
      }
    } else {
      if (results.length === 0) {
        responseText = `I couldn't find any stocks matching those criteria right now.`;
      } else if (results.length === stocks.length) {
        responseText = `I couldn't identify specific criteria. Try asking for "oversold stocks", "price < 500", or "rsi < 30".`;
      } else {
        responseText = `I found ${results.length} stocks matching your criteria.`;
        // Limit to 10 so we don't flood chat
        foundStocks = results.slice(0, 10);
        if (results.length > 10) responseText += ` Here are the top 10:`;
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
