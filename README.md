# Triangular Arbitrage Visualization

A full-stack web application for detecting and visualizing triangular arbitrage opportunities in cryptocurrency markets. Features both historical data analysis (2017–2022) and real-time client-side opportunity detection via Binance WebSocket streams integration.

**Stack**: React 19, Vite 6, Express 5, Node 18+, Google BigQuery, D3.js v7

## Key Features

- 📊 **Historical Mode** — Explore 2017–2022 triangular arbitrage data with animated graph playback, time-series charts, summary stats, and drill-down detail panels
- 🔴 **Live Mode** — Real-time opportunity detection from Binance book ticker WebSocket streams, powered by a dedicated Web Worker for off-main-thread arbitrage scanning
- 📈 **Network Visualization** — D3.js force-directed graph with animated snapshot transitions (historical) and live edge highlighting with profit/stale color coding (live)
- 💡 **Advanced Analytics** — Profit metrics, volume data, volatility measures (24h/7d/30d), and per-pair liquidity analysis stored in 1M+ enriched opportunity rows
- 🎨 **Modern UI** — Dark theme, Tailwind CSS v4 + Shadcn/Radix UI components, skeleton loading states, responsive grid layout, persisted user preferences

## Prerequisites

- **Node.js** 18+ and **pnpm** 9+
- **Google BigQuery** access (for historical mode backend)
- Internet connection (for Binance API access in live mode)

```bash
node --version   # Should be 18+
pnpm --version   # Should be 9+
```

## Installation

### 1. Install Dependencies

```bash
pnpm install
```

Installs dependencies for both frontend and backend via pnpm workspaces.

### 2. Set Up Environment Variables

#### Backend — `apps/backend/.env`

```env
# Fully qualified BigQuery view
BIGQUERY_VIEW_ID="your-project.your_dataset.vw_triangle_opportunities_enriched"

# Optional if not using BIGQUERY_VIEW_ID directly
BIGQUERY_PROJECT_ID="your-project"
BIGQUERY_DATASET="your_dataset"
BIGQUERY_VIEW="vw_triangle_opportunities_enriched"
BIGQUERY_LOCATION="US"

# Server port (default: 3001)
PORT=3001
```

You need valid Google Cloud credentials with access to the BigQuery view. Application Default Credentials are supported by the BigQuery client.

#### Frontend — `apps/frontend/.env` (optional)

The frontend proxies `/api` requests to `http://localhost:3001` during development. No `.env` is required for the default setup. Optional overrides:

```env
VITE_API_URL=http://localhost:3001        # API base URL
VITE_BINANCE_REST_URL=https://api.binance.us  # Binance REST base
VITE_BINANCE_WS_URL=wss://stream.binance.us:9443/stream  # Binance WS
```

## Running the Application

### Development Mode

```bash
# Run both backend & frontend with hot reload
pnpm dev

# Or individually:
pnpm dev:backend    # Express server → http://localhost:3001
pnpm dev:frontend   # Vite dev server → http://localhost:5173
```

### Production Build

```bash
pnpm build
# Backend compiles to apps/backend/dist/
# Frontend builds to apps/frontend/dist/
```

## Architecture

**Monorepo** managed with pnpm workspaces (`apps/backend`, `apps/frontend`).

### Historical Mode — Data Flow

```
Header (date range + bin controls)
  → AppContext (shared state)
    → useSummary()         → SummaryCards + TimeSeriesChart
    → useGraphTimeline()   → NetworkGraph (snapshot animation)
    → GraphPlaybackControls (play/pause, step, speed, scrub)
    → Node click → useTriangles(currency) → DetailPanel (slide-out)
```

All historical data is served by the Express backend, which queries a BigQuery view containing ~1M pre-computed triangular arbitrage opportunities with volatility and liquidity metrics.

### Live Mode — Data Flow

```
useBinanceExchangeInfo(selectedCoins)
  → derives pairs, builds adjacency list, enumerates triangles
useBinanceWebSocket(pairs)
  → BookTicker messages via Binance combined stream (up to 300 pairs)
useArbitrageDetection(triangles, config)
  → Web Worker maintains price map, checks all triangles (fwd + rev)
  → Opportunities deduped by triangle+direction+rounded profit
  → OpportunityFeed (grouped, sorted) + NetworkGraph (edge highlighting)
```

Live mode is **entirely client-side** — no backend required. The arbitrage detection runs in a dedicated Web Worker to keep the UI responsive.

## API Endpoints

Base URL: `http://localhost:3001/api/historical`

