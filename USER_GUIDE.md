# Triangular Arbitrage Visualization - User Guide

Welcome to the Triangular Arbitrage Visualization platform! This guide will help you understand and use both the **Live Dashboard** and the **Historical Dashboard** to explore cryptocurrency arbitrage opportunities.

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Live Dashboard](#live-dashboard)
4. [Historical Dashboard](#historical-dashboard)
5. [Understanding the Metrics](#understanding-the-metrics)
6. [Troubleshooting](#troubleshooting)
7. [Tips & Best Practices](#tips--best-practices)

---

## Overview

### What is Triangular Arbitrage?

Triangular arbitrage is a trading strategy that exploits price discrepancies across three cryptocurrencies. For example:
- You convert Currency A to Currency B
- You convert Currency B to Currency C
- You convert Currency C back to Currency A

If the prices are favorable, you end up with more of Currency A than you started with — that's profit!

### The Two Dashboards

This platform provides two complementary tools:

- **Live Dashboard**: Real-time detection of arbitrage opportunities happening RIGHT NOW on Binance
- **Historical Dashboard**: Analysis of historical opportunities from 2017–2022 based on actual market data

---

## Getting Started

### Switching Between Dashboards

At the top of the application, you'll see a **Mode Toggle** button:
- Click the toggle to switch between **Live** and **Historical** modes
- Your selection is automatically saved so you return to the same mode next time

### Universal Controls (Available in Both Modes)

Regardless of which dashboard you're viewing, you'll see:

- **Connection Status** (Live only): Indicates whether the platform is connected to cryptocurrency data
- **Pause/Resume**: Temporarily stop data collection
- **Clear**: Remove all detected opportunities from the list

---

## Live Dashboard

The **Live Dashboard** shows **real-time arbitrage opportunities** as they occur on Binance. This is a powerful tool for traders who want to identify profitable trades as they happen.

### What You're Looking At

The Live Dashboard consists of three main sections:

#### 1. **Controls Bar** (Top)

Adjust detection parameters on the fly:

| Control | What It Does | Typical Range |
|---------|-------------|--------------|
| **Fee %** | Trading fee per transaction leg (e.g., Binance charges ~0.1%) | 0.00% - 1.00% |
| **Min Profit %** | Minimum profit threshold to display | 0.05% - 2.00% |
| **Notional $** | Starting trade amount for profit calculation | $1 - $100,000 |
| **Show Near-Misses** | Also display near-miss opportunities (profit -0.5% to 0%) | Toggle ON/OFF |
| **Stale Minutes** | How long before an opportunity fades in the graph | 1 - 60 min |

**Tip**: Adjust these based on your trading strategy. Higher fees? Increase "Min Profit %". Want to see more opportunities? Lower the threshold.

#### 2. **Statistics Cards** (Below Controls)

Six cards displaying key metrics:

| Metric | Meaning |
|--------|---------|
| **Base Coins** | Number of cryptocurrencies being monitored (click to select/deselect) |
| **Pairs** | Total trading pairs across selected cryptocurrencies |
| **Possible Triangles** | Total three-currency combinations that could create arbitrage loops |
| **Messages/sec** | Real-time message rate from Binance (higher = more market activity) |
| **Price Map** | How many trading pairs have received price data |
| **Opportunities** | Running total of opportunities detected during this session |

**Interactive**: Click any stat card to open a detailed view of that data.

#### 3. **Main Content Area** (Split Screen)

**Left Side: Network Graph (2/3 width)**
- Visual representation of trading pairs and currencies
- Each **node** (circle) represents a cryptocurrency (e.g., BTC, ETH, USDT)
- Each **link** (line) represents a trading pair (e.g., BTC↔ETH)
- **Node Colors** indicate opportunity type:
  - 🟢 **Bright Green** = Currency involved in profitable opportunities
  - 🟡 **Amber/Gold** = Currency involved only in near-miss opportunities
  - ⚪ **Gray** = No recent opportunities
- **Edge Colors** show opportunity status:
  - 🟢 **Bright Green** (full brightness) = Active profitable trades
  - 🟡 **Amber/Gold** (faded) = Active near-miss trades
  - ⚪ **Gray** (dim) = No events detected
- **Node Size**: Larger nodes = more opportunity volume involving that currency
- **Link Thickness**: Thicker lines = more frequent trading pair usage
- **Interactions**:
  - Click on a currency (node) to see all its triangles in the detail panel
  - Drag nodes to reposition for better viewing
  - Scroll to zoom in/out
  - Toggle **"Active only"** to show only recent opportunities

**Right Side: Live Triangles Feed (1/3 width)**
- Scrollable list of detected opportunities, grouped by triangle
- Each group shows:
  - Triangle path (e.g., BTC → ETH → USDT)
  - Direction (forward or reverse)
  - Average profit %
  - Total volume (USD)
  - Time when most recent opportunity was detected
- **Click to expand** any row to see individual opportunities within that triangle

### How to Use the Live Dashboard

#### Basic Workflow

1. **Start Monitoring**
   - Open the Live Dashboard
   - Review the statistics cards to see network health
   - Ensure "Connection Status" shows ✅ "connected"

2. **Adjust Parameters** (Optional)
   - Set your acceptable fee % (default: 0.1%)
   - Set your minimum profit threshold
   - Decide your notional trade amount
   
3. **Watch for Opportunities**
   - New opportunities appear in the **Live Triangles** feed on the right
   - The Network Graph highlights profitable trades in green
   - Amber events show near-misses (close but unprofitable)

4. **Investigate an Opportunity**
   - Click on a triangle in the feed to expand and see details
   - Click on a currency node in the graph to see all its triangles
   - For each triangle, note:
     - The three currencies involved
     - The direction (forward or reverse)
     - The profit percentage
     - The volume (higher volume = more liquidity)

5. **Filter Results**
   - Toggle **"Show Near-Misses"** to hide close-but-unprofitable opportunities
   - Adjust **"Stale Minutes"** to control how long opportunities remain visible
   - Toggle **"Active only"** to filter the graph to recent activity only

#### Advanced Tips

- **Volume Matters**: Higher USD volume indicates more liquidity and easier execution
- **Time Sensitivity**: The timestamp tells you how recent the opportunity is (fresher = better)
- **Direction**: Some opportunities work better in one direction than the reverse
- **Multiple Opportunities**: If the same triangle appears repeatedly, it's a reliable pattern

---

## Historical Dashboard

The **Historical Dashboard** analyzes **historical arbitrage data from 2017–2022**. Use this to understand patterns, trends, and which currencies/triangles were most profitable.

### What You're Looking At

The Historical Dashboard has four main sections:

#### 1. **Date & Interval Controls** (Top, in Header)

| Control | What It Does |
|---------|-------------|
| **Start Date** | Beginning of date range to analyze |
| **End Date** | End of date range |
| **Interval** | Time bucket size for grouping data: Day / Month / Year |

**Example**: Select Jan 2017 – Dec 2022 with "Month" interval to see monthly trends.

#### 2. **Summary Cards** (Below Controls)

Six metric cards showing aggregate statistics:

| Metric | Meaning |
|--------|---------|
| **Total Opportunities** | Total arbitrage events in selected date range |
| **Avg Profit %** | Average profit across all opportunities |
| **Max Profit %** | Highest single profit observed |
| **Total Volume** | Total USD volume traded across opportunities |
| **Unique Triangles** | How many distinct triangle combinations were found |
| **Currencies** | How many different cryptocurrencies participated |

#### 3. **Main Content Area** (Split Screen)

**Left Side: Network Graph (2/3 width)**
- Shows the **aggregate network** of all triangles in the selected period
- **Node Size**: Larger circles = more opportunities involving that currency (more central to arbitrage activity)
- **Link Thickness**: Thicker lines = higher frequency of trading pair usage
- **Link Colors**: Gradient colors represent opportunity density/frequency on that trading pair
- **Visibility**: Nodes and links are prominently sized for clear visibility at any zoom level

**Playback Controls** (Below the graph):
- ⏮️ **Step Backward** / ⏭️ **Step Forward**: Move one month (or day/year) at a time
- ▶️ **Play** / ⏸️ **Pause**: Automatically animate through time
- **Timeline Slider**: Scrub to jump to any point in time
- **Speed Selector**: Choose playback speed (0.5x, 1x, 2x, 4x)

**Right Side: Opportunities Over Time Chart (1/3 width)**
- **Upper line (blue)**: Total count of opportunities per time bucket
- **Lower line (yellow)**: Maximum profit % observed in that bucket
- **X-axis**: Timeline matching the Network Graph animation
- Hover over the chart to see exact values

#### 4. **Graph Filters** (Settings icon in graph card)

Advanced filtering options:

| Filter | What It Does |
|--------|-------------|
| **Min Frequency** | Hide currencies/pairs with fewer than X opportunities |
| **Min Profit %** | Exclude opportunities with profit below X% |

**Example**: Set Min Frequency to 100 to focus only on frequently-occurring triangles.

### How to Use the Historical Dashboard

#### Basic Workflow

1. **Select a Date Range**
   - Click **Start Date** and pick a beginning date (default: 2017-01-01)
   - Click **End Date** and pick an ending date (default: 2022-12-31)
   - Press Tab or click elsewhere to apply

2. **Choose a Time Interval**
   - Select **Day** for daily granularity (detailed but slow)
   - Select **Month** for monthly view (recommended, balanced)
   - Select **Year** for yearly overview (aggregated)

3. **Review Summary Metrics**
   - Read the six summary cards to understand the overall market
   - Example: "In 2021, there were 400K opportunities averaging 0.3% profit"

4. **Animate Through Time**
   - Press ▶️ **Play** to see how the network evolved over time
   - Watch how nodes grow/shrink and links appear/disappear
   - The chart on the right shows corresponding opportunity counts
   - Adjust speed if animation is too fast/slow

5. **Scrub to Specific Dates**
   - Use the **Timeline Slider** to jump to any date
   - Or use ⏮️ / ⏭️ buttons to step through one bucket at a time

6. **Investigate Specific Triangles**
   - Click on any **currency node** (circle) in the graph
   - A side panel opens showing **all triangles involving that currency**
   - For each triangle, see:
     - How many times it occurred
     - Average & max profit
     - Total USD volume
     - Last time it was observed
   - Sort by count, profit, or volume to find the best performers

#### Advanced Filtering

1. Click the **⚙️ Settings** icon in the graph card header
2. Adjust **Min Frequency**: Focus on only the most common triangles
3. Adjust **Min Profit %**: Exclude low-profit opportunities
4. The graph updates in real-time to reflect your filters

#### Example Analysis Scenarios

**Scenario 1: Find the Most Profitable Triangle (2021)**
1. Set dates: 2021-01-01 to 2021-12-31
2. Set interval: Month
3. Click Play to watch the year evolve
4. Click on a node when you see big triangles forming
5. In the side panel, sort by "Max Profit"
6. Identify the best performer

**Scenario 2: Track Evolution of a Currency Over Time**
1. Set dates: 2017-01-01 to 2022-12-31
2. Set interval: Year
3. Click Play to see how BTC, ETH, etc. grew from 2017–2022
4. Notice which nodes stayed active throughout (most mature/liquid)

**Scenario 3: Compare Different Time Periods**
1. Set interval: Month
2. Analyze Jan–Jun 2017 (early days, few opportunities)
3. Switch to Jan–Jun 2021 (DeFi boom, many opportunities)
4. Compare summary cards to see growth

---

## Understanding the Metrics

### Profit %

**Definition**: How much profit you make relative to your starting amount, after accounting for trading fees.

**Formula**:
```
Profit % = ((Final Amount - Starting Amount) / Starting Amount) × 100
```

**Examples**:
- Profit % = 0.3% with $1,000 start = $1,003 finish
- Profit % = 1.0% with $10,000 start = $10,100 finish

**Note**: Includes trading fees (typically 0.1% per leg × 3 legs = 0.3% total cost).

### Volume (USD)

**Definition**: Total USD value of cryptocurrency traded across all three legs of the triangle.

**Why it matters**:
- Higher volume = more liquidity = easier to execute
- Lower volume = harder to buy/sell at predicted prices

### Frequency

**Definition**: How many times a specific triangle or trading pair appeared in the opportunities list.

**Why it matters**:
- High frequency = stable, repeatable pattern
- Low frequency = rare, one-off opportunity

### Triangles

**Definition**: A set of three distinct cryptocurrencies that form a trading loop.

**Example**: BTC → ETH → USDT → BTC

**Unique Triangle Count**: Total number of distinct triangle combinations.

### Direction

**Definition**: The order in which you traverse the triangle.

- **Forward**: A → B → C → A
- **Reverse**: C → B → A → C

Sometimes one direction is profitable, the other isn't.

---

## Troubleshooting

### "Connection Status" shows Disconnected

**Cause**: The Live Dashboard is not connected to Binance's data stream.

**Solution**:
1. Check your internet connection
2. Click **Reconnect** button
3. Wait 5–10 seconds for reconnection attempt
4. If still failing, try refreshing the page

### No Opportunities Detected in Live Dashboard

**Cause**: Market is efficient, or your threshold is too high.

**Solutions**:
1. **Lower "Min Profit %"** to 0.01 to catch near-misses
2. **Toggle "Show Near-Misses"** to ON
3. **Increase "Notional $"** to look at larger trades
4. Check if connection is active (green status badge)

### Historical Dashboard Animation is Slow

**Cause**: Too many opportunities to render or interval too granular.

**Solutions**:
1. Switch from **Day** to **Month** interval
2. Increase **Min Frequency** to filter out noise
3. Shorten the date range
4. Reduce playback speed initially, then increase once loaded

### Numbers Don't Match (Live vs Historical)

**Cause**: They measure different things.

**Live**: Real-time current market prices

**Historical**: Precomputed data from 2017–2022 using prices at that time
