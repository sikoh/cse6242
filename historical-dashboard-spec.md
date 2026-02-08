# Historical Dashboard - Functionality Reference

This document describes the current implementation of the Historical Dashboard feature, spanning frontend components in `apps/frontend/src/components/historical/` and backend endpoints in `apps/backend/src/`.

## Overview

The Historical Dashboard provides server-side aggregation and visualization of precomputed triangular arbitrage opportunities stored in a PostgreSQL database. The dataset covers 2017-01-01 through 2022-12-31 and is sourced from the `vw_triangle_opportunities_enriched` view. Each row represents a detected opportunity with net profit already accounting for a 0.1% fee per trade leg.

Unlike the Live Dashboard (which is client-side only), the Historical Dashboard requires the Express backend to query, aggregate, and serve data to the frontend.

## Data Source

**Database view**: `vw_triangle_opportunities_enriched` (PostgreSQL, hosted on Google Cloud)

Key columns used by the backend service:

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer | Primary key |
| `timestamp` | timestamp | Exact detection time |
| `trade_date` | date | Date only (used for time binning) |
| `triangle_key` | text | Canonical key, e.g., `BNB-BTC-ETH` |
| `curr_a`, `curr_b`, `curr_c` | text | The three currencies in the triangle |
| `profit_net_pct` | numeric | Net profit % (fee-inclusive) |
| `pair_ab`, `pair_bc`, `pair_ca` | text | Trading pair symbols for each leg |
| `volume_usd_ab`, `volume_usd_bc`, `volume_usd_ca` | numeric | USD volume per leg (nullable) |
| `min_trades` | integer | Minimum trades required (nullable) |

The view also contains volatility, liquidity, and covariance metrics at 24h/168h/720h windows and triangle-level aggregates, though these are not currently surfaced in the dashboard UI.

## Data Pipeline

### Frontend to Backend

All historical data flows through four REST endpoints under `/api/historical`. The frontend uses TanStack Query hooks with a **5-minute stale time** for caching. Requests are parameterized by date range, time bin, and graph filter values managed in React state and app context.

### Backend Query Processing

All endpoints validate query parameters with Zod schemas, execute raw SQL via Prisma's `$queryRaw`, and return JSON with a `meta` object containing `queryTimeMs` for performance monitoring. Validation errors return HTTP 400 with Zod issue details.

## API Endpoints

### GET /api/historical/summary

Returns aggregate statistics and an optional time series for the selected date range.

**Parameters** (Zod schema: `summaryQuerySchema`):

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `startDate` | ISO date string | `2017-01-01` | Start of date range |
| `endDate` | ISO date string | `2022-12-31` | End of date range |
| `bin` | `day` \| `month` \| `year` | _(optional)_ | If provided, includes time series data bucketed at this interval |

**Backend logic** (`services/historical.ts:24-117`):
1. **Main aggregates**: `COUNT(*)`, `AVG(profit_net_pct)`, `MAX(profit_net_pct)`, `SUM(volume)`, `COUNT(DISTINCT triangle_key)` over all rows in date range
2. **Currency count**: `COUNT(DISTINCT currency)` across a `UNION` of `curr_a`, `curr_b`, `curr_c`
3. **Top 10 triangles**: Grouped by `triangle_key`, ordered by count descending, limited to 10
4. **Time series** (if `bin` provided): `DATE_TRUNC` by bin level, grouped and ordered chronologically

**Response shape**:
```json
{
  "data": {
    "totalOpportunities": 1042837,
    "avgProfitPct": 0.312,
    "maxProfitPct": 8.74,
    "totalVolumeUsd": 52481000000,
    "uniqueTriangles": 1847,
    "uniqueCurrencies": 186,
    "topTriangles": [
      { "triangleKey": "BNB-BTC-USDT", "count": 24819, "avgProfit": 0.28 }
    ],
    "timeSeries": [
      { "date": "2017-01-01", "count": 1523, "avgProfit": 0.31, "maxProfit": 4.2 }
    ]
  },
  "meta": { "startDate": "...", "endDate": "...", "queryTimeMs": 842 }
}
```

### GET /api/historical/graph-timeline

Returns a sequence of graph snapshots (one per time bucket) for animated playback, plus cross-snapshot aggregates.

