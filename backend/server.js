import express from 'express';
import { Server } from 'socket.io';
import cors from 'cors';
import http from 'http';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

// Comprehensive NIFTY 100 + Popular stocks for accurate Top Gainers/Losers
const symbols = [
  "HCLTECH.NS", "AXISBANK.NS", "INDUSINDBK.NS", "MARUTI.NS", "POWERGRID.NS",
  "ICICIBANK.NS", "TCS.NS", "HDFCBANK.NS", "JSWSTEEL.NS", "BEL.NS",
  "BPCL.NS", "CHOLAFIN.NS", "SHRIRAMFIN.NS", "TITAN.NS", "DRREDDY.NS",
  "APOLLOHOSP.NS", "WIPRO.NS", "TATASTEEL.NS", "TATAMOTORS.NS", "TATACONSUM.NS",
  "TATAPOWER.NS", "SIEMENS.NS", "SRF.NS", "VEDL.NS", "RELIANCE.NS",
  "BOSCHLTD.NS", "LT.NS", "TRENT.NS", "ITC.NS", "HINDUNILVR.NS",
  "HINDALCO.NS", "ABB.NS", "HEROMOTOCO.NS", "GRASIM.NS", "AMBUJACEM.NS",
  "EICHERMOT.NS", "COLPAL.NS", "CIPLA.NS", "ASIANPAINT.NS", "BRITANNIA.NS",
  "ULTRACEMCO.NS", "ICICIGI.NS", "DIVISLAB.NS", "ADANIENSOL.NS", "VARUNBEV.NS",
  "SBILIFE.NS", "ZYDUSLIFE.NS", "DMART.NS", "IRCTC.NS", "ICICIPRULI.NS",
  "JIOFIN.NS", "ADANITOTAL.NS", "HDFCLIFE.NS", "GODREJCP.NS", "JINDALSTEL.NS",
  "INDIGO.NS", "SBICARD.NS", "NAUKRI.NS", "LTIM.NS", "DABUR.NS",
  "BAJAJFINSV.NS", "RECLTD.NS", "ADANIPOWER.NS", "TECHM.NS", "BAJAJ-AUTO.NS",
  "BHARTIARTL.NS", "IRFC.NS", "HAL.NS", "BAJFINANCE.NS", "MARICO.NS",
  "GAIL.NS", "PFC.NS", "COALINDIA.NS", "IOC.NS", "NTPC.NS",
  "MCDOWELL-N.NS", "TVSMOTOR.NS", "DLF.NS", "ONGC.NS", "ADANIENT.NS",
  "ADANIGREEN.NS", "ADANIPORTS.NS", "SUNPHARMA.NS", "INFY.NS", "PIDILITIND.NS",
  "BAJAJHLDNG.NS", "HAPPSTMNDS.NS", "ZOMATO.NS", "PAYTM.NS", "NYKAA.NS",
  "PAGEIND.NS", "PETRONET.NS", "POLYCAB.NS", "MUTHOOTFIN.NS", "MPHASIS.NS",
  "MRF.NS", "NAM-INDIA.NS", "NMDC.NS", "OBEROIRLTY.NS", "PIIND.NS",
  "PNB.NS", "PERSISTENT.NS", "RELIANCE.NS", "SAIL.NS", "TATACOMM.NS",
  "TATAMTRDVR.NS", "UPL.NS", "UNITDSPR.NS", "VBL.NS", "WHIRLPOOL.NS",
  "YESBANK.NS", "ABCAPITAL.NS", "ABFRL.NS", "AJANTPHARM.NS", "ALKEM.NS",
  "ALOKINDS.NS", "AMARAJABAT.NS", "APLLTD.NS", "ASHOKLEY.NS", "AUBANK.NS",
  "AUROPHARMA.NS", "BALKRISIND.NS", "BANDHANBNK.NS", "BANKBARODA.NS", "BANKINDIA.NS",
  "BATAINDIA.NS", "BERGEPAINT.NS", "BHARATFORG.NS", "BHEL.NS", "BIOCON.NS",
  "CANBK.NS", "COFORGE.NS", "CONCOR.NS", "COROMANDEL.NS", "CROMPTON.NS",
  "CUMMINSIND.NS", "DEEPAKNTR.NS", "DELHIVERY.NS", "DIXON.NS", "ESCORTS.NS",
  "EXIDEIND.NS", "FEDERALBNK.NS", "GLENMARK.NS", "GMREPP.NS", "GMRINFRA.NS",
  "GNFC.NS", "GOKEX.NS", "GUJGASLTD.NS", "HAVELLS.NS", "HDFCAMC.NS",
  "IDEA.NS", "IDFCFIRSTB.NS", "INDIACEM.NS", "INDIAMART.NS", "IEX.NS",
  "INDHOTEL.NS", "IPCALAB.NS", "JBMA.NS", "JKCEMENT.NS", "JSWENERGY.NS",
  "JUBLFOOD.NS", "KALYANKJIL.NS", "KEI.NS", "L&TFH.NS", "LAURUSLABS.NS",
  "LICHSGFIN.NS", "LUPIN.NS", "MANAPPURAM.NS", "MAXHEALTH.NS", "MAZDOCK.NS",
  "METROBRAND.NS", "MFSL.NS", "MOTHERSON.NS", "NESTLEIND.NS", "NHPC.NS",
  "PATANJALI.NS", "PEL.NS", "POONAWALLA.NS", "PRESTIGE.NS", "RVNL.NS",
  "RELAXO.NS", "SIEMENS.NS", "SHREETECHN.NS", "SUZLON.NS", "SYNGENE.NS",
  "TATAELXSI.NS", "TITAN.NS", "TORNTPOWER.NS", "VGUARD.NS", "VOLTAS.NS"
];

