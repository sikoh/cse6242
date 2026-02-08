# Live Dashboard - Functionality Reference

This document describes the current implementation of the Live Dashboard feature as built in `apps/frontend/src/components/live/`.

## Overview

The Live Dashboard is a client-side-only, real-time triangular arbitrage opportunity detector. It connects directly to Binance's public WebSocket API, receives streaming best-bid/ask prices, and runs an arbitrage detection algorithm entirely in the browser using a Web Worker. There is no backend involvement.

## Data Pipeline

### 1. Exchange Info Initialization

On mount, the dashboard fetches Binance's REST endpoint `GET /api/v3/exchangeInfo` to retrieve all available trading pairs. This data is cached for 1 hour via TanStack Query.

**Pair filtering** (`lib/graph.ts:5-11`): Only pairs where `status === "TRADING"` and at least one side (base or quote) is a major currency are kept. The major currencies are:

- USDT
- BTC
- ETH
- BNB
- BUSD

### 2. Triangle Construction

From the filtered pairs, an adjacency list is built (`lib/graph.ts:13-31`) mapping each currency to its neighbors and the connecting pair symbol. Triangles are then enumerated (`lib/graph.ts:34-70`) by iterating all currency triples A-B-C where edges exist between each pair and C connects back to A. Duplicate triangles are eliminated using a canonical sorted key (e.g., `BNB-BTC-ETH`).

### 3. WebSocket Connection

**Endpoint**: `wss://stream.binance.com:9443/stream` (configurable via `VITE_BINANCE_WS_URL`)

**Stream type**: Multiplexed `@bookTicker` streams. Each pair provides the current best bid price/quantity and best ask price/quantity.

**Stream limit**: A maximum of **200 pairs** are subscribed per connection (`MAX_STREAMS_PER_CONNECTION = 200`). If more than 200 relevant pairs exist, only the first 200 are used.

**Reconnection**: On disconnect, automatic reconnection is attempted with exponential backoff: delays of 1s, 2s, 4s, 8s, 16s (capped at 30s), up to **5 attempts** maximum. A manual Reconnect button is available in the UI.

**Message format** (per Binance bookTicker):

| Field | Description          |
|-------|----------------------|
| `s`   | Symbol (e.g., BTCUSDT) |
| `b`   | Best bid price       |
| `B`   | Best bid quantity     |
| `a`   | Best ask price       |
| `A`   | Best ask quantity     |

### 4. Arbitrage Detection (Web Worker)

All detection runs off the main thread in `workers/arbitrage.worker.ts`. The worker maintains:

- A **price map** (`Map<string, PriceData>`) updated on every incoming bookTicker message
- The full list of precomputed triangles
- The current user configuration (fee, minProfit, notional)

**On each price update**, the worker:

1. Updates the price map entry for that symbol
2. Iterates through **every** triangle in both forward and reverse directions
3. For each triangle with complete price data (all 3 pairs present), calculates profit

**Profit calculation** for a triangle with pairs [P1, P2, P3]:

```
feeMultiplier = 1 - (fee / 100)

Forward direction:
  Step 1 (buy):  amount = notional / P1.ask * feeMultiplier
  Step 2 (sell): amount = amount * P2.bid * feeMultiplier
  Step 3 (sell): amount = amount * P3.bid * feeMultiplier

  profit% = ((amount - notional) / notional) * 100

Reverse direction: same formula applied to pairs in reverse order [P3, P2, P1]
```

**Filtering**: An opportunity is emitted only when:

- `profit% > config.minProfit` (user-configurable, default 0.05%)
- `profit% < 10%` (hard-coded `MAX_REASONABLE_PROFIT` ceiling to reject calculation artifacts from missing/stale data)

**Stats reporting**: Every 1 second, the worker posts a `STATS` message containing the current price map size and checks-per-second count.

### 5. Opportunity Buffer

Detected opportunities are stored in a React state array capped at **1,000 entries** (`MAX_OPPORTUNITIES`). New opportunities are prepended; when the buffer exceeds 1,000, the oldest entries are dropped. A separate cumulative `totalCount` counter tracks all-time detections for the session.

## User Interface

### Layout

```
+-------------------------------------------------------+
| LiveControls                                          |
| [Status] [Pause/Resume] [Clear] | Fee | MinProfit | $ |
+-------------------------------------------------------+
| Stats: Pairs | Triangles | Msg/sec | PriceMap | Opps  |
+-------------------------------------+-----------------+
|                                     |                 |
|  Network Graph (D3 force-directed)  | Opportunity     |
|  2/3 width, 500px height            | Feed            |
|                                     | 1/3 width       |
|                                     | Scrollable list |
+-------------------------------------+-----------------+
```

### Controls Bar

| Control | Type | Default | Range | Behavior |
|---------|------|---------|-------|----------|
| Connection Status | Badge | - | connecting / connected / disconnected / error | Auto-updates; animated spinner while connecting |
| Reconnect | Button | - | - | Shown only when disconnected or error; resets attempt counter and reconnects |
| Pause / Resume | Toggle button | Running | - | When paused, WebSocket stays connected but price updates are not forwarded to the worker |
| Clear | Button | - | - | Resets opportunity list and cumulative total count to zero; does **not** reset price map or config |
| Fee % | Slider | 0.10% | 0.00% - 1.00% (step 0.10%) | Applied per trade leg in the profit calculation |
| Min Profit | Slider | 0.05% | 0.00% - 2.00% (step 0.01%) | Opportunities below this threshold are discarded by the worker |
| Notional $ | Number input | $100 | $1 - $100,000 | Starting trade amount used in profit calculation |

