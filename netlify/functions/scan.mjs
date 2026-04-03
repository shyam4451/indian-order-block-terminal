const NSE_EQUITY_CSV_URL = "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv";

const TIMEFRAMES = [
  { name: "4H", interval: "1h", range: "60d", synthetic4h: true },
  { name: "Daily", interval: "1d", range: "2y" },
  { name: "Weekly", interval: "1wk", range: "5y" }
];

const NIFTY50 = [
  "ADANIENT.NS", "ADANIPORTS.NS", "APOLLOHOSP.NS", "ASIANPAINT.NS", "AXISBANK.NS", "BAJAJ-AUTO.NS",
  "BAJFINANCE.NS", "BAJAJFINSV.NS", "BEL.NS", "BHARTIARTL.NS", "BPCL.NS", "BRITANNIA.NS", "CIPLA.NS",
  "COALINDIA.NS", "DRREDDY.NS", "EICHERMOT.NS", "ETERNAL.NS", "GRASIM.NS", "HCLTECH.NS", "HDFCBANK.NS",
  "HDFCLIFE.NS", "HEROMOTOCO.NS", "HINDALCO.NS", "HINDUNILVR.NS", "ICICIBANK.NS", "INDUSINDBK.NS",
  "INFY.NS", "ITC.NS", "JIOFIN.NS", "JSWSTEEL.NS", "KOTAKBANK.NS", "LT.NS", "M&M.NS", "MARUTI.NS",
  "NESTLEIND.NS", "NTPC.NS", "ONGC.NS", "POWERGRID.NS", "RELIANCE.NS", "SBILIFE.NS", "SBIN.NS",
  "SHRIRAMFIN.NS", "SUNPHARMA.NS", "TATACONSUM.NS", "TATAMOTORS.NS", "TATASTEEL.NS", "TCS.NS",
  "TECHM.NS", "TITAN.NS", "TRENT.NS", "ULTRACEMCO.NS", "WIPRO.NS"
];

const FNO_STOCKS = [
  "RELIANCE.NS", "HDFCBANK.NS", "ICICIBANK.NS", "SBIN.NS", "INFY.NS", "TCS.NS", "AXISBANK.NS",
  "LT.NS", "ITC.NS", "BHARTIARTL.NS", "TATAMOTORS.NS", "MARUTI.NS", "SUNPHARMA.NS", "BAJFINANCE.NS",
  "KOTAKBANK.NS", "HINDUNILVR.NS", "ULTRACEMCO.NS", "ADANIENT.NS", "ADANIPORTS.NS", "TATASTEEL.NS",
  "JSWSTEEL.NS", "HINDALCO.NS", "POWERGRID.NS", "ONGC.NS", "NTPC.NS", "COALINDIA.NS", "DRREDDY.NS",
  "CIPLA.NS", "EICHERMOT.NS", "GRASIM.NS"
];

const INDEX_INSTRUMENTS = [
  {
    name: "NIFTY 50",
    sourceSymbol: "^NSEI",
    tvSymbol: "NSE:NIFTY1!",
    cashTvSymbol: "NSE:NIFTY"
  },
  {
    name: "BANK NIFTY",
    sourceSymbol: "^NSEBANK",
    tvSymbol: "NSE:BANKNIFTY1!",
    cashTvSymbol: "NSE:BANKNIFTY"
  },
  {
    name: "FIN NIFTY",
    sourceSymbol: "NIFTYFINSRV25_50.NS",
    tvSymbol: "NSE:FINNIFTY1!",
    cashTvSymbol: "NSE:NIFTYFINSRV25_50"
  },
  {
    name: "MIDCAP NIFTY",
    sourceSymbol: "NIFTY_MID_SELECT.NS",
    tvSymbol: "NSE:MIDCPNIFTY1!",
    cashTvSymbol: "NSE:NIFTY_MID_SELECT"
  }
];

function csvToRows(text) {
  const [headerLine, ...lines] = text.trim().split(/\r?\n/);
  const headers = headerLine.split(",").map((item) => item.trim().replace(/^"|"$/g, ""));
  return lines.map((line) => {
    const columns = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
    return headers.reduce((record, header, index) => {
      record[header] = (columns[index] || "").replace(/^"|"$/g, "").trim();
      return record;
    }, {});
  });
}

