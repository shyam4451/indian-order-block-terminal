const elements = {
  scanButton: document.getElementById("scanButton"),
  universe: document.getElementById("universe"),
  limit: document.getElementById("limit"),
  proximity: document.getElementById("proximity"),
  impulse: document.getElementById("impulse"),
  minTimeframes: document.getElementById("minTimeframes"),
  metricScanned: document.getElementById("metricScanned"),
  metricMatches: document.getElementById("metricMatches"),
  metricBullish: document.getElementById("metricBullish"),
  metricIndices: document.getElementById("metricIndices"),
  stocksBody: document.getElementById("stocksBody"),
  indicesGrid: document.getElementById("indicesGrid"),
  scanMeta: document.getElementById("scanMeta"),
  marketTape: document.getElementById("marketTape"),
  newsFeed: document.getElementById("newsFeed"),
  sectorSentiment: document.getElementById("sectorSentiment"),
  biasFilter: document.getElementById("biasFilter"),
  divergenceFilter: document.getElementById("divergenceFilter"),
  zoneFilter: document.getElementById("zoneFilter"),
  timeframeFilter: document.getElementById("timeframeFilter"),
  qualityFilter: document.getElementById("qualityFilter"),
  sortBy: document.getElementById("sortBy")
};

const qualityOrder = {
  S: 5,
  "A+": 4,
  A: 3,
  B: 2,
  Watch: 1
};

const state = {
  latestPayload: null
};

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }
  return Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function formatDate(value) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function qualityClass(quality) {
  if (quality === "S") return "s-tier";
  if (quality === "A+" || quality === "A") return "bullish";
  if (quality === "B") return "neutral";
  return "muted";
}

function divergenceClass(divergence) {
  if (divergence === "bullish") return "bullish";
  if (divergence === "bearish") return "bearish";
  return "neutral";
}

function buildFilteredStocks() {
  if (!state.latestPayload) {
    return [];
  }

  const filters = {
    bias: elements.biasFilter.value,
    divergence: elements.divergenceFilter.value,
    zone: elements.zoneFilter.value,
    timeframe: elements.timeframeFilter.value,
    quality: elements.qualityFilter.value,
    sortBy: elements.sortBy.value
  };

  const filtered = state.latestPayload.stocks.filter((row) => {
    if (filters.bias !== "all" && row.direction !== filters.bias) return false;
    if (filters.divergence !== "all" && (row.divergence || "none") !== filters.divergence) return false;
    if (filters.zone === "inside" && row.insideZone !== "yes") return false;
    if (filters.zone === "near" && row.insideZone !== "no") return false;
    if (filters.timeframe !== "all" && row.timeframe !== filters.timeframe) return false;
    if (filters.quality !== "all" && row.tradeQuality !== filters.quality) return false;
    return true;
  });

  filtered.sort((a, b) => {
    switch (filters.sortBy) {
      case "distance":
        return a.distancePct - b.distancePct;
      case "quality":
        return (qualityOrder[b.tradeQuality] || 0) - (qualityOrder[a.tradeQuality] || 0) || b.score - a.score;
      case "confluence":
        return b.matchedTimeframes - a.matchedTimeframes || b.score - a.score;
      case "rr":
        return b.riskReward1 - a.riskReward1 || b.score - a.score;
      case "recent":
        return new Date(b.formedAt) - new Date(a.formedAt);
      case "score":
      default:
        return b.score - a.score || a.distancePct - b.distancePct;
    }
  });

  return filtered;
}

