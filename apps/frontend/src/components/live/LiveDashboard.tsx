import { useCallback, useMemo, useState } from 'react'
import { NetworkGraph } from '@/components/graph/NetworkGraph'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppContext } from '@/context/AppContext'
import { useArbitrageDetection } from '@/hooks/useArbitrageDetection'
import { useBinanceExchangeInfo } from '@/hooks/useBinanceExchangeInfo'
import { useBinanceWebSocket } from '@/hooks/useBinanceWebSocket'
import { formatNumber } from '@/lib/utils'
import type { BookTickerMessage, LiveConfig } from '@/types'
import { LiveControls } from './LiveControls'
import { OpportunityFeed } from './OpportunityFeed'

export function LiveDashboard() {
  const { selectedNode, openNodeDetail } = useAppContext()
  const [isPaused, setIsPaused] = useState(false)
  const [config, setConfig] = useState<LiveConfig>({
    fee: 0.1,
    minProfit: 0.05,
    notional: 100,
  })

  const {
    pairs,
    triangles,
    pairCount,
    triangleCount,
    isLoading: exchangeLoading,
  } = useBinanceExchangeInfo()

  const { opportunities, totalCount, stats, sendPriceUpdate, clearOpportunities } =
    useArbitrageDetection({
      triangles,
      config,
      enabled: !isPaused && !exchangeLoading,
    })

  const handleMessage = useCallback(
    (message: BookTickerMessage) => {
      if (!isPaused) {
        sendPriceUpdate(message)
      }
    },
    [isPaused, sendPriceUpdate]
  )

  const { status, messagesPerSecond, reconnect } = useBinanceWebSocket({
    pairs,
    enabled: !exchangeLoading,
    onMessage: handleMessage,
  })

  const opportunitiesDisplay =
    totalCount > 9_999 ? formatNumber(totalCount, 0) : totalCount.toLocaleString('en-US')

  // Build flashing edges from recent opportunities
  const flashingEdges = useMemo(() => {
    const edges = new Set<string>()
    const recentThreshold = Date.now() - 2000 // Last 2 seconds
    for (const opp of opportunities) {
      if (opp.timestamp > recentThreshold) {
        for (const step of opp.steps) {
          edges.add(step.pair)
        }
      }
    }
    return edges
  }, [opportunities])

  // Build simple graph data from triangles
  const graphData = useMemo(() => {
    const nodeMap = new Map<
      string,
      {
        id: string
        opportunityCount: number
        totalVolumeUsd: number
        avgProfit: number
        profitSum: number
      }
    >()

    for (const triangle of triangles) {
      for (const currency of triangle.currencies) {
        if (!nodeMap.has(currency)) {
          nodeMap.set(currency, {
            id: currency,
            opportunityCount: 0,
            totalVolumeUsd: 0,
            avgProfit: 0,
            profitSum: 0,
          })
        }
      }
    }

    // Build links from pairs (start with frequency 0)
    const linkMap = new Map<
      string,
      {
        source: string
        target: string
        pair: string
        frequency: number
        avgProfit: number
        totalVolumeUsd: number
        profitSum: number
      }
    >()
    for (const pair of pairs) {
      linkMap.set(pair.symbol, {
        source: pair.baseAsset,
        target: pair.quoteAsset,
        pair: pair.symbol,
        frequency: 0,
        avgProfit: 0,
        totalVolumeUsd: 0,
        profitSum: 0,
      })
    }

    // Update counts from opportunities
    for (const opp of opportunities) {
      // Calculate total volume for this opportunity from its steps
      const oppVolume = opp.steps.reduce((sum, step) => sum + step.price * step.quantity, 0)

      const currencies = [opp.currA, opp.currB, opp.currC]
      for (const currency of currencies) {
        const node = nodeMap.get(currency)
        if (node) {
          node.opportunityCount++
          node.profitSum += opp.profitPct
          node.avgProfit = node.profitSum / node.opportunityCount
          node.totalVolumeUsd += oppVolume
        }
      }
      // Update link frequencies from opportunity steps
      for (const step of opp.steps) {
        const link = linkMap.get(step.pair)
        if (link) {
          link.frequency++
          link.profitSum += opp.profitPct
          link.avgProfit = link.profitSum / link.frequency
          link.totalVolumeUsd += step.price * step.quantity
        }
      }
    }

    const nodes = Array.from(nodeMap.values()).map(({ profitSum, ...rest }) => rest)
    const links = Array.from(linkMap.values()).map(({ profitSum, ...rest }) => rest)

    return { nodes, links }
  }, [triangles, pairs, opportunities])

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      openNodeDetail(nodeId)
    },
    [openNodeDetail]
  )

  if (exchangeLoading) {
    return (
      <div className="container mx-auto flex flex-col gap-4 p-4">
        <Skeleton className="h-20" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-[500px] lg:col-span-2" />
          <Skeleton className="h-[500px]" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto flex flex-col gap-4 p-4">
      {/* Controls */}
      <LiveControls
        config={config}
        onConfigChange={setConfig}
        isPaused={isPaused}
        onPauseChange={setIsPaused}
        onClear={clearOpportunities}
        status={status}
        onReconnect={reconnect}
      />

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Pairs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">{pairCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Triangles</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">{triangleCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Messages/sec</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">{formatNumber(messagesPerSecond, 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Price Map</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">{stats.priceMapSize}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Opportunities</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-green-500">{opportunitiesDisplay}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main content */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Graph */}
        <div className="lg:col-span-2">
          <div className="flex h-[500px] flex-col rounded-lg border border-border bg-card">
            <div className="flex-shrink-0 border-b border-border px-4 py-1.5">
              <h2 className="text-sm font-medium">Live Network</h2>
            </div>
            <div className="min-h-0 flex-1">
              <NetworkGraph
                nodes={graphData.nodes}
                links={graphData.links}
                selectedNode={selectedNode}
                onNodeClick={handleNodeClick}
                mode="live"
                flashingEdges={flashingEdges}
              />
            </div>
          </div>
        </div>

        {/* Opportunity feed */}
        <div className="lg:col-span-1">
          <OpportunityFeed opportunities={opportunities} />
        </div>
      </div>
    </div>
  )
}
