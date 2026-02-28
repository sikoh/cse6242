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

### Opportunity Categorization & Deduplication

Opportunities are categorized as **profitable** (profit > 0%) or **near-miss** (profit between `nearMissFloor` and 0%, default -0.5% to 0%). Multiple raw opportunities detected for the same triangle are grouped and deduplicated by:

- **Triangle key** (canonical sorted currency triple)
- **Direction** (forward or reverse)
- **Price source** (pair symbol tuple)

Each deduplicated entry aggregates:
- Total count of raw opportunities merged
- Aggregated volume across those opportunities
- Volume-weighted average profit

The deduplicated list is capped at **5,000 entries**. New opportunities are prepended; when the buffer exceeds capacity, the oldest entries are dropped. A separate cumulative `totalCount` counter tracks all-time detections for the session.

## User Interface

### Layout

```
----------------------------------------------------------------+
| LiveControls (full width)                                        |
| [Status] [Pause/Resume] [Clear] | Fee | MinProfit | Notional $     |
----------------------------------------------------------------+
| Stats: Base Coins | Pairs | Possible Triangles | Msg/sec | PriceMap | Opps |
-----------------------------------------------+------------------------+
|                                               |                        |
|  Live Network (D3 force-directed)             | Opportunity Feed       |
|  (2/3 width) h-[350px] / md:h-[450px] / lg:h-[500px] | (1/3 width) Scrollable |
|  Header: "Live Network"   [Active only toggle]  | list grouped by       |
|  Drag / Pan / Zoom / Hover                     | triangle + direction  |
|                                               | shows expanded items  |
-----------------------------------------------+------------------------+
```

Legend: near-miss = muted amber (subdued color/opacity); profitable = green. Use `Show Near-Misses` toggle to include/exclude near-miss entries in the feed and graph.
 
Near-miss display: Near-miss opportunities (profit between `nearMissFloor` and 0%) are represented in the UI as muted amber elements. The Network Graph renders near-miss edges in a subdued amber color with reduced opacity, and the Opportunity Feed shows near-miss groups with an amber left border and amber text. Use the `Show Near-Misses` toggle in the Controls Bar to include or exclude near-miss entries from the feed and graph.

### Controls Bar

| Control | Type | Default | Range | Behavior |
|---------|------|---------|-------|----------|
| Connection Status | Badge | - | connecting / connected / disconnected / error | Auto-updates; animated spinner while connecting |
| Reconnect | Button | - | - | Shown only when disconnected or error; resets attempt counter and reconnects |
| Pause / Resume | Toggle button | Running | - | When paused, WebSocket stays connected but price updates are not forwarded to the worker |
| Clear | Button | - | - | Resets opportunity list and cumulative total count to zero; does **not** reset price map or config |
| Fee % | Slider | 0.10% | 0.00% - 1.00% (step 0.10%) | Applied per trade leg in the profit calculation |
| Min Profit | Slider | 0.05% | 0.00% - 2.00% (step 0.01%) | Opportunities below this threshold are discarded by the worker |
| Notional $ | Number input | $1,000 | $1 - $100,000 | Starting trade amount used in profit calculation |
| Show Near-Misses | Toggle | OFF | - | When ON, displays opportunities with profit between `nearMissFloor` and 0%; when OFF, only profitable opportunities (>0%) are shown |
| Stale Minutes | Slider | 5 min | 1 - 60 min | Determines how long an opportunity remains "active" (bright) in the graph before fading to "stale" (dimmed) |
| Show Active Only | Toggle | ON | - | When ON, hides graph nodes/links not involved in recent opportunities; when OFF, shows full network |

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

- **Nodes**: Currencies. Size scales with total opportunity count and volume USD. Clicking a node opens a detail panel via app context.
- **Links**: Trading pairs. Width scales with opportunity frequency. Color and opacity vary by opportunity status:
  - **Profitable edges**: Green (`#12cf57`), high opacity when active (1.0), low when stale (0.4)
  - **Near-miss edges**: Muted amber (`#d7c78e`), medium-high opacity when active (0.8), very low when stale (0.3)
  - **No events**: Gray (`#6b7280`), 50% opacity
- **Active vs. Stale**: Determined by timestamp relative to `staleMinutes` config. Active edges render at full brightness; stale edges fade.
- **Priority rendering**: Profitable-active edges render on top, followed by near-miss-active, then stale edges below. This ensures high-value opportunities are always visible.
- **Interactions**: Drag nodes, zoom/pan, hover for tooltips. Can toggle "Show Active Only" to filter out the static graph and view only recent opportunity networks.

### Opportunity Feed

Scrollable card showing deduplicated opportunities (up to 5,000 entries), grouped and sorted by status:

Each group displays:

- **Triangle path**: `CurrA → CurrB → CurrC` shown as badges
- **Direction**: "forward" or "reverse"
- **Count badge**: Optional; shown if multiple raw opportunities are merged into this group
- **Time ago**: Relative timestamp of the most recent raw opportunity in the group
- **Total volume**: Aggregated USD volume across all merged opportunities
- **Avg profit %**: Volume-weighted average profit of the group
- **Expandable rows**: Click to expand and view individual raw opportunities bundled into the group

**Sorting**: Profitable groups appear first, then near-miss groups; within each category, most recent first.

**Color scheme**:
- **Profitable** (profit > 0%): Green text (`text-green-400/70`), green left border
- **Near-miss** (profit ≤ 0%, ≥ `nearMissFloor`): Muted amber text (`text-amber-500`), amber left border
- The "Show Near-Misses" toggle filters whether near-miss groups are displayed at all

Empty state shows: "No opportunities detected yet - Markets are efficient most of the time"

### Additional UI Features

**Coin Selector**: Click the "Base Coins" stat card to open a modal for selecting which quote currencies (USDT, BTC, ETH, BNB, BUSD) to monitor. Changing selections clears the opportunity buffer and rebuilds the pair/triangle set.

**Drawer Panels** (opened by clicking stat cards):

- **Pairs Drawer**: Lists all filtered trading pairs included in the current analysis
- **Triangles Drawer**: Shows enumerated triangular cycles with their constituent pairs  
- **Streams Drawer**: Displays real-time WebSocket message log for the current session (messages/sec, recent stream errors)
- **Price Map Drawer**: Shows the current price entries (bid/ask) for all pairs that have received at least one update

These drawers provide transparency into the detection pipeline and help debug why certain opportunities may or may not appear.

## Constraints Summary

### Hard-Coded Constraints

| Constraint | Value | Location |
|------------|-------|----------|
| Max WebSocket streams | 200 | `useBinanceWebSocket.ts:5` |
| Max buffered opportunities | 5,000 | `useArbitrageDetection.ts` |
| Max reasonable profit | 10% | `arbitrage.worker.ts:86` |
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
| Notional amount | $1,000 | $1 | $100,000 | $1 |
| Near-miss floor | -0.50% | - | 0.00% | - |
| Stale minutes | 5 min | 1 min | 60 min | 1 min |

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
7. **Deduplication across sessions**: Deduplication is based on triangle key and direction only; identical triangles from different market cycles are merged into one group.
8. **Graph filtering on primary quote currencies**: Only triangles involving the selected quote currencies are monitored. Opportunities across other quote currencies cannot be detected.
