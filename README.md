# Triangular Arbitrage Visualization

A full-stack web application for detecting and visualizing triangular arbitrage opportunities in cryptocurrency markets. Features both historical data analysis (2017-2022) and real-time opportunity detection with Binance integration.

**Stack**: React + TypeScript (Frontend, Vite), Express + Node.js (Backend, TypeScript), PostgreSQL (GCP), Prisma ORM

## Project Overview

This monorepo contains:

- **Frontend**: React dashboard with D3.js network visualization, supporting historical and live modes
- **Backend**: Express REST API and WebSocket support for serving arbitrage opportunity data
- **Database**: PostgreSQL instance hosting 1M+ historical triangle opportunities with rich liquidity/volatility metrics

### Key Features

- 📊 **Historical Mode**: Explore 2017-2022 triangular arbitrage data with time slider, filters, and network graph
- 🔴 **Live Mode**: Real-time opportunity detection from Binance WebSocket streams (using Web Workers)
- 📈 **Network Visualization**: D3.js force-directed graph showing currency relationships and trade flows
- 💡 **Advanced Analytics**: Profit metrics, volume data, volatility measures, and liquidity analysis
- 🎨 **Modern UI**: Tailwind CSS + Shadcn UI components, responsive design, dark theme support

## Prerequisites

- **Node.js** 18+ and **pnpm** 9+ (monorepo package manager)
- **PostgreSQL** connection credentials (for backend database access)
- Internet connection (for Binance API access in live mode)

### Install Node.js & pnpm

```bash
# Check if Node.js is installed
node --version  # Should be 18+

# Install pnpm globally
npm install -g pnpm

# Verify pnpm
pnpm --version  # Should be 9+
```

## Installation

### 1. Clone & Install Dependencies

```bash
# Navigate to project root
cd /path/to/cse6242

# Install all workspace dependencies
pnpm install
```

This will install dependencies for both frontend and backend using the pnpm workspace configuration.

### 2. Set Up Environment Variables

#### Backend Configuration

Create `.env` file in `apps/backend/`:

```env
# PostgreSQL connection string (GCP instance)
DATABASE_URL="postgresql://user:password@host:5432/database?schema=public&connection_limit=10"

# Server port
PORT=3001
```

**Note**: You'll need valid PostgreSQL credentials with access to the `public.vw_triangle_opportunities_enriched` view.

#### Frontend Configuration (Optional)

The frontend automatically proxies API calls to `http://localhost:3001` during development (see `apps/frontend/vite.config.ts`). No `.env` file is required for basic setup, but you can create `apps/frontend/.env` if you need to customize:

```env
# API base URL (defaults to /api via Vite proxy in dev)
VITE_API_URL=http://localhost:3001
```

### 3. Generate Prisma Client

The backend uses Prisma ORM for type-safe database access:

```bash
# Generate Prisma client
pnpm --filter @cse6242/backend db:generate
```

## Running the Application

### Development Mode

#### Option 1: Run Both Backend & Frontend Together

```bash
pnpm dev
```

This runs both servers in parallel with hot-reload enabled:

- **Frontend**: http://localhost:5173 (Vite dev server)
- **Backend**: http://localhost:3001 (Express server)

#### Option 2: Run Individually

**Backend only** (Terminal 1):

```bash
pnpm dev:backend
```
- Server will start on `http://localhost:3001`
- Uses `tsx` for TypeScript execution with file watching
- Health check endpoint: `GET http://localhost:3001/health`

**Frontend only** (Terminal 2):
```bash
pnpm dev:frontend
```
- Server will start on `http://localhost:5173`
- Vite provides instant module reload (HMR)
- API calls proxy to `:3001` (see vite.config.ts)

### Production Build

```bash
# Build both frontend and backend
pnpm build

# This will:
# - Compile backend TypeScript → apps/backend/dist/
# - Build frontend with Vite → apps/frontend/dist/
```

### Running Production Build

**Backend**:

```bash
# From apps/backend/
node dist/index.js
```

**Frontend**
The built frontend is a static SPA that can be served by:

- A static file server (e.g., `pnpm add -g serve` then `serve dist/`)
- The Express backend (configure static middleware)
- A CDN or external hosting

## Project Structure