async function fetchNseSymbols(limit = 100) {
  const response = await fetch(NSE_EQUITY_CSV_URL, {
    headers: { "user-agent": "Mozilla/5.0" }
  });
  if (!response.ok) {
    throw new Error(`NSE symbol download failed: ${response.status}`);
  }

  const rows = csvToRows(await response.text());
  return rows
    .filter((row) => row.SERIES === "EQ" && row.SYMBOL)
    .map((row) => `${row.SYMBOL}.NS`)
    .slice(0, limit);
}

async function fetchYahooCandles(symbol, interval, range) {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set("interval", interval);
  url.searchParams.set("range", range);
  url.searchParams.set("includePrePost", "false");
  url.searchParams.set("events", "div,splits");

  const response = await fetch(url.toString(), {
    headers: { "user-agent": "Mozilla/5.0" }
  });

  if (!response.ok) {
    throw new Error(`Yahoo chart request failed for ${symbol}: ${response.status}`);
  }

  const payload = await response.json();
  const result = payload?.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  if (!result || !quote || !Array.isArray(result.timestamp)) {
    return [];
  }

  const rows = [];
  result.timestamp.forEach((timestamp, index) => {
    const open = quote.open?.[index];
    const high = quote.high?.[index];
    const low = quote.low?.[index];
    const close = quote.close?.[index];
    const volume = quote.volume?.[index] ?? 0;
    if ([open, high, low, close].some((value) => value === null || value === undefined)) {
      return;
    }
    rows.push({
      datetime: new Date(timestamp * 1000).toISOString(),
      open,
      high,
      low,
      close,
      volume
    });
  });

  return rows;
}

function buildSynthetic4H(rows) {
  const sessions = new Map();
  rows.forEach((row) => {
    const key = row.datetime.slice(0, 10);
    if (!sessions.has(key)) {
      sessions.set(key, []);
    }
    sessions.get(key).push(row);
  });

  const blocks = [];
  [...sessions.values()].forEach((session) => {
    session.sort((a, b) => a.datetime.localeCompare(b.datetime));
    for (let i = 0; i < session.length; i += 4) {
      const block = session.slice(i, i + 4);
      if (block.length < 2) {
        continue;
      }
      blocks.push({
        datetime: block[block.length - 1].datetime,
        open: block[0].open,
        high: Math.max(...block.map((item) => item.high)),
        low: Math.min(...block.map((item) => item.low)),
        close: block[block.length - 1].close,
        volume: block.reduce((sum, item) => sum + (item.volume || 0), 0)
      });
    }
  });

  return blocks;
}

function rollingAverage(values, window) {
  return values.map((_, index) => {
    if (index + 1 < window) {
      return null;
    }
    const slice = values.slice(index + 1 - window, index + 1);
    return slice.reduce((sum, value) => sum + value, 0) / slice.length;
  });
}

function computeRsi(closes, period = 14) {
  const gains = [];
  const losses = [];
  for (let i = 0; i < closes.length; i += 1) {
    const delta = i === 0 ? 0 : closes[i] - closes[i - 1];
    gains.push(Math.max(delta, 0));
    losses.push(Math.max(-delta, 0));
  }

  const rsi = Array(closes.length).fill(50);
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i < closes.length; i += 1) {
    if (i <= period) {
      avgGain += gains[i];
      avgLoss += losses[i];
      if (i === period) {
        avgGain /= period;
        avgLoss /= period;
      }
      continue;
    }

    avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
    avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;
    if (avgLoss === 0) {
      rsi[i] = 100;
      continue;
    }
    const rs = avgGain / avgLoss;
    rsi[i] = 100 - (100 / (1 + rs));
  }

  return rsi;
}

function pivotLows(values, window = 3) {
  const points = [];
  for (let i = window; i < values.length - window; i += 1) {
    const value = values[i];
    const left = values.slice(i - window, i);
    const right = values.slice(i + 1, i + window + 1);
    if (value <= Math.min(...left) && value <= Math.min(...right)) {
      points.push(i);
    }
  }
  return points;
}

function pivotHighs(values, window = 3) {
  const points = [];
  for (let i = window; i < values.length - window; i += 1) {
    const value = values[i];
    const left = values.slice(i - window, i);
    const right = values.slice(i + 1, i + window + 1);
    if (value >= Math.max(...left) && value >= Math.max(...right)) {
      points.push(i);
    }
  }
  return points;
}

