import {
  FNO_STOCKS,
  HTF_TIMEFRAMES,
  INDEX_INSTRUMENTS,
  LTF_TIMEFRAMES,
  NIFTY50,
  getDefaultDirections,
  getUniverseLabel
} from "./lib/constants.mjs";
import {
  buildSynthetic4H,
  fetchMarketTape,
  fetchNewsItems,
  fetchNseSymbols,
  fetchYahooCandles,
  resolveMarketType
} from "./lib/dataSources.mjs";
import { detectDivergence } from "./lib/divergenceEngine.mjs";
import { clamp, distanceToZone, round } from "./lib/helpers.mjs";
import { buildLevels, scoreSetup } from "./lib/scoringEngine.mjs";
import {
  buildExplanation,
  buildSignalRecord,
  buildTrendAlignment,
  buildWarnings,
  classifySetup,
  deriveSetupState
} from "./lib/setupEngine.mjs";
import { eligibleTriggerTimeframes, evaluateTrigger, pickBestTrigger } from "./lib/triggerEngine.mjs";
import {
  barsSinceLastZoneTouch,
  buildTrendContext,
  buildZones,
  favorableZonePosition,
  findNearestOpposingZone,
  hasAdequateRoom
} from "./lib/zoneEngine.mjs";

/**
 * @typedef {Object} ScanOptions
 * @property {number} proximity
 * @property {number} impulse
 * @property {string[]} allowedDirections
 * @property {string} universe
 * @property {string} marketType
 * @property {string} scalpMode
 * @property {string} scalpStyle
 * @property {number} pivotLength
 * @property {number} minPivotSpacing
 */

function buildPreview(rows, zone, levels, trigger, divergence) {
  const sample = rows.slice(-40);
  return {
    timeframe: zone.timeframe,
    candles: sample.map((row) => ({
      at: row.datetime,
      open: round(row.open),
      high: round(row.high),
      low: round(row.low),
      close: round(row.close)
    })),
    zoneLow: round(zone.zoneLow),
    zoneHigh: round(zone.zoneHigh),
    invalidation: levels.invalidation,
    target1: levels.target1,
    markers: {
      sweepAt: trigger?.sweep?.at || null,
      confirmationAt: trigger?.confirmation?.at || null,
      divergenceAt: divergence?.pivots?.price?.[1]?.at || null
    }
  };
}

function timeframeAllowed(timeframeName, scalpMode) {
  if (scalpMode === "only") {
    return timeframeName === "1H";
  }
  if (scalpMode === "off") {
    return timeframeName !== "1H";
  }
  return true;
}

function buildSetupCandidate({
  symbol,
  displayName,
  tvSymbol,
  marketType,
  timeframe,
  rows,
  zone,
  currentPrice,
  trigger,
  divergence,
  opposingZone,
  generatedAt
}) {
  const { distancePct, insideZone } = distanceToZone(currentPrice, zone.zoneLow, zone.zoneHigh);
  const levels = buildLevels({ currentPrice, zone, opposingZone });
  const invalidated = zone.direction === "bullish"
    ? currentPrice < levels.invalidation
    : currentPrice > levels.invalidation;
  const trendContext = buildTrendContext(rows);
  const trendAlignment = buildTrendAlignment({ direction: zone.direction, trendContext, zone });
  const mode = timeframe.mode;
  const setupType = classifySetup({ mode, zone, trigger, divergence });
  const setupState = deriveSetupState({ insideZone, trigger, invalidated });
  const score = scoreSetup({ zone, trigger, divergence, levels, trendAlignment });
  const warnings = buildWarnings({ zone, divergence, levels, opposingZone, trigger });
  const explanation = buildExplanation({ symbol, zone, trigger, divergence, levels, setupType, state: setupState });
  const preview = buildPreview(rows, zone, levels, trigger, divergence);
  const signal = buildSignalRecord({
    symbol,
    direction: zone.direction,
    setupType,
    score: score.total,
    divergence,
    levels,
    generatedAt,
    zone,
    trigger,
    marketType
  });

  return {
    symbol,
    name: displayName,
    tvSymbol,
    marketType,
    mode,
    direction: zone.direction,
    zoneType: zone.zoneType,
    zoneTimeframe: zone.timeframe,
    triggerTimeframe: trigger?.timeframe || "none",
    setupType,
    setupState,
    currentPrice: round(currentPrice),
    zoneLow: round(zone.zoneLow),
    zoneHigh: round(zone.zoneHigh),
    distancePct: round(distancePct),
    insideZone,
    timestamp: generatedAt,
    formedAt: zone.formedAt,
    freshness: zone.freshness,
    currentRangeRatio: trendContext.currentRangeRatio,
    zone,
    trigger,
    divergence,
    levels,
    score: score.total,
    scoreBreakdown: score.breakdown,
    strongestFactors: score.strongestFactors,
    warnings,
    explanation,
    preview,
    signal
  };
}