function stockRowMarkup(row) {
  const divergence = row.divergence || "none";
  const biasClass = row.direction === "bullish" ? "bullish" : "bearish";
  const divergenceTone = divergenceClass(divergence);
  const distanceClass = row.insideZone === "yes" ? "inside-yes" : "inside-no";
  const sweepClass = row.liquiditySweepConfirmed ? "bullish" : "neutral";
  const qualityTone = qualityClass(row.tradeQuality);

  return `
    <tr>
      <td>
        <div class="stock-cell">
          <span class="stock-symbol">${row.symbol}</span>
          <span class="stock-subline">${row.matchedTimeframes} timeframes aligned</span>
        </div>
      </td>
      <td>${row.timeframe}</td>
      <td><span class="badge ${biasClass}">${row.direction}</span></td>
      <td>${formatNumber(row.currentPrice)}</td>
      <td>
        <div class="zone-cell">
          <span class="zone-range">${formatNumber(row.zoneLow)} - ${formatNumber(row.zoneHigh)}</span>
          <span class="zone-date">Formed ${formatDate(row.formedAt)}</span>
        </div>
      </td>
      <td>
        <div class="distance-cell">
          <span class="distance-value ${distanceClass}">${formatNumber(row.distancePct)}%</span>
          <span class="distance-state ${distanceClass}">${row.insideZone === "yes" ? "inside zone" : "near zone"}</span>
        </div>
      </td>
      <td><span class="badge ${sweepClass}">${row.liquiditySweepConfirmed ? "sweep" : "none"}</span></td>
      <td><span class="badge ${divergenceTone}">${divergence}</span></td>
      <td>
        <div class="plan-cell">
          <span>E ${formatNumber(row.entry)}</span>
          <span>SL ${formatNumber(row.stopLoss)}</span>
          <span>TP1 ${formatNumber(row.takeProfit1)}</span>
        </div>
      </td>
      <td>
        <div class="plan-cell">
          <span>TP2 ${formatNumber(row.takeProfit2)}</span>
          <span>1:${formatNumber(row.riskReward1)}</span>
        </div>
      </td>
      <td><span class="badge ${qualityTone}">${row.tradeQuality}</span></td>
      <td><span class="score-pill">${formatNumber(row.score)}</span></td>
    </tr>
  `;
}

function indexCardMarkup(item) {
  const divergence = item.divergence || "none";
  const biasClass = item.direction === "bullish" ? "bullish" : "bearish";
  const divergenceTone = divergenceClass(divergence);
  const qualityTone = qualityClass(item.tradeQuality);
  return `
    <article class="index-card">
      <div class="index-header">
        <h3>${item.name}</h3>
        <span class="badge ${qualityTone}">${item.tradeQuality}</span>
      </div>
      <div class="chip-grid">
        <span class="chip ${biasClass}">${item.direction || "watch"}</span>
        <span class="chip ${divergenceTone}">RSI ${divergence}</span>
        <span class="chip">${item.timeframe || "multi-timeframe"}</span>
      </div>
      <div class="index-grid">
        <div>
          <span class="label">Current</span>
          <span class="value">${formatNumber(item.currentPrice)}</span>
        </div>
        <div>
          <span class="label">Distance</span>
          <span class="value ${item.insideZone === "yes" ? "inside-yes" : "inside-no"}">${formatNumber(item.distancePct)}%</span>
        </div>
        <div>
          <span class="label">Entry / SL</span>
          <span class="value">${formatNumber(item.entry)} / ${formatNumber(item.stopLoss)}</span>
        </div>
        <div>
          <span class="label">TP1 / RR</span>
          <span class="value">${formatNumber(item.takeProfit1)} / 1:${formatNumber(item.riskReward1)}</span>
        </div>
      </div>
    </article>
  `;
}

function tapeCardMarkup(item) {
  const tone = Number(item.change) >= 0 ? "bullish" : "bearish";
  const sign = Number(item.change) >= 0 ? "+" : "";
  return `
    <article class="tape-card">
      <span class="label">${item.name}</span>
      <strong>${formatNumber(item.price)}</strong>
      <small class="${tone}">${sign}${formatNumber(item.change)} (${sign}${formatNumber(item.changePct)}%)</small>
    </article>
  `;
}

function newsCardMarkup(item) {
  return `
    <a class="news-card" href="${item.link}" target="_blank" rel="noreferrer">
      <span class="news-tag">${item.sourceQuery}</span>
      <h4>${item.title}</h4>
      <small>${item.pubDate ? formatDate(item.pubDate) : "Latest"}</small>
    </a>
  `;
}

function sectorCardMarkup(item) {
  const tone = item.sentimentScore >= 20 ? "bullish" : item.sentimentScore <= -5 ? "bearish" : "neutral";
  return `
    <article class="sector-card">
      <div class="sector-head">
        <strong>${item.sector}</strong>
        <span class="badge ${qualityClass(item.topQuality)}">${item.topQuality}</span>
      </div>
      <div class="sector-stats">
        <span>Sentiment <strong class="${tone}">${formatNumber(item.sentimentScore, 1)}</strong></span>
        <span>Avg Score <strong>${formatNumber(item.avgScore)}</strong></span>
        <span>Avg R:R <strong>1:${formatNumber(item.avgRR)}</strong></span>
      </div>
    </article>
  `;
}

