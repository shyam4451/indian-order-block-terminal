import { FNO_STOCKS, NIFTY50 } from "./constants.mjs";
import {
  buildSynthetic4H,
  fetchMarketTape,
  fetchNseSymbols,
  fetchYahooCandles
} from "./dataSources.mjs";
import { clamp, round } from "./helpers.mjs";

const RSI_LENGTH = 14;
const UO_PERIODS = { fast: 7, medium: 14, slow: 28 };
const CACHE_TTL_MS = 3 * 60 * 1000;
const DEFAULT_PIVOT_WINDOWS = [3, 4, 5];
const DUPLICATE_LOOKBACK_CANDLES = 10;

const candleCache = new Map();
const alertMemory = new Map();

const SETUPS = [
  { id: "A", label: "Setup A", biasTf: "1H", entryTf: "15m", intervalMs: 15 * 60 * 1000 },
  { id: "B", label: "Setup B", biasTf: "4H", entryTf: "1H", intervalMs: 60 * 60 * 1000 },
  { id: "C", label: "Setup C", biasTf: "1D", entryTf: "4H", intervalMs: 4 * 60 * 60 * 1000 }
];

function normalizeSymbol(symbol) {
  return symbol.endsWith(".NS") || symbol.startsWith("^") ? symbol : `${symbol}.NS`;
}

function displaySymbol(symbol) {
  return symbol.replace(/\.NS$/, "");
}

function lastValue(values) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];
    if (value !== null && value !== undefined && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function average(values) {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (!filtered.length) {
    return null;
  }
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function computeRsi(closes, length = RSI_LENGTH) {
  if (closes.length <= length) {
    return Array(closes.length).fill(null);
  }

  const rsi = Array(closes.length).fill(null);
  let gains = 0;
  let losses = 0;

  for (let index = 1; index <= length; index += 1) {
    const delta = closes[index] - closes[index - 1];
    gains += Math.max(delta, 0);
    losses += Math.max(-delta, 0);
  }

  let avgGain = gains / length;
  let avgLoss = losses / length;
  rsi[length] = avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss)));

  for (let index = length + 1; index < closes.length; index += 1) {
    const delta = closes[index] - closes[index - 1];
    const gain = Math.max(delta, 0);
    const loss = Math.max(-delta, 0);
    avgGain = ((avgGain * (length - 1)) + gain) / length;
    avgLoss = ((avgLoss * (length - 1)) + loss) / length;
    rsi[index] = avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss)));
  }

  return rsi;
}

function computeUltimateOscillator(rows, periods = UO_PERIODS) {
  const { fast, medium, slow } = periods;
  const buyingPressure = [];
  const trueRange = [];

  rows.forEach((row, index) => {
    const previousClose = index === 0 ? row.close : rows[index - 1].close;
    const lowBase = Math.min(row.low, previousClose);
    const highBase = Math.max(row.high, previousClose);
    buyingPressure.push(row.close - lowBase);
    trueRange.push(Math.max(highBase - lowBase, 0));
  });

  const oscillator = Array(rows.length).fill(null);

  for (let index = 0; index < rows.length; index += 1) {
    if (index + 1 < slow) {
      continue;
    }

    const averageFor = (length) => {
      const bpSlice = buyingPressure.slice(index + 1 - length, index + 1);
      const trSlice = trueRange.slice(index + 1 - length, index + 1);
      const bpSum = bpSlice.reduce((sum, value) => sum + value, 0);
      const trSum = trSlice.reduce((sum, value) => sum + value, 0);
      return trSum === 0 ? 0 : bpSum / trSum;
    };

    oscillator[index] = 100 * (
      (4 * averageFor(fast)) +
      (2 * averageFor(medium)) +
      averageFor(slow)
    ) / 7;
  }

  return oscillator;
}

function computeVolumeRatio(rows, window = 20) {
  if (rows.length <= window) {
    return 1;
  }
  const previousVolumes = rows.slice(-1 - window, -1).map((row) => row.volume || 0);
  const baseline = average(previousVolumes);
  if (!baseline) {
    return 1;
  }
  return (rows[rows.length - 1].volume || 0) / baseline;
}

