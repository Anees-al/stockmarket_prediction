import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

// Connect to our live backend on Render
const BACKEND_URL = 'https://stockmarket-prediction-1.onrender.com';
const socket = io(BACKEND_URL, {
  reconnectionDelayMax: 10000,
});

const SECTORS = {
  'IT / Tech': ["TCS", "INFY", "HCLTECH", "WIPRO", "TECHM", "LTIM", "HAPPSTMNDS", "NAUKRI", "ZOMATO", "COFORGE", "PERSISTENT", "MPHASIS"],
  'Banking / Finance': ["HDFCBANK", "ICICIBANK", "AXISBANK", "SBIN", "KOTAKBANK", "INDUSINDBK", "BAJFINANCE", "BAJAJFINSV", "SBILIFE", "HDFCLIFE", "JIOFIN", "SBICARD", "RECLTD", "PFC", "CHOLAFIN", "SHRIRAMFIN", "ICICIPRULI", "ICICIGI", "PNB", "YESBANK", "IDFCFIRSTB", "CANBK", "BANKBARODA", "MUTHOOTFIN"],
  'Energy / Power': ["RELIANCE", "NTPC", "POWERGRID", "ONGC", "BPCL", "IOC", "ADANIPOWER", "TATAPOWER", "ADANIGREEN", "ADANIENSOL", "COALINDIA", "JSWENERGY", "NHPC", "SUZLON", "GUJGASLTD"],
  'Consumer Goods': ["ITC", "HINDUNILVR", "NESTLEIND", "BRITANNIA", "TATACONSUM", "GODREJCP", "DABUR", "MARICO", "COLPAL", "TITAN", "ASIANPAINT", "PIDILITIND", "NYKAA", "VARUNBEV", "VBL", "PAGEIND", "BATAINDIA", "TRENT"],
  'Auto / Transport': ["MARUTI", "TATAMOTORS", "M&M", "HEROMOTOCO", "EICHERMOT", "TVSMOTOR", "BAJAJ-AUTO", "INDIGO", "ADANIPORTS", "ASHOKLEY", "BHARATFORG"],
  'Metals / Mining': ["TATASTEEL", "JSWSTEEL", "HINDALCO", "GRASIM", "JINDALSTEL", "VEDL", "BEL", "HAL", "NMDC", "SAIL"],
  'Pharma / Health': ["SUNPHARMA", "CIPLA", "DRREDDY", "DIVISLAB", "ZYDUSLIFE", "APOLLOHOSP", "MAXHEALTH", "LUPIN", "AUROPHARMA", "ALKEM"],
  'Infrastructure': ["LT", "ULTRACEMCO", "AMBUJACEM", "SIEMENS", "ABB", "DLF", "IRFC", "IRCTC", "RVNL", "MAZDOCK", "GMRINFRA", "DLF", "KALYANKJIL", "POLYCAB"]
};