function renderStocks(rows) {
  if (!rows.length) {
    elements.stocksBody.innerHTML = '<tr><td colspan="12" class="empty-state">No setups matched the current filters.</td></tr>';
    return;
  }

  elements.stocksBody.innerHTML = rows.map(stockRowMarkup).join("");
}

function renderIndices(rows) {
  if (!rows.length) {
    elements.indicesGrid.innerHTML = '<div class="empty-state">No index setups available right now.</div>';
    return;
  }

  elements.indicesGrid.innerHTML = rows.map(indexCardMarkup).join("");
}

function renderTape(rows) {
  if (!rows.length) {
    return;
  }
  elements.marketTape.innerHTML = rows.map(tapeCardMarkup).join("");
}

function renderNews(rows) {
  if (!rows.length) {
    elements.newsFeed.innerHTML = '<div class="empty-state">No live headlines could be loaded right now.</div>';
    return;
  }
  elements.newsFeed.innerHTML = rows.map(newsCardMarkup).join("");
}

function renderSectorSentiment(rows) {
  if (!rows.length) {
    elements.sectorSentiment.innerHTML = '<div class="empty-state">Sector sentiment will appear after the scan.</div>';
    return;
  }
  elements.sectorSentiment.innerHTML = rows.slice(0, 8).map(sectorCardMarkup).join("");
}

function renderMetrics(payload, filteredStocks) {
  elements.metricScanned.textContent = payload.meta.scannedSymbols ?? "-";
  elements.metricMatches.textContent = filteredStocks.length;
  elements.metricBullish.textContent = filteredStocks.filter((item) => item.divergence === "bullish").length;
  elements.metricIndices.textContent = payload.indices.length;
  elements.scanMeta.textContent = `Updated ${new Date(payload.generatedAt).toLocaleString("en-IN")} | Universe: ${payload.meta.universeLabel}`;
}

function refreshView() {
  if (!state.latestPayload) {
    return;
  }
  const filteredStocks = buildFilteredStocks();
  renderMetrics(state.latestPayload, filteredStocks);
  renderStocks(filteredStocks);
  renderIndices(state.latestPayload.indices || []);
  renderTape(state.latestPayload.marketTape || []);
  renderNews(state.latestPayload.news || []);
  renderSectorSentiment(state.latestPayload.sectorSentiment || []);
}

async function runScan() {
  elements.scanButton.disabled = true;
  elements.scanButton.textContent = "Scanning...";

  const params = new URLSearchParams({
    universe: elements.universe.value,
    limit: elements.limit.value,
    proximity: elements.proximity.value,
    impulse: elements.impulse.value,
    minTimeframes: elements.minTimeframes.value
  });

  try {
    const response = await fetch(`/api/scan?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Scan failed with status ${response.status}`);
    }

    state.latestPayload = await response.json();
    refreshView();
  } catch (error) {
    console.error(error);
    elements.scanMeta.textContent = "Scan failed. Check your function logs and data source access.";
    elements.stocksBody.innerHTML = '<tr><td colspan="12" class="empty-state">The scan failed. See browser console or Netlify function logs.</td></tr>';
    elements.indicesGrid.innerHTML = '<div class="empty-state">Could not load indices right now.</div>';
    elements.newsFeed.innerHTML = '<div class="empty-state">Could not load news right now.</div>';
    elements.sectorSentiment.innerHTML = '<div class="empty-state">Could not load sector sentiment right now.</div>';
  } finally {
    elements.scanButton.disabled = false;
    elements.scanButton.textContent = "Run Market Scan";
  }
}

elements.scanButton.addEventListener("click", runScan);
[elements.biasFilter, elements.divergenceFilter, elements.zoneFilter, elements.timeframeFilter, elements.qualityFilter, elements.sortBy]
  .forEach((element) => {
    element.addEventListener("change", refreshView);
  });

window.addEventListener("load", () => {
  runScan();
});