function findPivotIndices(values, type, window) {
  const pivots = [];

  for (let index = window; index < values.length - window; index += 1) {
    const value = values[index];
    if (!Number.isFinite(value)) {
      continue;
    }

    const left = values.slice(index - window, index);
    const right = values.slice(index + 1, index + 1 + window);
    if (left.some((item) => !Number.isFinite(item)) || right.some((item) => !Number.isFinite(item))) {
      continue;
    }

    if (type === "low" && value <= Math.min(...left) && value <= Math.min(...right)) {
      pivots.push(index);
    }
    if (type === "high" && value >= Math.max(...left) && value >= Math.max(...right)) {
      pivots.push(index);
    }
  }

  return pivots;
}

function buildDivergenceStrength(priceMovePct, oscillatorMove, spacing, slopeDifference, ageBars) {
  const raw = (
    Math.min(priceMovePct * 11, 34) +
    Math.min(oscillatorMove * 2.1, 30) +
    Math.min(spacing * 2.3, 18) +
    Math.min(slopeDifference * 4.5, 12) +
    Math.max(10 - ageBars, 0)
  );
  return clamp(Math.round(raw), 0, 100);
}

function detectDirectionalDivergence(rows, direction, windows = DEFAULT_PIVOT_WINDOWS) {
  if (rows.length < 60) {
    return null;
  }

  const closes = rows.map((row) => row.close);
  const lows = rows.map((row) => row.low);
  const highs = rows.map((row) => row.high);
  const uoSeries = computeUltimateOscillator(rows);
  const candidates = [];
  const bullish = direction === "LONG";
  const priceSeries = bullish ? lows : highs;

  windows.forEach((window) => {
    const pivots = findPivotIndices(priceSeries, bullish ? "low" : "high", window);
    for (let index = pivots.length - 1; index > 0; index -= 1) {
      const second = pivots[index];
      const first = pivots[index - 1];
      const spacing = second - first;
      const ageBars = rows.length - 1 - second;

      if (spacing < window + 1 || spacing > 40 || ageBars > 8) {
        continue;
      }

      const uoA = uoSeries[first];
      const uoB = uoSeries[second];
      if (!Number.isFinite(uoA) || !Number.isFinite(uoB)) {
        continue;
      }

      const priceA = priceSeries[first];
      const priceB = priceSeries[second];
      const priceMovePct = Math.abs((priceB - priceA) / Math.max(Math.abs(priceA), 0.01)) * 100;
      const oscillatorMove = Math.abs(uoB - uoA);
      const priceSlope = ((priceB - priceA) / Math.max(Math.abs(priceA), 0.01)) / Math.max(spacing, 1);
      const oscillatorSlope = (uoB - uoA) / Math.max(spacing, 1);
      const slopeDifference = Math.abs(priceSlope * 100) + Math.abs(oscillatorSlope);
      const strength = buildDivergenceStrength(priceMovePct, oscillatorMove, spacing, slopeDifference, ageBars);

      const divergenceKinds = bullish
        ? [
          {
            valid: priceB < priceA && uoB > uoA,
            label: "Bullish UO",
            pricePattern: "LL",
            oscillatorPattern: "HL",
            hidden: false
          },
          {
            valid: priceB > priceA && uoB < uoA,
            label: "Hidden Bullish UO",
            pricePattern: "HL",
            oscillatorPattern: "LL",
            hidden: true
          }
        ]
        : [
          {
            valid: priceB > priceA && uoB < uoA,
            label: "Bearish UO",
            pricePattern: "HH",
            oscillatorPattern: "LH",
            hidden: false
          },
          {
            valid: priceB < priceA && uoB > uoA,
            label: "Hidden Bearish UO",
            pricePattern: "LH",
            oscillatorPattern: "HH",
            hidden: true
          }
        ];

      divergenceKinds.forEach((kind) => {
        if (!kind.valid) {
          return;
        }

        candidates.push({
          direction,
          divergence: kind.label,
          pricePattern: kind.pricePattern,
          oscillatorPattern: kind.oscillatorPattern,
          strength,
          slopeDifference: round(slopeDifference, 2),
          ageBars,
          window,
          hidden: kind.hidden,
          pivots: {
            price: [
              { at: rows[first].datetime, value: round(priceA) },
              { at: rows[second].datetime, value: round(priceB) }
            ],
            uo: [
              { at: rows[first].datetime, value: round(uoA) },
              { at: rows[second].datetime, value: round(uoB) }
            ]
          }
        });
      });
    }
  });

  return candidates.sort((left, right) => {
    if (right.strength !== left.strength) {
      return right.strength - left.strength;
    }
    return left.ageBars - right.ageBars;
  })[0] || null;
}

