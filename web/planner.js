import { clamp } from "./utils.js";

export function buildTradePlan(stock, style, accountCapital, maxRiskPct) {
  const capital = Number(accountCapital) || 1000000;
  const riskPct = Number(maxRiskPct) || 1;
  const maxRiskAmount = capital * (riskPct / 100);
  const atrBuffer = stock.atrPercent / 100;

  let entry = stock.close;
  let stop = stock.close * (1 - Math.max(atrBuffer * 1.1, 0.025));
  let target1 = stock.close * (1 + Math.max(atrBuffer * 1.5, 0.04));
  let target2 = stock.close * (1 + Math.max(atrBuffer * 2.6, 0.07));

  if (style === "Swing") {
    entry = Math.max(stock.close, stock.ema20 * 1.002);
    stop = Math.min(stock.ema50 * 0.992, stock.close * (1 - Math.max(atrBuffer * 1.25, 0.03)));
  }

  if (style === "Positional") {
    entry = Math.max(stock.close, stock.ema20 * 1.005);
    stop = Math.min(stock.ema50 * 0.985, stock.ema200 * 1.01);
    target1 = entry + ((entry - stop) * 2);
    target2 = entry + ((entry - stop) * 3.2);
  }

  if (style === "Futures") {
    entry = Math.max(stock.close, stock.ema20 * 1.003);
    stop = Math.min(stock.ema50 * 0.99, stock.close * (1 - Math.max(atrBuffer, 0.022)));
    target1 = entry + ((entry - stop) * 1.8);
    target2 = entry + ((entry - stop) * 2.8);
  }

  const riskPerShare = Math.max(entry - stop, entry * 0.005);
  const quantity = Math.max(1, Math.floor(maxRiskAmount / riskPerShare));
  const rr1 = (target1 - entry) / riskPerShare;
  const rr2 = (target2 - entry) / riskPerShare;
  const lotSize = stock.lotSize || 1;
  const riskPerLot = riskPerShare * lotSize;
  const lotsAllowed = style === "Futures" ? Math.max(0, Math.floor(maxRiskAmount / riskPerLot)) : 0;
  const marginPlaceholder = style === "Futures" ? clamp((entry * lotSize * 0.18), 50000, 350000) : 0;

  return {
    style,
    entry,
    stop,
    target1,
    target2,
    riskPerShare,
    rr1,
    rr2,
    accountCapital: capital,
    maxRiskPct: riskPct,
    maxRiskAmount,
    quantity,
    lotSize,
    riskPerLot,
    lotsAllowed,
    marginPlaceholder
  };
}
