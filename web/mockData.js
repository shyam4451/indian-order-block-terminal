import {
  adxDmi,
  atrPercent,
  deriveTrendState,
  ema,
  latest,
  obv,
  performance,
  relativeStrengthScore,
  rsi,
  volumeRatio
} from "./analytics.js";
import { average, clamp, createSeededRandom, dateDaysAgo, formatPercent, pick, sample } from "./utils.js";

const SECTORS = [
  "Banking",
  "Financial Services",
  "IT",
  "Pharma",
  "Auto",
  "Realty",
  "Capital Goods",
  "PSU",
  "Metals",
  "Energy",
  "FMCG"
];

const STOCK_CATALOG = [
  { symbol: "RELIANCE", company: "Reliance Industries", sector: "Energy", marketCapBucket: "Large Cap", futuresEligible: true, lotSize: 250, universe: ["Nifty 50", "Nifty 500"] },
  { symbol: "HDFCBANK", company: "HDFC Bank", sector: "Banking", marketCapBucket: "Large Cap", futuresEligible: true, lotSize: 550, universe: ["Nifty 50", "Nifty 500"] },
  { symbol: "ICICIBANK", company: "ICICI Bank", sector: "Banking", marketCapBucket: "Large Cap", futuresEligible: true, lotSize: 700, universe: ["Nifty 50", "Nifty 500"] },
  { symbol: "SBIN", company: "State Bank of India", sector: "Banking", marketCapBucket: "Large Cap", futuresEligible: true, lotSize: 1500, universe: ["Nifty 50", "Nifty 500"] },
  { symbol: "AXISBANK", company: "Axis Bank", sector: "Banking", marketCapBucket: "Large Cap", futuresEligible: true, lotSize: 625, universe: ["Nifty 50", "Nifty 500"] },
  { symbol: "KOTAKBANK", company: "Kotak Mahindra Bank", sector: "Banking", marketCapBucket: "Large Cap", futuresEligible: true, lotSize: 400, universe: ["Nifty 50", "Nifty 500"] },
  { symbol: "BAJFINANCE", company: "Bajaj Finance", sector: "Financial Services", marketCapBucket: "Large Cap", futuresEligible: true, lotSize: 125, universe: ["Nifty 50", "Nifty 500"] },
  { symbol: "BAJAJFINSV", company: "Bajaj Finserv", sector: "Financial Services", marketCapBucket: "Large Cap", futuresEligible: true, lotSize: 500, universe: ["Nifty 50", "Nifty 500"] },
  { symbol: "JIOFIN", company: "Jio Financial Services", sector: "Financial Services", marketCapBucket: "Large Cap", futuresEligible: true, lotSize: 3000, universe: ["Nifty 50", "Nifty 500"] },
  { symbol: "INFY", company: "Infosys", sector: "IT", marketCapBucket: "Large Cap", futuresEligible: true, lotSize: 300, universe: ["Nifty 50", "Nifty 500"] },
  { symbol: "TCS", company: "Tata Consultancy Services", sector: "IT", marketCapBucket: "Large Cap", futuresEligible: true, lotSize: 175, universe: ["Nifty 50", "Nifty 500"] },
  { symbol: "HCLTECH", company: "HCL Technologies", sector: "IT", marketCapBucket: "Large Cap", futuresEligible: true, lotSize: 350, universe: ["Nifty 50", "Nifty 500"] },
  { symbol: "WIPRO", company: "Wipro", sector: "IT", marketCapBucket: "Large Cap", futuresEligible: true, lotSize: 1500, universe: ["Nifty 50", "Nifty 500"] },
  { symbol: "SUNPHARMA", company: "Sun Pharma", sector: "Pharma", marketCapBucket: "Large Cap", futuresEligible: true, lotSize: 700, universe: ["Nifty 50", "Nifty 500"] },
  { symbol: "DRREDDY", company: "Dr Reddy's", sector: "Pharma", marketCapBucket: "Large Cap", futuresEligible: true, lotSize: 125, universe: ["Nifty 50", "Nifty 500"] },
  { symbol: "CIPLA", company: "Cipla", sector: "Pharma", marketCapBucket: "Large Cap", futuresEligible: true, lotSize: 650, universe: ["Nifty 50", "Nifty 500"] },
  { symbol: "TATAMOTORS", company: "Tata Motors", sector: "Auto", marketCapBucket: "Large Cap", futuresEligible: true, lotSize: 1425, universe: ["Nifty 50", "Nifty 500"] },
  { symbol: "MARUTI", company: "Maruti Suzuki", sector: "Auto", marketCapBucket: "Large Cap", futuresEligible: true, lotSize: 100, universe: ["Nifty 50", "Nifty 500"] },
  { symbol: "M&M", company: "Mahindra & Mahindra", sector: "Auto", marketCapBucket: "Large Cap", futuresEligible: true, lotSize: 350, universe: ["Nifty 50", "Nifty 500"] },
  { symbol: "DLF", company: "DLF", sector: "Realty", marketCapBucket: "Large Cap", futuresEligible: true, lotSize: 1650, universe: ["Nifty Next 50", "Nifty 500"] },
  { symbol: "GODREJPROP", company: "Godrej Properties", sector: "Realty", marketCapBucket: "Mid Cap", futuresEligible: true, lotSize: 325, universe: ["Nifty Next 50", "Nifty 500"] },
  { symbol: "LT", company: "Larsen & Toubro", sector: "Capital Goods", marketCapBucket: "Large Cap", futuresEligible: true, lotSize: 300, universe: ["Nifty 50", "Nifty 500"] },
  { symbol: "SIEMENS", company: "Siemens India", sector: "Capital Goods", marketCapBucket: "Large Cap", futuresEligible: false, lotSize: 1, universe: ["Nifty Next 50", "Nifty 500"] },
  { symbol: "ABB", company: "ABB India", sector: "Capital Goods", marketCapBucket: "Large Cap", futuresEligible: false, lotSize: 1, universe: ["Nifty Next 50", "Nifty 500"] },
  { symbol: "BHEL", company: "BHEL", sector: "PSU", marketCapBucket: "Mid Cap", futuresEligible: true, lotSize: 2100, universe: ["Nifty Next 50", "Nifty 500"] },
  { symbol: "NTPC", company: "NTPC", sector: "PSU", marketCapBucket: "Large Cap", futuresEligible: true, lotSize: 1500, universe: ["Nifty 50", "Nifty 500"] },
  { symbol: "ONGC", company: "ONGC", sector: "PSU", marketCapBucket: "Large Cap", futuresEligible: true, lotSize: 1700, universe: ["Nifty 50", "Nifty 500"] },
  { symbol: "TATASTEEL", company: "Tata Steel", sector: "Metals", marketCapBucket: "Large Cap", futuresEligible: true, lotSize: 4200, universe: ["Nifty 50", "Nifty 500"] },
  { symbol: "HINDALCO", company: "Hindalco", sector: "Metals", marketCapBucket: "Large Cap", futuresEligible: true, lotSize: 1400, universe: ["Nifty 50", "Nifty 500"] },
  { symbol: "JSWSTEEL", company: "JSW Steel", sector: "Metals", marketCapBucket: "Large Cap", futuresEligible: true, lotSize: 675, universe: ["Nifty 50", "Nifty 500"] },
  { symbol: "BHARTIARTL", company: "Bharti Airtel", sector: "Financial Services", marketCapBucket: "Large Cap", futuresEligible: true, lotSize: 950, universe: ["Nifty 50", "Nifty 500"] },
  { symbol: "ITC", company: "ITC", sector: "FMCG", marketCapBucket: "Large Cap", futuresEligible: true, lotSize: 1600, universe: ["Nifty 50", "Nifty 500"] },
  { symbol: "HINDUNILVR", company: "Hindustan Unilever", sector: "FMCG", marketCapBucket: "Large Cap", futuresEligible: true, lotSize: 300, universe: ["Nifty 50", "Nifty 500"] },
  { symbol: "NESTLEIND", company: "Nestle India", sector: "FMCG", marketCapBucket: "Large Cap", futuresEligible: false, lotSize: 1, universe: ["Nifty 50", "Nifty 500"] },
  { symbol: "POWERGRID", company: "Power Grid", sector: "Energy", marketCapBucket: "Large Cap", futuresEligible: true, lotSize: 2700, universe: ["Nifty 50", "Nifty 500"] },
  { symbol: "COALINDIA", company: "Coal India", sector: "Energy", marketCapBucket: "Large Cap", futuresEligible: true, lotSize: 2100, universe: ["Nifty 50", "Nifty 500"] },
  { symbol: "TRENT", company: "Trent", sector: "FMCG", marketCapBucket: "Large Cap", futuresEligible: true, lotSize: 175, universe: ["Nifty 50", "Nifty 500"] },
  { symbol: "ADANIPORTS", company: "Adani Ports", sector: "Capital Goods", marketCapBucket: "Large Cap", futuresEligible: true, lotSize: 625, universe: ["Nifty 50", "Nifty 500"] },
  { symbol: "BEL", company: "Bharat Electronics", sector: "PSU", marketCapBucket: "Large Cap", futuresEligible: true, lotSize: 2850, universe: ["Nifty 50", "Nifty 500"] },
  { symbol: "ULTRACEMCO", company: "UltraTech Cement", sector: "Capital Goods", marketCapBucket: "Large Cap", futuresEligible: true, lotSize: 100, universe: ["Nifty 50", "Nifty 500"] }
];