**Parameters** (Zod schema: `graphTimelineQuerySchema`):

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `startDate` | ISO date string | `2017-01-01` | Start of date range |
| `endDate` | ISO date string | `2022-12-31` | End of date range |
| `bin` | `day` \| `month` \| `year` | `month` | Time bucket size for snapshots |
| `minFrequency` | integer | `10` | Minimum opportunity count to include a node/edge |
| `minProfitPct` | number | `0` | Minimum `profit_net_pct` to include an opportunity |

**Backend logic** (`services/historical.ts:378-576`):
1. **Node query**: `UNION ALL` of all three currency positions, `DATE_TRUNC` by bin, aggregated per bucket per currency, filtered by `HAVING COUNT(*) >= minFrequency`
2. **Link query**: `UNION ALL` of all three pair positions, same bucketing and HAVING filter
3. **Snapshot assembly**: Groups node/link rows by bucket date, builds per-snapshot graph structures, sorts chronologically
4. **Connected component filtering**: Per snapshot, links are filtered to only connect existing nodes, then orphan nodes (with no remaining links) are removed
5. **Aggregate graph**: `allNodes` and `allLinks` are built by summing counts/volumes and averaging profits across all snapshots

**Response shape**:
```json
{
  "data": {
    "snapshots": [
      {
        "date": "2017-01-01",
        "nodes": [{ "id": "BTC", "opportunityCount": 523, "totalVolumeUsd": 1200000, "avgProfit": 0.31 }],
        "links": [{ "source": "BTC", "target": "ETH", "pair": "ETHBTC", "frequency": 210, "avgProfit": 0.28, "totalVolumeUsd": 580000 }]
      }
    ],
    "allNodes": [ ... ],
    "allLinks": [ ... ]
  },
  "meta": { "startDate": "...", "endDate": "...", "queryTimeMs": 2341, "snapshotCount": 72, "allNodeCount": 45, "allLinkCount": 120 }
}
```

### GET /api/historical/triangles

Returns triangles involving a specific currency, with pagination and sorting.

**Parameters** (Zod schema: `trianglesQuerySchema`):

| Parameter | Type | Default | Constraints | Description |
|-----------|------|---------|-------------|-------------|
| `startDate` | ISO date string | `2017-01-01` | | Start of date range |
| `endDate` | ISO date string | `2022-12-31` | | End of date range |
| `currency` | string | _(required)_ | min length 1 | Currency to filter by (matches any of `curr_a/b/c`) |
| `sortBy` | `count` \| `profit` \| `volume` | `count` | | Sort order for results |
| `limit` | integer | `100` | 1-1000 | Page size |
| `offset` | integer | `0` | min 0 | Pagination offset |

**Backend logic** (`services/historical.ts:227-298`):
1. Count query: `COUNT(DISTINCT triangle_key)` where currency matches any position
2. Data query: `GROUP BY triangle_key, curr_a, curr_b, curr_c` with `COUNT(*)`, `AVG(profit_net_pct)`, `MAX(profit_net_pct)`, `SUM(volume)`, `MAX(timestamp)` as last_seen
3. Sorted by the selected column descending, with `LIMIT/OFFSET`

**Response shape**:
```json
{
  "data": [
    {
      "triangleId": 1042,
      "triangleKey": "BNB-BTC-ETH",
      "currA": "BNB", "currB": "BTC", "currC": "ETH",
      "count": 24819,
      "avgProfit": 0.28,
      "maxProfit": 3.14,
      "totalVolumeUsd": 8400000,
      "lastSeen": "2022-11-15T14:23:00.000Z"
    }
  ],
  "meta": { "startDate": "...", "endDate": "...", "queryTimeMs": 312, "total": 47, "limit": 100, "offset": 0, "hasMore": false }
}
```

### GET /api/historical/opportunities

Returns individual opportunity rows with optional filtering and pagination.

**Parameters** (Zod schema: `opportunitiesQuerySchema`):

| Parameter | Type | Default | Constraints | Description |
|-----------|------|---------|-------------|-------------|
| `startDate` | ISO date string | `2017-01-01` | | Start of date range |
| `endDate` | ISO date string | `2022-12-31` | | End of date range |
| `triangleKey` | string | _(optional)_ | | Filter to a specific triangle |
| `minProfitPct` | number | _(optional)_ | min 0 | Minimum profit threshold |
| `limit` | integer | `100` | 1-1000 | Page size |
| `offset` | integer | `0` | min 0 | Pagination offset |