function qualifyRsiFilter(direction, entryRsi, biasRsi) {
  if (!Number.isFinite(entryRsi) || !Number.isFinite(biasRsi)) {
    return false;
  }
  if (direction === "LONG") {
    return entryRsi > 40 && biasRsi > 50;
  }
  return entryRsi < 60 && biasRsi < 50;
}

function scoreSignal({ divergence, entryRsi, biasRsi, volumeRatio, direction }) {
  const divergenceScore = Math.min(divergence.strength * 0.5, 50);
  const biasDistance = direction === "LONG" ? biasRsi - 50 : 50 - biasRsi;
  const entryBuffer = direction === "LONG" ? entryRsi - 40 : 60 - entryRsi;
  const alignmentScore = clamp(Math.round((biasDistance * 1.1) + (entryBuffer * 0.8)), 0, 24);
  const freshnessScore = clamp(12 - divergence.ageBars, 0, 12);
  const volumeScore = volumeRatio > 1.5 ? clamp(Math.round(8 + ((volumeRatio - 1.5) * 6)), 0, 14) : 0;
  const total = clamp(Math.round(divergenceScore + alignmentScore + freshnessScore + volumeScore), 0, 100);

  return {
    total,
    breakdown: {
      divergence: round(divergenceScore, 1),
      alignment: alignmentScore,
      freshness: freshnessScore,
      volume: volumeScore
    }
  };
}

function buildSetupSummary(signal) {
  return `${signal.setup} | ${signal.biasTimeframe} -> ${signal.entryTimeframe}`;
}

function buildRationale(signal) {
  const hidden = signal.divergence.toLowerCase().includes("hidden");
  const priceLine = hidden
    ? (signal.signal === "LONG"
      ? `Price made a higher low while UO made a lower low on ${signal.entryTimeframe}.`
      : `Price made a lower high while UO made a higher high on ${signal.entryTimeframe}.`)
    : (signal.signal === "LONG"
      ? `Price made a lower low while UO made a higher low on ${signal.entryTimeframe}.`
      : `Price made a higher high while UO made a lower high on ${signal.entryTimeframe}.`);
  const biasLine = signal.signal === "LONG"
    ? `${signal.biasTimeframe} RSI is above 50, supporting long bias.`
    : `${signal.biasTimeframe} RSI is below 50, supporting short bias.`;
  const entryLine = signal.signal === "LONG"
    ? `Entry RSI is ${signal.rsi}, keeping the long filter above 40.`
    : `Entry RSI is ${signal.rsi}, keeping the short filter below 60.`;

  return [priceLine, biasLine, entryLine];
}