const PROFILE_MAP = {
  RELIANCE: "momentum",
  ICICIBANK: "pullback",
  HCLTECH: "momentum",
  WIPRO: "divBull",
  TATAMOTORS: "adxBull",
  DLF: "liquidityBull",
  BHEL: "obv",
  TATASTEEL: "divBear",
  HINDALCO: "adxBear",
  TRENT: "pullback",
  BEL: "momentum",
  GODREJPROP: "liquidityBull",
  POWERGRID: "obv",
  NTPC: "pullback"
};

const INDEX_CONFIG = [
  { name: "Nifty 50", base: 22380, drift: 0.0011, vol: 0.011 },
  { name: "Bank Nifty", base: 48250, drift: 0.00135, vol: 0.014 },
  { name: "FinNifty", base: 22120, drift: 0.00115, vol: 0.012 },
  { name: "Nifty Midcap", base: 51380, drift: 0.0014, vol: 0.016 },
  { name: "Nifty Smallcap", base: 16420, drift: 0.00085, vol: 0.018 }
];

function baseSectorDrift(sector) {
  return {
    Banking: 0.0012,
    "Financial Services": 0.001,
    IT: 0.00065,
    Pharma: 0.0008,
    Auto: 0.00115,
    Realty: 0.0009,
    "Capital Goods": 0.00125,
    PSU: 0.00135,
    Metals: 0.00035,
    Energy: 0.0009,
    FMCG: 0.00045
  }[sector];
}

