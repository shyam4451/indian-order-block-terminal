const elements = {
  scanButton: document.getElementById("scanButton"),
  universe: document.getElementById("universe"),
  limit: document.getElementById("limit"),
  symbols: document.getElementById("symbols"),
  sendAlerts: document.getElementById("sendAlerts"),
  directionFilter: document.getElementById("directionFilter"),
  setupFilter: document.getElementById("setupFilter"),
  qualityFilter: document.getElementById("qualityFilter"),
  volumeFilter: document.getElementById("volumeFilter"),
  minScoreFilter: document.getElementById("minScoreFilter"),
  sortFilter: document.getElementById("sortFilter"),
  statusBadge: document.getElementById("statusBadge"),
  scanMeta: document.getElementById("scanMeta"),
  metricTotal: document.getElementById("metricTotal"),
  metricLongs: document.getElementById("metricLongs"),
  metricShorts: document.getElementById("metricShorts"),
  metricUnique: document.getElementById("metricUnique"),
  metricAlerts: document.getElementById("metricAlerts"),
  metricStrongest: document.getElementById("metricStrongest"),
  metricStrongestMeta: document.getElementById("metricStrongestMeta"),
  marketTape: document.getElementById("marketTape"),
  topSignals: document.getElementById("topSignals"),
  tableSummary: document.getElementById("tableSummary"),
  signalRows: document.getElementById("signalRows"),
  detailPanel: document.getElementById("detailPanel"),
  telegramSummary: document.getElementById("telegramSummary"),
  diagnosticSummary: document.getElementById("diagnosticSummary")
};