function buildSignal({ rawSymbol, setup, rows, divergence, entryRsi, entryUo, biasRsi, volumeRatio }) {
  const currentBar = rows[rows.length - 1];
  const direction = divergence.direction;
  const score = scoreSignal({ divergence, entryRsi, biasRsi, volumeRatio, direction });
  const signal = {
    id: `${rawSymbol}:${setup.id}:${direction}:${divergence.pivots.price[1].at}`,
    symbol: displaySymbol(rawSymbol),
    rawSymbol,
    setup: setup.label,
    setupId: setup.id,
    signal: direction,
    divergence: divergence.divergence,
    price: round(currentBar.close),
    rsi: round(entryRsi),
    uo: round(entryUo),
    biasRsi: round(biasRsi),
    biasTimeframe: setup.biasTf,
    entryTimeframe: setup.entryTf,
    strengthScore: divergence.strength,
    slopeDifference: divergence.slopeDifference,
    volumeRatio: round(volumeRatio, 2),
    volumeConfirmed: volumeRatio > 1.5,
    score: score.total,
    scoreBreakdown: score.breakdown,
    quality: score.total >= 80 ? "Prime" : score.total >= 68 ? "High" : "Watch",
    pricePattern: divergence.pricePattern,
    oscillatorPattern: divergence.oscillatorPattern,
    pivotWindow: divergence.window,
    freshnessBars: divergence.ageBars,
    time: currentBar.datetime,
    timeframeCombo: `${setup.biasTf} -> ${setup.entryTf}`,
    alertState: "pending",
    rationale: [],
    payload: {
      symbol: displaySymbol(rawSymbol),
      setup: setup.label,
      signal: direction,
      divergence: divergence.divergence,
      price: round(currentBar.close),
      rsi: round(entryRsi),
      uo: round(entryUo),
      time: currentBar.datetime
    },
    internals: {
      divergence,
      biasRsi: round(biasRsi),
      entryRsi: round(entryRsi),
      entryUo: round(entryUo),
      currentVolume: round(currentBar.volume || 0, 0),
      lastBarTime: currentBar.datetime
    }
  };

  signal.rationale = buildRationale(signal);
  return signal;
}

async function fetchCachedCandles(symbol, interval, range, cacheKey = `${symbol}:${interval}:${range}`) {
  const cached = candleCache.get(cacheKey);
  if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL_MS) {
    return cached.rows;
  }

  const rows = await fetchYahooCandles(symbol, interval, range);
  candleCache.set(cacheKey, { rows, fetchedAt: Date.now() });
  return rows;
}

async function getSymbolSeries(symbol) {
  const hourlyRows = await fetchCachedCandles(symbol, "1h", "60d");
  const [intradayRows, dailyRows] = await Promise.all([
    fetchCachedCandles(symbol, "15m", "30d"),
    fetchCachedCandles(symbol, "1d", "2y")
  ]);

  return {
    "15m": intradayRows,
    "1H": hourlyRows,
    "4H": buildSynthetic4H(hourlyRows),
    "1D": dailyRows
  };
}

function shouldSuppressAlert(signal, setup) {
  const key = `${signal.rawSymbol}:${setup.id}:${signal.signal}`;
  const previous = alertMemory.get(key);
  if (!previous) {
    return false;
  }

  const sameSignal = previous.pivotTime === signal.internals.divergence.pivots.price[1].at;
  if (!sameSignal) {
    return false;
  }

  const elapsedMs = new Date(signal.time).getTime() - new Date(previous.firstAlertBarTime).getTime();
  return elapsedMs < (setup.intervalMs * DUPLICATE_LOOKBACK_CANDLES);
}

function rememberAlert(signal, setup) {
  const key = `${signal.rawSymbol}:${setup.id}:${signal.signal}`;
  alertMemory.set(key, {
    pivotTime: signal.internals.divergence.pivots.price[1].at,
    firstAlertBarTime: signal.time
  });
}

function escapeTelegramMarkdown(value) {
  return String(value ?? "")
    .replace(/([_*`\[])/g, "\\$1");
}

function formatTelegramMessage(signal) {
  return [
    "🚨 *UO MTF Divergence Alert*",
    "",
    `📊 Symbol: ${escapeTelegramMarkdown(signal.symbol)}`,
    `📍 Signal: ${escapeTelegramMarkdown(signal.signal)}`,
    `📉 Divergence: ${escapeTelegramMarkdown(signal.divergence)}`,
    "",
    "🧭 Setup:",
    `- Bias TF: ${escapeTelegramMarkdown(signal.biasTimeframe)}`,
    `- Entry TF: ${escapeTelegramMarkdown(signal.entryTimeframe)}`,
    "",
    `💰 Price: ${escapeTelegramMarkdown(signal.price)}`,
    `📈 RSI (Entry TF): ${escapeTelegramMarkdown(signal.rsi)}`,
    `📊 UO (Entry TF): ${escapeTelegramMarkdown(signal.uo)}`,
    "",
    `🕒 Time: ${escapeTelegramMarkdown(signal.time)}`
  ].join("\n");
}

async function sendTelegramAlert(signal, env) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return {
      delivered: false,
      state: "disabled",
      reason: "Telegram environment variables are missing."
    };
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: formatTelegramMessage(signal),
      parse_mode: "Markdown"
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram send failed: ${response.status} ${body}`);
  }

  return { delivered: true, state: "sent", reason: null };
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function mapWithConcurrency(items, limit, worker) {
  const results = Array(items.length);
  let pointer = 0;

  async function consume() {
    while (pointer < items.length) {
      const index = pointer;
      pointer += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length || 1) }, consume));
  return results;
}

