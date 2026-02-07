import type {
  BookTickerMessage,
  LiveConfig,
  LiveOpportunity,
  TradeStep,
  Triangle,
  WorkerInboundMessage,
  WorkerOutboundMessage,
} from '@/types'

interface PriceData {
  bid: number
  ask: number
  bidQty: number
  askQty: number
  lastUpdate: number
}

// Worker state
let triangles: Triangle[] = []
let config: LiveConfig = { fee: 0.1, minProfit: 0.1, notional: 100 }
const priceMap = new Map<string, PriceData>()
let checksPerSecond = 0
let lastStatsTime = Date.now()
let checkCount = 0
let opportunitySeq = 0

// Handle messages from main thread
self.onmessage = (event: MessageEvent<WorkerInboundMessage>) => {
  const { type, payload } = event.data

  switch (type) {
    case 'INIT':
      triangles = payload.triangles
      config = payload.config
      priceMap.clear()
      break

    case 'PRICE_UPDATE':
      handlePriceUpdate(payload as BookTickerMessage)
      break

    case 'CONFIG_UPDATE':
      config = payload
      break
  }
}

function handlePriceUpdate(msg: BookTickerMessage) {
  const { s: symbol, b: bid, B: bidQty, a: ask, A: askQty } = msg

  priceMap.set(symbol, {
    bid: Number.parseFloat(bid),
    ask: Number.parseFloat(ask),
    bidQty: Number.parseFloat(bidQty),
    askQty: Number.parseFloat(askQty),
    lastUpdate: Date.now(),
  })

  // Check for opportunities after each price update
  checkOpportunities()
}

function checkOpportunities() {
  checkCount++

  // Update stats every second
  const now = Date.now()
  if (now - lastStatsTime >= 1000) {
    checksPerSecond = checkCount
    checkCount = 0
    lastStatsTime = now

    const statsMessage: WorkerOutboundMessage = {
      type: 'STATS',
      payload: {
        priceMapSize: priceMap.size,
        checksPerSecond,
      },
    }
    self.postMessage(statsMessage)
  }

  // Check each triangle in both directions
  // Reject profits > 10% as they indicate calculation errors (real arb is typically < 1%)
  const MAX_REASONABLE_PROFIT = 10

  for (const triangle of triangles) {
    const forwardResult = calculateTriangleProfit(triangle, 'forward')
    if (
      forwardResult &&
      forwardResult.profit > config.minProfit &&
      forwardResult.profit < MAX_REASONABLE_PROFIT
    ) {
      const opportunity = createOpportunity(
        triangle,
        'forward',
        forwardResult.profit,
        forwardResult.steps
      )
      const message: WorkerOutboundMessage = {
        type: 'OPPORTUNITY',
        payload: opportunity,
      }
      self.postMessage(message)
    }

    const reverseResult = calculateTriangleProfit(triangle, 'reverse')
    if (
      reverseResult &&
      reverseResult.profit > config.minProfit &&
      reverseResult.profit < MAX_REASONABLE_PROFIT
    ) {
      const opportunity = createOpportunity(
        triangle,
        'reverse',
        reverseResult.profit,
        reverseResult.steps
      )
      const message: WorkerOutboundMessage = {
        type: 'OPPORTUNITY',
        payload: opportunity,
      }
      self.postMessage(message)
    }
  }
}

function calculateTriangleProfit(
  triangle: Triangle,
  direction: 'forward' | 'reverse'
): { profit: number; steps: TradeStep[] } | null {
  const { pairs } = triangle
  const orderedPairs = direction === 'forward' ? pairs : [...pairs].reverse()

  const [pair1, pair2, pair3] = orderedPairs
  const price1 = priceMap.get(pair1)
  const price2 = priceMap.get(pair2)
  const price3 = priceMap.get(pair3)

  if (!price1 || !price2 || !price3) return null

  // Simplified calculation - assumes all pairs follow BASE/QUOTE convention
  // In reality, we'd need to track which direction to trade each pair
  const feeMultiplier = 1 - config.fee / 100

  // Start with notional amount
  let amount = config.notional
  const steps: TradeStep[] = []

  // Step 1
  const rate1 = price1.ask
  amount = (amount / rate1) * feeMultiplier
  steps.push({ pair: pair1, action: 'buy', price: rate1, quantity: config.notional })

  // Step 2
  const rate2 = price2.bid
  amount = amount * rate2 * feeMultiplier
  steps.push({ pair: pair2, action: 'sell', price: rate2, quantity: amount / rate2 })

  // Step 3
  const rate3 = price3.bid
  amount = amount * rate3 * feeMultiplier
  steps.push({ pair: pair3, action: 'sell', price: rate3, quantity: amount / rate3 })

  const profit = ((amount - config.notional) / config.notional) * 100

  return { profit, steps }
}

function createOpportunity(
  triangle: Triangle,
  direction: 'forward' | 'reverse',
  profit: number,
  steps: TradeStep[]
): LiveOpportunity {
  const [currA, currB, currC] = triangle.currencies
  const now = Date.now()
  const seq = opportunitySeq++

  return {
    id: `${triangle.key}-${direction}-${now}-${seq}`,
    timestamp: now,
    triangleKey: triangle.key,
    currA,
    currB,
    currC,
    direction,
    profitPct: profit,
    steps,
  }
}
