import { barsSince, calcAtr, clamp, round, zoneWidthPct } from "./helpers.mjs";

function structurePositionRatio(rows, zone, index, window = 40) {
  const slice = rows.slice(Math.max(0, index - window), index + 1);
  if (!slice.length) {
    return 0.5;
  }
  const rangeHigh = Math.max(...slice.map((item) => item.high));
  const rangeLow = Math.min(...slice.map((item) => item.low));
  const range = rangeHigh - rangeLow;
  if (range <= 0) {
    return 0.5;
  }
  const zoneMid = (zone.zoneLow + zone.zoneHigh) / 2;
  return (zoneMid - rangeLow) / range;
}

function currentRangePositionRatio(rows, price, window = 40) {
  const slice = rows.slice(Math.max(0, rows.length - window));
  if (!slice.length) {
    return 0.5;
  }
  const rangeHigh = Math.max(...slice.map((item) => item.high));
  const rangeLow = Math.min(...slice.map((item) => item.low));
  const range = rangeHigh - rangeLow;
  if (range <= 0) {
    return 0.5;
  }
  return (price - rangeLow) / range;
}

function zoneTouched(row, zone) {
  return row.low <= zone.zoneHigh && row.high >= zone.zoneLow;
}

function countRetests(rows, zone, formedIndex, direction) {
  let touches = 0;
  for (let index = formedIndex + 2; index < rows.length; index += 1) {
    const row = rows[index];
    if (!zoneTouched(row, zone)) {
      continue;
    }
    if (direction === "bullish" && row.close < zone.zoneLow) {
      return Number.POSITIVE_INFINITY;
    }
    if (direction === "bearish" && row.close > zone.zoneHigh) {
      return Number.POSITIVE_INFINITY;
    }
    touches += 1;
  }
  return touches;
}

function inferFreshness(retests) {
  if (retests === 0) return "first-touch";
  if (retests === 1) return "second-touch";
  return "stale";
}

function overlapPenalty(rows, start, end) {
  const slice = rows.slice(Math.max(0, start - 4), Math.min(rows.length, end + 5));
  if (slice.length < 4) {
    return 0;
  }
  let overlaps = 0;
  for (let index = 1; index < slice.length; index += 1) {
    const prev = slice[index - 1];
    const current = slice[index];
    const overlapLow = Math.max(prev.low, current.low);
    const overlapHigh = Math.min(prev.high, current.high);
    if (overlapHigh > overlapLow) {
      overlaps += (overlapHigh - overlapLow) / Math.max(prev.high - prev.low, current.high - current.low, 0.01);
    }
  }
  return clamp(overlaps / (slice.length - 1), 0, 1.5);
}

function computeBaseWindow(rows, pivotIndex, maxBaseCandles = 4) {
  let start = pivotIndex;
  let end = pivotIndex;
  while (start > 0 && pivotIndex - start < maxBaseCandles - 1) {
    const current = rows[start];
    const prev = rows[start - 1];
    const overlapLow = Math.max(current.low, prev.low);
    const overlapHigh = Math.min(current.high, prev.high);
    if (overlapHigh <= overlapLow) {
      break;
    }
    start -= 1;
  }
  while (end < rows.length - 1 && end - start < maxBaseCandles - 1) {
    const current = rows[end];
    const next = rows[end + 1];
    const overlapLow = Math.max(current.low, next.low);
    const overlapHigh = Math.min(current.high, next.high);
    if (overlapHigh <= overlapLow) {
      break;
    }
    end += 1;
  }
  return { start, end };
}

function evaluateDeparture(rows, direction, zone, pivotIndex, departureWindow, atrValue, lookback = 20) {
  const future = rows.slice(pivotIndex + 1, pivotIndex + 1 + departureWindow);
  const prior = rows.slice(Math.max(0, pivotIndex - lookback), pivotIndex);
  if (!future.length || !prior.length) {
    return {
      departureStrength: 0,
      structureBreak: false,
      displacement: false
    };
  }

  const priorHigh = Math.max(...prior.map((item) => item.high));
  const priorLow = Math.min(...prior.map((item) => item.low));
  const strongestBody = Math.max(...future.map((item) => Math.abs(item.close - item.open)));
  if (direction === "bullish") {
    return {
      departureStrength: (Math.max(...future.map((item) => item.high)) - zone.zoneHigh) / Math.max(atrValue, 0.01),
      structureBreak: Math.max(...future.map((item) => item.high)) > priorHigh,
      displacement: strongestBody >= Math.max(atrValue * 0.95, 0.01) && future.some((item) => item.close > zone.zoneHigh)
    };
  }

  return {
    departureStrength: (zone.zoneLow - Math.min(...future.map((item) => item.low))) / Math.max(atrValue, 0.01),
    structureBreak: Math.min(...future.map((item) => item.low)) < priorLow,
    displacement: strongestBody >= Math.max(atrValue * 0.95, 0.01) && future.some((item) => item.close < zone.zoneLow)
  };
}