Config changes take effect immediately - the new values are posted to the worker, which uses them for all subsequent price checks.

### Stats Cards

Five summary cards displayed in a row:

| Card | Source | Description |
|------|--------|-------------|
| Pairs | Exchange info | Count of filtered trading pairs subscribed to |
| Triangles | Triangle builder | Count of enumerated triangular cycles |
| Messages/sec | WebSocket hook | bookTicker messages received in the last 1-second window |
| Price Map | Worker stats | Number of unique pairs with at least one price update |
| Opportunities | Detection hook | Cumulative count of detected opportunities (green text) |

### Network Graph

D3.js force-directed graph (`components/graph/NetworkGraph.tsx`):

- **Nodes**: Currencies. Size scales with total volume USD across buffered opportunities. Clicking a node opens a detail panel via app context.
- **Links**: Trading pairs. Width scales logarithmically with opportunity frequency (1.5-7px range). Color follows a viridis-style colormap based on relative frequency.
- **Flashing edges**: Pairs involved in opportunities detected within the **last 2 seconds** are highlighted in yellow (`#facc15`) at full opacity. This provides real-time visual feedback when arbitrage is found.
- **Interactions**: Drag nodes, zoom/pan, hover for tooltips.

### Opportunity Feed

Scrollable card showing the most recent buffered opportunities (up to 1,000):

Each row displays:

- **Triangle path**: `CurrA -> CurrB -> CurrC` shown as badges
- **Direction**: "forward" or "reverse"
- **Time ago**: Relative timestamp (e.g., "2s ago")
- **Profit %**: Color-coded by magnitude:
  - `> 0.5%`: Emerald
  - `0.2% - 0.5%`: Green
  - `< 0.2%`: Lime

Empty state shows: "No opportunities detected yet - Markets are efficient most of the time"

## Constraints Summary

### Hard-Coded Constraints

| Constraint | Value | Location |
|------------|-------|----------|
| Max WebSocket streams | 200 | `useBinanceWebSocket.ts:5` |
| Max buffered opportunities | 1,000 | `useArbitrageDetection.ts:28` |
| Max reasonable profit | 10% | `arbitrage.worker.ts:86` |
| Flashing edge window | 2 seconds | `LiveDashboard.tsx:59` |
| Max reconnect attempts | 5 | `useBinanceWebSocket.ts:31` |
| Max reconnect backoff | 30 seconds | `useBinanceWebSocket.ts:76` |
| Exchange info cache TTL | 1 hour | `useBinanceExchangeInfo.ts:11` |
| Quote currency filter | USDT, BTC, ETH, BNB, BUSD | `graph.ts:3` |
| Pair status filter | TRADING only | `graph.ts:7` |

### User-Configurable Constraints

| Parameter | Default | Min | Max | Step |
|-----------|---------|-----|-----|------|
| Fee per leg | 0.10% | 0.00% | 1.00% | 0.10% |
| Min profit threshold | 0.05% | 0.00% | 2.00% | 0.01% |
| Notional amount | $100 | $1 | $100,000 | $1 |

## Key Files

| File | Purpose |
|------|---------|
| `components/live/LiveDashboard.tsx` | Main orchestration, graph data building, state management |
| `components/live/LiveControls.tsx` | Configuration UI (sliders, buttons) |
| `components/live/OpportunityFeed.tsx` | Scrollable opportunity list |
| `components/live/ConnectionStatus.tsx` | WebSocket status badge |
| `components/graph/NetworkGraph.tsx` | D3 force-directed graph visualization |
| `hooks/useBinanceWebSocket.ts` | WebSocket connection and reconnection logic |
| `hooks/useArbitrageDetection.ts` | Worker lifecycle, opportunity buffer management |
| `hooks/useBinanceExchangeInfo.ts` | REST fetch, pair filtering, triangle building |
| `workers/arbitrage.worker.ts` | Off-thread price tracking and detection loop |
| `lib/graph.ts` | Pair filtering, adjacency list, triangle enumeration |
| `lib/env.ts` | Environment variable defaults for API endpoints |

## Known Limitations

1. **No price staleness check**: Prices remain in the map indefinitely. If a pair stops updating (e.g., WebSocket reconnect), stale prices may produce false signals until fresh data arrives.
2. **All triangles checked on every update**: No optimization to check only triangles affected by the updated pair. Performance scales as `O(triangles * 2)` per message.
3. **Simplified trade direction**: The profit calculation assumes a fixed buy/sell pattern (buy on step 1, sell on steps 2 and 3) regardless of actual base/quote orientation, which may produce inaccurate results for some pair combinations.
4. **No order book depth check**: Only best bid/ask prices are used. Actual execution at the notional amount could face slippage.
5. **200-pair cap**: Liquid pairs beyond the first 200 are excluded from monitoring.
6. **Session-only storage**: All opportunity history is lost on page refresh or tab close.