function generateCandleSeries(seed, basePrice, drift, volatility, avgVolume, profile) {
  const rng = createSeededRandom(seed);
  const candles = [];
  let close = basePrice;

  for (let i = 259; i >= 0; i -= 1) {
    const noise = ((rng() - 0.5) * volatility * 2);
    const seasonal = Math.sin((260 - i) / 11) * volatility * 0.12;
    const dailyReturn = drift + noise + seasonal;
    const nextClose = Math.max(20, close * (1 + dailyReturn));
    const open = close * (1 + ((rng() - 0.5) * volatility * 0.55));
    const high = Math.max(open, nextClose) * (1 + (rng() * volatility * 0.6));
    const low = Math.min(open, nextClose) * (1 - (rng() * volatility * 0.6));
    const volume = avgVolume * (0.8 + (rng() * 0.55));
    candles.push({
      date: dateDaysAgo(i),
      open,
      high,
      low,
      close: nextClose,
      volume
    });
    close = nextClose;
  }

  applyProfileAdjustments(candles, avgVolume, profile);
  return candles;
}

function applyProfileAdjustments(candles, avgVolume, profile) {
  if (!profile) {
    return;
  }
  const last = candles.length - 1;

  if (profile === "momentum") {
    for (let i = last - 8; i <= last; i += 1) {
      const boost = 1 + ((i - (last - 8)) * 0.008);
      candles[i].close = candles[i - 1].close * boost;
      candles[i].open = candles[i - 1].close * (1 + ((i % 2 === 0 ? -1 : 1) * 0.003));
      candles[i].high = candles[i].close * 1.01;
      candles[i].low = Math.min(candles[i].open, candles[i].close) * 0.992;
      candles[i].volume = avgVolume * (1.45 + ((i - (last - 8)) * 0.08));
    }
  }

  if (profile === "pullback") {
    for (let i = last - 11; i <= last - 4; i += 1) {
      candles[i].close = candles[i - 1].close * 1.01;
      candles[i].open = candles[i - 1].close * 0.998;
      candles[i].high = candles[i].close * 1.01;
      candles[i].low = candles[i].open * 0.992;
      candles[i].volume = avgVolume * 1.15;
    }
    for (let i = last - 3; i <= last - 1; i += 1) {
      candles[i].close = candles[i - 1].close * 0.988;
      candles[i].open = candles[i - 1].close * 0.998;
      candles[i].high = candles[i].open * 1.003;
      candles[i].low = candles[i].close * 0.994;
      candles[i].volume = avgVolume * 0.8;
    }
    candles[last].open = candles[last - 1].close * 0.997;
    candles[last].close = candles[last - 1].close * 1.018;
    candles[last].high = candles[last].close * 1.008;
    candles[last].low = Math.min(candles[last].open, candles[last].close) * 0.994;
    candles[last].volume = avgVolume * 1.3;
  }

  if (profile === "divBull") {
    const a = last - 13;
    const b = last - 4;
    candles[a].low *= 0.965;
    candles[a].close = candles[a].low * 1.015;
    candles[a].volume = avgVolume * 1.25;
    candles[b].low = candles[a].low * 0.987;
    candles[b].close = candles[b].low * 1.025;
    candles[b].volume = avgVolume * 1.35;
    for (let i = b + 1; i <= last; i += 1) {
      candles[i].close = candles[i - 1].close * 1.011;
      candles[i].high = candles[i].close * 1.008;
      candles[i].low = Math.min(candles[i].open, candles[i].close) * 0.995;
    }
  }

  if (profile === "divBear") {
    const a = last - 12;
    const b = last - 4;
    candles[a].high *= 1.028;
    candles[a].close = candles[a].high * 0.985;
    candles[a].volume = avgVolume * 1.2;
    candles[b].high = candles[a].high * 1.01;
    candles[b].close = candles[b].high * 0.98;
    candles[b].volume = avgVolume * 1.25;
    for (let i = b + 1; i <= last; i += 1) {
      candles[i].close = candles[i - 1].close * 0.992;
      candles[i].high = Math.max(candles[i].open, candles[i].close) * 1.004;
      candles[i].low = candles[i].close * 0.992;
    }
  }

  if (profile === "adxBull") {
    for (let i = last - 9; i <= last; i += 1) {
      candles[i].close = candles[i - 1].close * 1.014;
      candles[i].open = candles[i - 1].close * 1.002;
      candles[i].high = candles[i].close * 1.009;
      candles[i].low = candles[i].open * 0.995;
      candles[i].volume = avgVolume * 1.25;
    }
  }

  if (profile === "adxBear") {
    for (let i = last - 9; i <= last; i += 1) {
      candles[i].close = candles[i - 1].close * 0.986;
      candles[i].open = candles[i - 1].close * 0.998;
      candles[i].high = candles[i].open * 1.004;
      candles[i].low = candles[i].close * 0.992;
      candles[i].volume = avgVolume * 1.2;
    }
  }

  if (profile === "obv") {
    for (let i = last - 19; i <= last; i += 1) {
      const flatMove = i % 2 === 0 ? 1.0035 : 0.998;
      candles[i].close = candles[i - 1].close * flatMove;
      candles[i].open = candles[i - 1].close * (i % 2 === 0 ? 0.999 : 1.001);
      candles[i].high = Math.max(candles[i].open, candles[i].close) * 1.006;
      candles[i].low = Math.min(candles[i].open, candles[i].close) * 0.994;
      candles[i].volume = avgVolume * (i % 2 === 0 ? 1.45 : 0.82);
    }
  }

  if (profile === "liquidityBull") {
    const pivot = last - 5;
    const referenceLow = Math.min(...candles.slice(last - 12, last - 6).map((candle) => candle.low));
    candles[pivot].low = referenceLow * 0.985;
    candles[pivot].close = referenceLow * 1.01;
    candles[pivot].open = referenceLow * 0.998;
    candles[pivot].high = candles[pivot].close * 1.012;
    candles[pivot].volume = avgVolume * 1.7;
    for (let i = pivot + 1; i <= last; i += 1) {
      candles[i].close = candles[i - 1].close * 1.011;
      candles[i].open = candles[i - 1].close * 0.999;
      candles[i].high = candles[i].close * 1.007;
      candles[i].low = candles[i].open * 0.995;
      candles[i].volume = avgVolume * 1.1;
    }
  }
}

