export const NSE_EQUITY_CSV_URL = "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv";

export const HTF_TIMEFRAMES = [
  { name: "1H", interval: "1h", range: "60d", weight: 1.0, mode: "Scalp" },
  { name: "Daily", interval: "1d", range: "2y", weight: 1.55, mode: "Swing" },
  { name: "Weekly", interval: "1wk", range: "5y", weight: 2.2, mode: "Swing" }
];

export const LTF_TIMEFRAMES = [
  { name: "5M", interval: "5m", range: "10d", synthetic4h: false, weight: 0.55 },
  { name: "15M", interval: "15m", range: "30d", synthetic4h: false, weight: 0.75 },
  { name: "1H", interval: "1h", range: "60d", synthetic4h: false, weight: 1.0 },
  { name: "4H", interval: "1h", range: "60d", synthetic4h: true, weight: 1.35 }
];

export const MARKET_TAPE_SYMBOLS = [
  { name: "NIFTY 50", symbol: "^NSEI" },
  { name: "BANK NIFTY", symbol: "^NSEBANK" },
  { name: "SENSEX", symbol: "^BSESN" },
  { name: "INDIA VIX", symbol: "^INDIAVIX" }
];

export const NIFTY50 = [
  "ADANIENT.NS", "ADANIPORTS.NS", "APOLLOHOSP.NS", "ASIANPAINT.NS", "AXISBANK.NS", "BAJAJ-AUTO.NS",
  "BAJFINANCE.NS", "BAJAJFINSV.NS", "BEL.NS", "BHARTIARTL.NS", "BPCL.NS", "BRITANNIA.NS", "CIPLA.NS",
  "COALINDIA.NS", "DRREDDY.NS", "EICHERMOT.NS", "ETERNAL.NS", "GRASIM.NS", "HCLTECH.NS", "HDFCBANK.NS",
  "HDFCLIFE.NS", "HEROMOTOCO.NS", "HINDALCO.NS", "HINDUNILVR.NS", "ICICIBANK.NS", "INDUSINDBK.NS",
  "INFY.NS", "ITC.NS", "JIOFIN.NS", "JSWSTEEL.NS", "KOTAKBANK.NS", "LT.NS", "M&M.NS", "MARUTI.NS",
  "NESTLEIND.NS", "NTPC.NS", "ONGC.NS", "POWERGRID.NS", "RELIANCE.NS", "SBILIFE.NS", "SBIN.NS",
  "SHRIRAMFIN.NS", "SUNPHARMA.NS", "TATACONSUM.NS", "TATAMOTORS.NS", "TATASTEEL.NS", "TCS.NS",
  "TECHM.NS", "TITAN.NS", "TRENT.NS", "ULTRACEMCO.NS", "WIPRO.NS"
];

export const FNO_STOCKS = [
  "RELIANCE.NS", "HDFCBANK.NS", "ICICIBANK.NS", "SBIN.NS", "INFY.NS", "TCS.NS", "AXISBANK.NS",
  "LT.NS", "ITC.NS", "BHARTIARTL.NS", "TATAMOTORS.NS", "MARUTI.NS", "SUNPHARMA.NS", "BAJFINANCE.NS",
  "KOTAKBANK.NS", "HINDUNILVR.NS", "ULTRACEMCO.NS", "ADANIENT.NS", "ADANIPORTS.NS", "TATASTEEL.NS",
  "JSWSTEEL.NS", "HINDALCO.NS", "POWERGRID.NS", "ONGC.NS", "NTPC.NS", "COALINDIA.NS", "DRREDDY.NS",
  "CIPLA.NS", "EICHERMOT.NS", "GRASIM.NS"
];

export const INDEX_INSTRUMENTS = [
  { name: "NIFTY 50", sourceSymbol: "^NSEI", tvSymbol: "NSE:NIFTY1!", marketType: "Index" },
  { name: "BANK NIFTY", sourceSymbol: "^NSEBANK", tvSymbol: "NSE:BANKNIFTY1!", marketType: "Index" },
  { name: "FIN NIFTY", sourceSymbol: "NIFTYFINSRV25_50.NS", tvSymbol: "NSE:FINNIFTY1!", marketType: "Index" },
  { name: "MIDCAP NIFTY", sourceSymbol: "NIFTY_MID_SELECT.NS", tvSymbol: "NSE:MIDCPNIFTY1!", marketType: "Index" }
];

export function getUniverseLabel(universe) {
  return {
    nifty50: "Nifty 50 Cash Watchlist",
    fno: "Liquid F&O Long / Short",
    all: "NSE Cash Universe"
  }[universe] || "Custom";
}

export function getDefaultDirections(universe) {
  return universe === "fno" ? ["bullish", "bearish"] : ["bullish"];
}
