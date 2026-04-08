import {
  detectBearishDivergence,
  detectBreakout,
  detectBullishDivergence,
  detectLiquiditySweep,
  detectObvAccumulation,
  detectPullback
} from "./analytics.js";

function scannerRecord(stock, scanner, direction, extras = {}) {
  return {
    id: `${scanner}:${stock.symbol}`,
    symbol: stock.symbol,
    company: stock.company,
    sector: stock.sector,
    scanner,
    direction,
    trendState: stock.trendState,
    close: stock.close,
    volumeRatio: stock.volumeRatio,
    adx: stock.adx,
    relativeStrengthScore: stock.relativeStrengthScore,
    grade: stock.grade,
    summary: extras.summary,
    confirm: extras.confirm,
    invalidate: extras.invalidate,
    traderType: extras.traderType,
    risk: extras.risk,
    trigger: extras.trigger ?? null,
    stop: extras.stop ?? null
  };
}

export function runScanners(stocks, filters = {}) {
  const filtered = stocks.filter((stock) => {
    if (filters.universe === "cash" && stock.futuresEligible) {
      return false;
    }
    if (filters.universe === "futures" && !stock.futuresEligible) {
      return false;
    }
    if (filters.sector && filters.sector !== "all" && stock.sector !== filters.sector) {
      return false;
    }
    if (filters.trend && filters.trend !== "all" && stock.trendState !== filters.trend) {
      return false;
    }
    if (filters.marketCap && filters.marketCap !== "all" && stock.marketCapBucket !== filters.marketCap) {
      return false;
    }
    if (filters.minVolume && stock.avgDailyVolume < filters.minVolume) {
      return false;
    }
    if (filters.maxAtr && stock.atrPercent > filters.maxAtr) {
      return false;
    }
    return true;
  });

  const results = {
    momentumBreakout: [],
    rsiBullishDivergence: [],
    rsiBearishDivergence: [],
    adxExpansion: [],
    obvAccumulation: [],
    liquiditySweep: [],
    pullbackTrend: []
  };

  filtered.forEach((stock) => {
    const breakout20 = detectBreakout(stock.candles, 20);
    const breakout55 = detectBreakout(stock.candles, 55);
    const bullishDivergence = detectBullishDivergence(stock.candles, stock.rsiSeries);
    const bearishDivergence = detectBearishDivergence(stock.candles, stock.rsiSeries);
    const liquiditySweep = detectLiquiditySweep(stock.candles);
    const pullback = detectPullback(stock.candles, stock.ema20Series, stock.ema50Series, stock.ema200Series);
    const obvAccumulation = detectObvAccumulation(stock.candles, stock.obvSeries);

    const priceAbove200 = stock.close > stock.ema200;
    const trendAligned = stock.ema20 > stock.ema50;
    const adxBullish = stock.adx > stock.adxThreshold && stock.plusDi > stock.minusDi && stock.prevPlusDi <= stock.prevMinusDi;
    const adxBearish = stock.adx > stock.adxThreshold && stock.minusDi > stock.plusDi && stock.prevMinusDi <= stock.prevPlusDi;

    if (priceAbove200 && trendAligned && (breakout20 || breakout55) && stock.volumeRatio >= 1.5 && stock.adx >= stock.adxThreshold) {
      const breakout = breakout55 || breakout20;
      results.momentumBreakout.push(
        scannerRecord(stock, "Momentum Breakout", "bullish", {
          summary: "Strong stock already in an uptrend is attempting fresh price expansion with volume support.",
          confirm: "A close through the breakout level with continued volume and broad market support.",
          invalidate: "Failure back below the breakout zone or a fast reversal on weak breadth.",
          traderType: "Swing and short-term positional traders.",
          risk: "Late breakouts can fail quickly if volume fades after the first expansion day.",
          trigger: breakout.breakoutLevel,
          stop: Math.min(stock.ema20, stock.candles[stock.candles.length - 3].low)
        })
      );
    }

    if (bullishDivergence && stock.rsi <= 42) {
      results.rsiBullishDivergence.push(
        scannerRecord(stock, "RSI Bullish Divergence", "bullish", {
          summary: bullishDivergence.detail,
          confirm: "Price reclaiming the swing high between the two troughs.",
          invalidate: "A breakdown below the second trough low.",
          traderType: "Countertrend swing traders waiting for confirmation.",
          risk: "Divergence can persist in weak stocks before a real reversal begins.",
          trigger: bullishDivergence.trigger,
          stop: bullishDivergence.stop
        })
      );
    }

    if (bearishDivergence && stock.rsi >= 58) {
      results.rsiBearishDivergence.push(
        scannerRecord(stock, "RSI Bearish Divergence", "bearish", {
          summary: bearishDivergence.detail,
          confirm: "Price losing the swing low between the two peaks.",
          invalidate: "Strength above the second peak high.",
          traderType: "Short-term short sellers or longs using it as a caution signal.",
          risk: "Strong uptrends can ignore divergence much longer than expected.",
          trigger: bearishDivergence.trigger,
          stop: bearishDivergence.stop
        })
      );
    }

    if (adxBullish || adxBearish) {
      results.adxExpansion.push(
        scannerRecord(stock, "ADX Expansion", adxBullish ? "bullish" : "bearish", {
          summary: "ADX is rising and directional control is shifting, suggesting trend ignition.",
          confirm: "A decisive break through the recent swing in the direction of DI control.",
          invalidate: "ADX flattening while price slips back inside the prior range.",
          traderType: "Trend traders looking for early expansion phases.",
          risk: "High ADX after an already extended move can be closer to exhaustion than ignition."
        })
      );
    }

    if (obvAccumulation && stock.volumeRatio >= 1) {
      results.obvAccumulation.push(
        scannerRecord(stock, "OBV / Accumulation", "bullish", {
          summary: obvAccumulation.detail,
          confirm: "Breakout above range resistance with volume expansion.",
          invalidate: "OBV rolling over while price loses the lower end of the range.",
          traderType: "Breakout traders stalking accumulation before expansion.",
          risk: "Range-bound names can stay range-bound longer than expected.",
          trigger: obvAccumulation.rangeHigh
        })
      );
    }

    if (liquiditySweep) {
      results.liquiditySweep.push(
        scannerRecord(stock, "Liquidity Sweep Reversal", liquiditySweep.side, {
          summary: liquiditySweep.detail,
          confirm: "A follow-through candle away from the trapped liquidity zone.",
          invalidate: liquiditySweep.side === "bullish"
            ? "Price closing back below the reclaimed low."
            : "Price reclaiming the rejected high.",
          traderType: "Discretionary reversal and mean-reversion traders.",
          risk: "A weak reclaim can just be noise inside a continuing trend.",
          trigger: liquiditySweep.level
        })
      );
    }

    if (pullback) {
      results.pullbackTrend.push(
        scannerRecord(stock, "Pullback In Trend", "bullish", {
          summary: pullback.detail,
          confirm: "A strong resume candle and continued support above the pullback anchor.",
          invalidate: "Price losing the pullback low or slipping under trend support.",
          traderType: "Swing traders wanting better location than chasing breakouts.",
          risk: "A shallow-looking pullback can become a deeper trend failure if the market weakens.",
          trigger: stock.close,
          stop: pullback.anchor
        })
      );
    }
  });

  Object.keys(results).forEach((key) => {
    results[key].sort((a, b) => b.relativeStrengthScore - a.relativeStrengthScore);
  });

  return results;
}

export function flattenScannerResults(results) {
  return Object.values(results).flat();
}
