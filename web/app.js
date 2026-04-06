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
  chartTitle: document.getElementById("chartTitle"),
  chartLink: document.getElementById("chartLink"),
  chartContainer: document.getElementById("chartContainer")
};

const state = {
  latestPayload: null,
  chartSymbol: "NSE:RELIANCE"
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

function chartUrl(symbol) {
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`;
}

function renderTradingView(symbol, title) {
  state.chartSymbol = symbol;
  elements.chartTitle.textContent = title;
  elements.chartLink.href = chartUrl(symbol);
  elements.chartContainer.innerHTML = '<div id="tv-widget" style="height: 560px;"></div>';

  if (!window.TradingView) {
    elements.chartContainer.innerHTML = '<div class="empty-state">TradingView widget failed to load.</div>';
    return;
  }

  // TradingView expects a plain DOM container to mount into.
  new window.TradingView.widget({
    autosize: true,
    symbol,
    interval: "240",
    timezone: "Asia/Kolkata",
    theme: "dark",
    style: "1",
    locale: "en",
    enable_publishing: false,
    allow_symbol_change: true,
    hide_side_toolbar: false,
    container_id: "tv-widget"
  });
}

function makeChip(label, className = "") {
  return `<span class="chip ${className}">${label}</span>`;
}

function stockRowMarkup(row) {
  const divergence = row.divergence || "none";
  const tvSymbol = row.tvSymbol || `NSE:${row.symbol.replace(".NS", "")}`;
  return `
    <tr>
      <td><strong>${row.symbol}</strong></td>
      <td>${row.timeframe}</td>
      <td class="bias-${row.direction}">${row.direction}</td>
      <td>${formatNumber(row.currentPrice)}</td>
      <td>${formatNumber(row.zoneLow)} - ${formatNumber(row.zoneHigh)}</td>
      <td class="inside-${row.insideZone}">${formatNumber(row.distancePct)}%</td>
      <td class="div-${divergence}">${divergence}</td>
      <td>${formatNumber(row.score)}</td>
      <td>
        <a class="link-button" href="${chartUrl(tvSymbol)}" target="_blank" rel="noreferrer" data-chart-symbol="${tvSymbol}" data-chart-title="${row.symbol} chart">
          View
        </a>
      </td>
    </tr>
  `;
}

function indexCardMarkup(item) {
  const divergence = item.divergence || "none";
  return `
    <article class="index-card">
      <h3>${item.name}</h3>
      <div class="index-meta">
        ${makeChip(item.direction || "watch", `bias-${item.direction || "bullish"}`)}
        ${makeChip(item.timeframe || "multi-timeframe")}
        ${makeChip(`RSI ${divergence}`, `div-${divergence}`)}
      </div>
      <p class="index-stat">Spot/index source: ${item.sourceSymbol}</p>
      <p class="index-stat">Current: ${formatNumber(item.currentPrice)} | Zone: ${formatNumber(item.zoneLow)} - ${formatNumber(item.zoneHigh)}</p>
      <p class="index-stat">Distance: ${formatNumber(item.distancePct)}% | Matches: ${item.matchedTimeframes}</p>
      <div class="index-links">
        <a class="link-button" href="${chartUrl(item.tvSymbol)}" target="_blank" rel="noreferrer" data-chart-symbol="${item.tvSymbol}" data-chart-title="${item.name} futures chart">
          Futures Chart
        </a>
        <a class="link-button" href="${chartUrl(item.cashTvSymbol)}" target="_blank" rel="noreferrer">
          Cash Index
        </a>
      </div>
    </article>
  `;
}

function renderStocks(rows) {
  if (!rows.length) {
    elements.stocksBody.innerHTML = '<tr><td colspan="9" class="empty-state">No setups matched the current filters.</td></tr>';
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

function renderMetrics(payload) {
  elements.metricScanned.textContent = payload.meta.scannedSymbols ?? "-";
  elements.metricMatches.textContent = payload.stocks.length;
  elements.metricBullish.textContent = payload.meta.bullishDivergences ?? "-";
  elements.metricIndices.textContent = payload.indices.length;
  elements.scanMeta.textContent = `Updated ${new Date(payload.generatedAt).toLocaleString("en-IN")} | Universe: ${payload.meta.universeLabel}`;
}

function attachChartLinks() {
  document.querySelectorAll("[data-chart-symbol]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const symbol = event.currentTarget.dataset.chartSymbol;
      const title = event.currentTarget.dataset.chartTitle;
      renderTradingView(symbol, title);
    });
  });
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

    const payload = await response.json();
    state.latestPayload = payload;
    renderMetrics(payload);
    renderStocks(payload.stocks);
    renderIndices(payload.indices);
    attachChartLinks();

    const defaultChart = payload.stocks[0]?.tvSymbol || payload.indices[0]?.tvSymbol || "NSE:RELIANCE";
    const defaultTitle = payload.stocks[0]
      ? `${payload.stocks[0].symbol} chart`
      : payload.indices[0]
        ? `${payload.indices[0].name} futures chart`
        : "TradingView inspection panel";
    renderTradingView(defaultChart, defaultTitle);
  } catch (error) {
    console.error(error);
    elements.scanMeta.textContent = "Scan failed. Check your function logs and data source access.";
    elements.stocksBody.innerHTML = '<tr><td colspan="9" class="empty-state">The scan failed. See browser console or Netlify function logs.</td></tr>';
    elements.indicesGrid.innerHTML = '<div class="empty-state">Could not load indices right now.</div>';
  } finally {
    elements.scanButton.disabled = false;
    elements.scanButton.textContent = "Run Scan";
  }
}

elements.scanButton.addEventListener("click", runScan);
window.addEventListener("load", () => {
  renderTradingView("NSE:RELIANCE", "TradingView inspection panel");
  runScan();
});