function detectRsiDivergence(rows) {
  if (rows.length < 40) {
    return null;
  }

  const lows = rows.map((row) => row.low);
  const highs = rows.map((row) => row.high);
  const rsi = computeRsi(rows.map((row) => row.close));
  const lowPivots = pivotLows(lows);
  const highPivots = pivotHighs(highs);

  if (lowPivots.length >= 2) {
    const first = lowPivots[lowPivots.length - 2];
    const second = lowPivots[lowPivots.length - 1];
    if (lows[second] < lows[first] && rsi[second] > rsi[first]) {
      return { type: "bullish", at: rows[second].datetime };
    }
  }

  if (highPivots.length >= 2) {
    const first = highPivots[highPivots.length - 2];
    const second = highPivots[highPivots.length - 1];
    if (highs[second] > highs[first] && rsi[second] < rsi[first]) {
      return { type: "bearish", at: rows[second].datetime };
    }
  }

  return null;
}

function findOrderBlocks(rows, impulseThreshold = 1.5, lookback = 20, searchBack = 6) {
  if (rows.length < lookback + 10) {
    return [];
  }

  const ranges = rows.map((row) => Math.max(0, row.high - row.low));
  const bodies = rows.map((row) => Math.abs(row.close - row.open));
  const avgRanges = rollingAverage(ranges, 10);
  const zones = [];

  for (let idx = lookback; idx < rows.length; idx += 1) {
    const row = rows[idx];
    const avgRange = avgRanges[idx];
    if (!avgRange) {
      continue;
    }

    const priorHigh = Math.max(...rows.slice(idx - lookback, idx).map((item) => item.high));
    const priorLow = Math.min(...rows.slice(idx - lookback, idx).map((item) => item.low));
    const bullishBreak = row.close > priorHigh && bodies[idx] >= avgRange * impulseThreshold;
    const bearishBreak = row.close < priorLow && bodies[idx] >= avgRange * impulseThreshold;

    if (!bullishBreak && !bearishBreak) {
      continue;
    }

    const candidates = rows.slice(Math.max(0, idx - searchBack), idx);
    if (bullishBreak) {
      const source = [...candidates].reverse().find((item) => item.close < item.open);
      if (source) {
        zones.push({
          direction: "bullish",
          formedAt: source.datetime,
          zoneLow: source.low,
          zoneHigh: source.open
        });
      }
    }

    if (bearishBreak) {
      const source = [...candidates].reverse().find((item) => item.close > item.open);
      if (source) {
        zones.push({
          direction: "bearish",
          formedAt: source.datetime,
          zoneLow: source.open,
          zoneHigh: source.high
        });
      }
    }
  }

  const unique = [];
  const seen = new Set();
  [...zones].reverse().forEach((zone) => {
    const key = `${zone.direction}:${zone.zoneLow.toFixed(2)}:${zone.zoneHigh.toFixed(2)}`;
    if (seen.has(key) || unique.length >= 5) {
      return;
    }
    seen.add(key);
    unique.push(zone);
  });

  return unique.reverse();
}

function distanceToZone(price, zoneLow, zoneHigh) {
  if (price >= zoneLow && price <= zoneHigh) {
    return { distancePct: 0, insideZone: "yes" };
  }
  if (price < zoneLow) {
    return { distancePct: ((zoneLow - price) / price) * 100, insideZone: "no" };
  }
  return { distancePct: ((price - zoneHigh) / price) * 100, insideZone: "no" };
}

function scoreMatch(distancePct, timeframe, divergence) {
  const timeframeWeight = { "4H": 1.0, Daily: 1.5, Weekly: 2.0 }[timeframe] || 1.0;
  const divergenceBonus = divergence ? 1 : 0;
  return Math.max(0, 5 - distancePct) * timeframeWeight + divergenceBonus;
}

async function scanInstrument(symbol, options = {}) {
  const {
    displayName = symbol,
    tvSymbol = `NSE:${symbol.replace(".NS", "")}`,
    cashTvSymbol = tvSymbol,
    proximity = 1,
    impulse = 1.5
  } = options;

  const matches = [];

  for (const timeframe of TIMEFRAMES) {
    let rows = await fetchYahooCandles(symbol, timeframe.interval, timeframe.range);
    if (timeframe.synthetic4h) {
      rows = buildSynthetic4H(rows);
    }
    if (!rows.length) {
      continue;
    }

    const currentPrice = rows[rows.length - 1].close;
    const zones = findOrderBlocks(rows, impulse);
    const divergence = detectRsiDivergence(rows);
    let best = null;

    zones.forEach((zone) => {
      const { distancePct, insideZone } = distanceToZone(currentPrice, zone.zoneLow, zone.zoneHigh);
      if (distancePct <= proximity || insideZone === "yes") {
        const candidate = {
          symbol,
          name: displayName,
          tvSymbol,
          cashTvSymbol,
          timeframe: timeframe.name,
          direction: zone.direction,
          currentPrice,
          zoneLow: Number(zone.zoneLow.toFixed(2)),
          zoneHigh: Number(zone.zoneHigh.toFixed(2)),
          distancePct: Number(distancePct.toFixed(2)),
          insideZone,
          divergence: divergence?.type || null,
          formedAt: zone.formedAt,
          score: Number(scoreMatch(distancePct, timeframe.name, divergence?.type).toFixed(2))
        };
        if (!best || candidate.distancePct < best.distancePct) {
          best = candidate;
        }
      }
    });

    if (best) {
      matches.push(best);
    }
  }

  return matches;
}

