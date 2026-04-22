import { clamp, round } from "./helpers.mjs";

function computeRsi(closes, period = 14) {
  if (closes.length <= period) {
    return Array(closes.length).fill(null);
  }

  const gains = Array(closes.length).fill(0);
  const losses = Array(closes.length).fill(0);
  for (let index = 1; index < closes.length; index += 1) {
    const delta = closes[index] - closes[index - 1];
    gains[index] = Math.max(delta, 0);
    losses[index] = Math.max(-delta, 0);
  }

  const rsi = Array(closes.length).fill(null);
  let avgGain = gains.slice(1, period + 1).reduce((sum, value) => sum + value, 0) / period;
  let avgLoss = losses.slice(1, period + 1).reduce((sum, value) => sum + value, 0) / period;

  for (let index = period + 1; index < closes.length; index += 1) {
    avgGain = ((avgGain * (period - 1)) + gains[index]) / period;
    avgLoss = ((avgLoss * (period - 1)) + losses[index]) / period;
    if (avgLoss === 0) {
      rsi[index] = 100;
      continue;
    }
    const rs = avgGain / avgLoss;
    rsi[index] = 100 - (100 / (1 + rs));
  }

  return rsi;
}

function pivotPoints(values, type = "low", window = 3) {
  const pivots = [];
  for (let index = window; index < values.length - window; index += 1) {
    const value = values[index];
    const left = values.slice(index - window, index);
    const right = values.slice(index + 1, index + 1 + window);
    if (type === "low" && value <= Math.min(...left) && value <= Math.min(...right)) {
      pivots.push(index);
    }
    if (type === "high" && value >= Math.max(...left) && value >= Math.max(...right)) {
      pivots.push(index);
    }
  }
  return pivots;
}

function buildStrength({ priceMovePct, rsiMove, spacing, pivotLength }) {
  return clamp(
    Math.round((Math.min(priceMovePct * 20, 40) + Math.min(rsiMove * 2, 30) + Math.min((spacing / Math.max(pivotLength, 1)) * 6, 30))),
    0,
    100
  );
}

function buildDivergencePayload(rows, rsi, first, second, type, timeframeName, direction, alignsWithZone) {
  const priceA = direction.includes("bullish") ? rows[first].low : rows[first].high;
  const priceB = direction.includes("bullish") ? rows[second].low : rows[second].high;
  const rsiA = rsi[first];
  const rsiB = rsi[second];
  const priceMovePct = Math.abs((priceB - priceA) / Math.max(Math.abs(priceA), 0.01)) * 100;
  const rsiMove = Math.abs(rsiB - rsiA);
  const spacing = second - first;
  const pivotLength = timeframeName === "Weekly" ? 2 : timeframeName === "1H" ? 4 : 3;
  const strength = buildStrength({ priceMovePct, rsiMove, spacing, pivotLength });

  return {
    type,
    label: {
      bullish: "Bullish RSI",
      bearish: "Bearish RSI",
      hiddenBullish: "Hidden Bullish RSI",
      hiddenBearish: "Hidden Bearish RSI"
    }[type],
    timeframe: timeframeName,
    strength,
    alignsWithZone,
    pivots: {
      price: [
        { at: rows[first].datetime, value: round(priceA) },
        { at: rows[second].datetime, value: round(priceB) }
      ],
      rsi: [
        { at: rows[first].datetime, value: round(rsiA) },
        { at: rows[second].datetime, value: round(rsiB) }
      ]
    }
  };
}

export function detectDivergence(rows, direction, timeframeName, options = {}) {
  const pivotLength = Number(options.pivotLength || (timeframeName === "Weekly" ? 2 : timeframeName === "1H" ? 4 : 3));
  const minPivotSpacing = Number(options.minPivotSpacing || (timeframeName === "1H" ? 6 : 5));
  const maxLookbackBars = Number(options.maxLookbackBars || (timeframeName === "Weekly" ? 18 : timeframeName === "1H" ? 26 : 22));
  if (rows.length < Math.max(28, pivotLength * 8)) {
    return null;
  }

  const closes = rows.map((row) => row.close);
  const rsi = computeRsi(closes);
  const bullish = direction === "bullish";
  const priceSeries = bullish ? rows.map((row) => row.low) : rows.map((row) => row.high);
  const pivots = pivotPoints(priceSeries, bullish ? "low" : "high", pivotLength);
  if (pivots.length < 2) {
    return null;
  }

  const candidates = [];
  for (let index = pivots.length - 1; index > 0; index -= 1) {
    const second = pivots[index];
    const first = pivots[index - 1];
    if (rows.length - 1 - second > maxLookbackBars || second - first < minPivotSpacing) {
      continue;
    }
    if (rsi[first] === null || rsi[second] === null) {
      continue;
    }

    if (bullish) {
      if (priceSeries[second] < priceSeries[first] && rsi[second] > rsi[first]) {
        candidates.push(buildDivergencePayload(rows, rsi, first, second, "bullish", timeframeName, direction, true));
      }
      if (priceSeries[second] > priceSeries[first] && rsi[second] < rsi[first]) {
        candidates.push(buildDivergencePayload(rows, rsi, first, second, "hiddenBullish", timeframeName, direction, true));
      }
    } else {
      if (priceSeries[second] > priceSeries[first] && rsi[second] < rsi[first]) {
        candidates.push(buildDivergencePayload(rows, rsi, first, second, "bearish", timeframeName, direction, true));
      }
      if (priceSeries[second] < priceSeries[first] && rsi[second] > rsi[first]) {
        candidates.push(buildDivergencePayload(rows, rsi, first, second, "hiddenBearish", timeframeName, direction, true));
      }
    }
  }

  if (!candidates.length) {
    return null;
  }

  return candidates.sort((a, b) => b.strength - a.strength)[0];
}
