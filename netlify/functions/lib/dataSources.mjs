import { INDEX_INSTRUMENTS, MARKET_TAPE_SYMBOLS, NSE_EQUITY_CSV_URL } from "./constants.mjs";
import { buildStableUniverseOrder, round, stripHtml } from "./helpers.mjs";

function csvToRows(text) {
  const [headerLine, ...lines] = text.trim().split(/\r?\n/);
  const headers = headerLine.split(",").map((item) => item.trim().replace(/^"|"$/g, ""));
  return lines.map((line) => {
    const columns = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
    return headers.reduce((record, header, index) => {
      record[header] = (columns[index] || "").replace(/^"|"$/g, "").trim();
      return record;
    }, {});
  });
}

export async function fetchNseSymbols(limit = 100) {
  const response = await fetch(NSE_EQUITY_CSV_URL, {
    headers: { "user-agent": "Mozilla/5.0" }
  });
  if (!response.ok) {
    throw new Error(`NSE symbol download failed: ${response.status}`);
  }

  const rows = csvToRows(await response.text());
  const symbols = rows
    .filter((row) => row.SERIES === "EQ" && row.SYMBOL)
    .map((row) => `${row.SYMBOL}.NS`);
  const stableOrder = buildStableUniverseOrder(symbols);

  return limit >= stableOrder.length ? stableOrder : stableOrder.slice(0, limit);
}

export async function fetchYahooCandles(symbol, interval, range) {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set("interval", interval);
  url.searchParams.set("range", range);
  url.searchParams.set("includePrePost", "false");
  url.searchParams.set("events", "div,splits");

  const response = await fetch(url.toString(), {
    headers: { "user-agent": "Mozilla/5.0" }
  });
  if (!response.ok) {
    throw new Error(`Yahoo chart request failed for ${symbol}: ${response.status}`);
  }

  const payload = await response.json();
  const result = payload?.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  if (!result || !quote || !Array.isArray(result.timestamp)) {
    return [];
  }

  const rows = [];
  result.timestamp.forEach((timestamp, index) => {
    const open = quote.open?.[index];
    const high = quote.high?.[index];
    const low = quote.low?.[index];
    const close = quote.close?.[index];
    const volume = quote.volume?.[index] ?? 0;
    if ([open, high, low, close].some((value) => value === null || value === undefined)) {
      return;
    }
    rows.push({
      datetime: new Date(timestamp * 1000).toISOString(),
      open,
      high,
      low,
      close,
      volume
    });
  });

  return rows;
}

export function buildSynthetic4H(rows) {
  const sessions = new Map();
  rows.forEach((row) => {
    const key = row.datetime.slice(0, 10);
    if (!sessions.has(key)) {
      sessions.set(key, []);
    }
    sessions.get(key).push(row);
  });

  const blocks = [];
  [...sessions.values()].forEach((session) => {
    session.sort((a, b) => a.datetime.localeCompare(b.datetime));
    for (let index = 0; index < session.length; index += 4) {
      const block = session.slice(index, index + 4);
      if (block.length < 2) {
        continue;
      }
      blocks.push({
        datetime: block[block.length - 1].datetime,
        open: block[0].open,
        high: Math.max(...block.map((item) => item.high)),
        low: Math.min(...block.map((item) => item.low)),
        close: block[block.length - 1].close,
        volume: block.reduce((sum, item) => sum + (item.volume || 0), 0)
      });
    }
  });

  return blocks;
}

export async function fetchYahooQuote(symbol) {
  const rows = await fetchYahooCandles(symbol, "1d", "5d");
  if (rows.length < 2) {
    return null;
  }
  const last = rows[rows.length - 1];
  const previous = rows[rows.length - 2];
  const change = last.close - previous.close;
  const changePct = previous.close ? (change / previous.close) * 100 : 0;
  return {
    symbol,
    price: round(last.close),
    change: round(change),
    changePct: round(changePct)
  };
}

export async function fetchMarketTape() {
  const settled = await Promise.allSettled(
    MARKET_TAPE_SYMBOLS.map(async (item) => {
      const quote = await fetchYahooQuote(item.symbol);
      return quote ? { name: item.name, ...quote } : null;
    })
  );

  return settled
    .filter((item) => item.status === "fulfilled" && item.value)
    .map((item) => item.value);
}

function parseRssItems(xml, limit = 6) {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  return items.slice(0, limit).map((item) => {
    const block = item[1];
    const title = stripHtml((block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "");
    const link = stripHtml((block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || "");
    const pubDate = stripHtml((block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || "");
    return { title, link, pubDate };
  }).filter((item) => item.title && item.link);
}

export async function fetchNewsItems(symbols) {
  const queries = [
    "Nifty 50 Indian stock market",
    ...symbols.slice(0, 4).map((symbol) => symbol.replace(".NS", ""))
  ];
  const settled = await Promise.allSettled(
    queries.map(async (query) => {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query + " NSE OR India stocks")}&hl=en-IN&gl=IN&ceid=IN:en`;
      const response = await fetch(url, {
        headers: { "user-agent": "Mozilla/5.0" }
      });
      if (!response.ok) {
        return [];
      }
      const xml = await response.text();
      return parseRssItems(xml, 2).map((item) => ({ ...item, sourceQuery: query }));
    })
  );

  return settled
    .filter((item) => item.status === "fulfilled")
    .flatMap((item) => item.value)
    .slice(0, 8);
}

export function resolveMarketType(symbol, universe) {
  if (INDEX_INSTRUMENTS.some((item) => item.sourceSymbol === symbol)) {
    return "Index";
  }
  return universe === "fno" ? "F&O" : "Cash";
}