async function resolveSymbols(universe, limit, customSymbols) {
  if (customSymbols?.length) {
    return customSymbols.map(normalizeSymbol);
  }
  if (universe === "fno") {
    return FNO_STOCKS.slice(0, limit);
  }
  if (universe === "all") {
    return fetchNseSymbols(limit);
  }
  return NIFTY50.slice(0, limit);
}

function evaluateSetupsForSymbol(rawSymbol, seriesByTimeframe) {
  const signals = [];
  const diagnostics = {
    setupChecks: 0,
    divergenceMisses: 0,
    filterMisses: 0,
    qualified: 0
  };

  SETUPS.forEach((setup) => {
    diagnostics.setupChecks += 1;
    const entryRows = seriesByTimeframe[setup.entryTf];
    const biasRows = seriesByTimeframe[setup.biasTf];

    if (!entryRows?.length || !biasRows?.length) {
      diagnostics.divergenceMisses += 1;
      return;
    }

    const entryRsiSeries = computeRsi(entryRows.map((row) => row.close));
    const entryUoSeries = computeUltimateOscillator(entryRows);
    const biasRsiSeries = computeRsi(biasRows.map((row) => row.close));
    const entryRsi = lastValue(entryRsiSeries);
    const entryUo = lastValue(entryUoSeries);
    const biasRsi = lastValue(biasRsiSeries);
    const volumeRatio = computeVolumeRatio(entryRows);

    if (!Number.isFinite(entryRsi) || !Number.isFinite(entryUo) || !Number.isFinite(biasRsi)) {
      diagnostics.divergenceMisses += 1;
      return;
    }

    let setupQualified = false;
    let setupSawDivergence = false;

    ["LONG", "SHORT"].forEach((direction) => {
      const divergence = detectDirectionalDivergence(entryRows, direction);
      if (!divergence) {
        return;
      }
      setupSawDivergence = true;
      if (!qualifyRsiFilter(direction, entryRsi, biasRsi)) {
        diagnostics.filterMisses += 1;
        return;
      }

      setupQualified = true;
      signals.push(buildSignal({
        rawSymbol,
        setup,
        rows: entryRows,
        divergence,
        entryRsi,
        entryUo,
        biasRsi,
        volumeRatio
      }));
    });

    if (!setupQualified && !setupSawDivergence) {
      diagnostics.divergenceMisses += 1;
    }
    if (setupQualified) {
      diagnostics.qualified += 1;
    }
  });

  return { signals, diagnostics };
}

function summarizeSignals(signals, telegramSummary) {
  const longs = signals.filter((signal) => signal.signal === "LONG").length;
  const shorts = signals.filter((signal) => signal.signal === "SHORT").length;
  const bySetup = Object.fromEntries(
    SETUPS.map((setup) => [setup.label, signals.filter((signal) => signal.setupId === setup.id).length])
  );
  const strongest = signals[0] || null;

  return {
    totalSignals: signals.length,
    longSignals: longs,
    shortSignals: shorts,
    uniqueSymbols: new Set(signals.map((signal) => signal.symbol)).size,
    volumeConfirmed: signals.filter((signal) => signal.volumeConfirmed).length,
    strongestSetup: strongest ? {
      symbol: strongest.symbol,
      setup: buildSetupSummary(strongest),
      score: strongest.score
    } : null,
    bySetup,
    telegram: telegramSummary
  };
}

