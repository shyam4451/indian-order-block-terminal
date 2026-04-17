const NSE_EQUITY_CSV_URL = "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv";

const HTF_TIMEFRAMES = [
  { name: "Daily", interval: "1d", range: "2y", weight: 1.5 },
  { name: "Weekly", interval: "1wk", range: "5y", weight: 2.2 }
];

const LTF_TIMEFRAMES = [
  { name: "1H", interval: "1h", range: "60d", synthetic4h: false, weight: 1.0 },
  { name: "4H", interval: "1h", range: "60d", synthetic4h: true, weight: 1.35 }
];

const MARKET_TAPE_SYMBOLS = [
  { name: "NIFTY 50", symbol: "^NSEI" },
  { name: "BANK NIFTY", symbol: "^NSEBANK" },
  { name: "SENSEX", symbol: "^BSESN" },
  { name: "INDIA VIX", symbol: "^INDIAVIX" }
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
  { name: "NIFTY 50", sourceSymbol: "^NSEI", tvSymbol: "NSE:NIFTY1!" },
  { name: "BANK NIFTY", sourceSymbol: "^NSEBANK", tvSymbol: "NSE:BANKNIFTY1!" },
  { name: "FIN NIFTY", sourceSymbol: "NIFTYFINSRV25_50.NS", tvSymbol: "NSE:FINNIFTY1!" },
  { name: "MIDCAP NIFTY", sourceSymbol: "NIFTY_MID_SELECT.NS", tvSymbol: "NSE:MIDCPNIFTY1!" }
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
  const symbols = rows
    .filter((row) => row.SERIES === "EQ" && row.SYMBOL)
    .map((row) => `${row.SYMBOL}.NS`);

  if (limit >= symbols.length) {
    return symbols;
  }

  const sampled = [];
  const step = symbols.length / limit;
  for (let index = 0; index < limit; index += 1) {
    const pickIndex = Math.min(symbols.length - 1, Math.floor(index * step));
    sampled.push(symbols[pickIndex]);
  }
  return [...new Set(sampled)];
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

function nearZoneInteraction(row, zone, direction) {
  const padding = (zone.zoneHigh - zone.zoneLow) * 0.15;
  if (direction === "bullish") {
    return row.low <= zone.zoneHigh + padding && row.low >= zone.zoneLow - (padding * 2);
  }
  return row.high >= zone.zoneLow - padding && row.high <= zone.zoneHigh + (padding * 2);
}

function zoneWidthPct(zone, referencePrice) {
  if (!referencePrice) {
    return 0;
  }
  return ((zone.zoneHigh - zone.zoneLow) / referencePrice) * 100;
}

function findNearestOpposingZone(zones, currentPrice, direction) {
  if (direction === "bullish") {
    return zones
      .filter((zone) => zone.direction === "bearish" && zone.zoneLow > currentPrice)
      .sort((a, b) => a.zoneLow - b.zoneLow)[0] || null;
  }

  return zones
    .filter((zone) => zone.direction === "bullish" && zone.zoneHigh < currentPrice)
    .sort((a, b) => b.zoneHigh - a.zoneHigh)[0] || null;
}

function hasAdequateRoom(zone, opposingZone, currentPrice) {
  if (!opposingZone || !currentPrice) {
    return true;
  }

  const roomPct = zone.direction === "bullish"
    ? ((opposingZone.zoneLow - currentPrice) / currentPrice) * 100
    : ((currentPrice - opposingZone.zoneHigh) / currentPrice) * 100;

  const minimumRoomPct = Math.max(zoneWidthPct(zone, currentPrice) * 1.25, 1.1);
  return roomPct >= minimumRoomPct;
}

function zoneFreshnessBoost(formedAt, timeframeName) {
  const formedTs = Date.parse(formedAt || "");
  if (Number.isNaN(formedTs)) {
    return 0;
  }

  const ageDays = Math.max(0, (Date.now() - formedTs) / (1000 * 60 * 60 * 24));
  const horizon = timeframeName === "Weekly" ? 420 : 180;
  return Math.max(0, 1.6 - (ageDays / horizon) * 1.6);
}

function detectLowerTimeframeSweep(rows, zone, direction, lookback = 18, evaluationWindow = 8) {
  if (rows.length < lookback + 3) {
    return { confirmed: false, at: null };
  }

  const start = Math.max(lookback + 1, rows.length - evaluationWindow);
  for (let idx = rows.length - 1; idx >= start; idx -= 1) {
    const candle = rows[idx];
    const recent = rows.slice(idx - lookback, idx);
    if (!recent.length || !nearZoneInteraction(candle, zone, direction)) {
      continue;
    }

    if (direction === "bullish") {
      const priorSwingLow = Math.min(...recent.map((item) => item.low));
      const reclaimed = candle.low < priorSwingLow && candle.close > priorSwingLow;
      if (reclaimed) {
        return { confirmed: true, at: candle.datetime };
      }
      continue;
    }

    const priorSwingHigh = Math.max(...recent.map((item) => item.high));
    const reclaimed = candle.high > priorSwingHigh && candle.close < priorSwingHigh;
    if (reclaimed) {
      return { confirmed: true, at: candle.datetime };
    }
  }

  return { confirmed: false, at: null };
}

function detectLowerTimeframeConfirmation(rows, direction, sweepAt = null) {
  const filtered = sweepAt
    ? rows.filter((row) => row.datetime >= sweepAt)
    : rows;
  const sample = filtered.length >= 4 ? filtered.slice(-4) : filtered;

  if (sample.length < 2) {
    return false;
  }

  for (let index = 1; index < sample.length; index += 1) {
    const current = sample[index];
    const previous = sample[index - 1];
    if (direction === "bullish" && current.close > current.open && current.close > previous.high) {
      return true;
    }
    if (direction === "bearish" && current.close < current.open && current.close < previous.low) {
      return true;
    }
  }

  return false;
}

function deriveSetupState({ insideZone, sweepConfirmed, confirmationCandle, invalidated }) {
  if (invalidated) return "Invalidated";
  if (sweepConfirmed && confirmationCandle) return "LTF Confirmed";
  if (sweepConfirmed) return "LTF Sweep Seen";
  if (insideZone === "yes") return "At HTF Zone";
  return "Near HTF Zone";
}

function scoreCandidate(match) {
  const htfWeight = { Daily: 1.5, Weekly: 2.2 }[match.zoneTimeframe] || 1;
  const triggerWeight = { "1H": 1.0, "4H": 1.3, none: 0 }[match.triggerTimeframe || "none"] || 0;
  return Number((
    Math.max(0, 5 - match.distancePct) * htfWeight +
    (match.insideZone === "yes" ? 1.5 : 0.5) +
    (match.sweepConfirmed ? 2.5 : 0) +
    (match.confirmationCandle ? 1.75 : 0) +
    (match.hasOpposingRoom ? 1.2 : -2.5) +
    (match.roomPct !== null ? Math.min(match.roomPct, 4) * 0.35 : 0) +
    zoneFreshnessBoost(match.formedAt, match.zoneTimeframe) +
    triggerWeight
  ).toFixed(2));
}

function invalidationHit(price, zone, direction) {
  const buffer = Math.max((zone.zoneHigh - zone.zoneLow) * 0.12, price * 0.002);
  if (direction === "bullish") {
    return price < zone.zoneLow - buffer;
  }
  return price > zone.zoneHigh + buffer;
}

async function fetchYahooQuote(symbol) {
  const rows = await fetchYahooCandles(symbol, "1d", "5d");
  if (rows.length < 2) {
    return null;
  }
  const last = rows[rows.length - 1];
  const previous = rows[rows.length - 2];
  const change = last.close - previous.close;
  const changePct = previous.close ? (change / previous.close) * 100 : 0;
  return {
    symbol,
    price: Number(last.close.toFixed(2)),
    change: Number(change.toFixed(2)),
    changePct: Number(changePct.toFixed(2))
  };
}

async function fetchMarketTape() {
  const settled = await Promise.allSettled(
    MARKET_TAPE_SYMBOLS.map(async (item) => {
      const quote = await fetchYahooQuote(item.symbol);
      return quote ? { name: item.name, ...quote } : null;
    })
  );

  return settled
    .filter((item) => item.status === "fulfilled" && item.value)
    .map((item) => item.value);
}

function stripHtml(text) {
  return text
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRssItems(xml, limit = 6) {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  return items.slice(0, limit).map((item) => {
    const block = item[1];
    const title = stripHtml((block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "");
    const link = stripHtml((block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || "");
    const pubDate = stripHtml((block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || "");
    return { title, link, pubDate };
  }).filter((item) => item.title && item.link);
}

async function fetchNewsItems(symbols) {
  const queries = ["Nifty 50 Indian stock market", ...symbols.slice(0, 4).map((symbol) => symbol.replace(".NS", ""))];
  const settled = await Promise.allSettled(
    queries.map(async (query) => {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query + " NSE OR India stocks")}&hl=en-IN&gl=IN&ceid=IN:en`;
      const response = await fetch(url, {
        headers: { "user-agent": "Mozilla/5.0" }
      });
      if (!response.ok) {
        return [];
      }
      const xml = await response.text();
      return parseRssItems(xml, 2).map((item) => ({ ...item, sourceQuery: query }));
    })
  );

  return settled
    .filter((item) => item.status === "fulfilled")
    .flatMap((item) => item.value)
    .slice(0, 8);
}

async function scanInstrument(symbol, options = {}) {
  const {
    displayName = symbol,
    tvSymbol = `NSE:${symbol.replace(".NS", "")}`,
    proximity = 1,
    impulse = 1.5,
    allowedDirections = ["bullish", "bearish"]
  } = options;

  const ltfRowsByName = {};
  await Promise.all(
    LTF_TIMEFRAMES.map(async (timeframe) => {
      let rows = await fetchYahooCandles(symbol, timeframe.interval, timeframe.range);
      if (timeframe.synthetic4h) {
        rows = buildSynthetic4H(rows);
      }
      ltfRowsByName[timeframe.name] = rows;
    })
  );

  const matches = [];

  for (const timeframe of HTF_TIMEFRAMES) {
    const rows = await fetchYahooCandles(symbol, timeframe.interval, timeframe.range);
    if (!rows.length) {
      continue;
    }

    const currentPrice = rows[rows.length - 1].close;
    const zones = findOrderBlocks(rows, impulse);
    const directionalZones = zones.filter((zone) => allowedDirections.includes(zone.direction));
    let best = null;

    directionalZones.forEach((zone) => {
      const { distancePct, insideZone } = distanceToZone(currentPrice, zone.zoneLow, zone.zoneHigh);
      if (!(insideZone === "yes" || distancePct <= proximity)) {
        return;
      }

      const opposingZone = findNearestOpposingZone(zones, currentPrice, zone.direction);
      const roomPct = opposingZone
        ? Number((
          zone.direction === "bullish"
            ? ((opposingZone.zoneLow - currentPrice) / currentPrice) * 100
            : ((currentPrice - opposingZone.zoneHigh) / currentPrice) * 100
        ).toFixed(2))
        : null;
      const hasOpposingRoom = hasAdequateRoom(zone, opposingZone, currentPrice);
      if (!hasOpposingRoom) {
        return;
      }

      let triggerTimeframe = null;
      let sweepConfirmed = false;
      let confirmationCandle = false;
      let sweepAt = null;

      LTF_TIMEFRAMES.forEach((ltf) => {
        const triggerRows = ltfRowsByName[ltf.name] || [];
        if (!triggerRows.length) {
          return;
        }
        const sweep = detectLowerTimeframeSweep(triggerRows, zone, zone.direction);
        const confirmation = detectLowerTimeframeConfirmation(triggerRows, zone.direction, sweep.at);
        if (sweep.confirmed && (!triggerTimeframe || ltf.weight > ({ "1H": 1.0, "4H": 1.3 }[triggerTimeframe] || 0))) {
          triggerTimeframe = ltf.name;
          sweepConfirmed = true;
          confirmationCandle = confirmation;
          sweepAt = sweep.at;
        } else if (!triggerTimeframe && confirmation) {
          confirmationCandle = true;
        }
      });

      const invalidated = invalidationHit(currentPrice, zone, zone.direction);
      const candidate = {
        symbol,
        name: displayName,
        tvSymbol,
        timeframe: timeframe.name,
        zoneTimeframe: timeframe.name,
        triggerTimeframe: triggerTimeframe || "none",
        direction: zone.direction,
        currentPrice: Number(currentPrice.toFixed(2)),
        zoneLow: Number(zone.zoneLow.toFixed(2)),
        zoneHigh: Number(zone.zoneHigh.toFixed(2)),
        distancePct: Number(distancePct.toFixed(2)),
        insideZone,
        formedAt: zone.formedAt,
        roomPct,
        hasOpposingRoom,
        sweepConfirmed,
        sweepAt,
        confirmationCandle,
        invalidated
      };

      candidate.setupState = deriveSetupState(candidate);
      candidate.score = scoreCandidate(candidate);

      if (!best || candidate.score > best.score || (candidate.score === best.score && candidate.distancePct < best.distancePct)) {
        best = candidate;
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
  for (let index = 0; index < symbols.length; index += 6) {
    batches.push(symbols.slice(index, index + 6));
  }

  for (const batch of batches) {
    const batchResults = await Promise.all(batch.map((symbol) => scanInstrument(symbol, options).catch(() => [])));
    batchResults.forEach((instrumentMatches) => allMatches.push(...instrumentMatches));
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
      return items.map((item) => ({
        ...item,
        matchedTimeframes,
        symbolScore
      }));
    })
    .flat()
    .sort((a, b) => {
      const rank = {
        "LTF Confirmed": 5,
        "LTF Sweep Seen": 4,
        "At HTF Zone": 3,
        "Near HTF Zone": 2,
        Invalidated: 1
      };
      if ((rank[b.setupState] || 0) !== (rank[a.setupState] || 0)) return (rank[b.setupState] || 0) - (rank[a.setupState] || 0);
      if (b.symbolScore !== a.symbolScore) return b.symbolScore - a.symbolScore;
      return a.distancePct - b.distancePct;
    });
}

function getUniverseLabel(universe) {
  return {
    nifty50: "Nifty 50 Cash Watchlist",
    fno: "Liquid F&O Long / Short",
    all: "NSE Cash Universe"
  }[universe] || "Custom";
}

export default async (request) => {
  try {
    const url = new URL(request.url);
    const universe = url.searchParams.get("universe") || "nifty50";
    const requestedLimit = Math.min(Number(url.searchParams.get("limit") || "80"), 500);
    const proximity = Number(url.searchParams.get("proximity") || "1");
    const impulse = Number(url.searchParams.get("impulse") || "1.5");
    const minTimeframes = Number(url.searchParams.get("minTimeframes") || "1");

    const effectiveLimit = universe === "all" ? Math.min(requestedLimit, 150) : requestedLimit;
    const stockDirections = universe === "fno" ? ["bullish", "bearish"] : ["bullish"];

    let stockSymbols;
    if (universe === "all") {
      stockSymbols = await fetchNseSymbols(effectiveLimit);
    } else if (universe === "fno") {
      stockSymbols = FNO_STOCKS.slice(0, effectiveLimit);
    } else {
      stockSymbols = NIFTY50.slice(0, effectiveLimit);
    }

    const stocks = await scanUniverse(stockSymbols, {
      proximity,
      impulse,
      allowedDirections: stockDirections
    });
    const filteredStocks = stocks.filter((row) => row.matchedTimeframes >= minTimeframes);

    const indexResults = await Promise.all(
      INDEX_INSTRUMENTS.map(async (indexInstrument) => {
        const matches = await scanInstrument(indexInstrument.sourceSymbol, {
          displayName: indexInstrument.name,
          tvSymbol: indexInstrument.tvSymbol,
          proximity,
          impulse,
          allowedDirections: ["bullish", "bearish"]
        });
        const best = matches.sort((a, b) => b.score - a.score)[0];
        return best ? { ...best, sourceSymbol: indexInstrument.sourceSymbol } : null;
      })
    );

    const marketTape = await fetchMarketTape();
    const news = await fetchNewsItems(filteredStocks.map((item) => item.symbol));

    const note = universe === "all" && requestedLimit > effectiveLimit
      ? `Live NSE cash scans are capped at ${effectiveLimit} symbols on Netlify for stability.`
      : "HTF zones are defined on Daily/Weekly. Sweeps and confirms are searched on 1H/4H.";

    const payload = {
      generatedAt: new Date().toISOString(),
      stocks: filteredStocks,
      indices: indexResults.filter(Boolean),
      marketTape,
      news,
      meta: {
        scannedSymbols: stockSymbols.length,
        sweepSignals: filteredStocks.filter((item) => item.sweepConfirmed).length,
        confirmationSignals: filteredStocks.filter((item) => item.confirmationCandle).length,
        universe,
        universeLabel: getUniverseLabel(universe),
        note
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