function App() {
  const [stocks, setStocks] = useState([]);
  const [news, setNews] = useState([]);
  const [connected, setConnected] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [lastNotified, setLastNotified] = useState(new Set());

  const requestNotificationPermission = async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        setNotificationsEnabled(true);
        new Notification("🔔 Setup Complete!", {
          body: "You'll now receive alerts for 'STRONGER BUY' signals.",
          icon: "/favicon.ico"
        });
      }
    } else {
      alert("Browser does not support notifications.");
    }
  };

  const sendStockNotification = (stock) => {
    if (!notificationsEnabled) return;
    
    // Only notify if signal is Strong Buy / Buy
    if (stock.signal.includes("BUY")) {
        new Notification(`🎯 TRADE SIGNAL: ${stock.symbol}`, {
          body: `${stock.name} is now at ₹${stock.current.toFixed(0)} (RSI: ${stock.rsi.toFixed(1)}). Signal: ${stock.signal}`,
          vibrate: [200, 100, 200]
        });
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Calculate Next Market Open (Monday 9:15 AM)
  const getNextMarketOpen = () => {
    const now = currentTime;
    let nextOpen = new Date(now);
    nextOpen.setHours(9, 15, 0, 0);

    // If it's Saturday/Sunday or past 3:30 PM on a weekday
    if (now.getDay() === 0) { // Sunday
      nextOpen.setDate(now.getDate() + 1);
    } else if (now.getDay() === 6) { // Saturday
      nextOpen.setDate(now.getDate() + 2);
    } else if (now.getHours() >= 15 && now.getMinutes() >= 30) {
      nextOpen.setDate(now.getDate() + 1);
      if (nextOpen.getDay() === 6) nextOpen.setDate(nextOpen.getDate() + 2);
    }

    const diff = nextOpen - now;
    if (diff < 0) return "Market Open";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  useEffect(() => {
    socket.on('connect', () => {
      setConnected(true);
      console.log('Connected to socket server');
    });
    
    socket.on('disconnect', () => {
      setConnected(false);
      console.log('Disconnected from socket server');
    });
    
    socket.on('market_update', (data) => {
      setStocks(data);
      
      // Notification Alerting
      if (Array.isArray(data)) {
        data.forEach(stock => {
          const signal = stock?.signal || "";
          if (signal.includes("BUY") && !lastNotified.has(stock.symbol)) {
             sendStockNotification(stock);
             setLastNotified(prev => new Set([...prev, stock.symbol]));
          }
        });
      }
    });

    socket.on('news_update', (data) => {
      setNews(data);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('market_update');
    };
  }, []);

  const filteredStocks = searchQuery 
    ? stocks.filter(s => 
        s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || 
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : stocks;

  const topGainers = [...filteredStocks]
    .filter(s => s.pChange > 0)
    .sort((a, b) => b.pChange - a.pChange)
    .slice(0, searchQuery ? 10 : 5);

  const topLosers = [...filteredStocks]
    .filter(s => s.pChange < 0)
    .sort((a, b) => a.pChange - b.pChange)
    .slice(0, searchQuery ? 10 : 5);

  const swingOpportunities = [...stocks]
    .sort((a, b) => a.rsi - b.rsi)
    .slice(0, 10);

  const dangerStocks = [...stocks]
    .sort((a, b) => b.rsi - a.rsi)
    .slice(0, 6);

  const daySwingSignals = [...stocks]
    .filter(s => s.pChange > 1.0 && s.rsi < 65) // Momentum stocks not yet overbought
    .sort((a, b) => b.pChange - a.pChange)
    .slice(0, 4);

  // Identify Long Term Gems (Market Cap > 100k Cr, RSI < 60, preferably positive trend)
  const calculateFuturePrice = (current, years, cagr = 0.15) => current * Math.pow((1 + cagr), years);

  const longTermGems = [...stocks]
    .filter(s => s.marketCap > 100000000000) // 1 Lakh Crore
    .sort((a, b) => a.pe > 0 && b.pe > 0 ? a.pe - b.pe : b.marketCap - a.marketCap) // Sort by lower PE or higher Market Cap
    .slice(0, 6)
    .map(s => ({
      ...s,
      projections: {
        y1: calculateFuturePrice(s.current, 1),
        y3: calculateFuturePrice(s.current, 3),
        y5: calculateFuturePrice(s.current, 5),
        y10: calculateFuturePrice(s.current, 10)
      }
    }));

  // Calculate Sector Performance
  const sectorPerformance = Object.entries(SECTORS).map(([name, symbols]) => {
    const sectorStocks = stocks.filter(s => symbols.includes(s.symbol));
    const avgChange = sectorStocks.length > 0 
      ? sectorStocks.reduce((sum, s) => sum + s.pChange, 0) / sectorStocks.length 
      : 0;
    
    return { name, avgChange, count: sectorStocks.length };
  }).sort((a, b) => b.avgChange - a.avgChange);

  // Calculate Overall Market Sentiment
  const marketAvg = stocks.length > 0 
    ? stocks.reduce((sum, s) => sum + s.pChange, 0) / stocks.length 
    : 0;
  
  const marketSentiment = marketAvg > 0.2 ? 'Bullish' : marketAvg < -0.2 ? 'Bearish' : 'Neutral';
  const sentimentColor = marketSentiment === 'Bullish' ? 'text-emerald-400' : marketSentiment === 'Bearish' ? 'text-rose-400' : 'text-neutral-400';
  const sentimentIcon = marketSentiment === 'Bullish' ? '📈' : marketSentiment === 'Bearish' ? '📉' : '⚖️';

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-4 sm:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between mb-10 pb-6 border-b border-neutral-800 gap-6">
          <div className="flex-1 w-full md:w-auto">
            <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
                    <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path>
                    </svg>
                </div>
                <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-500 bg-clip-text text-transparent">
                    SwingTrader Pro
                </h1>
                <div className={`px-4 py-1.5 rounded-full bg-neutral-900 border border-neutral-800 flex items-center gap-2 shadow-inner`}>
                    <span className="text-lg animate-pulse">{sentimentIcon}</span>
                    <span className={`text-xs font-black uppercase tracking-widest ${sentimentColor}`}>
                        Market {marketSentiment}
                    </span>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <p className="text-neutral-400 text-lg flex items-center gap-2">
                    Real-time Market Analytics
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                </p>
                <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-500/10 uppercase tracking-widest whitespace-nowrap">
                    Monitoring {stocks.length} Companies
                </span>
            </div>
          </div>

          <div className="flex-1 w-full max-w-md relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-neutral-500 group-focus-within:text-emerald-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search Company or Ticker (e.g. HDFC)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-11 pr-4 py-3.5 bg-neutral-900/50 border border-neutral-800 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-neutral-100 placeholder-neutral-500 transition-all outline-none"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-neutral-500 hover:text-white transition-colors"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-3 bg-neutral-900 px-5 py-2.5 rounded-full border border-neutral-800 shadow-inner">
              <div className={`w-3.5 h-3.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-sm font-black tracking-widest text-neutral-200">
                {connected ? 'LIVE IST' : 'SERVER OFFLINE'}
              </span>
              <span className="bg-neutral-800 px-3 py-1 rounded-lg text-emerald-400 font-mono text-sm font-bold border border-neutral-700">
                {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={requestNotificationPermission}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full border transition-all ${notificationsEnabled ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-emerald-500/40'}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                <span className="text-[10px] font-black uppercase tracking-widest">
                    {notificationsEnabled ? 'Alerts On' : 'Enable Mobile Alerts'}
                </span>
              </button>

              {notificationsEnabled && (
                <button 
                  onClick={() => sendStockNotification({ symbol: 'DEMO', name: 'Test Alert', current: 0, rsi: 25.5, signal: 'STRONG BUY' })}
                  className="px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-black uppercase tracking-widest hover:bg-blue-500/20 transition-all"
                >
                  Send Test Alert
                </button>
              )}
              
              {!connected && (
                <div className="bg-orange-500/10 border border-orange-500/20 px-4 py-1.5 rounded-full flex items-center gap-2">
                  <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Next Open In:</span>
                  <span className="text-xs font-mono font-bold text-neutral-100">{getNextMarketOpen()}</span>
                </div>
              )}
            </div>
          </div>
        </header>

        {searchQuery && (
          <div className="mb-6">
            <p className="text-sm text-neutral-400">
              Showing results for "<span className="text-emerald-400 font-semibold">{searchQuery}</span>" ({filteredStocks.length} found)
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          
          <section className="bg-neutral-900 rounded-2xl border border-emerald-900/40 shadow-xl shadow-emerald-900/5 overflow-hidden backdrop-blur-sm">
            <div className="bg-gradient-to-r from-emerald-950 to-neutral-900 p-6 border-b border-neutral-800/80">
              <h2 className="text-2xl font-bold flex items-center gap-2 text-emerald-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                {searchQuery ? 'Gaining Matches' : 'Top Gainers'}
              </h2>
            </div>
            <div className="p-4">
              <div className="space-y-3">
                {topGainers.map((stock) => (
                  <StockRow key={stock.symbol} stock={stock} type="gainer" />
                ))}
                {stocks.length > 0 && topGainers.length === 0 && (
                  <p className="text-neutral-500 p-6 text-center italic">No gainers found matching your search.</p>
                )}
                {stocks.length === 0 && (
                  <p className="text-neutral-500 p-6 text-center animate-pulse">Connecting to live market...</p>
                )}
              </div>
            </div>
          </section>

          <section className="bg-neutral-900 rounded-2xl border border-rose-900/40 shadow-xl shadow-rose-900/5 overflow-hidden backdrop-blur-sm">
            <div className="bg-gradient-to-r from-rose-950 to-neutral-900 p-6 border-b border-neutral-800/80">
              <h2 className="text-2xl font-bold flex items-center gap-2 text-rose-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"></path></svg>
                {searchQuery ? 'Losing Matches' : 'Top Losers'}
              </h2>
            </div>
            <div className="p-4">
              <div className="space-y-3">
                {topLosers.map((stock) => (
                  <StockRow key={stock.symbol} stock={stock} type="loser" />
                ))}
                {stocks.length > 0 && topLosers.length === 0 && (
                  <p className="text-neutral-500 p-6 text-center italic">No losers found matching your search.</p>
                )}
                {stocks.length === 0 && (
                  <p className="text-neutral-500 p-6 text-center animate-pulse">Connecting to live market...</p>
                )}
              </div>
            </div>
          </section>

        </div>

        {/* Intraday (Day Swing) Section */}
        <section className="bg-neutral-900 rounded-3xl border border-orange-500/20 shadow-2xl overflow-hidden mb-12">
            <div className="bg-orange-950/20 p-8 border-b border-orange-500/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold flex items-center gap-3 text-orange-400">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                    Intraday "Day Swing" Signals
                </h2>
                <p className="text-neutral-500 mt-1 font-medium italic">Target: <span className="text-orange-500/80">Buy Morning / Sell Before 3:20 PM</span></p>
              </div>
              <div className="flex gap-2">
                <span className="bg-orange-500/10 text-orange-400 text-[10px] font-bold px-3 py-1 rounded-full border border-orange-500/20">HIGH MOMENTUM</span>
                <span className="bg-orange-500/10 text-orange-400 text-[10px] font-bold px-3 py-1 rounded-full border border-orange-500/20">VOLATILE</span>
              </div>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {daySwingSignals.map(stock => (
                <div key={stock.symbol} className="p-5 rounded-2xl bg-neutral-950 border border-neutral-800 hover:border-orange-500/40 transition-all group relative">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                        <span className="text-orange-400 font-bold text-lg">{stock.symbol}</span>
                        <h4 className="text-neutral-500 text-[10px] font-medium truncate max-w-[120px]">{stock.name}</h4>
                    </div>
                    <div className="text-right">
                        <span className="block text-emerald-400 font-bold text-sm">+{stock.pChange.toFixed(2)}%</span>
                        <span className="text-[10px] text-neutral-600 font-mono">Today</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <div className="px-3 py-1 bg-orange-500/10 text-orange-500 text-[10px] font-black rounded-lg border border-orange-500/20 uppercase tracking-tighter">
                        Signal: BUY NOW
                    </div>
                    <div className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
                        Scalp
                    </div>
                  </div>
                </div>
              ))}
              {daySwingSignals.length === 0 && <p className="col-span-full text-center p-12 text-neutral-500 italic">Scanning for explosive intraday momentum...</p>}
            </div>
        </section>

        {/* Sector Health Section */}
        <section className="bg-neutral-900 rounded-2xl border border-neutral-800 shadow-xl overflow-hidden mb-12">
            <div className="bg-neutral-900 p-6 border-b border-neutral-800 flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-2 text-neutral-100">
                    <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                    Market Sector Health
                </h2>
                <span className="text-xs text-neutral-500 font-mono">Weighted Average pChange</span>
            </div>
            <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {sectorPerformance.map((sector) => (
                        <div key={sector.name} className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-neutral-700 transition-all group">
                            <div className="flex justify-between items-start mb-3">
                                <h3 className="font-bold text-neutral-300 group-hover:text-white transition-colors">{sector.name}</h3>
                                <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">{sector.count} Stocks</span>
                            </div>
                            <div className="flex items-end gap-2">
                                <span className={`text-2xl font-mono font-bold ${sector.avgChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {sector.avgChange >= 0 ? '+' : ''}{sector.avgChange.toFixed(2)}%
                                </span>
                            </div>
                            <div className="mt-3 h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full transition-all duration-1000 ${sector.avgChange >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                                    style={{ width: `${Math.min(Math.abs(sector.avgChange) * 10, 100)}%` }}
                                ></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>

        {/* Long Term Investment Section */}
        <section className="bg-neutral-900 rounded-3xl border border-blue-500/20 shadow-2xl overflow-hidden mb-12">
            <div className="bg-blue-950/20 p-8 border-b border-blue-500/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold flex items-center gap-3 text-blue-400">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    Long-Term Wealth Gems (1 Year+)
                </h2>
                <p className="text-neutral-500 mt-1 font-medium italic">Strategy: <span className="text-blue-500/80">Blue Chip / Value Selection</span></p>
              </div>
              <div className="flex gap-2">
                <span className="bg-blue-500/10 text-blue-400 text-[10px] font-bold px-3 py-1 rounded-full border border-blue-500/20">LOW VOLATILITY</span>
                <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-3 py-1 rounded-full border border-emerald-500/20">HIGH DIVIDEND</span>
              </div>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {longTermGems.map(stock => (
                <div key={stock.symbol} className="relative p-6 rounded-2xl bg-neutral-950 border border-neutral-800 hover:border-blue-500/40 transition-all group overflow-hidden">
                  <div className="absolute top-0 right-0 p-3">
                    <div className="w-20 h-20 bg-blue-500/5 rounded-full -mr-10 -mt-10 blur-2xl group-hover:bg-blue-500/10 transition-all"></div>
                  </div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                        <span className="text-blue-400 font-bold text-lg">{stock.symbol}</span>
                        <h4 className="text-neutral-400 text-xs font-medium truncate max-w-[150px]">{stock.name}</h4>
                    </div>
                    <div className="text-right">
                        <span className="block text-neutral-100 font-bold">₹{stock.current.toLocaleString('en-IN')}</span>
                        <span className="text-[10px] text-neutral-500 font-mono">Market Cap: ₹{(stock.marketCap / 10000000).toFixed(0)} Cr</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-center text-[10px]">
                        <span className="block text-neutral-500 mb-1">P/E Ratio</span>
                        <span className="font-bold text-neutral-200">{stock.pe > 0 ? stock.pe.toFixed(1) : 'N/A'}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-center text-[10px]">
                        <span className="block text-neutral-500 mb-1">Status</span>
                        <span className="font-bold text-emerald-400">STABLE</span>
                    </div>
                  </div>

                  {/* Future Projections */}
                  <div className="mt-5 p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
                    <h5 className="text-[10px] font-bold text-blue-400 mb-3 uppercase tracking-widest border-b border-blue-500/10 pb-2">Future Price Forecast (15% CAGR)</h5>
                    <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] text-neutral-500 font-medium">1 Year Info</span>
                            <span className="text-[11px] font-bold text-neutral-300">₹{stock.projections.y1.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                        </div>
                        <div className="flex justify-between items-center border-l border-neutral-800 pl-3">
                            <span className="text-[10px] text-neutral-500 font-medium">3 Year Pro</span>
                            <span className="text-[11px] font-bold text-neutral-300">₹{stock.projections.y3.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] text-neutral-500 font-medium">5 Year Goal</span>
                            <span className="text-[11px] font-bold text-emerald-400">₹{stock.projections.y5.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                        </div>
                        <div className="flex justify-between items-center border-l border-neutral-800 pl-3">
                            <span className="text-[10px] text-neutral-500 font-medium">10 Year Cap</span>
                            <span className="text-[11px] font-bold text-blue-400">₹{stock.projections.y10.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                        </div>
                    </div>
                  </div>
                </div>
              ))}
              {stocks.length === 0 && <p className="col-span-full text-center p-12 text-neutral-500 animate-pulse">Scanning fundamentals for long-term value...</p>}
            </div>
        </section>

        {/* Swing Trade Insights */}
        <div className="flex flex-col gap-10 mb-12">
          <section className="bg-neutral-900 rounded-3xl border border-emerald-500/20 shadow-2xl overflow-hidden">
            <div className="bg-emerald-950/20 p-8 border-b border-emerald-500/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold flex items-center gap-3 text-emerald-400">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    Top 10 Swing Trade Opportunities
                </h2>
                <p className="text-neutral-500 mt-1 font-medium italic">Recommended Holding: <span className="text-emerald-500/80">3 - 5 Trading Days</span></p>
              </div>
              <div className="bg-neutral-800/50 px-4 py-2 rounded-xl text-neutral-400 text-sm font-mono border border-neutral-700">
                Strategy: RSI Mean Reversion
              </div>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {swingOpportunities.map((stock, index) => (
                <div key={stock.symbol} className="p-5 rounded-2xl bg-neutral-950 border border-neutral-800 hover:border-emerald-500/40 transition-all hover:scale-[1.02] active:scale-95 group">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-black bg-emerald-500 text-neutral-950 px-1.5 py-0.5 rounded leading-none">RANK #{index + 1}</span>
                    <span className="font-mono text-[10px] text-neutral-500">{stock.symbol}</span>
                  </div>
                  <h3 className="font-bold text-neutral-100 truncate text-sm mb-3 group-hover:text-emerald-400 transition-colors">{stock.name}</h3>
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-xs font-mono text-neutral-500 italic">
                        <span>Price:</span>
                        <span className="text-neutral-200">₹{stock.current.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-mono text-neutral-500 italic">
                        <span>RSI:</span>
                        <span className={`font-bold ${stock.rsi < 30 ? 'text-emerald-400 underline underline-offset-4' : 'text-neutral-300'}`}>{stock.rsi.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              ))}
              {stocks.length > 0 && swingOpportunities.length === 0 && <p className="col-span-full text-center p-12 text-neutral-500 italic">No clear trade setups identified at the moment.</p>}
            </div>
          </section>

          <section className="bg-neutral-900 rounded-3xl border border-rose-500/20 shadow-2xl overflow-hidden">
            <div className="bg-rose-950/10 p-6 border-b border-rose-500/10">
              <h2 className="text-xl font-bold flex items-center gap-2 text-rose-400/80">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.268 17c-.77 1.333.192 3 1.732 3z"></path></svg>
                Danger Alerts: Avoid the Hyped Overbought Zone
              </h2>
            </div>
            <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {dangerStocks.map(stock => (
                <div key={stock.symbol} className="p-4 rounded-xl bg-neutral-950/50 border border-neutral-800">
                  <span className="block font-bold text-neutral-300 text-xs mb-1 group-hover:text-rose-400 transition-colors uppercase tracking-tight">{stock.symbol}</span>
                  <div className="flex justify-between items-end">
                    <span className="text-[10px] font-bold text-rose-500 opacity-60">RSI: {stock.rsi.toFixed(1)}</span>
                  </div>
                </div>
              ))}
              {stocks.length > 0 && dangerStocks.length === 0 && <p className="col-span-full text-center p-6 text-neutral-500 italic text-sm">Markets are currently showing stable momentum.</p>}
            </div>
          </section>
        </div>

        {/* Market News Feed */}
        <section className="bg-neutral-900 rounded-3xl border border-neutral-800 shadow-xl overflow-hidden mb-12">
            <div className="bg-neutral-950/40 p-6 border-b border-neutral-800 flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-2 text-neutral-100">
                    <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"></path></svg>
                    Live Market Insights
                </h2>
                <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                    </span>
                    <span className="text-[10px] font-bold text-orange-400 tracking-widest uppercase">Live Feed</span>
                </div>
            </div>
            <div className="p-8">
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                    {news.map((item) => (
                        <li key={item.id} className="flex gap-4 group border-b border-neutral-800/30 pb-4 last:border-0 last:pb-0 md:border-b-0 md:pb-0 font-sans">
                            <div className="mt-2 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-neutral-700 group-hover:bg-orange-500 transition-colors"></div>
                            <div className="flex-1">
                                <a 
                                    href={item.link} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-neutral-300 hover:text-orange-400 font-medium leading-relaxed transition-colors block text-base"
                                >
                                    {item.title}
                                </a>
                                <div className="mt-1 flex items-center gap-3 text-[10px] text-neutral-500 font-bold uppercase tracking-tight">
                                    <span className="bg-neutral-800/80 px-2 py-0.5 rounded text-neutral-400">{item.publisher}</span>
                                    <span>•</span>
                                    <span>{new Date(item.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                            </div>
                        </li>
                    ))}
                    {news.length === 0 && (
                        <p className="col-span-full text-neutral-500 italic text-center py-6 animate-pulse">Connecting to global news stream...</p>
                    )}
                </ul>
            </div>
        </section>

        {/* All Stocks Snapshot Table */}
        <section className="bg-neutral-900 rounded-3xl border border-neutral-800 shadow-2xl overflow-hidden mb-12">
            <div className="p-6 md:p-8 border-b border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path></svg>
                        All Market Snapshot
                    </h2>
                    <p className="text-neutral-500 text-sm mt-1">Technical insights for all {filteredStocks.length} monitored stocks</p>
                </div>
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-neutral-950 text-neutral-400 text-[10px] sm:text-xs uppercase tracking-widest font-bold border-b border-neutral-800">
                            <th className="px-4 sm:px-8 py-5">Symbol</th>
                            <th className="hidden lg:table-cell px-8 py-5">Company</th>
                            <th className="px-4 sm:px-8 py-5 text-right">Price</th>
                            <th className="px-4 sm:px-8 py-5 text-right">Change</th>
                            <th className="hidden md:table-cell px-8 py-5 text-right font-mono">RSI</th>
                            <th className="px-4 sm:px-8 py-5 text-right">Signal</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/50">
                        {filteredStocks.map((stock) => (
                            <tr key={stock.symbol} className="hover:bg-neutral-800/30 transition-colors group">
                                <td className="px-4 sm:px-8 py-4 whitespace-nowrap">
                                    <span className="bg-emerald-500/10 text-emerald-400 text-[10px] sm:text-xs font-bold px-2 py-1 rounded border border-emerald-500/20">
                                        {stock.symbol}
                                    </span>
                                </td>
                                <td className="hidden lg:table-cell px-8 py-4 font-medium text-neutral-400 group-hover:text-white transition-colors truncate max-w-[150px]">
                                    {stock.name}
                                </td>
                                <td className="px-4 sm:px-8 py-4 text-right font-mono font-semibold text-neutral-100 text-sm sm:text-base">
                                    ₹{stock.current.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                                </td>
                                <td className={`px-4 sm:px-8 py-4 text-right font-mono font-bold text-sm sm:text-base ${stock.pChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {stock.pChange >= 0 ? '+' : ''}{stock.pChange.toFixed(1)}%
                                </td>
                                <td className={`hidden md:table-cell px-8 py-4 text-right font-mono font-bold ${stock.rsi < 35 || stock.rsi > 65 ? 'underline underline-offset-4 decoration-2 text-white' : 'text-neutral-500'}`}>
                                  {stock.rsi.toFixed(0)}
                                </td>
                                <td className="px-4 sm:px-8 py-4 text-right whitespace-nowrap">
                                    <span className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-full font-bold font-mono text-[9px] sm:text-[10px] uppercase tracking-tighter ${stock.signalColor === 'emerald' ? 'bg-emerald-500/10 text-emerald-400' : stock.signalColor === 'rose' ? 'bg-rose-500/10 text-rose-400' : 'bg-neutral-800 text-neutral-500'}`}>
                                        {stock.signal}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredStocks.length === 0 && (
                    <div className="p-20 text-center">
                        <p className="text-neutral-500 text-lg italic">No stock data available or matching search criteria.</p>
                    </div>
                )}
            </div>
        </section>

      </div>
    </div>
  );
}



function StockRow({ stock, type }) {
  const isGainer = type === 'gainer';
  const colorText = isGainer ? 'text-emerald-400' : 'text-rose-400';
  const colorBg = isGainer ? 'bg-emerald-400/10' : 'bg-rose-400/10';
  
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-neutral-950/60 hover:bg-neutral-800 transition-colors border border-transparent hover:border-neutral-700 group cursor-pointer">
      <div>
        <h3 className="text-lg font-bold tracking-wide text-neutral-100 group-hover:text-white transition-colors">{stock.symbol}</h3>
        <p className="text-sm text-neutral-500 truncate max-w-[140px] sm:max-w-[200px]">{stock.name}</p>
      </div>
      <div className="text-right">
        <p className="text-lg font-bold text-neutral-100 font-mono tracking-tight">
          ₹{stock.current.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <div className={`mt-1 inline-flex items-center justify-end gap-1 ${colorText} ${colorBg} px-2.5 py-0.5 rounded-full`}>
          <span className="text-sm font-semibold font-mono tracking-wide">
            {isGainer ? '+' : ''}{stock.change.toFixed(2)} ({isGainer ? '+' : ''}{stock.pChange.toFixed(2)}%)
          </span>
        </div>
      </div>
    </div>
  );
}

export default App;