async function scanInstrument(symbol, options = {}) {
  const {
    displayName = symbol,
    tvSymbol = `NSE:${symbol.replace(".NS", "")}`,
    proximity = 1,
    impulse = 1.5,
    allowedDirections = ["bullish", "bearish"],
    universe = "all",
    scalpMode = "include",
    scalpStyle = "conservative",
    pivotLength = 3,
    minPivotSpacing = 5,
    generatedAt = new Date().toISOString()
  } = options;

  const marketType = options.marketType || resolveMarketType(symbol, universe);
  const isCashLongScan = marketType === "Cash" && allowedDirections.length === 1 && allowedDirections[0] === "bullish";
  const enabledHtfTimeframes = HTF_TIMEFRAMES.filter((timeframe) => timeframeAllowed(timeframe.name, scalpMode));
  const requiredTriggerNames = [...new Set(
    enabledHtfTimeframes.flatMap((timeframe) => eligibleTriggerTimeframes(timeframe.name, scalpStyle))
  )];
  const rowCache = new Map();
  const rawIntradayCache = new Map();

  async function getRows(timeframe) {
    if (rowCache.has(timeframe.name)) {
      return rowCache.get(timeframe.name);
    }

    let rows;
    if (timeframe.synthetic4h) {
      const rawKey = `${timeframe.interval}:${timeframe.range}`;
      let rawRows = rawIntradayCache.get(rawKey);
      if (!rawRows) {
        rawRows = await fetchYahooCandles(symbol, timeframe.interval, timeframe.range);
        rawIntradayCache.set(rawKey, rawRows);
      }
      rows = buildSynthetic4H(rawRows);
    } else {
      const cacheKey = `${timeframe.interval}:${timeframe.range}:${timeframe.name}`;
      if (rowCache.has(cacheKey)) {
        return rowCache.get(cacheKey);
      }
      rows = await fetchYahooCandles(symbol, timeframe.interval, timeframe.range);
      rowCache.set(cacheKey, rows);
    }

    rowCache.set(timeframe.name, rows);
    return rows;
  }

  const triggerRowsByName = {};
  await Promise.all(
    LTF_TIMEFRAMES.filter((timeframe) => requiredTriggerNames.includes(timeframe.name)).map(async (timeframe) => {
      triggerRowsByName[timeframe.name] = await getRows(timeframe);
    })
  );

  const matches = [];

  for (const timeframe of enabledHtfTimeframes) {
    const rows = await getRows(timeframe);
    if (!rows.length) {
      continue;
    }

    const currentPrice = rows[rows.length - 1].close;
    const trendContext = buildTrendContext(rows);
    const zoneImpulse = isCashLongScan ? Math.max(1.15, impulse - 0.2) : impulse;
    const zones = buildZones(rows, timeframe.name, zoneImpulse, {
      allowLooseDemand: isCashLongScan && timeframe.name !== "1H"
    }).filter((zone) => allowedDirections.includes(zone.direction));
    const triggerNames = eligibleTriggerTimeframes(timeframe.name, scalpStyle);
    let best = null;

    zones.forEach((zone) => {
      const { distancePct, insideZone } = distanceToZone(currentPrice, zone.zoneLow, zone.zoneHigh);
      const touchAge = barsSinceLastZoneTouch(rows, zone);
      const maxTouchAge = isCashLongScan
        ? (timeframe.name === "Weekly" ? 14 : timeframe.name === "1H" ? 16 : 14)
        : (timeframe.name === "Weekly" ? 8 : timeframe.name === "1H" ? 12 : 10);
      const effectiveProximity = isCashLongScan && zone.zoneType === "demand"
        ? Math.max(proximity, timeframe.name === "Weekly" ? 2.2 : 1.6)
        : proximity;
      if (!(insideZone === "yes" || distancePct <= effectiveProximity)) {
        return;
      }
      if (insideZone !== "yes" && touchAge > maxTouchAge) {
        return;
      }
      const allowLooseZonePosition = isCashLongScan && zone.zoneType === "demand";
      if (!favorableZonePosition(currentPrice, zone, zone.direction, allowLooseZonePosition)) {
        return;
      }
      if (zone.direction === "bullish" && trendContext.currentRangeRatio > (isCashLongScan ? 0.9 : (timeframe.name === "1H" ? 0.84 : 0.76))) {
        return;
      }
      if (zone.direction === "bearish" && trendContext.currentRangeRatio < (timeframe.name === "1H" ? 0.16 : 0.24)) {
        return;
      }

      const opposingZone = findNearestOpposingZone(zones, currentPrice, zone.direction);
      if (!hasAdequateRoom(zone, opposingZone, currentPrice, isCashLongScan)) {
        return;
      }

      const divergence = detectDivergence(rows, zone.direction, timeframe.name, {
        pivotLength,
        minPivotSpacing
      });

      const triggerResults = triggerNames.map((name) => {
        const triggerRows = triggerRowsByName[name] || [];
        if (!triggerRows.length) {
          return null;
        }
        return evaluateTrigger(triggerRows, zone, zone.direction, name, {
          evaluationWindow: timeframe.name === "1H" ? 12 : 10,
          lookback: timeframe.name === "1H" ? 16 : 18
        });
      });

      const trigger = pickBestTrigger(triggerResults) || {
        timeframe: "none",
        sweep: { detected: false, at: null, barsAgo: null, level: null, strength: 0 },
        bos: { detected: false, at: null, strength: 0 },
        confirmation: { detected: false, at: null, candleType: null },
        volume: { detected: false, ratio: null },
        quality: 0
      };

      const candidate = buildSetupCandidate({
        symbol,
        displayName,
        tvSymbol,
        marketType,
        timeframe,
        rows,
        zone,
        currentPrice,
        trigger,
        divergence,
        opposingZone,
        generatedAt
      });

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
  for (let index = 0; index < symbols.length; index += 4) {
    batches.push(symbols.slice(index, index + 4));
  }

  for (const batch of batches) {
    const batchResults = await Promise.all(batch.map((symbol) => scanInstrument(symbol, options).catch(() => [])));
    batchResults.forEach((matches) => allMatches.push(...matches));
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
      const symbolScore = round(items.reduce((sum, item) => sum + item.score, 0));
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
      if ((rank[b.setupState] || 0) !== (rank[a.setupState] || 0)) {
        return (rank[b.setupState] || 0) - (rank[a.setupState] || 0);
      }
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.distancePct - b.distancePct;
    });
}

function buildMarketOverview({ stocks, indices, marketTape }) {
  const combined = [...stocks, ...indices];
  const confirmedLongs = combined.filter((item) => item.direction === "bullish" && item.setupState === "LTF Confirmed").length;
  const confirmedShorts = combined.filter((item) => item.direction === "bearish" && item.setupState === "LTF Confirmed").length;
  const nearZoneWatchlist = combined.filter((item) => item.setupState === "At HTF Zone" || item.setupState === "Near HTF Zone").length;
  const divergenceSetups = combined.filter((item) => item.divergence).length;
  const scalpSetups = combined.filter((item) => item.mode === "Scalp").length;
  const strongestSetup = combined.sort((a, b) => b.score - a.score)[0] || null;
  const breadth = {
    advancing: marketTape.filter((item) => Number(item.change) > 0).length,
    declining: marketTape.filter((item) => Number(item.change) < 0).length
  };
  const bucketCounts = combined.reduce((accumulator, item) => {
    const key = item.marketType || "Other";
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});

  const nifty = marketTape.find((item) => item.name === "NIFTY 50");
  const vix = marketTape.find((item) => item.name === "INDIA VIX");
  const riskTone = nifty && vix
    ? (nifty.changePct >= 0 && vix.changePct <= 0 ? "Risk-On" : "Mixed")
    : "Mixed";

  return {
    confirmedLongs,
    confirmedShorts,
    nearZoneWatchlist,
    divergenceSetups,
    scalpSetups,
    strongestSetup: strongestSetup
      ? {
        symbol: strongestSetup.symbol,
        direction: strongestSetup.direction,
        setupType: strongestSetup.setupType,
        score: strongestSetup.score,
        reason: strongestSetup.explanation.reasons[0]
      }
      : null,
    breadth,
    riskTone,
    bucketCounts
  };
}

export default async (request) => {
  try {
    const url = new URL(request.url);
    const universe = url.searchParams.get("universe") || "nifty50";
    const requestedLimit = Math.min(Number(url.searchParams.get("limit") || "80"), 500);
    const proximity = Number(url.searchParams.get("proximity") || "1");
    const impulse = Number(url.searchParams.get("impulse") || "1.5");
    const minTimeframes = Number(url.searchParams.get("minTimeframes") || "1");
    const scalpMode = url.searchParams.get("scalpMode") || "include";
    const scalpStyle = url.searchParams.get("scalpStyle") || "conservative";
    const pivotLength = Number(url.searchParams.get("pivotLength") || "3");
    const minPivotSpacing = Number(url.searchParams.get("pivotSpacing") || "5");
    const generatedAt = new Date().toISOString();

    const effectiveLimit = universe === "all" ? Math.min(requestedLimit, 150) : requestedLimit;
    const allowedDirections = getDefaultDirections(universe);

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
      allowedDirections,
      universe,
      scalpMode,
      scalpStyle,
      pivotLength,
      minPivotSpacing,
      generatedAt
    });
    const filteredStocks = stocks.filter((item) => item.matchedTimeframes >= minTimeframes);

    const indexResults = await Promise.all(
      INDEX_INSTRUMENTS.map(async (instrument) => {
        const matches = await scanInstrument(instrument.sourceSymbol, {
          displayName: instrument.name,
          tvSymbol: instrument.tvSymbol,
          proximity,
          impulse,
          allowedDirections: ["bullish", "bearish"],
          universe: "fno",
          scalpMode,
          scalpStyle,
          pivotLength,
          minPivotSpacing,
          marketType: "Index",
          generatedAt
        }).catch(() => []);
        return matches.sort((a, b) => b.score - a.score)[0] || null;
      })
    );

    const indices = indexResults.filter(Boolean);
    const marketTape = await fetchMarketTape();
    const news = await fetchNewsItems(filteredStocks.map((item) => item.symbol));
    const marketOverview = buildMarketOverview({ stocks: filteredStocks, indices, marketTape });
    const topSetups = filteredStocks.slice(0, 5).map((item) => ({
      symbol: item.symbol,
      direction: item.direction,
      setupType: item.setupType,
      score: item.score,
      divergenceLabel: item.divergence?.label || null,
      timeframeCombo: `${item.zoneTimeframe} / ${item.triggerTimeframe}`,
      reason: item.explanation.reasons[0]
    }));

    const note = universe === "all" && requestedLimit > effectiveLimit
      ? `Live NSE cash scans are capped at ${effectiveLimit} symbols on Netlify for stability.`
      : "Zones, divergence, BOS, sweeps, and trigger quality are now scored separately for explainability.";

    const payload = {
      generatedAt,
      stocks: filteredStocks,
      indices,
      topSetups,
      marketTape,
      marketOverview,
      news,
      meta: {
        scannedSymbols: stockSymbols.length,
        sweepSignals: filteredStocks.filter((item) => item.trigger?.sweep?.detected).length,
        confirmationSignals: filteredStocks.filter((item) => item.trigger?.confirmation?.detected).length,
        divergenceSignals: filteredStocks.filter((item) => item.divergence).length,
        scalpSignals: filteredStocks.filter((item) => item.mode === "Scalp").length,
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
