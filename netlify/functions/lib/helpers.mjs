export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function round(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return null;
  }
  return Number(Number(value).toFixed(digits));
}

export function rollingAverage(values, window) {
  return values.map((_, index) => {
    if (index + 1 < window) {
      return null;
    }
    const slice = values.slice(index + 1 - window, index + 1);
    return slice.reduce((sum, value) => sum + value, 0) / slice.length;
  });
}

export function ema(values, length) {
  if (!values.length) {
    return [];
  }
  const multiplier = 2 / (length + 1);
  const output = Array(values.length).fill(null);
  let previous = values[0];
  output[0] = previous;
  for (let index = 1; index < values.length; index += 1) {
    previous = ((values[index] - previous) * multiplier) + previous;
    output[index] = previous;
  }
  return output;
}

export function calcAtr(rows, window = 14) {
  const trueRanges = rows.map((row, index) => {
    if (index === 0) {
      return row.high - row.low;
    }
    const prevClose = rows[index - 1].close;
    return Math.max(
      row.high - row.low,
      Math.abs(row.high - prevClose),
      Math.abs(row.low - prevClose)
    );
  });
  return rollingAverage(trueRanges, window);
}

export function distanceToZone(price, zoneLow, zoneHigh) {
  if (price >= zoneLow && price <= zoneHigh) {
    return { distancePct: 0, insideZone: "yes" };
  }
  if (price < zoneLow) {
    return { distancePct: ((zoneLow - price) / price) * 100, insideZone: "no" };
  }
  return { distancePct: ((price - zoneHigh) / price) * 100, insideZone: "no" };
}

export function zoneWidthPct(zone, referencePrice) {
  if (!referencePrice) {
    return 0;
  }
  return ((zone.zoneHigh - zone.zoneLow) / referencePrice) * 100;
}

export function barsSince(rows, predicate) {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (predicate(rows[index], index)) {
      return rows.length - 1 - index;
    }
  }
  return Number.POSITIVE_INFINITY;
}

export function buildStableUniverseOrder(symbols) {
  const buckets = new Map();
  symbols.forEach((symbol) => {
    const bucketKey = symbol[0]?.toUpperCase() || "#";
    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, []);
    }
    buckets.get(bucketKey).push(symbol);
  });

  const orderedKeys = [...buckets.keys()].sort();
  const stable = [];
  let added = true;

  while (added) {
    added = false;
    orderedKeys.forEach((key) => {
      const bucket = buckets.get(key);
      if (bucket?.length) {
        stable.push(bucket.shift());
        added = true;
      }
    });
  }

  return stable;
}

export function stripHtml(text) {
  return text
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
