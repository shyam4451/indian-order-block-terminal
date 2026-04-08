export const EDUCATION = {
  breadth: {
    title: "Market Breadth",
    what: "Breadth measures how many stocks are participating in a move, not just what the headline index is doing.",
    use: "Traders use strong breadth to validate a rally and weak breadth to question whether an index move is narrow and fragile.",
    caution: "Breadth can improve or weaken before the index clearly responds, so do not treat it as a standalone entry signal."
  },
  emaAlignment: {
    title: "EMA Alignment",
    what: "The 20, 50, and 200 EMA show short, medium, and long-term trend structure.",
    use: "When 20 is above 50 and 50 is above 200, trend quality is usually cleaner because multiple time horizons are aligned.",
    caution: "EMA alignment is slow to change. It helps with context, but late entries can still fail if price is extended."
  },
  adx: {
    title: "ADX / DMI",
    what: "ADX measures trend strength. DI+ and DI- show which side currently has directional control.",
    use: "Traders look for rising ADX after quiet periods because it can signal trend expansion. DI+ above DI- supports bullish direction, while DI- above DI+ supports bearish direction.",
    caution: "ADX does not tell you direction by itself. A high ADX only says the trend is strong, not whether you should buy or sell."
  },
  openInterest: {
    title: "Futures Open Interest",
    what: "Open interest shows whether futures positions are being opened or closed.",
    use: "Price and OI together help traders separate new long build-up from short covering, or fresh shorts from long unwinding.",
    caution: "One-day OI changes can be noisy near expiry, rollover, or event-driven spikes. Read OI with price and volume, not alone."
  },
  rsiDivergence: {
    title: "RSI Divergence",
    what: "Divergence appears when price makes a new extreme but RSI does not confirm it.",
    use: "Traders use divergence as an early warning that momentum is weakening and then wait for price confirmation through a swing level.",
    caution: "Divergence can fail repeatedly in strong trends. Treat it as a setup idea, not a reversal guarantee."
  },
  volumeExpansion: {
    title: "Volume Expansion",
    what: "Volume expansion compares current participation against recent average participation.",
    use: "Breakouts and trend resumes tend to have better follow-through when volume expands because more participants are involved.",
    caution: "Huge one-day volume after an extended move can also mean exhaustion or event-driven noise rather than healthy accumulation."
  },
  sectorStrength: {
    title: "Sector Strength",
    what: "Sector strength helps you see where relative leadership is concentrated.",
    use: "A good stock in a strong sector often has better odds of follow-through than a good stock in a weak sector.",
    caution: "Sector leadership rotates. Strong sectors can cool quickly after crowded moves or macro headlines."
  },
  liquiditySweep: {
    title: "Liquidity Sweep Reversal",
    what: "A sweep happens when price pushes through a prior swing level, traps traders, and then closes back inside the range.",
    use: "Experienced discretionary traders watch for sweeps near obvious support, resistance, and crowded breakout levels.",
    caution: "A weak reclaim is not enough. Without a strong close back inside range and supportive volume, the setup can just be a continuation move."
  },
  pullback: {
    title: "Pullback In Trend",
    what: "A pullback setup looks for price to retrace into support within a broader trend and then resume.",
    use: "Traders prefer pullbacks when they want better entry location than chasing a fresh breakout.",
    caution: "A pullback is attractive only if the broader trend is intact. Pulling back into a weak trend can become a reversal."
  },
  obv: {
    title: "OBV / Accumulation",
    what: "On-Balance Volume tracks whether volume is flowing more on up moves or down moves.",
    use: "When OBV rises while price is still coiling, traders read it as possible accumulation ahead of a breakout attempt.",
    caution: "OBV can be distorted by one-off volume bursts. Combine it with price structure and range location."
  },
  ranking: {
    title: "Watchlist Ranking",
    what: "The ranking engine scores stocks on trend, sector, relative strength, volume, derivatives context, and setup readiness.",
    use: "It helps you prioritize where to spend attention when the universe is too large to inspect manually.",
    caution: "A high score does not remove execution risk. It only means multiple supportive factors are aligned."
  },
  planner: {
    title: "Trade Planner",
    what: "The planner converts a setup into entry, stop, targets, and position size based on your risk rules.",
    use: "Traders use it to keep risk consistent instead of sizing trades emotionally.",
    caution: "A good plan still needs discipline. Wide stops or poor liquidity can make a mathematically good trade impractical."
  },
  journal: {
    title: "Trade Journal",
    what: "The journal records whether your actual execution matched the plan and what the result was in R.",
    use: "Over time it shows which setups, mistakes, and conditions are improving or hurting performance.",
    caution: "A small sample can be misleading. Focus on repeated behavior and process quality, not just recent PnL."
  },
  risk: {
    title: "Risk Dashboard",
    what: "Risk controls track open risk, sector clustering, futures leverage, and drawdown limits.",
    use: "This helps prevent one market move from harming several positions at once.",
    caution: "Correlation rises during stress. Diversified names can still move together when the market turns sharply."
  }
};

export function getEducation(key) {
  return EDUCATION[key] || null;
}
