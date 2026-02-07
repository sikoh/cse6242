import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { getExchangeInfo } from '@/lib/api'
import { buildAdjacencyList, buildTriangles, filterRelevantPairs } from '@/lib/graph'
import type { BinanceSymbol } from '@/types'

export function useBinanceExchangeInfo() {
  const query = useQuery({
    queryKey: ['binance-exchange-info'],
    queryFn: getExchangeInfo,
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
  })

  const processed = useMemo(() => {
    if (!query.data) return null

    const allSymbols: BinanceSymbol[] = query.data.symbols.map((s) => ({
      symbol: s.symbol,
      baseAsset: s.baseAsset,
      quoteAsset: s.quoteAsset,
      status: s.status,
    }))

    const relevantPairs = filterRelevantPairs(allSymbols)
    const adjacency = buildAdjacencyList(relevantPairs)
    const triangles = buildTriangles(adjacency)

    return {
      pairs: relevantPairs,
      triangles,
      pairCount: relevantPairs.length,
      triangleCount: triangles.length,
    }
  }, [query.data])

  return {
    ...query,
    pairs: processed?.pairs ?? [],
    triangles: processed?.triangles ?? [],
    pairCount: processed?.pairCount ?? 0,
    triangleCount: processed?.triangleCount ?? 0,
  }
}