| Method | Endpoint          | Description                                                    |
| ------ | ----------------- | -------------------------------------------------------------- |
| `GET`  | `/health`         | Server health check (root-level, not under `/api`)             |
| `GET`  | `/summary`        | Aggregate stats, top triangles, and time-series data           |
| `GET`  | `/graph`          | Network graph nodes & links for D3 visualization               |
| `GET`  | `/graph-timeline` | Bulk graph snapshots for animated playback (by day/month/year) |
| `GET`  | `/triangles`      | Paginated triangle details filtered by currency                |
| `GET`  | `/opportunities`  | Paginated raw opportunity rows with optional filters           |

All endpoints accept `startDate` and `endDate` query parameters (ISO date strings, default `2017-01-01` to `2022-12-31`). Request validation uses Zod schemas; invalid parameters return structured 400 errors.

## Project Structure

```
cse6242/                          # Monorepo root
├── apps/
│   ├── backend/                  # Express 5 API server
│   │   └── src/
│   │       ├── index.ts          # Express app entry point
│   │       ├── routes/           # API route handlers
│   │       ├── services/         # Business logic & BigQuery SQL queries
│   │       ├── lib/              # BigQuery client setup
│   │       └── types/            # Zod schemas & TypeScript types
│   │
│   └── frontend/                 # React 19 SPA (Vite 6)
│       └── src/
│           ├── App.tsx           # Providers (QueryClient, Router, AppContext)
│           ├── components/
│           │   ├── ui/           # Shadcn/Radix primitives (13 components)
│           │   ├── layout/       # Header, ModeToggle, RootLayout, Disclaimer
│           │   ├── graph/        # NetworkGraph, GraphControls, GraphTooltip
│           │   ├── historical/   # SummaryCards, TimeSeriesChart, PlaybackControls
│           │   ├── live/         # LiveDashboard, OpportunityFeed, drawers
│           │   └── shared/       # DetailPanel, TriangleTable
│           ├── hooks/            # Data fetching, WebSocket, arbitrage detection
│           ├── workers/          # Web Worker for arbitrage scanning
│           ├── context/          # AppContext (mode, date range, selections)
│           ├── lib/              # API client, graph utils, arbitrage math
│           ├── routes/           # TanStack Router config
│           ├── types/            # Frontend TypeScript definitions
│           └── styles/           # Tailwind CSS entry point
│
├── package.json                  # Root workspace scripts
├── pnpm-workspace.yaml           # Workspace config
├── tsconfig.base.json            # Shared TypeScript config
└── biome.jsonc                   # Linting & formatting
```

## Tech Stack

### Frontend

| Library         | Purpose                                                          |
| --------------- | ---------------------------------------------------------------- |
| React 19        | UI framework                                                     |
| TanStack Router | Client-side routing with type-safe route tree                    |
| TanStack Query  | Server state, caching, infinite queries (5-min stale)            |
| TanStack Table  | Headless table utilities                                         |
| D3.js v7        | Force-directed graph (simulation, zoom, drag, scales)            |
| Recharts        | Time-series composed charts (area + line, dual axes)             |
| Radix UI        | Headless primitives (Sheet, Select, Slider, Tabs, Tooltip, etc.) |
| Tailwind CSS v4 | Utility-first styling via `@tailwindcss/vite` plugin             |
| Lucide React    | Icon library                                                     |
| date-fns        | Date formatting                                                  |
| Vite 6          | Build tool with native Web Worker support                        |

### Backend

| Library         | Purpose                                    |
| --------------- | ------------------------------------------ |
| Express 5       | REST API framework                         |
| Google BigQuery | Historical analytics data source           |
| Zod 4           | Request validation schemas                 |
| dotenv          | Environment variable loading               |
| tsx             | TypeScript execution with file watching    |

### Development Tools

| Tool       | Purpose                         |
| ---------- | ------------------------------- |
| pnpm       | Monorepo package manager        |
| Biome      | Fast linting & formatting       |
| TypeScript | Type checking across workspaces |

## Development

### Code Quality

```bash
pnpm typecheck   # Type-check both frontend and backend
pnpm check       # Biome lint + format check
pnpm lint        # Lint only
pnpm format      # Auto-fix formatting
```

## Troubleshooting

| Problem                         | Solution                                                             |
| ------------------------------- | -------------------------------------------------------------------- |
| BigQuery config is not set      | Create `apps/backend/.env` with `BIGQUERY_VIEW_ID` or the project/dataset vars |
| Backend query/auth errors       | Verify Google Cloud credentials and BigQuery dataset access         |
| Frontend API errors             | Ensure backend is running on `http://localhost:3001`                 |
| Port conflict (5173)            | `pnpm dev:frontend -- --port 5174`                                   |
| Port conflict (3001)            | `PORT=3002 pnpm dev:backend`                                         |