function buildIndexSeries() {
  return INDEX_CONFIG.map((config) => {
    const candles = generateCandleSeries(`index-${config.name}`, config.base, config.drift, config.vol, 1, "momentum");
    const closes = candles.map((candle) => candle.close);
    const ema20Series = ema(closes, 20);
    const ema50Series = ema(closes, 50);
    const ema200Series = ema(closes, 200);
    const close = latest(closes);
    const summary = [];

    if (close > latest(ema20Series) && close > latest(ema50Series) && close > latest(ema200Series)) {
      summary.push(`${config.name} is above its 20, 50, and 200 EMA, which suggests strong trend alignment across short, medium, and long-term structure.`);
    } else if (close < latest(ema20Series) && close > latest(ema200Series)) {
      summary.push(`${config.name} is below the 20 EMA but above the 200 EMA, which suggests short-term weakness inside a broader uptrend.`);
    } else {
      summary.push(`${config.name} has mixed EMA alignment, which suggests a less decisive trend structure right now.`);
    }

    return {
      name: config.name,
      currentPrice: close,
      changePct: performance(closes, 1),
      perf1D: performance(closes, 1),
      perf5D: performance(closes, 5),
      perf20D: performance(closes, 20),
      ema20: latest(ema20Series),
      ema50: latest(ema50Series),
      ema200: latest(ema200Series),
      trendState: close > latest(ema20Series) && latest(ema20Series) > latest(ema50Series) ? "Bullish" : "Mixed",
      above20: close > latest(ema20Series),
      above50: close > latest(ema50Series),
      above200: close > latest(ema200Series),
      summary: summary.join(" "),
      sparkline: closes.slice(-24)
    };
  });
}

