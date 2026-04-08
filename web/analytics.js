import { average, clamp, sum } from "./utils.js";

export function ema(values, period) {
  const multiplier = 2 / (period + 1);
  const output = [];
  let prev = values[0] ?? 0;
  values.forEach((value, index) => {
    if (index === 0) {
      prev = value;
    } else {
      prev = ((value - prev) * multiplier) + prev;
    }
    output.push(prev);
  });
  return output;
}

export function sma(values, period) {
  return values.map((_, index) => {
    if (index + 1 < period) {
      return null;
    }
    return average(values.slice(index + 1 - period, index + 1));
  });
}

export function rsi(values, period = 14) {
  if (values.length < period + 2) {
    return Array(values.length).fill(50);
  }
  const output = Array(values.length).fill(50);
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i += 1) {
    const delta = values[i] - values[i - 1];
    gains += Math.max(delta, 0);
    losses += Math.max(-delta, 0);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  output[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss)));

  for (let i = period + 1; i < values.length; i += 1) {
    const delta = values[i] - values[i - 1];
    avgGain = ((avgGain * (period - 1)) + Math.max(delta, 0)) / period;
    avgLoss = ((avgLoss * (period - 1)) + Math.max(-delta, 0)) / period;
    output[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss)));
  }
  return output;
}

export function atrPercent(candles, period = 14) {
  if (candles.length < period + 1) {
    return 0;
  }
  const trs = [];
  for (let i = 1; i < candles.length; i += 1) {
    const current = candles[i];
    const prevClose = candles[i - 1].close;
    trs.push(
      Math.max(
        current.high - current.low,
        Math.abs(current.high - prevClose),
        Math.abs(current.low - prevClose)
      )
    );
  }
  const atr = average(trs.slice(-period));
  return (atr / candles[candles.length - 1].close) * 100;
}

