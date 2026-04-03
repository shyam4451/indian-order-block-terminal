# Order Block Terminal India

This project is now structured as a deployable website, not just a terminal tool.

It gives you:

- a polished market dashboard UI
- automatic stock discovery from the NSE equity list
- scans for 4H, Daily, and Weekly order-block proximity
- RSI divergence detection
- TradingView chart links for every stock
- an index section for futures-oriented workflows
- a Netlify-compatible serverless API
- GitHub/Netlify-friendly repo setup

## Website structure

- `index.html`: main dashboard page
- `styles.css`: visual design
- `web/app.js`: browser-side logic
- `netlify/functions/scan.mjs`: serverless scan API
- `netlify.toml`: Netlify routing setup

## How it works

### Frontend

The frontend is a static website, so Netlify can host it directly.

### Backend/API

The scan engine lives in a Netlify Function:

- route: `/api/scan`
- actual function file: `netlify/functions/scan.mjs`

That function:

- loads stock symbols
- downloads Yahoo chart candles
- builds synthetic 4H candles from 1H data
- detects simple bullish and bearish order blocks
- checks RSI divergence
- returns JSON for the website table and index cards

## Supported universes

- `Nifty 50`
- `Liquid F&O stocks`
- `NSE EQ universe`

## Futures and indices

The website includes a dedicated index section for futures traders.

Current index set:

- `NIFTY 50`
- `BANK NIFTY`
- `FIN NIFTY`
- `MIDCAP NIFTY`

The TradingView links point to futures-friendly symbols such as continuous futures charts.

## Deploy to Netlify

### Easiest path

1. Push this project to GitHub.
2. Log into Netlify.
3. Click `Add new site` -> `Import an existing project`.
4. Select your GitHub repo.
5. Netlify should detect:

- publish directory: `.`
- functions directory: `netlify/functions`

6. Deploy.

After deployment, your site URL will serve:

- the website homepage
- the scan API at `/api/scan`

## GitHub prep

This repo already includes:

- `.gitignore` so local virtualenvs, Netlify caches, env files, and `node_modules` stay out of Git
- `.nvmrc` with Node `18`
- `netlify.toml` for function routing

Suggested Git flow:

```bash
git add .
git commit -m "Build hosted Indian order block terminal"
git remote add origin <your-github-repo-url>
git push -u origin main
```

## Local preview

You can preview the static frontend with:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

Important:

- that only previews the static website shell
- the live API route is meant to run in Netlify Functions
- to fully run the hosted version locally, you would normally use Netlify CLI

If you want a full local Netlify-style test later, install Node 18 first and then use Netlify CLI.

## Important practical note

Full NSE scans can be heavy for serverless platforms because they have execution limits.

For the first real hosted version, the best defaults are:

- `Nifty 50`
- `Liquid F&O stocks`

Those are faster, more reliable, and better for a trading workflow anyway.

## Honest limitations in this version

- order blocks are heuristic, not institutional-grade market structure logic yet
- index scans currently use index data as the signal source while the chart link opens a futures-oriented TradingView symbol
- index coverage is still selective and currently focused on four major derivatives-watchlist products
- alerts and historical tracking are not added yet

## Good next upgrades

- Telegram alerts
- WhatsApp or email alerts
- historical scan database
- filters by volume and sector
- more index products and sector indices
- better market-structure logic with mitigation tracking and fair-value gaps
- authentication so only you can access the dashboard

## Sources

- NSE securities page: https://www.nseindia.com/market-data/securities-available-for-trading
- Netlify Functions docs: https://docs.netlify.com/build/functions/overview
