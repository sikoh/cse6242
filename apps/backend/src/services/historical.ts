import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import type {
  GraphData,
  GraphLink,
  GraphNode,
  GraphQuery,
  GraphSnapshot,
  GraphTimelineData,
  GraphTimelineQuery,
  OpportunitiesQuery,
  OpportunityRow,
  SummaryData,
  SummaryQuery,
  TimeSeriesPoint,
  TopTriangle,
  TriangleDetail,
  TrianglesQuery,
} from '../types/index.js'

// Helper to format date for PostgreSQL
const toDate = (d: string) => new Date(d)

export async function getSummary(query: SummaryQuery): Promise<SummaryData> {
  const { startDate, endDate, bin } = query
  const start = toDate(startDate)
  const end = toDate(endDate)

  // Main aggregates
  const aggregates = await prisma.$queryRaw<
    Array<{
      total: bigint
      avg_profit: number | null
      max_profit: number | null
      total_volume: number | null
      unique_triangles: bigint
    }>
  >`
    SELECT
      COUNT(*) as total,
      AVG(profit_net_pct) as avg_profit,
      MAX(profit_net_pct) as max_profit,
      SUM(COALESCE(volume_usd_ab, 0) + COALESCE(volume_usd_bc, 0) + COALESCE(volume_usd_ca, 0)) as total_volume,
      COUNT(DISTINCT triangle_key) as unique_triangles
    FROM vw_triangle_opportunities_enriched
    WHERE trade_date BETWEEN ${start} AND ${end}
  `

  // Unique currencies (need separate query due to UNION)
  const currencyCount = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COUNT(DISTINCT currency) as cnt FROM (
      SELECT curr_a as currency FROM vw_triangle_opportunities_enriched WHERE trade_date BETWEEN ${start} AND ${end}
      UNION
      SELECT curr_b FROM vw_triangle_opportunities_enriched WHERE trade_date BETWEEN ${start} AND ${end}
      UNION
      SELECT curr_c FROM vw_triangle_opportunities_enriched WHERE trade_date BETWEEN ${start} AND ${end}
    ) t
  `

  // Top triangles
  const topTriangles = await prisma.$queryRaw<
    Array<{ triangle_key: string; cnt: bigint; avg_profit: number }>
  >`
    SELECT
      triangle_key,
      COUNT(*) as cnt,
      AVG(profit_net_pct) as avg_profit
    FROM vw_triangle_opportunities_enriched
    WHERE trade_date BETWEEN ${start} AND ${end}
    GROUP BY triangle_key
    ORDER BY cnt DESC
    LIMIT 10
  `

  // Time series (if bin specified)
  let timeSeries: TimeSeriesPoint[] | undefined
  if (bin) {
    const truncFn = bin === 'day' ? 'day' : bin === 'month' ? 'month' : 'year'
    const truncLiteral = Prisma.raw(`'${truncFn}'`)
    const tsData = await prisma.$queryRaw<
      Array<{ date: Date; cnt: bigint; avg_profit: number; max_profit: number }>
    >`
        SELECT
          DATE_TRUNC(${truncLiteral}, trade_date) as date,
        COUNT(*) as cnt,
        AVG(profit_net_pct) as avg_profit,
        MAX(profit_net_pct) as max_profit
      FROM vw_triangle_opportunities_enriched
      WHERE trade_date BETWEEN ${start} AND ${end}
      GROUP BY DATE_TRUNC(${truncLiteral}, trade_date)
      ORDER BY date
    `
    timeSeries = tsData.map((row) => ({
      date: row.date.toISOString().split('T')[0],
      count: Number(row.cnt),
      avgProfit: row.avg_profit,
      maxProfit: row.max_profit,
    }))
  }

  const agg = aggregates[0]
  return {
    totalOpportunities: Number(agg?.total ?? 0),
    avgProfitPct: agg?.avg_profit ?? 0,
    maxProfitPct: agg?.max_profit ?? 0,
    totalVolumeUsd: agg?.total_volume ?? 0,
    uniqueTriangles: Number(agg?.unique_triangles ?? 0),
    uniqueCurrencies: Number(currencyCount[0]?.cnt ?? 0),
    topTriangles: topTriangles.map(
      (t): TopTriangle => ({
        triangleKey: t.triangle_key,
        count: Number(t.cnt),
        avgProfit: t.avg_profit,
      })
    ),
    timeSeries,
  }
}

export async function getGraph(query: GraphQuery): Promise<GraphData> {
  const { startDate, endDate, minFrequency, minProfitPct } = query
  const start = toDate(startDate)
  const end = toDate(endDate)

  // Nodes: aggregate by currency
  const nodes = await prisma.$queryRaw<
    Array<{ currency: string; cnt: bigint; total_volume: number; avg_profit: number }>
  >`
    WITH opps AS (
      SELECT * FROM vw_triangle_opportunities_enriched
      WHERE trade_date BETWEEN ${start} AND ${end}
        AND profit_net_pct >= ${minProfitPct}
    ),
    currency_stats AS (
      SELECT curr_a as currency, profit_net_pct as profit,
             COALESCE(volume_usd_ab, 0) + COALESCE(volume_usd_bc, 0) + COALESCE(volume_usd_ca, 0) as vol
      FROM opps
      UNION ALL
      SELECT curr_b, profit_net_pct,
             COALESCE(volume_usd_ab, 0) + COALESCE(volume_usd_bc, 0) + COALESCE(volume_usd_ca, 0)
      FROM opps
      UNION ALL
      SELECT curr_c, profit_net_pct,
             COALESCE(volume_usd_ab, 0) + COALESCE(volume_usd_bc, 0) + COALESCE(volume_usd_ca, 0)
      FROM opps
    )
    SELECT
      currency,
      COUNT(*) as cnt,
      SUM(vol) as total_volume,
      AVG(profit) as avg_profit
    FROM currency_stats
    GROUP BY currency
    HAVING COUNT(*) >= ${minFrequency}
    ORDER BY cnt DESC
  `

  // Links: aggregate by pair
  const links = await prisma.$queryRaw<
    Array<{
      pair: string
      src: string
      tgt: string
      cnt: bigint
      avg_profit: number
      total_volume: number
    }>
  >`
    WITH opps AS (
      SELECT * FROM vw_triangle_opportunities_enriched
      WHERE trade_date BETWEEN ${start} AND ${end}
        AND profit_net_pct >= ${minProfitPct}
    ),
    pair_stats AS (
      SELECT pair_ab as pair, curr_a as src, curr_b as tgt,
             profit_net_pct, COALESCE(volume_usd_ab, 0) as vol FROM opps
      UNION ALL
      SELECT pair_bc, curr_b, curr_c, profit_net_pct, COALESCE(volume_usd_bc, 0) FROM opps
      UNION ALL
      SELECT pair_ca, curr_c, curr_a, profit_net_pct, COALESCE(volume_usd_ca, 0) FROM opps
    )
    SELECT
      pair, src, tgt,
      COUNT(*) as cnt,
      AVG(profit_net_pct) as avg_profit,
      SUM(vol) as total_volume
    FROM pair_stats
    GROUP BY pair, src, tgt
    HAVING COUNT(*) >= ${minFrequency}
    ORDER BY cnt DESC
  `

  // Filter links to only include nodes that exist
  const nodeIds = new Set(nodes.map((n) => n.currency))
  const filteredLinks = links.filter((l) => nodeIds.has(l.src) && nodeIds.has(l.tgt))

  // Filter nodes to only include those with at least one link
  const connectedNodeIds = new Set<string>()
  for (const link of filteredLinks) {
    connectedNodeIds.add(link.src)
    connectedNodeIds.add(link.tgt)
  }
  const connectedNodes = nodes.filter((n) => connectedNodeIds.has(n.currency))

  return {
    nodes: connectedNodes.map(
      (n): GraphNode => ({
        id: n.currency,
        opportunityCount: Number(n.cnt),
        totalVolumeUsd: n.total_volume,
        avgProfit: n.avg_profit,
      })
    ),
    links: filteredLinks.map(
      (l): GraphLink => ({
        source: l.src,
        target: l.tgt,
        pair: l.pair,
        frequency: Number(l.cnt),
        avgProfit: l.avg_profit,
        totalVolumeUsd: l.total_volume,
      })
    ),
  }
}

export async function getTriangles(
  query: TrianglesQuery
): Promise<{ data: TriangleDetail[]; total: number }> {
  const { startDate, endDate, currency, limit, offset, sortBy } = query
  const start = toDate(startDate)
  const end = toDate(endDate)

  // Get total count
  const countResult = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COUNT(DISTINCT triangle_key) as cnt
    FROM vw_triangle_opportunities_enriched
    WHERE trade_date BETWEEN ${start} AND ${end}
      AND (curr_a = ${currency} OR curr_b = ${currency} OR curr_c = ${currency})
  `
  const total = Number(countResult[0]?.cnt ?? 0)

  // Determine sort column
  const orderBy =
    sortBy === 'profit'
      ? Prisma.sql`avg_profit DESC`
      : sortBy === 'volume'
        ? Prisma.sql`total_volume DESC`
        : Prisma.sql`cnt DESC`

  const data = await prisma.$queryRaw<
    Array<{
      triangle_id: number
      triangle_key: string
      curr_a: string
      curr_b: string
      curr_c: string
      cnt: bigint
      avg_profit: number
      max_profit: number
      total_volume: number
      last_seen: Date
    }>
  >`
    SELECT
      MIN(id) as triangle_id,
      triangle_key, curr_a, curr_b, curr_c,
      COUNT(*) as cnt,
      AVG(profit_net_pct) as avg_profit,
      MAX(profit_net_pct) as max_profit,
      SUM(COALESCE(volume_usd_ab, 0) + COALESCE(volume_usd_bc, 0) + COALESCE(volume_usd_ca, 0)) as total_volume,
      MAX(timestamp) as last_seen
    FROM vw_triangle_opportunities_enriched
    WHERE trade_date BETWEEN ${start} AND ${end}
      AND (curr_a = ${currency} OR curr_b = ${currency} OR curr_c = ${currency})
    GROUP BY triangle_key, curr_a, curr_b, curr_c
    ORDER BY ${orderBy}
    LIMIT ${limit} OFFSET ${offset}
  `

  return {
    data: data.map(
      (row): TriangleDetail => ({
        triangleId: row.triangle_id,
        triangleKey: row.triangle_key,
        currA: row.curr_a,
        currB: row.curr_b,
        currC: row.curr_c,
        count: Number(row.cnt),
        avgProfit: row.avg_profit,
        maxProfit: row.max_profit,
        totalVolumeUsd: row.total_volume,
        lastSeen: row.last_seen.toISOString(),
      })
    ),
    total,
  }
}