function buildStocks(indexes) {
  const nifty20D = indexes.find((item) => item.name === "Nifty 50")?.perf20D ?? 0;

  return STOCK_CATALOG.map((meta, index) => {
    const seed = `${meta.symbol}-${meta.sector}`;
    const rng = createSeededRandom(seed);
    const basePrice = clamp(60 + (rng() * 4200), 60, 4500);
    const avgVolume = 800000 + (rng() * 6000000);
    const candles = generateCandleSeries(
      seed,
      basePrice,
      baseSectorDrift(meta.sector) + ((rng() - 0.5) * 0.0005),
      0.016 + (rng() * 0.012),
      avgVolume,
      PROFILE_MAP[meta.symbol] || (index % 9 === 0 ? "momentum" : null)
    );

    const closes = candles.map((candle) => candle.close);
    const ema20Series = ema(closes, 20);
    const ema50Series = ema(closes, 50);
    const ema200Series = ema(closes, 200);
    const rsiSeries = rsi(closes);
    const adxState = adxDmi(candles);
    const obvSeries = obv(candles);
    const close = latest(closes);
    const ema20 = latest(ema20Series);
    const ema50 = latest(ema50Series);
    const ema200 = latest(ema200Series);
    const perf20 = performance(closes, 20);
    const relStrengthScore = relativeStrengthScore(perf20, nifty20D);
    const trendState = deriveTrendState({
      close,
      ema20,
      ema50,
      ema200,
      adx: adxState.adx
    });

    return {
      ...meta,
      tvSymbol: `NSE:${meta.symbol}`,
      candles,
      close,
      perf1D: performance(closes, 1),
      perf5D: performance(closes, 5),
      perf20D: perf20,
      ema20,
      ema50,
      ema200,
      ema20Series,
      ema50Series,
      ema200Series,
      above20: close > ema20,
      above50: close > ema50,
      above200: close > ema200,
      volumeRatio: volumeRatio(candles),
      avgDailyVolume: average(candles.slice(-20).map((candle) => candle.volume)),
      rsi: latest(rsiSeries),
      rsiSeries,
      adx: adxState.adx,
      prevAdx: adxState.prevAdx,
      plusDi: adxState.plusDi,
      minusDi: adxState.minusDi,
      prevPlusDi: adxState.prevPlusDi,
      prevMinusDi: adxState.prevMinusDi,
      adxThreshold: 23,
      atrPercent: atrPercent(candles),
      obvSeries,
      relativeStrengthScore: relStrengthScore,
      trendState,
      trendScore: clamp(
        (close > ema20 ? 22 : 6) +
        (close > ema50 ? 24 : 6) +
        (close > ema200 ? 26 : 6) +
        (ema20 > ema50 ? 14 : 4) +
        (ema50 > ema200 ? 14 : 4),
        0,
        100
      ),
      volumeScore: clamp(stockVolumeScore(candles), 0, 100),
      adxScore: clamp((adxState.adx * 2.6) + (adxState.plusDi > adxState.minusDi ? 10 : 0), 0, 100),
      plainEnglish: `${meta.company} is in ${trendState.toLowerCase()} structure with ${formatPercent(perf20, 1)} 20-day performance and volume running at ${average([volumeRatio(candles), 1]).toFixed(1)}x normal participation.`,
      sparkline: closes.slice(-24)
    };
  });
}