let latestNews = [];
let technicalData = {}; // Global cache for technical indicators

// Simple RSI Calculation
function calculateRSI(prices, period = 14) {
  if (prices.length <= period) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - (100 / (1 + rs));
}

async function updateTechnicalIndicators() {
  console.log(`Updating historical technical indicators for ${symbols.length} stocks...`);
  try {
    // Fetch last 30 days of historical data for each symbol
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 40);
    
    // Format dates as YYYY-MM-DD
    const period1 = thirtyDaysAgo.toISOString().split('T')[0];
    const period2 = today.toISOString().split('T')[0];
    
    const batchSize = 10;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      await Promise.all(batch.map(async (symbol) => {
        try {
          // Use chart() instead of historical() for better v3 support
          const result = await yahooFinance.chart(symbol, {
            period1,
            period2,
            interval: '1d'
          });
          
          if (result && result.quotes && result.quotes.length > 0) {
            const prices = result.quotes.map(d => d.close).filter(p => p != null);
            const rsi = calculateRSI(prices);
            
            // Simple Trend Analysis (Last 5 days)
            const isUptrend = prices.length >= 5 ? prices[prices.length - 1] > prices[prices.length - 5] : false;
            
            technicalData[symbol] = { rsi, isUptrend };
          }
        } catch (e) {
          console.warn(`Could not fetch chart for ${symbol}:`, e.message);
        }
      }));
      // Small pause between batches
      await new Promise(r => setTimeout(r, 1000));
    }
    console.log("Technical indicators update complete.");
  } catch (error) {
    console.error("Error in technical update:", error.message);
  }
}

async function fetchLiveStockData() {
  try {
    const results = await yahooFinance.quote(symbols);
    if (results && results.length > 0) {
      return results.map(quote => {
        const symbol = quote.symbol;
        const tech = technicalData[symbol] || { rsi: 50, isUptrend: false };
        
        // Generate Signal Logic
        let signal = "Neutral";
        let color = "neutral";
        
        if (tech.rsi < 35 && tech.isUptrend) { signal = "Strong Buy (Swing)"; color = "emerald"; }
        else if (tech.rsi < 45) { signal = "Buy / Accumulate"; color = "emerald"; }
        else if (tech.rsi > 75) { signal = "DANGER / Overbought"; color = "rose"; }
        else if (tech.rsi > 65) { signal = "Sell / Caution"; color = "rose"; }
        
        return {
          symbol: symbol.replace('.NS', ''),
          name: quote.shortName || quote.longName || quote.symbol,
          current: quote.regularMarketPrice || 0,
          change: quote.regularMarketChange || 0,
          pChange: quote.regularMarketChangePercent || 0,
          rsi: tech.rsi,
          marketCap: quote.marketCap || 0,
          pe: quote.trailingPE || 0,
          dividend: quote.dividendYield || 0,
          signal,
          signalColor: color
        };
      });
    }
  } catch (error) {
    console.error("Error fetching live data:", error.message);
  }
  return null;
}

let latestData = [];

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  if (latestData.length > 0) {
    socket.emit('market_update', latestData);
  }
  if (latestNews.length > 0) {
    socket.emit('news_update', latestNews);
  }
});

async function fetchMarketNews() {
  try {
    const results = await yahooFinance.search('NSE India News', { newsCount: 10 });
    if (results && results.news) {
      latestNews = results.news.map(item => ({
        id: item.uuid,
        title: item.title,
        publisher: item.publisher,
        link: item.link,
        time: item.providerPublishTime
      }));
      io.emit('news_update', latestNews);
    }
  } catch (e) {
    console.warn("Could not fetch news:", e.message);
  }
}

// Refresh data every 10 seconds to avoid rate limits with larger list
setInterval(async () => {
  const liveData = await fetchLiveStockData();
  if (liveData && liveData.length > 0) {
    latestData = liveData;
    io.emit('market_update', latestData);
  }
}, 10000);

// Initial load of history
updateTechnicalIndicators().then(() => {
  fetchLiveStockData().then(data => {
    if (data && data.length > 0) {
      latestData = data;
      console.log(`Successfully fetched initial live data for ${data.length} stocks.`);
    }
  });
});

const PORT = 4001;
server.listen(PORT, '127.0.0.1', async () => {
  console.log(`NIFTY 100 Live Server running on http://127.0.0.1:${PORT}`);
  
  // Initial data load
  await updateTechnicalIndicators();
  await fetchMarketNews();
  await fetchLiveStockData().then(data => {
    if (data && data.length > 0) {
      latestData = data;
      console.log(`Successfully fetched initial live data for ${data.length} stocks.`);
    }
  });
});

// Refresh indicators every 6 hours
setInterval(updateTechnicalIndicators, 1000 * 60 * 60 * 6);
// Refresh news every 15 minutes
setInterval(fetchMarketNews, 1000 * 60 * 15);

process.on('uncaughtException', (err) => {
  console.error('CRITICAL: Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});
