const elements = {
  scanButton: document.getElementById("scanButton"),
  universe: document.getElementById("universe"),
  limit: document.getElementById("limit"),
  proximity: document.getElementById("proximity"),
  impulse: document.getElementById("impulse"),
  minTimeframes: document.getElementById("minTimeframes"),
  scanMeta: document.getElementById("scanMeta"),
  metricScanned: document.getElementById("metricScanned"),
  metricMatches: document.getElementById("metricMatches"),
  metricSweeps: document.getElementById("metricSweeps"),
  metricConfirmed: document.getElementById("metricConfirmed"),
  stocksBody: document.getElementById("stocksBody"),
  indicesGrid: document.getElementById("indicesGrid")
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

function setupLabel(row) {
  return row.direction === "bullish" ? "Demand Long" : "Supply Short";
}

function boolPill(value, trueLabel, falseLabel = "No") {
  return `<span class="pill ${value ? "neutral" : "subtle"}">${value ? trueLabel : falseLabel}</span>`;
}

function stockRowMarkup(row) {
  const tone = row.direction === "bullish" ? "bullish" : "bearish";
  const zoneState = row.insideZone === "yes" ? "inside" : "near";
  const chartSymbol = row.tvSymbol || `NSE:${row.symbol.replace(".NS", "")}`;

  return `
    <tr>
      <td><strong>${row.symbol}</strong></td>
      <td>${row.timeframe}</td>
      <td><span class="pill ${tone}">${setupLabel(row)}</span></td>
      <td>${formatNumber(row.currentPrice)}</td>
      <td>${formatNumber(row.zoneLow)} - ${formatNumber(row.zoneHigh)}</td>
      <td><span class="${zoneState === "inside" ? "inside-yes" : "inside-no"}">${formatNumber(row.distancePct)}%</span></td>
      <td>${boolPill(row.sweepConfirmed, "Yes", "No")}</td>
      <td>${boolPill(row.confirmationCandle, "Yes", "No")}</td>
      <td>${formatNumber(row.score)}</td>
      <td><a class="link-button" href="${chartUrl(chartSymbol)}" target="_blank" rel="noreferrer">Open</a></td>
    </tr>
  `;
}

function indexCardMarkup(item) {
  const tone = item.direction === "bullish" ? "bullish" : "bearish";
  return `
    <article class="index-card">
      <div class="index-head">
        <strong>${item.name}</strong>
        <span class="pill ${tone}">${setupLabel(item)}</span>
      </div>
      <p>Price: ${formatNumber(item.currentPrice)}</p>
      <p>Zone: ${formatNumber(item.zoneLow)} - ${formatNumber(item.zoneHigh)}</p>
      <p>Distance: ${formatNumber(item.distancePct)}%</p>
      <div class="index-flags">
        ${boolPill(item.sweepConfirmed, "Sweep")}
        ${boolPill(item.confirmationCandle, "Confirm")}
      </div>
      <a class="link-button" href="${chartUrl(item.tvSymbol)}" target="_blank" rel="noreferrer">Open chart</a>
    </article>
  `;
}

function renderMetrics(payload) {
  const stocks = payload.stocks || [];
  elements.metricScanned.textContent = payload.meta?.scannedSymbols ?? "-";
  elements.metricMatches.textContent = stocks.length;
  elements.metricSweeps.textContent = stocks.filter((item) => item.sweepConfirmed).length;
  elements.metricConfirmed.textContent = stocks.filter((item) => item.confirmationCandle).length;
  const note = payload.meta?.note ? ` | ${payload.meta.note}` : "";
  elements.scanMeta.textContent = `Updated ${new Date(payload.generatedAt).toLocaleString("en-IN")} | Universe: ${payload.meta?.universeLabel || "-"}${note}`;
}

function renderStocks(rows) {
  if (!rows.length) {
    elements.stocksBody.innerHTML = '<tr><td colspan="10" class="empty-state">No setups matched this scan.</td></tr>';
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
    renderMetrics(payload);
    renderStocks(payload.stocks || []);
    renderIndices(payload.indices || []);
  } catch (error) {
    console.error(error);
    elements.scanMeta.textContent = "Scan failed. Check Netlify function logs or reduce the universe size.";
    elements.stocksBody.innerHTML = '<tr><td colspan="10" class="empty-state">The live scan failed.</td></tr>';
    elements.indicesGrid.innerHTML = '<div class="empty-state">Could not load index setups.</div>';
  } finally {
    elements.scanButton.disabled = false;
    elements.scanButton.textContent = "Run Scan";
  }
}

elements.scanButton.addEventListener("click", runScan);
window.addEventListener("load", runScan);