function stockVolumeScore(candles) {
  const ratio = volumeRatio(candles);
  return (ratio * 38) + 22;
}

function buildBreadth(stocks) {
  const advancing = stocks.filter((stock) => stock.perf1D > 0).length;
  const declining = stocks.length - advancing;
  const ratio = declining === 0 ? advancing : advancing / declining;
  const above50 = (stocks.filter((stock) => stock.above50).length / stocks.length) * 100;
  const above200 = (stocks.filter((stock) => stock.above200).length / stocks.length) * 100;

  let commentary = "Breadth is balanced, so index moves deserve confirmation from stock participation.";
  if (ratio > 1.35 && above50 > 60) {
    commentary = "Strong breadth means the rally is supported by many stocks, not just a few large names.";
  } else if (ratio < 0.85 && above50 < 50) {
    commentary = "Weak breadth means the index may be rising while many stocks are lagging.";
  }

  return {
    advanceDeclineRatio: ratio,
    advancing,
    declining,
    above50Pct: above50,
    above200Pct: above200,
    commentary
  };
}

function buildSectors(stocks) {
  return SECTORS.map((sector) => {
    const members = stocks.filter((stock) => stock.sector === sector);
    const oneDay = average(members.map((member) => member.perf1D));
    const fiveDay = average(members.map((member) => member.perf5D));
    const twentyDay = average(members.map((member) => member.perf20D));
    const relativeStrength = average(members.map((member) => member.relativeStrengthScore));
    const volumeExpansionScore = average(members.map((member) => member.volumeScore));
    const trendScore = average(members.map((member) => member.trendScore));
    const compositeScore = clamp(
      (relativeStrength * 0.32) +
      (volumeExpansionScore * 0.18) +
      (trendScore * 0.3) +
      (clamp((oneDay * 10) + 50, 0, 100) * 0.06) +
      (clamp((fiveDay * 5) + 50, 0, 100) * 0.06) +
      (clamp((twentyDay * 3) + 50, 0, 100) * 0.08),
      0,
      100
    );

    return {
      name: sector,
      perf1D: oneDay,
      perf5D: fiveDay,
      perf20D: twentyDay,
      relativeStrengthScore: relativeStrength,
      volumeExpansionScore,
      trendScore,
      compositeScore,
      note: compositeScore > 70
        ? "Sector strength helps identify where institutional money may be flowing."
        : "A stock from a weak sector usually needs stronger individual confirmation."
    };
  }).sort((a, b) => b.compositeScore - a.compositeScore);
}