export async function runUoMultiTimeframeScan(query = {}, env = process.env) {
  const universe = query.universe || "nifty50";
  const limit = clamp(parseNumber(query.limit, 24), 5, 120);
  const concurrency = clamp(parseNumber(query.concurrency, 4), 1, 8);
  const sendAlerts = query.sendAlerts !== "false";
  const customSymbols = String(query.symbols || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const symbols = await resolveSymbols(universe, limit, customSymbols);
  const scanStartedAt = new Date().toISOString();

  const settled = await mapWithConcurrency(symbols, concurrency, async (rawSymbol) => {
    try {
      const seriesByTimeframe = await getSymbolSeries(rawSymbol);
      const evaluation = evaluateSetupsForSymbol(rawSymbol, seriesByTimeframe);
      return {
        rawSymbol,
        signals: evaluation.signals,
        diagnostics: evaluation.diagnostics
      };
    } catch (error) {
      return {
        rawSymbol,
        error: error.message,
        signals: [],
        diagnostics: {
          setupChecks: SETUPS.length,
          divergenceMisses: 0,
          filterMisses: 0,
          qualified: 0
        }
      };
    }
  });

  const errors = settled.filter((item) => item.error).map((item) => ({
    symbol: displaySymbol(item.rawSymbol),
    error: item.error
  }));

  const signals = settled
    .flatMap((item) => item.signals || [])
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (right.strengthScore !== left.strengthScore) {
        return right.strengthScore - left.strengthScore;
      }
      return left.symbol.localeCompare(right.symbol);
    });

  const diagnostics = settled.reduce((accumulator, item) => {
    accumulator.setupChecks += item.diagnostics?.setupChecks || 0;
    accumulator.divergenceMisses += item.diagnostics?.divergenceMisses || 0;
    accumulator.filterMisses += item.diagnostics?.filterMisses || 0;
    accumulator.qualified += item.diagnostics?.qualified || 0;
    return accumulator;
  }, {
    setupChecks: 0,
    divergenceMisses: 0,
    filterMisses: 0,
    qualified: 0
  });

  const telegramSummary = {
    configured: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID),
    requested: sendAlerts,
    sent: 0,
    suppressed: 0,
    failed: 0,
    lastError: null
  };

  if (sendAlerts) {
    for (const signal of signals) {
      const setup = SETUPS.find((item) => item.id === signal.setupId);
      if (shouldSuppressAlert(signal, setup)) {
        signal.alertState = "suppressed";
        telegramSummary.suppressed += 1;
        continue;
      }

      try {
        const result = await sendTelegramAlert(signal, env);
        signal.alertState = result.state;
        signal.alertReason = result.reason;
        if (result.delivered) {
          rememberAlert(signal, setup);
          telegramSummary.sent += 1;
        }
      } catch (error) {
        signal.alertState = "failed";
        signal.alertReason = error.message;
        telegramSummary.failed += 1;
        telegramSummary.lastError = error.message;
      }
    }
  } else {
    signals.forEach((signal) => {
      signal.alertState = "idle";
    });
  }

  const marketTape = await fetchMarketTape().catch(() => []);
  const summary = summarizeSignals(signals, telegramSummary);
  const allFetchesFailed = symbols.length > 0 && errors.length === symbols.length;
  const noSignals = signals.length === 0;
  const note = allFetchesFailed
    ? "No symbols could be fetched from the upstream market source. This is a data-source problem, not a filter problem."
    : noSignals
      ? `No fully qualified signals. ${diagnostics.divergenceMisses} setup checks had no UO divergence and ${diagnostics.filterMisses} divergence checks failed the RSI bias filters.`
      : "UO divergence drives every signal. RSI only filters direction and higher-timeframe bias.";

  return {
    generatedAt: new Date().toISOString(),
    scanStartedAt,
    universe,
    symbolsScanned: symbols.length,
    symbolsFailed: errors.length,
    setups: SETUPS.map((setup) => ({
      id: setup.id,
      label: setup.label,
      biasTimeframe: setup.biasTf,
      entryTimeframe: setup.entryTf
    })),
    summary,
    diagnostics,
    telegram: telegramSummary,
    marketTape,
    signals,
    topSignals: signals.slice(0, 6),
    errors,
    meta: {
      note: telegramSummary.configured
        ? note
        : `${note} Telegram alerts are disabled until TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are configured.`
    }
  };
}