**Backend logic** (`services/historical.ts:300-376`):
1. Dynamically builds WHERE clause from provided filters
2. Count query for total matching rows
3. Data query ordered by `timestamp DESC` with `LIMIT/OFFSET`

**Response includes** per-row: id, timestamp, triangle key, currencies, net profit %, pair names, volumes per leg, min trades.

## User Interface

### Layout

```
+-------------------------------------------------------------------+
| Header                                                            |
| [Logo] [Title] | [Start Date] [End Date] [Interval] | [Mode]    |
+-------------------------------------------------------------------+
| Summary Cards (6 across)                                          |
| Opps | Avg Profit | Max Profit | Volume | Triangles | Currencies  |
+-----------------------------------+-------------------------------+
|                                   |                               |
| Currency Network (D3)             | Opportunities Over Time       |
| 2/3 width                        | (Recharts)                    |
|                                   | 1/3 width                     |
|                                   |                               |
|-----------------------------------|                               |
| Playback Controls                 |                               |
| [<<] [Play] [>>] Date Slider Spd |                               |
+-----------------------------------+-------------------------------+
```

### Global Controls (Header)

The TimeSlider component is rendered in the Header and is visible only in historical mode. It controls app-wide state via `AppContext`.

| Control | Type | Default | Range | Effect |
|---------|------|---------|-------|--------|
| Start Date | Date input | `2017-01-01` | `2017-01-01` to current end date | Refetches summary and graph-timeline |
| End Date | Date input | `2022-12-31` | Current start date to `2022-12-31` | Refetches summary and graph-timeline |
| Interval (bin) | Dropdown | `month` | `day` / `month` / `year` | Changes time bucket size; refetches graph-timeline and time series |

Changing any of these also resets the playback position to index 0.

### Summary Cards

Six metric cards in a responsive grid (2 cols mobile, 4 tablet, 6 desktop):

| Card | Color | Source field | Formatting |
|------|-------|-------------|------------|
| Total Opportunities | Blue | `totalOpportunities` | Abbreviated (e.g., 1.04M) |
| Avg Profit | Green | `avgProfitPct` | Percentage (3 decimal places) |
| Max Profit | Emerald | `maxProfitPct` | Percentage (3 decimal places) |
| Total Volume | Yellow | `totalVolumeUsd` | USD abbreviated (e.g., $52.5B) |
| Unique Triangles | Purple | `uniqueTriangles` | Abbreviated if >= 10,000, otherwise locale-formatted |
| Currencies | Orange | `uniqueCurrencies` | Abbreviated |

### Network Graph

D3.js force-directed graph (`components/graph/NetworkGraph.tsx`) in **historical mode**:

- **Nodes**: Currencies. Radius scales via `sqrt` from 8px to 40px based on `totalVolumeUsd`. Fill color is `var(--primary)`, or `var(--chart-2)` when selected.
- **Links**: Trading pairs. Width scales logarithmically from 1.5px to 7px based on `frequency`. Color follows a viridis sequential colormap. Opacity is 0.8.
- **Snapshot transitions**: When the playback position changes, nodes and links animate with a 300ms transition. Node positions are preserved between snapshots for visual continuity.
- **Force simulation**: Link distance 100px, charge strength -300, collision radius based on node size + 8px, alpha decay 0.02 (faster settling for smoother animation).
- **Zoom**: Supports zoom/pan via D3 zoom behavior (0.1x - 4x range).
- **Interactions**: Click a node to open the DetailPanel. Drag to reposition. Hover for tooltip (showing opportunity count, volume, avg profit).
- **Connected components only**: Orphan nodes with no links in the current snapshot are hidden.

### Graph Filter Controls

Accessible via a settings icon button in the graph card header. Opens a side Sheet with two filters:

| Filter | Type | Default | Slider range | Step | Effect |
|--------|------|---------|-------------|------|--------|
| Min Frequency | Slider + number input | 10 | 0 - 1,000 | 10 | Hides nodes/edges with fewer opportunities; triggers API refetch |
| Min Profit % | Slider + number input | 0 | 0% - 1.00% (slider: 0-100, /100) | 0.01 | Excludes opportunities below threshold; triggers API refetch |

Both filters are applied **server-side** as part of the `graph-timeline` query's `HAVING` clause and `WHERE` clause respectively.

