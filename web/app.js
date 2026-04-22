const JOURNAL_KEY = "stratdefender-journal";

const elements = {
  scanButton: document.getElementById("scanButton"),
  universe: document.getElementById("universe"),
  limit: document.getElementById("limit"),
  proximity: document.getElementById("proximity"),
  impulse: document.getElementById("impulse"),
  minTimeframes: document.getElementById("minTimeframes"),
  scalpMode: document.getElementById("scalpMode"),
  scalpStyle: document.getElementById("scalpStyle"),
  pivotLength: document.getElementById("pivotLength"),
  directionFilter: document.getElementById("directionFilter"),
  setupTypeFilter: document.getElementById("setupTypeFilter"),
  zoneTfFilter: document.getElementById("zoneTfFilter"),
  triggerTfFilter: document.getElementById("triggerTfFilter"),
  minScoreFilter: document.getElementById("minScoreFilter"),
  maxDistanceFilter: document.getElementById("maxDistanceFilter"),
  divergenceFilter: document.getElementById("divergenceFilter"),
  confirmedFilter: document.getElementById("confirmedFilter"),
  modeFilter: document.getElementById("modeFilter"),
  sortFilter: document.getElementById("sortFilter"),
  scanMeta: document.getElementById("scanMeta"),
  metricConfirmedLongs: document.getElementById("metricConfirmedLongs"),
  metricConfirmedShorts: document.getElementById("metricConfirmedShorts"),
  metricWatchlist: document.getElementById("metricWatchlist"),
  metricDivergences: document.getElementById("metricDivergences"),
  metricScalps: document.getElementById("metricScalps"),
  metricStrongest: document.getElementById("metricStrongest"),
  metricStrongestMeta: document.getElementById("metricStrongestMeta"),
  metricLastScan: document.getElementById("metricLastScan"),
  featuredStrip: document.getElementById("featuredStrip"),
  marketTape: document.getElementById("marketTape"),
  tableSummary: document.getElementById("tableSummary"),
  stocksBody: document.getElementById("stocksBody"),
  setupInspector: document.getElementById("setupInspector"),
  marketOverview: document.getElementById("marketOverview"),
  indicesGrid: document.getElementById("indicesGrid"),
  newsFeed: document.getElementById("newsFeed"),
  journalList: document.getElementById("journalList")
};

const state = {
  latestPayload: null,
  visibleRows: [],
  selectedSignalId: null,
  journal: loadJournal()
};

