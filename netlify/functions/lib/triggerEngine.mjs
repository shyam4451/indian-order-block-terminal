import { clamp, rollingAverage, round } from "./helpers.mjs";

export function eligibleTriggerTimeframes(zoneTimeframeName, scalpStyle = "conservative") {
  if (zoneTimeframeName === "1H") {
    return scalpStyle === "aggressive" ? ["5M", "15M"] : ["15M"];
  }
  if (zoneTimeframeName === "Daily") {
    return ["1H", "4H"];
  }
  return ["4H", "1H"];
}

function nearZoneInteraction(row, zone, direction) {
  const padding = (zone.zoneHigh - zone.zoneLow) * 0.18;
  if (direction === "bullish") {
    return row.low <= zone.zoneHigh + padding && row.low >= zone.zoneLow - (padding * 2);
  }
  return row.high >= zone.zoneLow - padding && row.high <= zone.zoneHigh + (padding * 2);
}

function swingLevel(rows, direction) {
  if (direction === "bullish") {
    return Math.min(...rows.map((item) => item.low));
  }
  return Math.max(...rows.map((item) => item.high));
}

function detectSweep(rows, zone, direction, options = {}) {
  const lookback = Number(options.lookback || 18);
  const evaluationWindow = Number(options.evaluationWindow || 10);
  if (rows.length < lookback + 3) {
    return { detected: false, at: null, barsAgo: null, level: null, strength: 0 };
  }

  const start = Math.max(lookback + 1, rows.length - evaluationWindow);
  for (let index = rows.length - 1; index >= start; index -= 1) {
    const candle = rows[index];
    const recent = rows.slice(index - lookback, index);
    if (!recent.length || !nearZoneInteraction(candle, zone, direction)) {
      continue;
    }
    const level = swingLevel(recent, direction);
    if (direction === "bullish") {
      const reclaimed = candle.low < level && candle.close > level;
      if (reclaimed) {
        return {
          detected: true,
          at: candle.datetime,
          barsAgo: rows.length - 1 - index,
          level: round(level),
          strength: clamp(Math.round((((level - candle.low) / Math.max(level, 0.01)) * 100) * 80), 1, 100)
        };
      }
      continue;
    }
    const reclaimed = candle.high > level && candle.close < level;
    if (reclaimed) {
      return {
        detected: true,
        at: candle.datetime,
        barsAgo: rows.length - 1 - index,
        level: round(level),
        strength: clamp(Math.round((((candle.high - level) / Math.max(level, 0.01)) * 100) * 80), 1, 100)
      };
    }
  }

  return { detected: false, at: null, barsAgo: null, level: null, strength: 0 };
}

function detectBos(rows, direction, fromTime = null) {
  const filtered = fromTime ? rows.filter((row) => row.datetime >= fromTime) : rows;
  const sample = filtered.slice(-8);
  if (sample.length < 4) {
    return { detected: false, at: null, strength: 0 };
  }

  for (let index = 2; index < sample.length; index += 1) {
    const previousHigh = Math.max(...sample.slice(Math.max(0, index - 2), index).map((item) => item.high));
    const previousLow = Math.min(...sample.slice(Math.max(0, index - 2), index).map((item) => item.low));
    const candle = sample[index];
    if (direction === "bullish" && candle.close > previousHigh) {
      return { detected: true, at: candle.datetime, strength: clamp(Math.round(((candle.close - previousHigh) / Math.max(previousHigh, 0.01)) * 1000), 1, 100) };
    }
    if (direction === "bearish" && candle.close < previousLow) {
      return { detected: true, at: candle.datetime, strength: clamp(Math.round(((previousLow - candle.close) / Math.max(previousLow, 0.01)) * 1000), 1, 100) };
    }
  }

  return { detected: false, at: null, strength: 0 };
}

function detectConfirmation(rows, direction, fromTime = null) {
  const filtered = fromTime ? rows.filter((row) => row.datetime >= fromTime) : rows;
  const sample = filtered.slice(-4);
  if (sample.length < 2) {
    return { detected: false, at: null, candleType: null };
  }

  for (let index = 1; index < sample.length; index += 1) {
    const current = sample[index];
    const previous = sample[index - 1];
    if (direction === "bullish" && current.close > current.open && current.close > previous.high) {
      return { detected: true, at: current.datetime, candleType: "reclaim" };
    }
    if (direction === "bearish" && current.close < current.open && current.close < previous.low) {
      return { detected: true, at: current.datetime, candleType: "rejection" };
    }
  }

  return { detected: false, at: null, candleType: null };
}

function detectVolumeConfirmation(rows, fromTime = null) {
  const filtered = fromTime ? rows.filter((row) => row.datetime >= fromTime) : rows;
  const sample = filtered.slice(-10);
  if (sample.length < 4) {
    return { detected: false, ratio: null };
  }
  const volumes = sample.map((row) => row.volume || 0);
  const averages = rollingAverage(volumes, Math.min(5, volumes.length));
  const latest = volumes[volumes.length - 1];
  const baseline = averages[averages.length - 2] || averages[averages.length - 1] || 0;
  const ratio = baseline ? latest / baseline : 0;
  return { detected: ratio >= 1.2, ratio: round(ratio, 2) };
}

export function evaluateTrigger(rows, zone, direction, timeframeName, options = {}) {
  const sweep = detectSweep(rows, zone, direction, options);
  const bos = detectBos(rows, direction, sweep.at);
  const confirmation = detectConfirmation(rows, direction, sweep.at);
  const volume = detectVolumeConfirmation(rows, sweep.at || confirmation.at);

  return {
    timeframe: timeframeName,
    sweep,
    bos,
    confirmation,
    volume,
    quality: clamp(
      (sweep.detected ? 38 : 0) +
      (bos.detected ? 24 : 0) +
      (confirmation.detected ? 22 : 0) +
      (volume.detected ? 16 : 0),
      0,
      100
    )
  };
}

export function pickBestTrigger(triggerResults) {
  return triggerResults
    .filter(Boolean)
    .sort((a, b) => {
      if (b.quality !== a.quality) {
        return b.quality - a.quality;
      }
      return (a.sweep?.barsAgo ?? Number.POSITIVE_INFINITY) - (b.sweep?.barsAgo ?? Number.POSITIVE_INFINITY);
    })[0] || null;
}