async function scanUniverse(symbols, options = {}) {
  const allMatches = [];
  const batches = [];
  for (let index = 0; index < symbols.length; index += 5) {
    batches.push(symbols.slice(index, index + 5));
  }

  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map((symbol) => scanInstrument(symbol, options).catch(() => []))
    );
    batchResults.forEach((instrumentMatches) => {
      allMatches.push(...instrumentMatches);
    });
  }

  const grouped = new Map();
  allMatches.forEach((match) => {
    const current = grouped.get(match.symbol) || [];
    current.push(match);
    grouped.set(match.symbol, current);
  });

  return [...grouped.values()]
    .map((items) => {
      const matchedTimeframes = items.length;
      const symbolScore = Number(items.reduce((sum, item) => sum + item.score, 0).toFixed(2));
      const divergenceBias = items.find((item) => item.divergence)?.divergence || "none";
      return items.map((item) => ({
        ...item,
        matchedTimeframes,
        symbolScore,
        divergenceBias
      }));
    })
    .flat()
    .sort((a, b) => {
      if (b.matchedTimeframes !== a.matchedTimeframes) return b.matchedTimeframes - a.matchedTimeframes;
      if (a.insideZone !== b.insideZone) return a.insideZone === "yes" ? -1 : 1;
      if (b.symbolScore !== a.symbolScore) return b.symbolScore - a.symbolScore;
      return a.distancePct - b.distancePct;
    });
}

function getUniverseLabel(universe) {
  return {
    nifty50: "Nifty 50",
    fno: "Liquid F&O Stocks",
    all: "NSE EQ Universe"
  }[universe] || "Custom";
}

export default async (request) => {
  try {
    const url = new URL(request.url);
    const universe = url.searchParams.get("universe") || "nifty50";
    const limit = Math.min(Number(url.searchParams.get("limit") || "80"), 500);
    const proximity = Number(url.searchParams.get("proximity") || "1");
    const impulse = Number(url.searchParams.get("impulse") || "1.5");
    const minTimeframes = Number(url.searchParams.get("minTimeframes") || "1");

    let stockSymbols;
    if (universe === "all") {
      stockSymbols = await fetchNseSymbols(limit);
    } else if (universe === "fno") {
      stockSymbols = FNO_STOCKS.slice(0, limit);
    } else {
      stockSymbols = NIFTY50.slice(0, limit);
    }

    const stocks = await scanUniverse(stockSymbols, { proximity, impulse });
    const filteredStocks = stocks.filter((row) => row.matchedTimeframes >= minTimeframes);

    const indexResults = await Promise.all(
      INDEX_INSTRUMENTS.map(async (indexInstrument) => {
        const matches = await scanInstrument(indexInstrument.sourceSymbol, {
          displayName: indexInstrument.name,
          tvSymbol: indexInstrument.tvSymbol,
          cashTvSymbol: indexInstrument.cashTvSymbol,
          proximity,
          impulse
        });
        const sorted = matches.sort((a, b) => b.score - a.score);
        const best = sorted[0];
        if (!best) {
          return null;
        }
        return {
          ...best,
          sourceSymbol: indexInstrument.sourceSymbol,
          matchedTimeframes: matches.length
        };
      })
    );

    const payload = {
      generatedAt: new Date().toISOString(),
      stocks: filteredStocks,
      indices: indexResults.filter(Boolean),
      meta: {
        scannedSymbols: stockSymbols.length,
        bullishDivergences: filteredStocks.filter((item) => item.divergenceBias === "bullish").length,
        universe,
        universeLabel: getUniverseLabel(universe)
      }
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Scan failed",
        details: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { "content-type": "application/json; charset=utf-8" }
      }
    );
  }
};