function buildFuturesOI(stocks) {
  const rows = stocks
    .filter((stock) => stock.futuresEligible)
    .map((stock) => {
      const rng = createSeededRandom(`oi-${stock.symbol}`);
      const spotPrice = stock.close;
      const futuresPrice = spotPrice * (1 + ((rng() - 0.45) * 0.01));
      const currentOi = Math.round(200000 + (rng() * 4000000));
      const oiChangePct = ((rng() - 0.3) * 18);
      const priceChangePct = stock.perf1D;
      const interpretation = interpretOi(priceChangePct, oiChangePct);

      return {
        symbol: stock.symbol,
        company: stock.company,
        futuresPrice,
        spotPrice,
        premiumDiscountPct: ((futuresPrice / spotPrice) - 1) * 100,
        currentOi,
        oiChangePct,
        priceChangePct,
        interpretationLabel: interpretation.label,
        interpretationText: interpretation.text,
        volume: Math.round(stock.avgDailyVolume * (0.28 + (rng() * 0.42))),
        deliveryPlaceholder: `${Math.round(28 + (rng() * 33))}% delivery placeholder`,
        rolloverNotes: pick([
          "Rollover watchlist placeholder for expiry week.",
          "Monitor whether fresh participation carries into next series.",
          "No rollover anomaly flagged in mock environment."
        ], rng),
        contextScore: interpretation.score
      };
    })
    .sort((a, b) => b.contextScore - a.contextScore);

  return new Map(rows.map((row) => [row.symbol, row]));
}

function interpretOi(priceChangePct, oiChangePct) {
  if (priceChangePct > 0 && oiChangePct > 0) {
    return {
      label: "Long build-up",
      text: "Price rose while open interest also increased, suggesting new long positions may be getting added.",
      score: 82
    };
  }
  if (priceChangePct < 0 && oiChangePct > 0) {
    return {
      label: "Short build-up",
      text: "Price fell while OI rose, suggesting fresh shorts may be entering.",
      score: 68
    };
  }
  if (priceChangePct > 0 && oiChangePct < 0) {
    return {
      label: "Short covering",
      text: "Price rose while OI fell, suggesting short covering rather than aggressive new buying.",
      score: 58
    };
  }
  return {
    label: "Long unwinding",
    text: "Price fell while OI fell, suggesting older long positions may be getting closed.",
    score: 42
  };
}

function buildNews(stocks) {
  const rng = createSeededRandom("news-engine");
  const categories = [
    "Earnings",
    "Order wins",
    "Bulk/block deals",
    "Promoter activity",
    "Stake sales / pledges",
    "Management commentary",
    "Regulatory actions",
    "RBI / macro events",
    "Commodity-sensitive news",
    "Government policy"
  ];
  const templates = {
    Earnings: "Quarterly update points to better margin discipline and stronger guidance focus.",
    "Order wins": "Large order wins may support momentum if the market believes earnings visibility improves.",
    "Bulk/block deals": "Large transactions can shift short-term sentiment and liquidity expectations.",
    "Promoter activity": "Promoter buying can help confidence; repeated selling can pressure sentiment.",
    "Stake sales / pledges": "Funding-related activity can affect risk perception even if fundamentals are unchanged.",
    "Management commentary": "Tone on demand, margin, and capex often matters more than the headline number.",
    "Regulatory actions": "Regulatory overhang can cap upside until clarity improves.",
    "RBI / macro events": "Macro-sensitive sectors can reprice quickly when rates or liquidity expectations shift.",
    "Commodity-sensitive news": "Input-cost and realizations commentary matters most for metals, energy, and industrials.",
    "Government policy": "Policy changes can re-rate entire sectors before single-stock numbers catch up."
  };

  return sample(stocks, 12, rng).map((stock, index) => {
    const category = pick(categories, rng);
    const importanceScore = Math.round(45 + (rng() * 50));
    const impact = importanceScore > 75
      ? pick(["Bullish", "Bearish"], rng)
      : pick(["Bullish", "Bearish", "Neutral"], rng);
    return {
      id: `news-${index + 1}`,
      headline: `${stock.company}: ${category} update moves onto trader radar`,
      ticker: stock.symbol,
      timestamp: dateDaysAgo(Math.floor(rng() * 3)),
      category,
      importanceScore,
      whyItMatters: templates[category],
      impact,
      context: `${stock.company} is being tracked because ${templates[category].toLowerCase()}`,
      sector: stock.sector
    };
  }).sort((a, b) => b.importanceScore - a.importanceScore);
}