function baseQualityScore({ baseCandles, departureStrength, structureBreak, displacement, overlap }) {
  let score = 10;
  score += clamp((4 - baseCandles) * 2, 0, 6);
  score += clamp(departureStrength * 2.6, 0, 8);
  score += structureBreak ? 4 : 0;
  score += displacement ? 4 : 0;
  score -= clamp(overlap * 5, 0, 6);
  return clamp(Math.round(score), 0, 30);
}

export function buildZones(rows, timeframeName, impulseThreshold = 1.5, options = {}) {
  const {
    allowLooseDemand = false
  } = options;
  const swingWindow = timeframeName === "Weekly" ? 2 : timeframeName === "1H" ? 4 : 3;
  const departureWindow = timeframeName === "Weekly" ? 4 : timeframeName === "1H" ? 8 : 6;
  const ageLimit = timeframeName === "Weekly" ? 110 : timeframeName === "1H" ? 80 : 90;
  if (rows.length < swingWindow * 2 + departureWindow + 12) {
    return [];
  }

  const atr = calcAtr(rows, 14);
  const zones = [];

  for (let index = swingWindow; index < rows.length - departureWindow; index += 1) {
    const row = rows[index];
    const atrValue = atr[index];
    if (!atrValue) {
      continue;
    }

    const left = rows.slice(index - swingWindow, index);
    const right = rows.slice(index + 1, index + 1 + swingWindow);
    const isPivotLow = row.low <= Math.min(...left.map((item) => item.low)) && row.low <= Math.min(...right.map((item) => item.low));
    const isPivotHigh = row.high >= Math.max(...left.map((item) => item.high)) && row.high >= Math.max(...right.map((item) => item.high));

    if (!isPivotLow && !isPivotHigh) {
      continue;
    }

    const { start, end } = computeBaseWindow(rows, index, 4);
    const baseRows = rows.slice(start, end + 1);
    const baseCandles = baseRows.length;
    const overlap = overlapPenalty(rows, start, end);
    const ageBars = rows.length - index - 1;
    if (ageBars > ageLimit) {
      continue;
    }

    if (isPivotLow) {
      const zone = {
        direction: "bullish",
        zoneType: "demand",
        timeframe: timeframeName,
        formedAt: rows[end].datetime,
        zoneLow: Math.min(...baseRows.map((item) => item.low)),
        zoneHigh: Math.max(...baseRows.map((item) => Math.max(item.open, item.close))),
        baseStart: rows[start].datetime,
        baseEnd: rows[end].datetime,
        baseCandles
      };
      const departure = evaluateDeparture(rows, "bullish", zone, end, departureWindow, atrValue);
      const retests = countRetests(rows, zone, end, "bullish");
      const freshness = inferFreshness(retests);
      const positionRatio = structurePositionRatio(rows, zone, end);
      const widthPct = zoneWidthPct(zone, row.close);
      const baseQuality = baseQualityScore({ baseCandles, overlap, ...departure });

      const demandImpulseFloor = allowLooseDemand ? impulseThreshold * 0.92 : impulseThreshold;
      const demandPositionLimit = allowLooseDemand ? 0.64 : 0.56;
      const demandRetestLimit = allowLooseDemand ? 4 : 3;
      const demandWidthLimit = allowLooseDemand ? 22 : 18;

      if (
        departure.departureStrength >= demandImpulseFloor &&
        positionRatio <= demandPositionLimit &&
        retests <= demandRetestLimit &&
        widthPct <= demandWidthLimit
      ) {
        zones.push({
          ...zone,
          freshness,
          retests,
          ageBars,
          atr: round(atrValue),
          departureStrength: round(departure.departureStrength),
          structureBreak: departure.structureBreak,
          displacement: departure.displacement,
          overlapScore: round(overlap),
          positionRatio: round(positionRatio, 3),
          baseQuality
        });
      }
    }

    if (isPivotHigh) {
      const zone = {
        direction: "bearish",
        zoneType: "supply",
        timeframe: timeframeName,
        formedAt: rows[end].datetime,
        zoneLow: Math.min(...baseRows.map((item) => Math.min(item.open, item.close))),
        zoneHigh: Math.max(...baseRows.map((item) => item.high)),
        baseStart: rows[start].datetime,
        baseEnd: rows[end].datetime,
        baseCandles
      };
      const departure = evaluateDeparture(rows, "bearish", zone, end, departureWindow, atrValue);
      const retests = countRetests(rows, zone, end, "bearish");
      const freshness = inferFreshness(retests);
      const positionRatio = structurePositionRatio(rows, zone, end);
      const widthPct = zoneWidthPct(zone, row.close);
      const baseQuality = baseQualityScore({ baseCandles, overlap, ...departure });

      if (
        departure.departureStrength >= impulseThreshold &&
        positionRatio >= 0.44 &&
        retests <= 3 &&
        widthPct <= 18
      ) {
        zones.push({
          ...zone,
          freshness,
          retests,
          ageBars,
          atr: round(atrValue),
          departureStrength: round(departure.departureStrength),
          structureBreak: departure.structureBreak,
          displacement: departure.displacement,
          overlapScore: round(overlap),
          positionRatio: round(positionRatio, 3),
          baseQuality
        });
      }
    }
  }

  const unique = [];
  const seen = new Set();
  [...zones].reverse().forEach((zone) => {
    const key = `${zone.direction}:${zone.zoneLow.toFixed(2)}:${zone.zoneHigh.toFixed(2)}`;
    if (seen.has(key) || unique.length >= 8) {
      return;
    }
    seen.add(key);
    unique.push(zone);
  });

  return unique.reverse();
}