export function adxDmi(candles, period = 14) {
  if (candles.length < period + 5) {
    return {
      adx: 18,
      prevAdx: 16,
      plusDi: 20,
      minusDi: 18,
      prevPlusDi: 19,
      prevMinusDi: 20
    };
  }

  const trs = [];
  const plusDM = [];
  const minusDM = [];

  for (let i = 1; i < candles.length; i += 1) {
    const current = candles[i];
    const previous = candles[i - 1];
    const upMove = current.high - previous.high;
    const downMove = previous.low - current.low;

    trs.push(
      Math.max(
        current.high - current.low,
        Math.abs(current.high - previous.close),
        Math.abs(current.low - previous.close)
      )
    );
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  let trSmooth = sum(trs.slice(0, period));
  let plusSmooth = sum(plusDM.slice(0, period));
  let minusSmooth = sum(minusDM.slice(0, period));
  const dxValues = [];
  const adxValues = [];

  for (let i = period; i < trs.length; i += 1) {
    if (i > period) {
      trSmooth = trSmooth - (trSmooth / period) + trs[i];
      plusSmooth = plusSmooth - (plusSmooth / period) + plusDM[i];
      minusSmooth = minusSmooth - (minusSmooth / period) + minusDM[i];
    }

    const plusDi = trSmooth === 0 ? 0 : (plusSmooth / trSmooth) * 100;
    const minusDi = trSmooth === 0 ? 0 : (minusSmooth / trSmooth) * 100;
    const dx = (plusDi + minusDi) === 0 ? 0 : (Math.abs(plusDi - minusDi) / (plusDi + minusDi)) * 100;
    dxValues.push({ dx, plusDi, minusDi });

    if (dxValues.length === period) {
      adxValues.push(average(dxValues.map((value) => value.dx)));
    } else if (dxValues.length > period) {
      const previousAdx = adxValues[adxValues.length - 1];
      adxValues.push(((previousAdx * (period - 1)) + dx) / period);
    }
  }

  const latest = dxValues[dxValues.length - 1] || { plusDi: 20, minusDi: 20 };
  const previous = dxValues[dxValues.length - 2] || latest;
  return {
    adx: adxValues[adxValues.length - 1] || 18,
    prevAdx: adxValues[adxValues.length - 2] || 16,
    plusDi: latest.plusDi,
    minusDi: latest.minusDi,
    prevPlusDi: previous.plusDi,
    prevMinusDi: previous.minusDi
  };
}

export function obv(candles) {
  let running = 0;
  return candles.map((candle, index) => {
    if (index === 0) {
      return 0;
    }
    const previous = candles[index - 1];
    if (candle.close > previous.close) {
      running += candle.volume;
    } else if (candle.close < previous.close) {
      running -= candle.volume;
    }
    return running;
  });
}

export function findSwingIndices(values, mode = "low", window = 3) {
  const points = [];
  for (let i = window; i < values.length - window; i += 1) {
    const value = values[i];
    const left = values.slice(i - window, i);
    const right = values.slice(i + 1, i + window + 1);
    const comparison = mode === "low"
      ? value <= Math.min(...left) && value <= Math.min(...right)
      : value >= Math.max(...left) && value >= Math.max(...right);
    if (comparison) {
      points.push(i);
    }
  }
  return points;
}

export function performance(closes, lookback) {
  if (closes.length <= lookback) {
    return 0;
  }
  const current = closes[closes.length - 1];
  const previous = closes[closes.length - 1 - lookback];
  return ((current / previous) - 1) * 100;
}

export function volumeRatio(candles, lookback = 20) {
  if (candles.length < lookback + 1) {
    return 1;
  }
  const current = candles[candles.length - 1].volume;
  const avg = average(candles.slice(-(lookback + 1), -1).map((candle) => candle.volume));
  return avg === 0 ? 1 : current / avg;
}

export function latest(series) {
  return series[series.length - 1];
}

export function deriveTrendState({ close, ema20, ema50, ema200, adx }) {
  if (close > ema20 && ema20 > ema50 && ema50 > ema200 && adx >= 24) {
    return "Strong uptrend";
  }
  if (close > ema50 && ema50 > ema200) {
    return "Uptrend";
  }
  if (close < ema20 && ema20 < ema50 && ema50 < ema200 && adx >= 24) {
    return "Strong downtrend";
  }
  if (close < ema50 && ema50 < ema200) {
    return "Downtrend";
  }
  if (Math.abs((close - ema20) / ema20) < 0.015) {
    return "Compression";
  }
  return "Mixed";
}

export function detectBullishDivergence(candles, rsiSeries) {
  const lows = candles.map((candle) => candle.low);
  const lowSwings = findSwingIndices(lows, "low", 3);
  if (lowSwings.length < 2) {
    return null;
  }
  for (let i = lowSwings.length - 1; i >= 1; i -= 1) {
    const first = lowSwings[i - 1];
    const second = lowSwings[i];
    if (second - first < 5) {
      continue;
    }
    if (lows[second] < lows[first] && rsiSeries[second] > rsiSeries[first]) {
      const swingHigh = Math.max(...candles.slice(first, second + 1).map((candle) => candle.high));
      return {
        firstIndex: first,
        secondIndex: second,
        trigger: swingHigh * 1.01,
        stop: candles[second].low * 0.995,
        detail: "Bullish divergence suggests downside momentum is weakening even though price made a fresh low."
      };
    }
  }
  return null;
}

export function detectBearishDivergence(candles, rsiSeries) {
  const highs = candles.map((candle) => candle.high);
  const highSwings = findSwingIndices(highs, "high", 3);
  if (highSwings.length < 2) {
    return null;
  }
  for (let i = highSwings.length - 1; i >= 1; i -= 1) {
    const first = highSwings[i - 1];
    const second = highSwings[i];
    if (second - first < 5) {
      continue;
    }
    if (highs[second] > highs[first] && rsiSeries[second] < rsiSeries[first]) {
      const swingLow = Math.min(...candles.slice(first, second + 1).map((candle) => candle.low));
      return {
        firstIndex: first,
        secondIndex: second,
        trigger: swingLow * 0.99,
        stop: candles[second].high * 1.005,
        detail: "Bearish divergence suggests upside momentum is fading even though price made a higher high."
      };
    }
  }
  return null;
}

export function detectLiquiditySweep(candles) {
  if (candles.length < 25) {
    return null;
  }
  const recent = candles.slice(-8);
  const current = recent[recent.length - 1];
  const previous = recent.slice(0, -1);
  const priorLow = Math.min(...previous.map((candle) => candle.low));
  const priorHigh = Math.max(...previous.map((candle) => candle.high));
  const averageVolume = average(previous.map((candle) => candle.volume));
  const closeRange = (current.close - current.low) / Math.max(current.high - current.low, 0.0001);

  if (current.low < priorLow && current.close > priorLow && current.volume > averageVolume * 1.5 && closeRange > 0.65) {
    return {
      side: "bullish",
      level: priorLow,
      detail: "Price swept beneath a prior swing low and then closed back inside the range on strong volume."
    };
  }

  if (current.high > priorHigh && current.close < priorHigh && current.volume > averageVolume * 1.5 && closeRange < 0.35) {
    return {
      side: "bearish",
      level: priorHigh,
      detail: "Price pushed above a prior swing high, failed, and closed back inside range with a decisive rejection."
    };
  }

  return null;
}

export function detectPullback(candles, ema20Series, ema50Series, ema200Series) {
  if (candles.length < 40) {
    return null;
  }
  const current = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const ema20Value = latest(ema20Series);
  const ema50Value = latest(ema50Series);
  const ema200Value = latest(ema200Series);
  const recentVolumes = candles.slice(-6).map((candle) => candle.volume);
  const pullbackVolumes = recentVolumes.slice(0, 4);
  const resumeVolume = recentVolumes[recentVolumes.length - 1];
  const volumeDrying = average(pullbackVolumes) < average(candles.slice(-25, -5).map((candle) => candle.volume));
  const nearSupport = Math.abs((current.low - ema20Value) / ema20Value) < 0.02 || Math.abs((current.low - ema50Value) / ema50Value) < 0.02;
  const bullishResume = current.close > prev.high && current.close > current.open;

  if (current.close > ema50Value && ema50Value > ema200Value && nearSupport && volumeDrying && bullishResume && resumeVolume > average(pullbackVolumes)) {
    return {
      anchor: Math.min(current.low, prev.low),
      detail: "Price pulled back into trend support with lighter volume and then resumed higher."
    };
  }
  return null;
}

export function detectBreakout(candles, period = 20) {
  if (candles.length < period + 2) {
    return null;
  }
  const current = candles[candles.length - 1];
  const priorHigh = Math.max(...candles.slice(-(period + 1), -1).map((candle) => candle.high));
  if (current.close > priorHigh) {
    return { breakoutLevel: priorHigh };
  }
  return null;
}

export function detectObvAccumulation(candles, obvSeries) {
  if (candles.length < 30) {
    return null;
  }
  const recentCloses = candles.slice(-20).map((candle) => candle.close);
  const recentHigh = Math.max(...recentCloses);
  const recentLow = Math.min(...recentCloses);
  const rangePct = ((recentHigh - recentLow) / recentLow) * 100;
  const obvSlope = obvSeries[obvSeries.length - 1] - obvSeries[obvSeries.length - 10];
  const priceDistanceToHigh = ((recentHigh - recentCloses[recentCloses.length - 1]) / recentHigh) * 100;

  if (rangePct < 7.5 && obvSlope > 0 && priceDistanceToHigh < 2.5) {
    return {
      rangeHigh: recentHigh,
      detail: "OBV is rising while price remains compressed near the breakout zone."
    };
  }
  return null;
}

export function relativeStrengthScore(stockPerf20, benchmarkPerf20) {
  const diff = stockPerf20 - benchmarkPerf20;
  return clamp(50 + (diff * 4), 0, 100);
}
