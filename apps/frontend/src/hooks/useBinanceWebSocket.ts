import { useCallback, useEffect, useRef, useState } from 'react'
import { BINANCE_WS_URL } from '@/lib/env'
import type { BinanceSymbol, BookTickerMessage, ConnectionStatus } from '@/types'

const MAX_STREAMS_PER_CONNECTION = 200

interface UseBinanceWebSocketOptions {
  pairs: BinanceSymbol[]
  enabled: boolean
  onMessage: (message: BookTickerMessage) => void
}

interface UseBinanceWebSocketReturn {
  status: ConnectionStatus
  messagesPerSecond: number
  reconnect: () => void
}

export function useBinanceWebSocket({
  pairs,
  enabled,
  onMessage,
}: UseBinanceWebSocketOptions): UseBinanceWebSocketReturn {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [messagesPerSecond, setMessagesPerSecond] = useState(0)

  const wsRef = useRef<WebSocket | null>(null)
  const messageCountRef = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5

  const connect = useCallback(() => {
    if (!enabled || pairs.length === 0) return

    // Build stream names (limit to MAX_STREAMS_PER_CONNECTION)
    const streamNames = pairs
      .slice(0, MAX_STREAMS_PER_CONNECTION)
      .map((p) => `${p.symbol.toLowerCase()}@bookTicker`)
      .join('/')

    const url = `${BINANCE_WS_URL}?streams=${streamNames}`

    setStatus('connecting')

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setStatus('connected')
      reconnectAttempts.current = 0
    }

    ws.onmessage = (event) => {
      try {
        const wrapper = JSON.parse(event.data)
        if (wrapper.data) {
          messageCountRef.current++
          onMessage(wrapper.data as BookTickerMessage)
        }
      } catch {
        // Ignore parse errors
      }
    }

    ws.onerror = () => {
      setStatus('error')
    }

    ws.onclose = () => {
      setStatus('disconnected')
      wsRef.current = null

      // Attempt reconnect with exponential backoff
      if (enabled && reconnectAttempts.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 30000)
        reconnectAttempts.current++
        setTimeout(connect, delay)
      }
    }
  }, [enabled, pairs, onMessage])

  const reconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
    }
    reconnectAttempts.current = 0
    connect()
  }, [connect])

  // Connect when enabled and pairs are available
  useEffect(() => {
    if (enabled && pairs.length > 0) {
      connect()
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [enabled, connect, pairs.length])

  // Track messages per second
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setMessagesPerSecond(messageCountRef.current)
      messageCountRef.current = 0
    }, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  return { status, messagesPerSecond, reconnect }
}