export function barsSinceLastZoneTouch(rows, zone) {
  return barsSince(rows, (row) => zoneTouched(row, zone));
}

export function favorableZonePosition(price, zone, direction, allowLoosePosition = false) {
  if (price < zone.zoneLow || price > zone.zoneHigh) {
    return true;
  }
  const width = zone.zoneHigh - zone.zoneLow;
  if (width <= 0) {
    return false;
  }
  const pricePosition = (price - zone.zoneLow) / width;
  if (direction === "bullish") {
    return pricePosition <= (allowLoosePosition ? 0.92 : 0.8);
  }
  return pricePosition >= (allowLoosePosition ? 0.12 : 0.2);
}

export function findNearestOpposingZone(zones, currentPrice, direction) {
  if (direction === "bullish") {
    return zones
      .filter((zone) => zone.direction === "bearish" && zone.zoneLow > currentPrice)
      .sort((a, b) => a.zoneLow - b.zoneLow)[0] || null;
  }
  return zones
    .filter((zone) => zone.direction === "bullish" && zone.zoneHigh < currentPrice)
    .sort((a, b) => b.zoneHigh - a.zoneHigh)[0] || null;
}

export function hasAdequateRoom(zone, opposingZone, currentPrice, allowLooseRoom = false) {
  if (!opposingZone || !currentPrice) {
    return true;
  }
  const roomPct = zone.direction === "bullish"
    ? ((opposingZone.zoneLow - currentPrice) / currentPrice) * 100
    : ((currentPrice - opposingZone.zoneHigh) / currentPrice) * 100;
  const minRoomPct = allowLooseRoom
    ? Math.max(zoneWidthPct(zone, currentPrice) * 0.8, 0.45)
    : Math.max(zoneWidthPct(zone, currentPrice) * 1.2, 0.9);
  return roomPct >= minRoomPct;
}

export function buildTrendContext(rows) {
  const closes = rows.map((row) => row.close);
  const recent = closes.slice(-30);
  const slope = recent.length > 1 ? (recent[recent.length - 1] - recent[0]) / Math.max(recent[0], 0.01) : 0;
  return {
    currentRangeRatio: round(currentRangePositionRatio(rows, closes[closes.length - 1]), 3),
    slopePct: round(slope * 100, 2)
  };
}