function loadJournal() {
  try {
    return JSON.parse(window.localStorage.getItem(JOURNAL_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveJournal() {
  window.localStorage.setItem(JOURNAL_KEY, JSON.stringify(state.journal));
}

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }
  return Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function chartUrl(symbol) {
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`;
}

function directionTone(direction) {
  return direction === "bullish" ? "bullish" : "bearish";
}

function stateTone(setupState) {
  if (setupState === "LTF Confirmed") return "bullish";
  if (setupState === "LTF Sweep Seen") return "neutral";
  if (setupState === "Invalidated") return "bearish";
  return "subtle";
}

function freshnessTone(freshness) {
  if (freshness === "first-touch") return "bullish";
  if (freshness === "second-touch") return "neutral";
  return "subtle";
}

function pill(tone, label) {
  return `<span class="pill ${tone}">${label}</span>`;
}

function setupLabel(row) {
  return row.direction === "bullish" ? "Demand Long" : "Supply Short";
}

function applyPreset(preset) {
  const reset = () => {
    elements.directionFilter.value = "all";
    elements.setupTypeFilter.value = "all";
    elements.zoneTfFilter.value = "all";
    elements.triggerTfFilter.value = "all";
    elements.minScoreFilter.value = "0";
    elements.maxDistanceFilter.value = "10";
    elements.divergenceFilter.value = "all";
    elements.confirmedFilter.value = "all";
    elements.modeFilter.value = "all";
    elements.sortFilter.value = "score";
  };

  reset();
  if (preset === "swing") {
    elements.modeFilter.value = "Swing";
    elements.minScoreFilter.value = "60";
    elements.sortFilter.value = "freshness";
  }
  if (preset === "divergence") {
    elements.divergenceFilter.value = "required";
    elements.minScoreFilter.value = "55";
    elements.sortFilter.value = "divergence";
  }
  if (preset === "scalp") {
    elements.modeFilter.value = "Scalp";
    elements.zoneTfFilter.value = "1H";
    elements.minScoreFilter.value = "50";
    elements.sortFilter.value = "scalp";
  }
  if (preset === "score") {
    elements.minScoreFilter.value = "75";
    elements.sortFilter.value = "score";
  }
  if (preset === "confirmed") {
    elements.confirmedFilter.value = "required";
    elements.minScoreFilter.value = "55";
  }
  renderAll();
}

function buildSetupTypeOptions(rows) {
  const values = [...new Set(rows.map((row) => row.setupType))].sort();
  elements.setupTypeFilter.innerHTML = ['<option value="all">All setup types</option>', ...values.map((value) => `<option value="${value}">${value}</option>`)].join("");
}

function sortRows(rows) {
  const values = [...rows];
  const freshnessRank = { "first-touch": 3, "second-touch": 2, stale: 1 };
  const modeRank = { Scalp: 2, Swing: 1 };
  const sortBy = elements.sortFilter.value;
  if (sortBy === "divergence") {
    return values.sort((a, b) => (b.divergence?.strength || 0) - (a.divergence?.strength || 0) || b.score - a.score);
  }
  if (sortBy === "freshness") {
    return values.sort((a, b) => (freshnessRank[b.freshness] || 0) - (freshnessRank[a.freshness] || 0) || b.score - a.score);
  }
  if (sortBy === "scalp") {
    return values.sort((a, b) => (modeRank[b.mode] || 0) - (modeRank[a.mode] || 0) || b.score - a.score);
  }
  if (sortBy === "distance") {
    return values.sort((a, b) => a.distancePct - b.distancePct || b.score - a.score);
  }
  return values.sort((a, b) => b.score - a.score || a.distancePct - b.distancePct);
}

function filterRows(rows) {
  return sortRows(rows.filter((row) => {
    if (elements.directionFilter.value !== "all" && row.direction !== elements.directionFilter.value) return false;
    if (elements.setupTypeFilter.value !== "all" && row.setupType !== elements.setupTypeFilter.value) return false;
    if (elements.zoneTfFilter.value !== "all" && row.zoneTimeframe !== elements.zoneTfFilter.value) return false;
    if (elements.triggerTfFilter.value !== "all" && row.triggerTimeframe !== elements.triggerTfFilter.value) return false;
    if (elements.divergenceFilter.value === "required" && !row.divergence) return false;
    if (elements.confirmedFilter.value === "required" && row.setupState !== "LTF Confirmed") return false;
    if (elements.modeFilter.value !== "all" && row.mode !== elements.modeFilter.value) return false;
    if (Number(row.score || 0) < Number(elements.minScoreFilter.value || 0)) return false;
    if (Number(row.distancePct || 0) > Number(elements.maxDistanceFilter.value || 0)) return false;
    return true;
  }));
}

function tapeCardMarkup(item) {
  const tone = Number(item.change) >= 0 ? "bullish" : "bearish";
  const sign = Number(item.change) >= 0 ? "+" : "";
  return `
    <article class="metric card tape-card">
      <span>${item.name}</span>
      <strong>${formatNumber(item.price)}</strong>
      <small class="${tone}">${sign}${formatNumber(item.change)} (${sign}${formatNumber(item.changePct)}%)</small>
    </article>
  `;
}

function featuredCardMarkup(item) {
  return `
    <article class="featured-card" data-select-symbol="${item.symbol}">
      <div class="featured-head">
        <strong>${item.symbol}</strong>
        ${pill(directionTone(item.direction), item.direction === "bullish" ? "Long" : "Short")}
      </div>
      <p>${item.setupType}</p>
      <div class="featured-meta">
        <span>Score ${formatNumber(item.score, 0)}</span>
        <span>${item.timeframeCombo}</span>
      </div>
      ${item.divergenceLabel ? `<div class="featured-meta">${pill("subtle", item.divergenceLabel)}</div>` : ""}
      <small>${item.reason}</small>
    </article>
  `;
}

function rowWarningsMarkup(warnings) {
  if (!warnings?.length) {
    return '<span class="pill subtle">No major warning</span>';
  }
  return warnings.slice(0, 2).map((item) => pill("subtle", item)).join("");
}

function stockRowMarkup(row) {
  const isSelected = row.signal.signalId === state.selectedSignalId;
  const divergenceBadge = row.divergence
    ? pill("subtle", `${row.divergence.label} ${row.divergence.strength}`)
    : pill("subtle", "No divergence");
  return `
    <tr class="${isSelected ? "row-selected" : ""}" data-select-signal="${row.signal.signalId}">
      <td>
        <div class="row-symbol">
          <strong>${row.symbol}</strong>
          <small>${row.marketType} | ${row.mode}</small>
        </div>
      </td>
      <td>
        <div class="stack">
          <div class="stack-inline">
            ${pill(directionTone(row.direction), setupLabel(row))}
            ${pill(freshnessTone(row.freshness), row.freshness)}
          </div>
          <strong>${row.setupType}</strong>
          <small>${row.explanation.summary}</small>
        </div>
      </td>
      <td>
        <div class="stack">
          <strong>${row.zoneTimeframe} -> ${row.triggerTimeframe}</strong>
          <small>${row.zone.zoneType} | ${row.setupState}</small>
        </div>
      </td>
      <td>
        <div class="stack">
          ${pill(row.trigger?.sweep?.detected ? "neutral" : "subtle", row.trigger?.sweep?.detected ? `Sweep ${row.trigger.sweep.barsAgo} ago` : "No sweep")}
          ${pill(row.trigger?.confirmation?.detected ? "bullish" : "subtle", row.trigger?.confirmation?.detected ? "Confirmed" : "Awaiting confirm")}
          ${divergenceBadge}
        </div>
      </td>
      <td>
        <div class="stack">
          <strong>${formatNumber(row.currentPrice)}</strong>
          <small>Zone ${formatNumber(row.zoneLow)} - ${formatNumber(row.zoneHigh)}</small>
          <small>Inv ${formatNumber(row.levels.invalidation)} | T1 ${formatNumber(row.levels.target1)}</small>
        </div>
      </td>
      <td>
        <div class="score-block">
          <strong>${formatNumber(row.score, 0)}</strong>
          <small>R:R ${formatNumber(row.levels.rrPotential)}</small>
        </div>
      </td>
      <td><div class="stack">${rowWarningsMarkup(row.warnings)}</div></td>
      <td>
        <div class="row-actions">
          <button class="secondary-button small-button" data-select-signal="${row.signal.signalId}">Inspect</button>
          <a class="link-button small-button" href="${chartUrl(row.tvSymbol)}" target="_blank" rel="noreferrer">Chart</a>
        </div>
      </td>
    </tr>
  `;
}

function renderPreviewSvg(setup) {
  const preview = setup.preview;
  if (!preview?.candles?.length) {
    return '<div class="empty-state compact">No preview data.</div>';
  }

  const width = 620;
  const height = 240;
  const padding = 18;
  const priceValues = preview.candles.flatMap((candle) => [candle.high, candle.low]).concat([
    preview.zoneLow,
    preview.zoneHigh,
    preview.invalidation,
    preview.target1
  ]);
  const min = Math.min(...priceValues);
  const max = Math.max(...priceValues);
  const y = (value) => {
    const ratio = (value - min) / Math.max(max - min, 0.01);
    return height - padding - (ratio * (height - padding * 2));
  };
  const x = (index) => padding + (index / Math.max(preview.candles.length - 1, 1)) * (width - padding * 2);
  const closePath = preview.candles.map((candle, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(candle.close)}`).join(" ");
  const markerTimes = preview.markers || {};

  const renderMarker = (time, color) => {
    if (!time) return "";
    const index = preview.candles.findIndex((candle) => candle.at === time);
    if (index === -1) return "";
    return `<circle cx="${x(index)}" cy="${y(preview.candles[index].close)}" r="4" fill="${color}" />`;
  };

  return `
    <svg class="preview-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      <rect x="${padding}" y="${y(preview.zoneHigh)}" width="${width - padding * 2}" height="${Math.max(y(preview.zoneLow) - y(preview.zoneHigh), 4)}" class="preview-zone" />
      <line x1="${padding}" y1="${y(preview.invalidation)}" x2="${width - padding}" y2="${y(preview.invalidation)}" class="preview-stop" />
      <line x1="${padding}" y1="${y(preview.target1)}" x2="${width - padding}" y2="${y(preview.target1)}" class="preview-target" />
      <path d="${closePath}" class="preview-line" />
      ${renderMarker(markerTimes.sweepAt, "#ffc56d")}
      ${renderMarker(markerTimes.confirmationAt, "#63e8bc")}
      ${renderMarker(markerTimes.divergenceAt, "#7fc3ff")}
    </svg>
  `;
}

function inspectorMarkup(setup) {
  const breakdown = setup.scoreBreakdown || {};
  const divergenceDetails = setup.divergence
    ? `
      <div class="detail-grid">
        <div class="detail-box">
          <span>Divergence</span>
          <strong>${setup.divergence.label}</strong>
          <small>${setup.divergence.timeframe} | strength ${setup.divergence.strength}</small>
        </div>
        <div class="detail-box">
          <span>Price pivots</span>
          <strong>${formatNumber(setup.divergence.pivots.price[0].value)} -> ${formatNumber(setup.divergence.pivots.price[1].value)}</strong>
          <small>${formatDateTime(setup.divergence.pivots.price[1].at)}</small>
        </div>
        <div class="detail-box">
          <span>RSI pivots</span>
          <strong>${formatNumber(setup.divergence.pivots.rsi[0].value)} -> ${formatNumber(setup.divergence.pivots.rsi[1].value)}</strong>
          <small>Aligned with zone</small>
        </div>
      </div>
    `
    : '<div class="empty-state compact">No qualifying RSI divergence on the selected setup timeframe.</div>';

  return `
    <div class="inspector-head">
      <div>
        <p class="section-label">${setup.marketType} | ${setup.mode}</p>
        <h3>${setup.symbol}</h3>
        <p class="inspector-summary">${setup.setupType}</p>
      </div>
      <div class="legend">
        ${pill(directionTone(setup.direction), setup.direction === "bullish" ? "Long bias" : "Short bias")}
        ${pill(stateTone(setup.setupState), setup.setupState)}
        ${pill(freshnessTone(setup.freshness), setup.freshness)}
      </div>
    </div>
    <div class="inspector-chart">
      ${renderPreviewSvg(setup)}
    </div>
    <div class="detail-grid">
      <div class="detail-box">
        <span>Total score</span>
        <strong>${formatNumber(setup.score, 0)}</strong>
        <small>${setup.strongestFactors.join(" • ")}</small>
      </div>
      <div class="detail-box">
        <span>Timeframes</span>
        <strong>${setup.zoneTimeframe} -> ${setup.triggerTimeframe}</strong>
        <small>${setup.zone.zoneType} | ${setup.setupState}</small>
      </div>
      <div class="detail-box">
        <span>Levels</span>
        <strong>Inv ${formatNumber(setup.levels.invalidation)}</strong>
        <small>T1 ${formatNumber(setup.levels.target1)} | R:R ${formatNumber(setup.levels.rrPotential)}</small>
      </div>
      <div class="detail-box">
        <span>Freshness</span>
        <strong>${setup.freshness}</strong>
        <small>${setup.zone.retests} retest(s) | age ${setup.zone.ageBars} candles</small>
      </div>
    </div>
    <div class="detail-grid score-grid">
      <div class="detail-box"><span>Zone quality</span><strong>${breakdown.zoneQuality || 0}/20</strong></div>
      <div class="detail-box"><span>Freshness</span><strong>${breakdown.freshness || 0}/15</strong></div>
      <div class="detail-box"><span>Sweep quality</span><strong>${breakdown.sweepQuality || 0}/15</strong></div>
      <div class="detail-box"><span>Confirmation</span><strong>${breakdown.confirmation || 0}/15</strong></div>
      <div class="detail-box"><span>Divergence</span><strong>${breakdown.divergence || 0}/10</strong></div>
      <div class="detail-box"><span>R:R</span><strong>${breakdown.rrPotential || 0}/15</strong></div>
      <div class="detail-box"><span>Trend alignment</span><strong>${breakdown.trendAlignment || 0}/10</strong></div>
    </div>
    <div class="detail-section">
      <p class="section-label">Why this setup?</p>
      <ul class="reason-list">
        ${setup.explanation.reasons.map((item) => `<li>${item}</li>`).join("")}
      </ul>
    </div>
    <div class="detail-section">
      <p class="section-label">Warnings</p>
      <div class="stack-inline">
        ${setup.warnings.length ? setup.warnings.map((item) => pill("subtle", item)).join("") : pill("bullish", "No major warning")}
      </div>
    </div>
    <div class="detail-section">
      <p class="section-label">Divergence detail</p>
      ${divergenceDetails}
    </div>
    <div class="detail-section">
      <p class="section-label">Journal this setup</p>
      <div class="journal-form">
        <input id="journalEntry" placeholder="Entry" value="${setup.levels.entryReference ?? ""}" />
        <input id="journalStop" placeholder="Stop" value="${setup.levels.invalidation ?? ""}" />
        <input id="journalTarget" placeholder="Target" value="${setup.levels.target1 ?? ""}" />
        <input id="journalResult" placeholder="Result in R" />
        <input id="journalTags" placeholder="Mistake tags / notes tags" />
        <textarea id="journalNotes" placeholder="Execution notes, review comments, screenshot link">${setup.explanation.summary}</textarea>
        <button class="primary-button" data-save-journal="${setup.signal.signalId}">Save To Journal</button>
      </div>
    </div>
  `;
}

function indexCardMarkup(item) {
  return `
    <article class="index-card">
      <div class="index-head">
        <strong>${item.name}</strong>
        ${pill(directionTone(item.direction), item.direction === "bullish" ? "Long" : "Short")}
      </div>
      <p>${item.setupType}</p>
      <p>${item.zoneTimeframe} -> ${item.triggerTimeframe} | score ${formatNumber(item.score, 0)}</p>
      <p>Zone ${formatNumber(item.zoneLow)} - ${formatNumber(item.zoneHigh)}</p>
      <div class="index-flags">
        ${pill(item.trigger?.sweep?.detected ? "neutral" : "subtle", item.trigger?.sweep?.detected ? "Sweep" : "No sweep")}
        ${pill(item.divergence ? "subtle" : "subtle", item.divergence ? item.divergence.label : "No divergence")}
      </div>
      <a class="link-button" href="${chartUrl(item.tvSymbol)}" target="_blank" rel="noreferrer">Open chart</a>
    </article>
  `;
}

function newsCardMarkup(item) {
  return `
    <a class="news-card" href="${item.link}" target="_blank" rel="noreferrer">
      <span class="section-label">${item.sourceQuery}</span>
      <strong>${item.title}</strong>
      <small>${formatDateTime(item.pubDate)}</small>
    </a>
  `;
}

function journalItemMarkup(item, index) {
  return `
    <article class="journal-card">
      <div class="index-head">
        <strong>${item.symbol}</strong>
        <button class="secondary-button small-button" data-remove-journal="${index}">Remove</button>
      </div>
      <p>${item.setupType}</p>
      <p>Entry ${item.entry || "-"} | Stop ${item.stop || "-"} | Target ${item.target || "-"}</p>
      <p>Result ${item.resultR || "-"}R</p>
      <p>${item.tags || "No tags"}</p>
      <small>${item.notes || "No notes"} | ${formatDateTime(item.savedAt)}</small>
    </article>
  `;
}

function renderMetrics(payload) {
  const overview = payload.marketOverview || {};
  const strongest = overview.strongestSetup;
  elements.metricConfirmedLongs.textContent = overview.confirmedLongs ?? "-";
  elements.metricConfirmedShorts.textContent = overview.confirmedShorts ?? "-";
  elements.metricWatchlist.textContent = overview.nearZoneWatchlist ?? "-";
  elements.metricDivergences.textContent = overview.divergenceSetups ?? "-";
  elements.metricScalps.textContent = overview.scalpSetups ?? "-";
  elements.metricStrongest.textContent = strongest?.symbol || "-";
  elements.metricStrongestMeta.textContent = strongest ? `${strongest.setupType} | ${strongest.score}` : "No standout setup";
  elements.metricLastScan.textContent = payload.generatedAt ? new Date(payload.generatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "-";
  elements.scanMeta.textContent = payload.meta?.note || "Scan complete.";
}

function renderFeatured(rows) {
  if (!rows.length) {
    elements.featuredStrip.innerHTML = '<div class="empty-state">No setups passed the current filters.</div>';
    return;
  }
  elements.featuredStrip.innerHTML = rows.slice(0, 5).map(featuredCardMarkup).join("");
}

function renderTape(rows) {
  if (!rows.length) {
    elements.marketTape.innerHTML = '<article class="metric card"><span>Market Tape</span><strong>-</strong></article>';
    return;
  }
  elements.marketTape.innerHTML = rows.map(tapeCardMarkup).join("");
}

function renderStocks(rows) {
  if (!rows.length) {
    elements.stocksBody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
          No setups matched the current filters.
          <div class="empty-actions">
            <button class="preset-button" data-preset="swing">Swing Reversals</button>
            <button class="preset-button" data-preset="divergence">Divergence Setups</button>
            <button class="preset-button" data-preset="scalp">Intraday Scalps</button>
          </div>
        </td>
      </tr>
    `;
    return;
  }
  elements.stocksBody.innerHTML = rows.map(stockRowMarkup).join("");
}

function renderInspector() {
  const setup = state.visibleRows.find((item) => item.signal.signalId === state.selectedSignalId) || state.visibleRows[0];
  if (!setup) {
    elements.setupInspector.innerHTML = '<div class="empty-state">No setup selected.</div>';
    return;
  }
  state.selectedSignalId = setup.signal.signalId;
  elements.setupInspector.innerHTML = inspectorMarkup(setup);
}

function renderMarketOverview(payload) {
  const overview = payload.marketOverview;
  if (!overview) {
    elements.marketOverview.innerHTML = '<div class="empty-state">Overview unavailable.</div>';
    return;
  }
  const buckets = Object.entries(overview.bucketCounts || {})
    .map(([key, value]) => `<div class="detail-box"><span>${key}</span><strong>${value}</strong></div>`)
    .join("");
  elements.marketOverview.innerHTML = `
    <div class="detail-grid">
      <div class="detail-box"><span>Risk tone</span><strong>${overview.riskTone}</strong></div>
      <div class="detail-box"><span>Breadth</span><strong>${overview.breadth?.advancing || 0} / ${overview.breadth?.declining || 0}</strong></div>
      <div class="detail-box"><span>Strongest</span><strong>${overview.strongestSetup?.symbol || "-"}</strong></div>
      <div class="detail-box"><span>Divergence</span><strong>${overview.divergenceSetups || 0}</strong></div>
    </div>
    <div class="detail-grid">${buckets || '<div class="detail-box"><span>Bucket counts</span><strong>-</strong></div>'}</div>
  `;
}

function renderIndices(rows) {
  elements.indicesGrid.innerHTML = rows.length
    ? rows.map(indexCardMarkup).join("")
    : '<div class="empty-state">No index setups available right now.</div>';
}

function renderNews(rows) {
  elements.newsFeed.innerHTML = rows.length
    ? rows.map(newsCardMarkup).join("")
    : '<div class="empty-state">No news loaded right now.</div>';
}

function renderJournal() {
  elements.journalList.innerHTML = state.journal.length
    ? state.journal.map(journalItemMarkup).join("")
    : '<div class="empty-state">Saved trades will appear here.</div>';
}

function renderTableSummary(total, visible) {
  elements.tableSummary.textContent = `${visible} visible setup${visible === 1 ? "" : "s"} from ${total} scanned result${total === 1 ? "" : "s"}.`;
}

function renderAll() {
  const payload = state.latestPayload;
  if (!payload) {
    return;
  }
  state.visibleRows = filterRows(payload.stocks || []);
  if (!state.visibleRows.some((item) => item.signal.signalId === state.selectedSignalId)) {
    state.selectedSignalId = state.visibleRows[0]?.signal.signalId || null;
  }
  renderMetrics(payload);
  renderFeatured(state.visibleRows.length ? state.visibleRows.map((item) => ({
    symbol: item.symbol,
    direction: item.direction,
    setupType: item.setupType,
    score: item.score,
    divergenceLabel: item.divergence?.label || null,
    timeframeCombo: `${item.zoneTimeframe} / ${item.triggerTimeframe}`,
    reason: item.explanation.reasons[0]
  })) : payload.topSetups || []);
  renderTape(payload.marketTape || []);
  renderStocks(state.visibleRows);
  renderInspector();
  renderMarketOverview(payload);
  renderIndices(payload.indices || []);
  renderNews(payload.news || []);
  renderTableSummary((payload.stocks || []).length, state.visibleRows.length);
}

async function runScan() {
  elements.scanButton.disabled = true;
  elements.scanButton.textContent = "Scanning...";

  const params = new URLSearchParams({
    universe: elements.universe.value,
    limit: elements.limit.value,
    proximity: elements.proximity.value,
    impulse: elements.impulse.value,
    minTimeframes: elements.minTimeframes.value,
    scalpMode: elements.scalpMode.value,
    scalpStyle: elements.scalpStyle.value,
    pivotLength: elements.pivotLength.value
  });

  try {
    const response = await fetch(`/api/scan?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Scan failed with status ${response.status}`);
    }
    const payload = await response.json();
    state.latestPayload = payload;
    buildSetupTypeOptions(payload.stocks || []);
    state.selectedSignalId = payload.stocks?.[0]?.signal?.signalId || null;
    renderAll();
  } catch (error) {
    console.error(error);
    elements.scanMeta.textContent = "Scan failed. Check Netlify function logs or reduce the universe size.";
    elements.stocksBody.innerHTML = '<tr><td colspan="8" class="empty-state">The live scan failed.</td></tr>';
    elements.featuredStrip.innerHTML = '<div class="empty-state">Could not load top setups.</div>';
    elements.setupInspector.innerHTML = '<div class="empty-state">Could not load the setup inspector.</div>';
    elements.marketOverview.innerHTML = '<div class="empty-state">Could not load market overview.</div>';
    elements.indicesGrid.innerHTML = '<div class="empty-state">Could not load index setups.</div>';
    elements.newsFeed.innerHTML = '<div class="empty-state">Could not load news.</div>';
  } finally {
    elements.scanButton.disabled = false;
    elements.scanButton.textContent = "Run Scan";
  }
}

function saveJournalEntry(signalId) {
  const setup = state.visibleRows.find((item) => item.signal.signalId === signalId);
  if (!setup) return;

  state.journal.unshift({
    symbol: setup.symbol,
    setupType: setup.setupType,
    entry: document.getElementById("journalEntry")?.value || "",
    stop: document.getElementById("journalStop")?.value || "",
    target: document.getElementById("journalTarget")?.value || "",
    resultR: document.getElementById("journalResult")?.value || "",
    tags: document.getElementById("journalTags")?.value || "",
    notes: document.getElementById("journalNotes")?.value || "",
    savedAt: new Date().toISOString()
  });
  state.journal = state.journal.slice(0, 40);
  saveJournal();
  renderJournal();
}

document.addEventListener("click", (event) => {
  const presetButton = event.target.closest("[data-preset]");
  if (presetButton) {
    applyPreset(presetButton.dataset.preset);
    return;
  }

  const selectButton = event.target.closest("[data-select-signal]");
  if (selectButton) {
    state.selectedSignalId = selectButton.dataset.selectSignal;
    renderStocks(state.visibleRows);
    renderInspector();
    return;
  }

  const featuredCard = event.target.closest("[data-select-symbol]");
  if (featuredCard) {
    const selected = state.visibleRows.find((item) => item.symbol === featuredCard.dataset.selectSymbol);
    if (selected) {
      state.selectedSignalId = selected.signal.signalId;
      renderStocks(state.visibleRows);
      renderInspector();
    }
    return;
  }

  const saveButton = event.target.closest("[data-save-journal]");
  if (saveButton) {
    saveJournalEntry(saveButton.dataset.saveJournal);
    return;
  }

  const removeButton = event.target.closest("[data-remove-journal]");
  if (removeButton) {
    state.journal.splice(Number(removeButton.dataset.removeJournal), 1);
    saveJournal();
    renderJournal();
  }
});

document.addEventListener("change", (event) => {
  if (event.target.closest(".filter-grid")) {
    renderAll();
  }
});

elements.scanButton.addEventListener("click", runScan);
window.addEventListener("load", () => {
  renderJournal();
  runScan();
});