export async function getOpportunities(
  query: OpportunitiesQuery
): Promise<{ data: OpportunityRow[]; total: number }> {
  const { startDate, endDate, triangleKey, minProfitPct, limit, offset } = query
  const start = toDate(startDate)
  const end = toDate(endDate)

  // Build WHERE conditions
  const conditions = [Prisma.sql`trade_date BETWEEN ${start} AND ${end}`]
  if (triangleKey) {
    conditions.push(Prisma.sql`triangle_key = ${triangleKey}`)
  }
  if (minProfitPct !== undefined) {
    conditions.push(Prisma.sql`profit_net_pct >= ${minProfitPct}`)
  }
  const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`

  // Get total count
  const countResult = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COUNT(*) as cnt FROM vw_triangle_opportunities_enriched ${whereClause}
  `
  const total = Number(countResult[0]?.cnt ?? 0)

  // Get data
  const data = await prisma.$queryRaw<
    Array<{
      id: number
      timestamp: Date
      triangle_key: string
      curr_a: string
      curr_b: string
      curr_c: string
      profit_net_pct: number
      pair_ab: string
      pair_bc: string
      pair_ca: string
      volume_usd_ab: number | null
      volume_usd_bc: number | null
      volume_usd_ca: number | null
      min_trades: number | null
    }>
  >`
    SELECT
      id, timestamp, triangle_key,
      curr_a, curr_b, curr_c,
      profit_net_pct,
      pair_ab, pair_bc, pair_ca,
      volume_usd_ab, volume_usd_bc, volume_usd_ca,
      min_trades
    FROM vw_triangle_opportunities_enriched
    ${whereClause}
    ORDER BY timestamp DESC
    LIMIT ${limit} OFFSET ${offset}
  `

  return {
    data: data.map(
      (row): OpportunityRow => ({
        id: row.id,
        timestamp: row.timestamp.toISOString(),
        triangleKey: row.triangle_key,
        currA: row.curr_a,
        currB: row.curr_b,
        currC: row.curr_c,
        profitNetPct: row.profit_net_pct,
        pairAb: row.pair_ab,
        pairBc: row.pair_bc,
        pairCa: row.pair_ca,
        volumeUsdAb: row.volume_usd_ab,
        volumeUsdBc: row.volume_usd_bc,
        volumeUsdCa: row.volume_usd_ca,
        minTrades: row.min_trades,
      })
    ),
    total,
  }
}