### Graph Playback Controls

Controls for animating through time-bucketed snapshots. Rendered below the graph.

| Control | Type | Default | Description |
|---------|------|---------|-------------|
| Step backward | Button | - | Decrements snapshot index by 1 |
| Play / Pause | Toggle button | Paused | Auto-advances through snapshots at the configured speed |
| Step forward | Button | - | Increments snapshot index by 1 |
| Current date | Text | First snapshot date | Displays the date of the current snapshot and position (e.g., "3 / 72") |
| Timeline slider | Slider | Index 0 | Scrubs through snapshots; debounced at 16ms for smooth interaction |
| Speed | Dropdown | 1x | Options: 0.5x, 1x, 2x, 4x. Interval = `1000 / speed` ms |

Playback automatically pauses when reaching the last snapshot. Changing the snapshot index does **not** trigger an API call -- all snapshots are fetched in the initial `graph-timeline` request.

### Time Series Chart

Recharts `ComposedChart` with dual Y-axes, displayed to the right of the network graph:

- **Left Y-axis**: Opportunity count. Rendered as a blue area chart with a vertical gradient fill.
- **Right Y-axis**: Max profit %. Rendered as a yellow line chart with dot markers.
- **X-axis**: Date formatted as `M/YY` (e.g., `1/17`).
- **Tooltip**: Shows formatted opportunity count, max profit %, and avg profit % on hover.

Data comes from the `timeSeries` field of the `/summary` response (only populated when `bin` is provided).

### Detail Panel

A side sheet (500px wide) that opens when a node is clicked in the network graph.

**Data source**: Fetches from `/api/historical/triangles` with the selected currency, current date range, sorted by count, limited to 50 results. Query is only enabled when a currency is selected.

**Content**:
1. **Header**: "{Currency} Triangles"
2. **3-stat summary row**:
   - Triangles: Total count from pagination meta
   - Best Avg Profit: Maximum `avgProfit` across returned triangles
   - Total Volume: Sum of `totalVolumeUsd` across returned triangles
3. **TriangleTable**: Scrollable table with columns:

| Column | Alignment | Formatting | Color |
|--------|-----------|------------|-------|
| Triangle | Left | Badge: `CurrA -> CurrB -> CurrC` | - |
| Count | Right | Abbreviated number | - |
| Avg Profit | Right | Percentage (3 decimals) | Green |
| Max Profit | Right | Percentage (3 decimals) | Emerald |
| Volume | Right | USD abbreviated | - |
| Last Seen | Right | Formatted date | Muted |

## Constraints Summary

### Date Range

| Constraint | Value | Location |
|------------|-------|----------|
| Minimum date | `2017-01-01` | `TimeSlider.tsx:19`, `types/index.ts:5` (Zod default) |
| Maximum date | `2022-12-31` | `TimeSlider.tsx:20`, `types/index.ts:6` (Zod default) |
| Default start | `2017-01-01` | `AppContext.tsx:32` |
| Default end | `2022-12-31` | `AppContext.tsx:33` |

### Pagination

| Constraint | Value | Location |
|------------|-------|----------|
| Default page size | 100 | `types/index.ts:10` (Zod default) |
| Max page size | 1,000 | `types/index.ts:10` (Zod max) |
| Min page size | 1 | `types/index.ts:10` (Zod min) |
| Detail panel triangle limit | 50 | `DetailPanel.tsx:21` |
| Top triangles in summary | 10 | `services/historical.ts:72` (SQL LIMIT) |

### Graph Filters

| Constraint | Default | Range | Location |
|------------|---------|-------|----------|
| Min frequency | 10 | 0 - 1,000 (slider) | `HistoricalDashboard.tsx:15`, `types/index.ts:24` |
| Min profit % | 0 | 0% - 1.00% (slider) | `HistoricalDashboard.tsx:16`, `types/index.ts:25` |
| Default bin | `month` | `day` / `month` / `year` | `AppContext.tsx:44`, `types/index.ts:29` |

### Graph Rendering