function buildJournal(stocks) {
  const rng = createSeededRandom("journal");
  const setupTypes = [
    "Momentum Breakout",
    "Pullback In Trend",
    "RSI Bullish Divergence",
    "ADX Expansion",
    "Liquidity Sweep Reversal"
  ];
  const emotions = ["Calm", "Focused", "Impatient", "Confident", "Hesitant"];
  const mistakes = ["None", "Late entry", "Stop moved", "Ignored breadth", "Oversized", "Exited too early"];

  const entries = sample(stocks, 14, rng).map((stock, index) => {
    const setupType = pick(setupTypes, rng);
    const entry = stock.close * (0.99 + (rng() * 0.03));
    const stop = entry * (0.965 + (rng() * 0.015));
    const exit = entry * (0.96 + (rng() * 0.12));
    const risk = entry - stop;
    const resultR = (exit - entry) / Math.max(risk, 0.01);
    return {
      date: dateDaysAgo(2 + index),
      symbol: stock.symbol,
      setupType,
      whyTaken: `${setupType} with ${stock.trendState.toLowerCase()} context and sector support.`,
      entry,
      stop,
      exit,
      resultR,
      note: pick(mistakes, rng),
      screenshot: "Screenshot placeholder",
      emotionalState: pick(emotions, rng),
      matchedRules: rng() > 0.25
    };
  });

  const bySetup = setupTypes.map((setupType) => {
    const matches = entries.filter((entry) => entry.setupType === setupType);
    const wins = matches.filter((entry) => entry.resultR > 0).length;
    const totalR = sumResults(matches);
    return {
      setupType,
      winRate: matches.length ? (wins / matches.length) * 100 : 0,
      avgR: matches.length ? totalR / matches.length : 0
    };
  });

  const grossProfit = sumResults(entries.filter((entry) => entry.resultR > 0));
  const grossLoss = Math.abs(sumResults(entries.filter((entry) => entry.resultR < 0)));

  return {
    entries,
    analytics: {
      bySetup,
      bestSetup: bySetup.slice().sort((a, b) => b.avgR - a.avgR)[0],
      worstSetup: bySetup.slice().sort((a, b) => a.avgR - b.avgR)[0],
      winRate: (entries.filter((entry) => entry.resultR > 0).length / entries.length) * 100,
      profitFactor: grossLoss === 0 ? 0 : grossProfit / grossLoss,
      expectancy: sumResults(entries) / entries.length,
      commonMistakes: topMistakes(entries)
    }
  };
}

function sumResults(entries) {
  return entries.reduce((total, entry) => total + entry.resultR, 0);
}

function topMistakes(entries) {
  const counts = new Map();
  entries.forEach((entry) => {
    counts.set(entry.note, (counts.get(entry.note) || 0) + 1);
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => `${name} (${count})`);
}

export function buildTerminalDataset() {
  const indexes = buildIndexSeries();
  const stocks = buildStocks(indexes);
  const breadth = buildBreadth(stocks);
  const sectors = buildSectors(stocks);
  const futuresMap = buildFuturesOI(stocks);
  const futuresRows = [...futuresMap.values()];
  const news = buildNews(stocks);
  const newsMap = new Map(news.map((item) => [item.ticker, item]));
  return {
    generatedAt: new Date().toISOString(),
    indexes,
    breadth,
    sectors,
    stocks,
    futuresRows,
    futuresMap,
    news,
    newsMap,
    journal: buildJournal(stocks),
    accounts: {
      capital: 1500000,
      maxRiskPct: 1
    }
  };
}
