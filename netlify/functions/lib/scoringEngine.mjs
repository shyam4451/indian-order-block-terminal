import { clamp, round, zoneWidthPct } from "./helpers.mjs";

function freshnessScore(zone) {
  const freshnessBase = {
    "first-touch": 15,
    "second-touch": 10,
    stale: 4
  }[zone.freshness] || 4;
  return clamp(Math.round(freshnessBase - Math.min(zone.ageBars / 18, 4)), 0, 15);
}

function zoneScore(zone) {
  return clamp(Math.round((zone.baseQuality / 30) * 20), 0, 20);
}

function sweepScore(trigger) {
  if (!trigger?.sweep?.detected) {
    return 0;
  }
  return clamp(Math.round(6 + (trigger.sweep.strength / 100) * 9), 0, 15);
}

function confirmationScore(trigger) {
  let score = 0;
  if (trigger?.bos?.detected) score += 7;
  if (trigger?.confirmation?.detected) score += 6;
  if (trigger?.volume?.detected) score += 2;
  return clamp(score, 0, 15);
}

function divergenceScore(divergence) {
  if (!divergence) {
    return 0;
  }
  const typeBonus = divergence.type.includes("hidden") ? 6 : 8;
  return clamp(Math.round(typeBonus + (divergence.strength / 100) * 2), 0, 10);
}

function rrScore(levels) {
  if (!levels?.rrPotential) {
    return 0;
  }
  return clamp(Math.round(Math.min(levels.rrPotential, 3) / 3 * 15), 0, 15);
}

function trendScore(trendAlignment) {
  return clamp(Math.round(trendAlignment), 0, 10);
}

function strongestFactors(breakdown, divergence) {
  const items = [
    ["Zone quality", breakdown.zoneQuality],
    ["Freshness", breakdown.freshness],
    ["Sweep quality", breakdown.sweepQuality],
    ["Confirmation", breakdown.confirmation],
    ["Divergence", breakdown.divergence],
    ["R:R potential", breakdown.rrPotential],
    ["Trend alignment", breakdown.trendAlignment]
  ];
  return items
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label]) => label === "Divergence" && divergence ? `${divergence.label} support` : label);
}

export function scoreSetup({ zone, trigger, divergence, levels, trendAlignment }) {
  const breakdown = {
    zoneQuality: zoneScore(zone),
    freshness: freshnessScore(zone),
    sweepQuality: sweepScore(trigger),
    confirmation: confirmationScore(trigger),
    divergence: divergenceScore(divergence),
    rrPotential: rrScore(levels),
    trendAlignment: trendScore(trendAlignment)
  };

  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  return {
    total: clamp(Math.round(total), 0, 100),
    breakdown,
    strongestFactors: strongestFactors(breakdown, divergence)
  };
}

export function buildLevels({ currentPrice, zone, opposingZone }) {
  const buffer = Math.max((zone.zoneHigh - zone.zoneLow) * 0.12, currentPrice * 0.002);
  const invalidation = zone.direction === "bullish"
    ? zone.zoneLow - buffer
    : zone.zoneHigh + buffer;
  const entryReference = currentPrice >= zone.zoneLow && currentPrice <= zone.zoneHigh
    ? currentPrice
    : zone.direction === "bullish"
      ? zone.zoneHigh
      : zone.zoneLow;
  const target1 = opposingZone
    ? (zone.direction === "bullish" ? opposingZone.zoneLow : opposingZone.zoneHigh)
    : zone.direction === "bullish"
      ? entryReference + (zone.zoneHigh - zone.zoneLow) * 3
      : entryReference - (zone.zoneHigh - zone.zoneLow) * 3;
  const risk = Math.abs(entryReference - invalidation);
  const reward = Math.abs(target1 - entryReference);
  const rrPotential = risk > 0 ? reward / risk : 0;

  return {
    entryReference: round(entryReference),
    invalidation: round(invalidation),
    target1: round(target1),
    target2: round(zone.direction === "bullish" ? target1 + risk : target1 - risk),
    rrPotential: round(rrPotential, 2),
    zoneWidthPct: round(zoneWidthPct(zone, currentPrice), 2)
  };
}
