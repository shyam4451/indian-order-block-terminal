import { clamp, round } from "./helpers.mjs";

export function classifySetup({ mode, zone, trigger, divergence }) {
  if (mode === "Scalp") {
    if (trigger?.sweep?.detected && divergence) {
      return "Scalp reversal after sweep + divergence";
    }
    return "Scalp pullback continuation";
  }

  if (zone.freshness === "first-touch" && !trigger?.sweep?.detected) {
    return "HTF first-touch reversal";
  }
  if (trigger?.sweep?.detected) {
    return "HTF retest after liquidity sweep";
  }
  if (divergence) {
    return "Divergence-supported reversal";
  }
  return zone.direction === "bullish" ? "Continuation from demand" : "Continuation from supply";
}

export function deriveSetupState({ insideZone, trigger, invalidated }) {
  if (invalidated) return "Invalidated";
  if (trigger?.sweep?.detected && trigger?.confirmation?.detected) return "LTF Confirmed";
  if (trigger?.sweep?.detected) return "LTF Sweep Seen";
  if (insideZone === "yes") return "At HTF Zone";
  return "Near HTF Zone";
}

export function buildWarnings({ zone, divergence, levels, opposingZone, trigger }) {
  const warnings = [];
  if (zone.freshness !== "first-touch") {
    warnings.push(`Zone is ${zone.freshness.replace("-", " ")}`);
  }
  if (zone.overlapScore > 0.85) {
    warnings.push("Base is messy / overlapping");
  }
  if (divergence && divergence.strength < 55) {
    warnings.push("Divergence is weak");
  }
  if (levels.rrPotential < 1.5) {
    warnings.push("Reward-to-risk is mediocre");
  }
  if (!trigger?.confirmation?.detected && trigger?.sweep?.detected) {
    warnings.push("Sweep has not fully confirmed");
  }
  if (opposingZone) {
    warnings.push(`Nearby opposing ${opposingZone.zoneType}`);
  }
  return warnings.slice(0, 4);
}

export function buildExplanation({ symbol, zone, trigger, divergence, levels, setupType, state }) {
  const reasons = [
    `${symbol} is reacting from ${zone.freshness.replace("-", " ")} ${zone.timeframe} ${zone.zoneType}`,
    `Departure strength ${zone.departureStrength} ATR with ${zone.structureBreak ? "structure break" : "no structure break"}`,
    `${zone.baseCandles}-candle base with overlap score ${zone.overlapScore}`
  ];

  if (trigger?.sweep?.detected) {
    reasons.push(`${trigger.timeframe} swept liquidity ${trigger.sweep.barsAgo} candle(s) ago and reclaimed`);
  }
  if (trigger?.bos?.detected) {
    reasons.push(`${trigger.timeframe} broke lower-timeframe structure back in setup direction`);
  }
  if (trigger?.confirmation?.detected) {
    reasons.push(`${trigger.timeframe} confirmation candle printed after the trigger`);
  }
  if (divergence) {
    reasons.push(`${divergence.label} detected on ${divergence.timeframe} and aligned with the zone`);
  }
  reasons.push(`Reference invalidation ${levels.invalidation} and first target ${levels.target1}`);

  return {
    summary: `${setupType} | ${state} | ${zone.timeframe} ${zone.zoneType}`,
    reasons: reasons.slice(0, 6)
  };
}

export function buildSignalRecord({ symbol, direction, setupType, score, divergence, levels, generatedAt, zone, trigger, marketType }) {
  return {
    signalId: `${symbol}:${zone.timeframe}:${direction}:${generatedAt}`,
    timestamp: generatedAt,
    symbol,
    marketType,
    direction,
    setupType,
    score,
    divergenceType: divergence?.type || null,
    entryReference: levels.entryReference,
    stopReference: levels.invalidation,
    targetReference: levels.target1,
    target2Reference: levels.target2,
    maxFavorableExcursion: null,
    maxAdverseExcursion: null,
    outcomeAfterXCandles: null,
    hit1R: null,
    hit2R: null,
    stopped: null,
    zoneTimeframe: zone.timeframe,
    triggerTimeframe: trigger?.timeframe || null
  };
}

export function buildTrendAlignment({ direction, trendContext, zone }) {
  let score = 5;
  if (direction === "bullish" && trendContext.slopePct >= 0) score += 2.5;
  if (direction === "bearish" && trendContext.slopePct <= 0) score += 2.5;
  if (direction === "bullish" && trendContext.currentRangeRatio <= 0.6) score += 2.5;
  if (direction === "bearish" && trendContext.currentRangeRatio >= 0.4) score += 2.5;
  if (zone.structureBreak) score += 1;
  return clamp(round(score, 1), 0, 10);
}