| Constraint | Value | Location |
|------------|-------|----------|
| Snapshot transition duration | 300ms | `NetworkGraph.tsx:26` |
| Slider debounce | 16ms | `GraphPlaybackControls.tsx:22` |
| Node radius range | 8 - 40px | `NetworkGraph.tsx` (sqrt scale) |
| Link width range | 1.5 - 7px | `NetworkGraph.tsx` (log scale) |
| Zoom extent | 0.1x - 4x | `NetworkGraph.tsx` (D3 scaleExtent) |
| Link opacity | 0.8 | `NetworkGraph.tsx` |
| Force: link distance | 100px | `NetworkGraph.tsx` |
| Force: charge strength | -300 | `NetworkGraph.tsx` |
| Force: alpha decay | 0.02 | `NetworkGraph.tsx` |
| Playback speeds | 0.5x, 1x, 2x, 4x | `GraphPlaybackControls.tsx:170-174` |

### Caching

| Constraint | Value | Location |
|------------|-------|----------|
| TanStack Query stale time | 5 minutes | `useHistoricalData.ts:15,23,31,40` |
| Mode preference | `localStorage` key `app-mode` | `AppContext.tsx:37` |

## Key Files

### Frontend

| File | Purpose |
|------|---------|
| `components/historical/HistoricalDashboard.tsx` | Main orchestration, state management, layout |
| `components/historical/SummaryCards.tsx` | Six aggregate metric cards |
| `components/historical/TimeSeriesChart.tsx` | Recharts dual-axis composed chart |
| `components/historical/GraphPlaybackControls.tsx` | Playback buttons, slider, speed selector |
| `components/historical/TimeSlider.tsx` | Date range and interval selector (in Header) |
| `components/graph/NetworkGraph.tsx` | D3 force-directed graph (shared with live mode) |
| `components/graph/GraphControls.tsx` | Min frequency / min profit filter sheet |
| `components/graph/GraphTooltip.tsx` | Hover tooltip for nodes and links |
| `components/shared/DetailPanel.tsx` | Side sheet for currency triangle details |
| `components/shared/TriangleTable.tsx` | Table rendering triangle detail rows |
| `components/layout/Header.tsx` | App header with TimeSlider and mode toggle |
| `hooks/useHistoricalData.ts` | TanStack Query hooks for all 4 endpoints |
| `context/AppContext.tsx` | Global state: date range, bin, mode, selections |

### Backend

| File | Purpose |
|------|---------|
| `routes/historical.ts` | Express router with Zod validation and response shaping |
| `services/historical.ts` | Raw SQL queries via Prisma for all 4 endpoints |
| `types/index.ts` | Zod schemas, TypeScript interfaces for all request/response types |

## Data Flow Diagram

```
Header (TimeSlider)
  │ sets fetchRange + bin in AppContext
  ▼
HistoricalDashboard
  ├── useSummary({ startDate, endDate, bin })
  │     └── GET /api/historical/summary
  │           └── getSummary() → aggregates + time series
  │                 ├── SummaryCards (6 metrics)
  │                 └── TimeSeriesChart (dual-axis chart)
  │
  ├── useGraphTimeline({ startDate, endDate, bin, minFrequency, minProfitPct })
  │     └── GET /api/historical/graph-timeline
  │           └── getGraphTimeline() → snapshots[] + allNodes + allLinks
  │                 ├── NetworkGraph (renders snapshots[currentIndex])
  │                 └── GraphPlaybackControls (navigates snapshots locally)
  │
  └── (on node click) → DetailPanel
        └── useTriangles({ currency, startDate, endDate, sortBy, limit })
              └── GET /api/historical/triangles
                    └── getTriangles() → TriangleDetail[] + total
                          └── TriangleTable
```

## Known Limitations

1. **Full date range fetched at once**: The `graph-timeline` endpoint returns all snapshots for the entire date range in a single response. For large ranges at daily granularity this could be a very large payload.
2. **No streaming or pagination for snapshots**: All snapshots must load before any visualization is shown.
3. **Aggregate averaging is approximate**: The `allNodes`/`allLinks` aggregate averages are computed as a running mean of snapshot-level averages, not a true weighted average across all underlying rows.
4. **Detail panel limited to top 50 triangles**: Only the first 50 triangles (sorted by count) are shown for a selected currency, with no pagination controls in the UI.
5. **No client-side filtering**: Graph filters (min frequency, min profit) trigger full API re-fetches rather than filtering the already-fetched data client-side.
6. **Opportunities endpoint unused in UI**: The `/opportunities` endpoint and `useOpportunities` infinite query hook exist but are not currently wired into any dashboard component.
