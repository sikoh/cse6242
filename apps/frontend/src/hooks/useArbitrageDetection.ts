import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  BookTickerMessage,
  LiveConfig,
  LiveOpportunity,
  Triangle,
  WorkerInboundMessage,
  WorkerOutboundMessage,
} from '@/types'

interface UseArbitrageDetectionOptions {
  triangles: Triangle[]
  config: LiveConfig
  enabled: boolean
}

interface UseArbitrageDetectionReturn {
  opportunities: LiveOpportunity[]
  totalCount: number
  stats: {
    priceMapSize: number
    checksPerSecond: number
  }
  sendPriceUpdate: (message: BookTickerMessage) => void
  clearOpportunities: () => void
}

const MAX_OPPORTUNITIES = 1000

export function useArbitrageDetection({
  triangles,
  config,
  enabled,
}: UseArbitrageDetectionOptions): UseArbitrageDetectionReturn {
  const workerRef = useRef<Worker | null>(null)
  const [opportunities, setOpportunities] = useState<LiveOpportunity[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [stats, setStats] = useState({ priceMapSize: 0, checksPerSecond: 0 })

  // Initialize worker
  useEffect(() => {
    if (!enabled) {
      if (workerRef.current) {
        workerRef.current.terminate()
        workerRef.current = null
      }
      return
    }

    // Create worker using Vite's native worker support
    const worker = new Worker(new URL('../workers/arbitrage.worker.ts', import.meta.url), {
      type: 'module',
    })

    worker.onmessage = (event: MessageEvent<WorkerOutboundMessage>) => {
      const { type, payload } = event.data

      if (type === 'OPPORTUNITY') {
        setTotalCount((prev) => prev + 1)
        setOpportunities((prev) => {
          const next = [payload as LiveOpportunity, ...prev]
          return next.slice(0, MAX_OPPORTUNITIES)
        })
      } else if (type === 'STATS') {
        setStats(payload as { priceMapSize: number; checksPerSecond: number })
      }
    }

    worker.onerror = (error) => {
      console.error('Worker error:', error)
    }

    workerRef.current = worker

    // Initialize with triangles and config
    const initMessage: WorkerInboundMessage = {
      type: 'INIT',
      payload: { triangles, config },
    }
    worker.postMessage(initMessage)

    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [enabled, triangles, config])

  // Update config when it changes
  useEffect(() => {
    if (workerRef.current && enabled) {
      const configMessage: WorkerInboundMessage = {
        type: 'CONFIG_UPDATE',
        payload: config,
      }
      workerRef.current.postMessage(configMessage)
    }
  }, [config, enabled])

  const sendPriceUpdate = useCallback((message: BookTickerMessage) => {
    if (workerRef.current) {
      const priceMessage: WorkerInboundMessage = {
        type: 'PRICE_UPDATE',
        payload: message,
      }
      workerRef.current.postMessage(priceMessage)
    }
  }, [])

  const clearOpportunities = useCallback(() => {
    setOpportunities([])
    setTotalCount(0)
  }, [])

  return { opportunities, totalCount, stats, sendPriceUpdate, clearOpportunities }
}
