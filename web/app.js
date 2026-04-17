const JOURNAL_KEY = "indian-order-block-journal";

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
  marketTape: document.getElementById("marketTape"),
  stocksBody: document.getElementById("stocksBody"),
  indicesGrid: document.getElementById("indicesGrid"),
  newsFeed: document.getElementById("newsFeed"),
  journalList: document.getElementById("journalList")
};

const state = {
  latestPayload: null,
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

function chartUrl(symbol) {
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`;
}

function setupLabel(row) {
  return row.direction === "bullish" ? "Demand Long" : "Supply Short";
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

function boolPill(value, trueLabel, falseLabel = "No") {
  return `<span class="pill ${value ? "neutral" : "subtle"}">${value ? trueLabel : falseLabel}</span>`;
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

function stockRowMarkup(row) {
  const tone = directionTone(row.direction);
  const zoneState = row.insideZone === "yes" ? "inside" : "near";
  const chartSymbol = row.tvSymbol || `NSE:${row.symbol.replace(".NS", "")}`;

  return `
    <tr>
      <td>
        <div class="row-symbol">
          <strong>${row.symbol}</strong>
          <small>${row.setupState}</small>
        </div>
      </td>
      <td>${row.zoneTimeframe}</td>
      <td>${row.triggerTimeframe === "none" ? "-" : row.triggerTimeframe}</td>
      <td><span class="pill ${tone}">${setupLabel(row)}</span></td>
      <td><span class="pill ${stateTone(row.setupState)}">${row.setupState}</span></td>
      <td>${formatNumber(row.currentPrice)}</td>
      <td>${formatNumber(row.zoneLow)} - ${formatNumber(row.zoneHigh)}</td>
      <td><span class="${zoneState === "inside" ? "inside-yes" : "inside-no"}">${formatNumber(row.distancePct)}%</span></td>
      <td>${boolPill(row.sweepConfirmed, "Yes", "No")}</td>
      <td>${boolPill(row.confirmationCandle, "Yes", "No")}</td>
      <td>${formatNumber(row.score)}</td>
      <td>
        <div class="row-actions">
          <a class="link-button" href="${chartUrl(chartSymbol)}" target="_blank" rel="noreferrer">Open</a>
          <button class="secondary-button small-button" data-journal='${JSON.stringify({
            symbol: row.symbol,
            setup: setupLabel(row),
            zoneTimeframe: row.zoneTimeframe,
            triggerTimeframe: row.triggerTimeframe,
            state: row.setupState,
            createdAt: new Date().toISOString()
          }).replace(/'/g, "&apos;")}'>Save</button>
        </div>
      </td>
    </tr>
  `;
}

function indexCardMarkup(item) {
  const tone = directionTone(item.direction);
  return `
    <article class="index-card">
      <div class="index-head">
        <strong>${item.name}</strong>
        <span class="pill ${tone}">${setupLabel(item)}</span>
      </div>
      <p>HTF zone: ${item.zoneTimeframe}</p>
      <p>LTF trigger: ${item.triggerTimeframe === "none" ? "-" : item.triggerTimeframe}</p>
      <p>State: ${item.setupState}</p>
      <p>Price: ${formatNumber(item.currentPrice)} | Zone: ${formatNumber(item.zoneLow)} - ${formatNumber(item.zoneHigh)}</p>
      <div class="index-flags">
        ${boolPill(item.sweepConfirmed, "Sweep")}
        ${boolPill(item.confirmationCandle, "Confirm")}
      </div>
      <a class="link-button" href="${chartUrl(item.tvSymbol)}" target="_blank" rel="noreferrer">Open chart</a>
    </article>
  `;
}

function newsCardMarkup(item) {
  const date = item.pubDate
    ? new Date(item.pubDate).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    })
    : "-";
  return `
    <a class="news-card" href="${item.link}" target="_blank" rel="noreferrer">
      <span class="section-label">${item.sourceQuery}</span>
      <strong>${item.title}</strong>
      <small>${date}</small>
    </a>
  `;
}

function journalItemMarkup(item, index) {
  const date = item.createdAt
    ? new Date(item.createdAt).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    })
    : "-";
  return `
    <article class="journal-card">
      <div class="index-head">
        <strong>${item.symbol}</strong>
        <button class="secondary-button small-button" data-remove-journal="${index}">Remove</button>
      </div>
      <p>${item.setup}</p>
      <p>Zone TF: ${item.zoneTimeframe} | Trigger TF: ${item.triggerTimeframe}</p>
      <p>Saved state: ${item.state}</p>
      <small>${date}</small>
    </article>
  `;
}

function renderMetrics(payload) {
  const stocks = payload.stocks || [];
  elements.metricScanned.textContent = payload.meta?.scannedSymbols ?? "-";
  elements.metricMatches.textContent = stocks.length;
  elements.metricSweeps.textContent = stocks.filter((item) => item.sweepConfirmed).length;
  elements.metricConfirmed.textContent = stocks.filter((item) => item.setupState === "LTF Confirmed").length;
  const note = payload.meta?.note ? ` | ${payload.meta.note}` : "";
  elements.scanMeta.textContent = `Updated ${new Date(payload.generatedAt).toLocaleString("en-IN")} | Universe: ${payload.meta?.universeLabel || "-"}${note}`;
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
    elements.stocksBody.innerHTML = '<tr><td colspan="12" class="empty-state">No setups matched this scan.</td></tr>';
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

function renderNews(rows) {
  if (!rows.length) {
    elements.newsFeed.innerHTML = '<div class="empty-state">No news loaded right now.</div>';
    return;
  }
  elements.newsFeed.innerHTML = rows.map(newsCardMarkup).join("");
}

function renderJournal() {
  if (!state.journal.length) {
    elements.journalList.innerHTML = '<div class="empty-state">Saved trades will appear here.</div>';
    return;
  }
  elements.journalList.innerHTML = state.journal.map(journalItemMarkup).join("");
}

function addJournalItem(item) {
  state.journal.unshift(item);
  state.journal = state.journal.slice(0, 30);
  saveJournal();
  renderJournal();
}

function removeJournalItem(index) {
  state.journal.splice(index, 1);
  saveJournal();
  renderJournal();
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
    renderTape(payload.marketTape || []);
    renderStocks(payload.stocks || []);
    renderIndices(payload.indices || []);
    renderNews(payload.news || []);
  } catch (error) {
    console.error(error);
    elements.scanMeta.textContent = "Scan failed. Check Netlify function logs or reduce the universe size.";
    elements.stocksBody.innerHTML = '<tr><td colspan="12" class="empty-state">The live scan failed.</td></tr>';
    elements.indicesGrid.innerHTML = '<div class="empty-state">Could not load index setups.</div>';
    elements.newsFeed.innerHTML = '<div class="empty-state">Could not load news.</div>';
  } finally {
    elements.scanButton.disabled = false;
    elements.scanButton.textContent = "Run Scan";
  }
}

document.addEventListener("click", (event) => {
  const journalButton = event.target.closest("[data-journal]");
  if (journalButton) {
    try {
      addJournalItem(JSON.parse(journalButton.dataset.journal));
    } catch (error) {
      console.error(error);
    }
    return;
  }

  const removeButton = event.target.closest("[data-remove-journal]");
  if (removeButton) {
    removeJournalItem(Number(removeButton.dataset.removeJournal));
  }
});

elements.scanButton.addEventListener("click", runScan);
window.addEventListener("load", () => {
  renderJournal();
  runScan();
});