export async function getGraphTimeline(query: GraphTimelineQuery): Promise<GraphTimelineData> {
  const { startDate, endDate, bin, minFrequency, minProfitPct } = query
  const start = toDate(startDate)
  const end = toDate(endDate)

  const truncFn = bin === 'day' ? 'day' : bin === 'month' ? 'month' : 'year'
  const truncLiteral = Prisma.raw(`'${truncFn}'`)

  // Get time-bucketed node data
  const nodeData = await prisma.$queryRaw<
    Array<{
      bucket: Date
      currency: string
      cnt: bigint
      total_volume: number
      avg_profit: number
    }>
  >`
    WITH opps AS (
      SELECT
        DATE_TRUNC(${truncLiteral}, trade_date) as bucket,
        curr_a, curr_b, curr_c,
        profit_net_pct,
        COALESCE(volume_usd_ab, 0) + COALESCE(volume_usd_bc, 0) + COALESCE(volume_usd_ca, 0) as vol
      FROM vw_triangle_opportunities_enriched
      WHERE trade_date BETWEEN ${start} AND ${end}
        AND profit_net_pct >= ${minProfitPct}
    ),
    currency_stats AS (
      SELECT bucket, curr_a as currency, profit_net_pct as profit, vol FROM opps
      UNION ALL
      SELECT bucket, curr_b, profit_net_pct, vol FROM opps
      UNION ALL
      SELECT bucket, curr_c, profit_net_pct, vol FROM opps
    )
    SELECT
      bucket,
      currency,
      COUNT(*) as cnt,
      SUM(vol) as total_volume,
      AVG(profit) as avg_profit
    FROM currency_stats
    GROUP BY bucket, currency
    HAVING COUNT(*) >= ${minFrequency}
    ORDER BY bucket, currency
  `

  // Get time-bucketed link data
  const linkData = await prisma.$queryRaw<
    Array<{
      bucket: Date
      pair: string
      src: string
      tgt: string
      cnt: bigint
      avg_profit: number
      total_volume: number
    }>
  >`
    WITH opps AS (
      SELECT
        DATE_TRUNC(${truncLiteral}, trade_date) as bucket,
        pair_ab, pair_bc, pair_ca,
        curr_a, curr_b, curr_c,
        profit_net_pct,
        COALESCE(volume_usd_ab, 0) as vol_ab,
        COALESCE(volume_usd_bc, 0) as vol_bc,
        COALESCE(volume_usd_ca, 0) as vol_ca
      FROM vw_triangle_opportunities_enriched
      WHERE trade_date BETWEEN ${start} AND ${end}
        AND profit_net_pct >= ${minProfitPct}
    ),
    pair_stats AS (
      SELECT bucket, pair_ab as pair, curr_a as src, curr_b as tgt, profit_net_pct, vol_ab as vol FROM opps
      UNION ALL
      SELECT bucket, pair_bc, curr_b, curr_c, profit_net_pct, vol_bc FROM opps
      UNION ALL
      SELECT bucket, pair_ca, curr_c, curr_a, profit_net_pct, vol_ca FROM opps
    )
    SELECT
      bucket, pair, src, tgt,
      COUNT(*) as cnt,
      AVG(profit_net_pct) as avg_profit,
      SUM(vol) as total_volume
    FROM pair_stats
    GROUP BY bucket, pair, src, tgt
    HAVING COUNT(*) >= ${minFrequency}
    ORDER BY bucket, pair
  `

  // Group by bucket to create snapshots
  const bucketMap = new Map<
    string,
    { nodes: Map<string, GraphNode>; links: Map<string, GraphLink> }
  >()
  const allNodesMap = new Map<string, GraphNode>()
  const allLinksMap = new Map<string, GraphLink>()

  // Process nodes
  for (const row of nodeData) {
    const dateStr = row.bucket.toISOString().split('T')[0]
    if (!bucketMap.has(dateStr)) {
      bucketMap.set(dateStr, { nodes: new Map(), links: new Map() })
    }
    const bucket = bucketMap.get(dateStr)!

    const node: GraphNode = {
      id: row.currency,
      opportunityCount: Number(row.cnt),
      totalVolumeUsd: row.total_volume,
      avgProfit: row.avg_profit,
    }
    bucket.nodes.set(row.currency, node)

    // Aggregate for allNodes
    const existing = allNodesMap.get(row.currency)
    if (existing) {
      existing.opportunityCount += node.opportunityCount
      existing.totalVolumeUsd += node.totalVolumeUsd
      existing.avgProfit = (existing.avgProfit + node.avgProfit) / 2
    } else {
      allNodesMap.set(row.currency, { ...node })
    }
  }

  // Process links
  for (const row of linkData) {
    const dateStr = row.bucket.toISOString().split('T')[0]
    if (!bucketMap.has(dateStr)) {
      bucketMap.set(dateStr, { nodes: new Map(), links: new Map() })
    }
    const bucket = bucketMap.get(dateStr)!

    const link: GraphLink = {
      source: row.src,
      target: row.tgt,
      pair: row.pair,
      frequency: Number(row.cnt),
      avgProfit: row.avg_profit,
      totalVolumeUsd: row.total_volume,
    }
    bucket.links.set(row.pair, link)

    // Aggregate for allLinks
    const existing = allLinksMap.get(row.pair)
    if (existing) {
      existing.frequency += link.frequency
      existing.totalVolumeUsd += link.totalVolumeUsd
      existing.avgProfit = (existing.avgProfit + link.avgProfit) / 2
    } else {
      allLinksMap.set(row.pair, { ...link })
    }
  }

  // Filter links and nodes to ensure all nodes have at least one edge
  const snapshots: GraphSnapshot[] = Array.from(bucketMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { nodes, links }]) => {
      const nodeIds = new Set(nodes.keys())
      // First filter: links must connect existing nodes
      const filteredLinks = Array.from(links.values()).filter(
        (l) => nodeIds.has(l.source) && nodeIds.has(l.target)
      )
      // Second filter: only include nodes that have at least one remaining link
      const connectedNodeIds = new Set<string>()
      for (const link of filteredLinks) {
        connectedNodeIds.add(link.source)
        connectedNodeIds.add(link.target)
      }
      const connectedNodes = Array.from(nodes.values()).filter((n) => connectedNodeIds.has(n.id))
      return {
        date,
        nodes: connectedNodes,
        links: filteredLinks,
      }
    })

  // Filter allLinks to only include allNodes, then filter allNodes to only include connected ones
  const allNodeIds = new Set(allNodesMap.keys())
  const filteredAllLinks = Array.from(allLinksMap.values()).filter(
    (l) => allNodeIds.has(l.source) && allNodeIds.has(l.target)
  )
  // Only include nodes that have at least one link
  const connectedAllNodeIds = new Set<string>()
  for (const link of filteredAllLinks) {
    connectedAllNodeIds.add(link.source)
    connectedAllNodeIds.add(link.target)
  }
  const connectedAllNodes = Array.from(allNodesMap.values()).filter((n) =>
    connectedAllNodeIds.has(n.id)
  )

  return {
    snapshots,
    allNodes: connectedAllNodes,
    allLinks: filteredAllLinks,
  }
}