const state = {
  payload: null,
  visibleSignals: [],
  selectedSignalId: null
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

function formatCompact(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }
  return Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function formatTime(value) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function pillClass(type) {
  const normalized = String(type || "").toLowerCase();
  if (
    normalized === "long" ||
    normalized === "bullish" ||
    normalized.includes("bullish") ||
    normalized === "prime" ||
    normalized === "sent"
  ) {
    return "accent";
  }
  if (
    normalized === "short" ||
    normalized === "bearish" ||
    normalized.includes("bearish") ||
    normalized === "failed"
  ) {
    return "danger";
  }
  if (normalized === "suppressed") {
    return "warning";
  }
  if (normalized === "high" || normalized === "configured") {
    return "info";
  }
  return "subtle";
}

function pill(label, tone) {
  return `<span class="pill ${pillClass(tone || label)}">${label}</span>`;
}

function toneText(value, positive = true) {
  return positive ? "accent-text" : "danger-text";
}

function summarizeScan(payload) {
  const summary = payload?.summary;
  if (!summary) {
    return;
  }

  elements.metricTotal.textContent = formatCompact(summary.totalSignals);
  elements.metricLongs.textContent = formatCompact(summary.longSignals);
  elements.metricShorts.textContent = formatCompact(summary.shortSignals);
  elements.metricUnique.textContent = formatCompact(summary.uniqueSymbols);
  elements.metricAlerts.textContent = formatCompact(summary.telegram?.sent || 0);
  elements.metricStrongest.textContent = summary.strongestSetup?.symbol || "-";
  elements.metricStrongestMeta.textContent = summary.strongestSetup
    ? `${summary.strongestSetup.setup} | score ${summary.strongestSetup.score}`
    : "No qualifying setup";
}

function renderMarketTape(items) {
  if (!items?.length) {
    elements.marketTape.innerHTML = '<article class="metric card"><span>Market Tape</span><strong>-</strong></article>';
    return;
  }

  elements.marketTape.innerHTML = items.map((item) => {
    const positive = Number(item.change || 0) >= 0;
    const sign = positive ? "+" : "";
    return `
      <article class="metric card tape-card">
        <span>${item.name}</span>
        <strong>${formatNumber(item.price)}</strong>
        <small class="${toneText(item.change, positive)}">${sign}${formatNumber(item.change)} (${sign}${formatNumber(item.changePct)}%)</small>
      </article>
    `;
  }).join("");
}

function topSignalCard(signal) {
  return `
    <article class="signal-card" data-select-signal="${signal.id}">
      <div class="signal-card-head">
        <div>
          <strong>${signal.symbol}</strong>
          <small>${signal.setup}</small>
        </div>
        ${pill(signal.signal, signal.signal)}
      </div>
      <div class="signal-card-grid">
        <div>
          <span>Bias</span>
          <strong>${signal.timeframeCombo}</strong>
        </div>
        <div>
          <span>Score</span>
          <strong>${formatCompact(signal.score)}</strong>
        </div>
        <div>
          <span>RSI</span>
          <strong>${formatNumber(signal.rsi)}</strong>
        </div>
        <div>
          <span>UO</span>
          <strong>${formatNumber(signal.uo)}</strong>
        </div>
      </div>
      <div class="signal-card-foot">
        ${pill(signal.divergence, signal.divergence)}
        ${pill(signal.quality, signal.quality)}
        ${signal.volumeConfirmed ? pill("Volume confirmed", "configured") : pill("Standard volume", "subtle")}
      </div>
    </article>
  `;
}

function renderTopSignals(signals) {
  if (!signals.length) {
    elements.topSignals.innerHTML = '<div class="empty-state">No signals passed the current filters.</div>';
    return;
  }
  elements.topSignals.innerHTML = signals.slice(0, 6).map(topSignalCard).join("");
}

function rowMarkup(signal, isSelected) {
  return `
    <tr class="${isSelected ? "row-selected" : ""}" data-select-signal="${signal.id}">
      <td>
        <div class="row-symbol">
          <strong>${signal.symbol}</strong>
          <small>${formatTime(signal.time)}</small>
        </div>
      </td>
      <td>
        <div class="stack">
          <strong>${signal.setup}</strong>
          <small>${signal.entryTimeframe} trigger</small>
        </div>
      </td>
      <td>
        <div class="stack">
          <strong>${signal.biasTimeframe}</strong>
          <small>Bias RSI ${formatNumber(signal.biasRsi)}</small>
        </div>
      </td>
      <td>
        <div class="stack">
          <div class="stack-inline">
            ${pill(signal.signal, signal.signal)}
            ${pill(signal.divergence, signal.divergence)}
          </div>
          <small>${signal.pricePattern} price | ${signal.oscillatorPattern} UO</small>
        </div>
      </td>
      <td><strong>${formatNumber(signal.price)}</strong></td>
      <td>
        <div class="stack">
          <strong>${formatNumber(signal.rsi)} / ${formatNumber(signal.uo)}</strong>
          <small>${signal.entryTimeframe} close</small>
        </div>
      </td>
      <td>
        <div class="stack">
          <div class="stack-inline">
            ${pill(signal.quality, signal.quality)}
            ${pill(`S ${formatCompact(signal.strengthScore)}`, "info")}
          </div>
          <small>Volume ${formatNumber(signal.volumeRatio)}</small>
        </div>
      </td>
      <td>
        <div class="stack">
          ${pill(signal.alertState, signal.alertState)}
          <small>${signal.alertReason || "Ready for delivery rules"}</small>
        </div>
      </td>
    </tr>
  `;
}

function filterSignals(signals) {
  const minimumScore = Number(elements.minScoreFilter.value || 0);
  const filtered = signals.filter((signal) => {
    if (elements.directionFilter.value !== "all" && signal.signal !== elements.directionFilter.value) {
      return false;
    }
    if (elements.setupFilter.value !== "all" && signal.setupId !== elements.setupFilter.value) {
      return false;
    }
    if (elements.qualityFilter.value !== "all" && signal.quality !== elements.qualityFilter.value) {
      return false;
    }
    if (elements.volumeFilter.value === "confirmed" && !signal.volumeConfirmed) {
      return false;
    }
    if (Number(signal.score || 0) < minimumScore) {
      return false;
    }
    return true;
  });

  const sortKey = elements.sortFilter.value;
  return filtered.sort((left, right) => {
    if (sortKey === "strength") {
      return right.strengthScore - left.strengthScore || right.score - left.score;
    }
    if (sortKey === "freshness") {
      return left.freshnessBars - right.freshnessBars || right.score - left.score;
    }
    if (sortKey === "volume") {
      return right.volumeRatio - left.volumeRatio || right.score - left.score;
    }
    return right.score - left.score || right.strengthScore - left.strengthScore;
  });
}

function renderTable() {
  const allSignals = state.payload?.signals || [];
  state.visibleSignals = filterSignals(allSignals);
  if (!state.visibleSignals.some((signal) => signal.id === state.selectedSignalId)) {
    state.selectedSignalId = state.visibleSignals[0]?.id || null;
  }

  elements.tableSummary.textContent = `${state.visibleSignals.length} visible from ${allSignals.length} qualified signals.`;

  if (!state.visibleSignals.length) {
    const diagnostics = state.payload?.diagnostics;
    const errors = state.payload?.errors || [];
    const reason = errors.length === state.payload?.symbolsScanned
      ? "The upstream market source failed for every scanned symbol."
      : state.payload?.meta?.note || "No signals qualified.";
    elements.signalRows.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
          No signals matched the current filters.
          <div class="empty-copy">${reason}</div>
          ${diagnostics ? `<div class="empty-copy">Setup checks: ${diagnostics.setupChecks} | No UO divergence: ${diagnostics.divergenceMisses} | RSI filter rejects: ${diagnostics.filterMisses}</div>` : ""}
        </td>
      </tr>
    `;
    return;
  }

  elements.signalRows.innerHTML = state.visibleSignals.map((signal) => rowMarkup(signal, signal.id === state.selectedSignalId)).join("");
}

function detailStat(label, value, meta = "") {
  return `
    <article class="detail-stat">
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${meta}</small>
    </article>
  `;
}

function detailMarkup(signal) {
  const divergence = signal.internals?.divergence;
  return `
    <div class="detail-header">
      <div>
        <p class="section-label">${signal.symbol}</p>
        <h3>${signal.setup} ${signal.signal}</h3>
        <p class="detail-copy">${signal.rationale.join(" ")}</p>
      </div>
      <div class="hero-tags">
        ${pill(signal.signal, signal.signal)}
        ${pill(signal.quality, signal.quality)}
        ${pill(signal.alertState, signal.alertState)}
      </div>
    </div>
    <div class="detail-grid">
      ${detailStat("Timeframes", signal.timeframeCombo, `${signal.divergence} divergence`)}
      ${detailStat("Current price", formatNumber(signal.price), `Scanned ${formatTime(signal.time)}`)}
      ${detailStat("Entry RSI / UO", `${formatNumber(signal.rsi)} / ${formatNumber(signal.uo)}`, `${signal.entryTimeframe} close`)}
      ${detailStat("Bias RSI", formatNumber(signal.biasRsi), `${signal.biasTimeframe} filter`)}
      ${detailStat("Strength score", formatCompact(signal.strengthScore), `Slope diff ${formatNumber(signal.slopeDifference)}`)}
      ${detailStat("Volume ratio", formatNumber(signal.volumeRatio), signal.volumeConfirmed ? "1.5x confirmation met" : "No volume boost")}
    </div>
    <div class="detail-section">
      <p class="section-label">Pivot read</p>
      <div class="stack-list">
        <div class="info-row">
          <strong>Price pivots</strong>
          <span>${formatNumber(divergence?.pivots?.price?.[0]?.value)} -> ${formatNumber(divergence?.pivots?.price?.[1]?.value)}</span>
        </div>
        <div class="info-row">
          <strong>UO pivots</strong>
          <span>${formatNumber(divergence?.pivots?.uo?.[0]?.value)} -> ${formatNumber(divergence?.pivots?.uo?.[1]?.value)}</span>
        </div>
        <div class="info-row">
          <strong>Pivot window</strong>
          <span>${signal.pivotWindow} candles | freshness ${signal.freshnessBars} bars</span>
        </div>
      </div>
    </div>
    <div class="detail-section">
      <p class="section-label">Score mix</p>
      <div class="stack-list">
        <div class="info-row">
          <strong>Divergence</strong>
          <span>${formatNumber(signal.scoreBreakdown.divergence)}</span>
        </div>
        <div class="info-row">
          <strong>Alignment</strong>
          <span>${formatCompact(signal.scoreBreakdown.alignment)}</span>
        </div>
        <div class="info-row">
          <strong>Freshness</strong>
          <span>${formatCompact(signal.scoreBreakdown.freshness)}</span>
        </div>
        <div class="info-row">
          <strong>Volume boost</strong>
          <span>${formatCompact(signal.scoreBreakdown.volume)}</span>
        </div>
      </div>
    </div>
    <div class="detail-section">
      <p class="section-label">Internal output</p>
      <pre class="json-block">${JSON.stringify(signal.payload, null, 2)}</pre>
    </div>
  `;
}

function renderDetail() {
  const signal = state.visibleSignals.find((item) => item.id === state.selectedSignalId) || state.visibleSignals[0];
  if (!signal) {
    elements.detailPanel.innerHTML = '<div class="empty-state compact">No signal selected.</div>';
    return;
  }
  state.selectedSignalId = signal.id;
  elements.detailPanel.innerHTML = detailMarkup(signal);
}

function renderTelegram(payload) {
  const telegram = payload?.telegram;
  if (!telegram) {
    elements.telegramSummary.innerHTML = '<div class="empty-state compact">No Telegram data.</div>';
    return;
  }

  elements.telegramSummary.innerHTML = `
    <div class="info-row">
      <strong>Configured</strong>
      <span>${telegram.configured ? "Yes" : "No"}</span>
    </div>
    <div class="info-row">
      <strong>Requested this scan</strong>
      <span>${telegram.requested ? "Yes" : "No"}</span>
    </div>
    <div class="info-row">
      <strong>Sent</strong>
      <span>${formatCompact(telegram.sent)}</span>
    </div>
    <div class="info-row">
      <strong>Suppressed</strong>
      <span>${formatCompact(telegram.suppressed)}</span>
    </div>
    <div class="info-row">
      <strong>Failed</strong>
      <span>${formatCompact(telegram.failed)}</span>
    </div>
    <div class="info-row">
      <strong>Status note</strong>
      <span>${payload.meta?.note || "No note"}</span>
    </div>
    ${telegram.lastError ? `<div class="info-row"><strong>Last error</strong><span>${telegram.lastError}</span></div>` : ""}
  `;
}

function renderDiagnostics(payload) {
  const diagnostics = payload?.diagnostics;
  const errors = payload?.errors || [];
  if (!diagnostics) {
    elements.diagnosticSummary.innerHTML = '<div class="empty-state compact">No diagnostics available.</div>';
    return;
  }

  const previewErrors = errors.slice(0, 4);
  elements.diagnosticSummary.innerHTML = `
    <div class="info-row">
      <strong>Setup checks</strong>
      <span>${formatCompact(diagnostics.setupChecks)}</span>
    </div>
    <div class="info-row">
      <strong>No UO divergence</strong>
      <span>${formatCompact(diagnostics.divergenceMisses)}</span>
    </div>
    <div class="info-row">
      <strong>RSI filter rejects</strong>
      <span>${formatCompact(diagnostics.filterMisses)}</span>
    </div>
    <div class="info-row">
      <strong>Qualified setups</strong>
      <span>${formatCompact(diagnostics.qualified)}</span>
    </div>
    <div class="info-row">
      <strong>Symbol fetch failures</strong>
      <span>${formatCompact(payload.symbolsFailed || 0)}</span>
    </div>
    ${previewErrors.map((item) => `
      <div class="info-row">
        <strong>${item.symbol}</strong>
        <span>${item.error}</span>
      </div>
    `).join("")}
  `;
}

function renderAll() {
  if (!state.payload) {
    return;
  }

  summarizeScan(state.payload);
  renderMarketTape(state.payload.marketTape || []);
  renderTable();
  renderTopSignals(state.visibleSignals);
  renderDetail();
  renderTelegram(state.payload);
  renderDiagnostics(state.payload);
}

function setStatus(label, tone, meta) {
  elements.statusBadge.className = `pill ${tone}`;
  elements.statusBadge.textContent = label;
  elements.scanMeta.textContent = meta;
}

async function runScan() {
  elements.scanButton.disabled = true;
  setStatus("Scanning", "warning", "Fetching live candles and qualifying UO divergence setups.");

  const params = new URLSearchParams({
    universe: elements.universe.value,
    limit: elements.limit.value,
    sendAlerts: elements.sendAlerts.value
  });

  const customSymbols = elements.symbols.value.trim();
  if (customSymbols) {
    params.set("symbols", customSymbols);
  }

  try {
    const response = await fetch(`/api/scan?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Scan failed with status ${response.status}`);
    }

    state.payload = await response.json();
    state.selectedSignalId = state.payload.signals?.[0]?.id || null;
    renderAll();
    setStatus(
      "Ready",
      "accent",
      `${formatCompact(state.payload.symbolsScanned)} symbols scanned at ${formatTime(state.payload.generatedAt)}. ${state.payload.meta?.note || ""}`
    );
  } catch (error) {
    console.error(error);
    setStatus("Error", "danger", error.message);
    elements.signalRows.innerHTML = '<tr><td colspan="8" class="empty-state">The live scan failed.</td></tr>';
    elements.topSignals.innerHTML = '<div class="empty-state">Could not load ranked signals.</div>';
    elements.detailPanel.innerHTML = '<div class="empty-state">Could not load signal detail.</div>';
    elements.telegramSummary.innerHTML = '<div class="empty-state compact">Telegram status unavailable.</div>';
    elements.diagnosticSummary.innerHTML = '<div class="empty-state compact">Diagnostics unavailable.</div>';
  } finally {
    elements.scanButton.disabled = false;
  }
}

document.addEventListener("click", (event) => {
  const signalTarget = event.target.closest("[data-select-signal]");
  if (signalTarget) {
    state.selectedSignalId = signalTarget.dataset.selectSignal;
    renderTable();
    renderDetail();
  }
});

document.addEventListener("change", (event) => {
  if ([
    elements.directionFilter,
    elements.setupFilter,
    elements.qualityFilter,
    elements.volumeFilter,
    elements.minScoreFilter,
    elements.sortFilter
  ].includes(event.target)) {
    renderAll();
  }
});

elements.scanButton.addEventListener("click", runScan);
