import { clamp } from "./utils.js";

export function scoreStocks(stocks, sectors, futuresMap, newsMap) {
  const sectorMap = new Map(sectors.map((sector) => [sector.name, sector]));

  return stocks.map((stock) => {
    const sectorScore = sectorMap.get(stock.sector)?.compositeScore ?? 50;
    const futuresScore = futuresMap.get(stock.symbol)?.contextScore ?? 50;
    const newsScore = newsMap.get(stock.symbol)?.importanceScore ?? 35;
    const breakoutReadiness = clamp(
      (stock.volumeRatio * 18) +
      (stock.adx * 1.4) +
      (stock.close > stock.ema20 ? 8 : 0) +
      (stock.close > stock.ema50 ? 8 : 0),
      0,
      100
    );

    const score = clamp(
      (stock.trendScore * 0.2) +
      (sectorScore * 0.16) +
      (stock.relativeStrengthScore * 0.16) +
      (stock.volumeScore * 0.12) +
      (futuresScore * 0.12) +
      (stock.adxScore * 0.1) +
      (breakoutReadiness * 0.08) +
      (newsScore * 0.06),
      0,
      100
    );

    const grade = score >= 82 ? "A+" : score >= 72 ? "A" : score >= 60 ? "B" : "Weak / avoid";
    const summaryParts = [];
    if (stock.trendScore > 70) {
      summaryParts.push("strong trend");
    }
    if (sectorScore > 68) {
      summaryParts.push("strong sector");
    }
    if (stock.adxScore > 65) {
      summaryParts.push("rising ADX");
    }
    if (futuresScore > 62 && futuresMap.get(stock.symbol)?.interpretationLabel) {
      summaryParts.push(futuresMap.get(stock.symbol).interpretationLabel.toLowerCase());
    }
    if (stock.volumeScore > 60) {
      summaryParts.push("volume confirmation");
    }

    return {
      ...stock,
      score,
      grade,
      summary: summaryParts.length
        ? `${summaryParts.slice(0, 4).join(", ")}, and nearby setup readiness.`
        : "Mixed trend, lighter confirmation, and lower priority versus stronger names."
    };
  }).sort((a, b) => b.score - a.score);
}
