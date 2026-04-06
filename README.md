# Triangular Arbitrage Visualization

This repository is a pnpm workspace with two applications:

- `apps/frontend`: a React + Vite dashboard with two modes
- `apps/backend`: an Express API used by the historical dashboard

The app supports:

- `Live` mode: client-side triangular arbitrage detection using Binance US REST/WebSocket data
- `Historical` mode: BigQuery-backed exploration of precomputed arbitrage data from `2017-01-01` through `2022-12-31`

## What You Need

You do not need a Python `requirements.txt` for this project. Dependencies are managed with:

- [package.json](/Users/silvy/code/school/cse6242/package.json)
- [pnpm-lock.yaml](/Users/silvy/code/school/cse6242/pnpm-lock.yaml)

Install these tools first:

- Node.js `18+`
- `pnpm` `9+`

Recommended setup on a new machine:

```bash
node --version
corepack enable
corepack prepare pnpm@latest --activate
pnpm --version
```

If `corepack` is not available, install pnpm another way:

```bash
npm install -g pnpm
pnpm --version
```

## Project Layout

```text
cse6242/
├── apps/
│   ├── backend/    # Express API for historical mode
│   └── frontend/   # React/Vite single-page app
├── README.md
├── USER_GUIDE.md
├── historical-dashboard-spec.md
├── live-dashboard-spec.md
├── package.json
├── pnpm-lock.yaml
└── pnpm-workspace.yaml
```

## Install Dependencies

From the repo root:

```bash
pnpm install
```

That installs dependencies for both workspace apps.

## Environment Setup

### Frontend env

Copy the example file:

```bash
cp apps/frontend/.env.example apps/frontend/.env
```

Default values:

```env
VITE_API_URL=/api
VITE_BINANCE_REST_URL=https://api.binance.us
VITE_BINANCE_WS_URL=wss://stream.binance.us:9443/stream
```

Notes:

- In local development, Vite proxies `/api` to `http://localhost:3001`
- If you keep the defaults, you can usually skip creating `apps/frontend/.env`

### Backend env

Historical mode requires the backend. Copy the example file:

```bash
cp apps/backend/.env.example apps/backend/.env
```

Required BigQuery configuration:

```env
PORT=3001
BIGQUERY_VIEW_ID=your-project.your_dataset.vw_triangle_opportunities_enriched
BIGQUERY_LOCATION=US
```

You can also build the view ID from separate values:

```env
BIGQUERY_PROJECT_ID=your-project
BIGQUERY_DATASET=your_dataset
BIGQUERY_VIEW=vw_triangle_opportunities_enriched
```

This codebase is currently written to pass inline credentials through env vars:

```env
GOOGLE_APPLICATION_CREDENTIALS_EMAIL=service-account@your-project.iam.gserviceaccount.com
GOOGLE_APPLICATION_CREDENTIALS_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Important details:

- `BIGQUERY_VIEW_ID` must be in `project.dataset.view` format
- The historical backend will fail at startup if BigQuery configuration is missing
- The live dashboard does not need the backend
- The private key must preserve escaped newlines exactly as shown above

## How To Run

### Option 1: Run live mode only

Use this if you only want the real-time dashboard.

Terminal 1:

```bash
pnpm dev:frontend
```

Then open:

- `http://localhost:5173`

What works in this mode:

- Live dashboard
- Binance US pair discovery
- Binance US WebSocket streaming
- Client-side arbitrage detection

What will not work:

- Historical dashboard API calls

### Option 2: Run the full app

Use this if you want both live mode and historical mode.

Terminal 1:

```bash
pnpm dev:backend
```

Terminal 2:

```bash
pnpm dev:frontend
```

Then open:

- Frontend: `http://localhost:5173`
- Backend health check: `http://localhost:3001/health`

You can also start both from one command:

```bash
pnpm dev
```

That root script runs backend and frontend together, but using two terminals is usually easier for debugging.

## Build And Preview

Build both apps:

```bash
pnpm build
```

Outputs:

- backend build: `apps/backend/dist`
- frontend build: `apps/frontend/dist`

Run the built backend:

```bash
pnpm --filter @cse6242/backend start
```

Preview the built frontend:

```bash
pnpm --filter @cse6242/frontend preview
```

Default preview URL is typically:

- `http://localhost:4173`

## Available Scripts

From the repo root:

```bash
pnpm dev
pnpm dev:backend
pnpm dev:frontend
pnpm build
pnpm typecheck
pnpm lint
pnpm format
pnpm check
```

What they do:

- `pnpm dev`: starts both apps
- `pnpm dev:backend`: starts the Express server with `tsx watch`
- `pnpm dev:frontend`: starts Vite dev server on port `5173`
- `pnpm build`: builds backend then frontend
- `pnpm typecheck`: runs TypeScript checks in both apps
- `pnpm lint`: runs Biome lint rules
- `pnpm format`: formats the repo with Biome
- `pnpm check`: runs Biome's combined checks

## API Summary

The backend mounts historical endpoints at:

- `GET /health`
- `GET /api/historical/summary`
- `GET /api/historical/graph`
- `GET /api/historical/graph-timeline`
- `GET /api/historical/triangles`
- `GET /api/historical/opportunities`

The frontend currently uses:

- `/summary`
- `/graph-timeline`
- `/triangles`

The `graph` and `opportunities` endpoints exist in the backend but are not currently used by the main dashboard UI.

## Current Runtime Behavior

### Live mode

- Uses Binance US endpoints by default, not global Binance
- Filters exchange pairs to symbols involving one of: `USDT`, `USD`, `USDC`, `BTC`, `ETH`
- Limits WebSocket subscriptions to `300` streams
- Stores live settings in `localStorage`
- Runs arbitrage detection in a Web Worker
- Counts only profitable events in the large `Opportunities` card

### Historical mode

- Uses date defaults `2017-01-01` to `2022-12-31`
- Fetches summary stats and graph snapshots from the backend
- Animates graph playback client-side after snapshot data loads
- Opens a detail drawer when you click a node
- Shows up to `50` triangle rows in that drawer, sorted by count

## Verification

I verified the current repo state with:

```bash
pnpm typecheck
pnpm build
```

Both succeeded locally.

`pnpm check` does not currently pass cleanly. The main reasons are:

- existing accessibility warnings in several UI components
- generated `dist/` files being included in Biome checks after a build

## Troubleshooting

### Frontend opens but historical mode errors out

Most likely causes:

- backend is not running
- `apps/backend/.env` is missing
- BigQuery credentials are invalid
- the configured BigQuery view does not exist or is not accessible

### Backend crashes on startup

Check:

- `BIGQUERY_VIEW_ID` or `BIGQUERY_PROJECT_ID` + `BIGQUERY_DATASET`
- service account email/private key values
- `BIGQUERY_LOCATION`

### Live mode shows no data

Check:

- internet access
- browser console for WebSocket issues
- whether Binance US endpoints are reachable from your network
- whether your selected coins produce enough pairs/triangles

### Port already in use

Backend on a different port:

```bash
PORT=3002 pnpm dev:backend
```

Frontend on a different port:

```bash
pnpm --filter @cse6242/frontend dev -- --port 5174
```