```
cse6242/                          # Monorepo root
├── apps/
│   ├── backend/                  # Express API server
│   │   ├── prisma/
│   │   │   └── schema.prisma     # Prisma ORM schema
│   │   ├── src/
│   │   │   ├── index.ts          # Express app entry point
│   │   │   ├── routes/           # API route handlers
│   │   │   ├── services/         # Business logic & DB queries
│   │   │   ├── lib/              # Utilities (Prisma client)
│   │   │   └── types/            # TypeScript type definitions
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── frontend/                 # React dashboard (Vite)
│       ├── src/
│       │   ├── main.tsx          # React DOM mount
│       │   ├── App.tsx           # Root component + providers
│       │   ├── components/       # React components
│       │   │   ├── ui/           # Shadcn UI components
│       │   │   ├── layout/       # Header, footer, mode toggle
│       │   │   ├── graph/        # D3 network visualization
│       │   │   ├── historical/   # Time slider, summary cards
│       │   │   ├── live/         # WebSocket, real-time feed
│       │   │   └── shared/       # Detail panel, tables
│       │   ├── hooks/            # React hooks (data fetching, WebSocket)
│       │   ├── workers/          # Web Worker (arbitrage detection)
│       │   ├── lib/              # Utilities (API client, D3 helpers)
│       │   ├── types/            # TypeScript definitions
│       │   └── styles/           # Tailwind CSS
│       ├── vite.config.ts        # Vite + API proxy config
│       ├── index.html
│       └── package.json
│
├── docs/                         # Technical documentation
│   ├── README.md                 # Documentation index
│   ├── backend-spec.md           # API & database schema details
│   ├── frontend-spec.md          # Component architecture & data flow
│   ├── live-dashboard-spec.md    # WebSocket & detection algorithm
│   ├── historical-graph-backend.md
│   ├── db-postgres.md            # PostgreSQL schema reference
│   └── wireframes/               # ASCII UI mockups
│
├── package.json                  # Root workspace config
├── pnpm-workspace.yaml           # pnpm monorepo setup
├── tsconfig.base.json            # Shared TypeScript config
├── biome.jsonc                   # Code linting & formatting
└── pnpm-lock.yaml                # Dependency lock file
```

## API Endpoints

Base URL (development): `http://localhost:3001/api/historical`

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Server health check |
| `GET` | `/summary` | Dashboard stats (total opportunities, avg profit, top triangles) |
| `GET` | `/graph` | Network graph data (nodes & links for D3 visualization) |
| `GET` | `/triangles` | List of triangle opportunities with filters |
| `GET` | `/triangles/:id` | Detail view for a specific triangle opportunity |

**Query Parameters**: All endpoints accept `startDate` and `endDate` (ISO format) for date range filtering.

See [docs/backend-spec.md](./docs/backend-spec.md) for complete API documentation.

## Tech Stack

### Frontend
- **React 18**: UI framework
- **TypeScript**: Type safety
- **Vite**: Fast bundler and dev server
- **TanStack Router/Query/Table**: Routing, data fetching, tables
- **D3.js**: Network graph visualization
- **Tailwind CSS**: Styling
- **Shadcn UI**: Component library
- **Recharts**: Time series charts

### Backend
- **Express.js**: REST API framework
- **TypeScript**: Type safety
- **Prisma ORM**: Database abstraction
- **PostgreSQL**: Main database
- **Node.js**: Runtime

### Development Tools
- **pnpm**: Package manager (monorepo support)
- **Biome**: Fast linting & formatting
- **TSX**: TypeScript execution with hot reload
- **TypeScript**: Type checking

## Contributing & Development

### Code Quality

```bash
# Type check both frontend and backend
pnpm typecheck

# Lint code with Biome
pnpm lint

# Auto-format code with Biome
pnpm format
```

### Debugging

**Backend**: The backend uses TypeScript with source maps. Use your IDE's debugger or Node.js inspector:
```bash
node --inspect dist/index.js
```

**Frontend**: Use React Developer Tools browser extension and Vite's built-in source maps.

## Troubleshooting

### Backend fails to start
- **Error**: `DATABASE_URL is not set`
  - **Solution**: Create `.env` in `apps/backend/` with valid PostgreSQL connection string
  
- **Error**: `ECONNREFUSED 127.0.0.1:5432`
  - **Solution**: Verify PostgreSQL is running and credentials in `DATABASE_URL` are correct

### Frontend shows "API connection error"
- **Check**: Is backend running on `http://localhost:3001`?
- **Check**: Is `CORS` enabled in backend (should be by default)?
- **Solution**: Open browser dev tools Network tab to see actual error

### Port already in use
- **Frontend (5173)**: `pnpm dev:frontend -- --port 5174`
- **Backend (3001)**: `PORT=3002 pnpm dev:backend`

## Documentation

For detailed technical information:

- 📘 [Frontend Specification](./docs/frontend-spec.md) - Component architecture, data flow, feature details
- 📗 [Backend Specification](./docs/backend-spec.md) - API endpoints, database schema, routes
- 📙 [Live Dashboard Spec](./docs/live-dashboard-spec.md) - WebSocket integration, real-time detection
- 📕 [PostgreSQL Schema](./docs/db-postgres.md) - Database table structure and relationships
- 🎨 [UI Wireframes](./docs/wireframes/) - ASCII mockups of dashboard layouts

## License

This project is part of CSE6242 (Data Visualization) at Georgia Tech.

## Support

For questions or issues, refer to [docs/issues.md](./docs/issues.md) or check existing documentation in the `docs/` folder.
