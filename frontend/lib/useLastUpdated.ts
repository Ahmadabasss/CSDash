'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const REFRESH_MS = 5 * 60 * 1000 // 5 minutes

export function useLastUpdated(onRefresh: () => Promise<void>) {
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [refreshing, setRefreshing] = useState(false)
  const [label, setLabel] = useState('just now')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await onRefresh()
      setLastUpdated(new Date())
    } finally {
      setRefreshing(false)
    }
  }, [onRefresh])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    timerRef.current = setInterval(refresh, REFRESH_MS)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [refresh])

  // Update "X ago" label every 30s
  useEffect(() => {
    function tick() {
      const diff = Math.floor((Date.now() - lastUpdated.getTime()) / 1000)
      if (diff < 10) setLabel('just now')
      else if (diff < 60) setLabel(`${diff}s ago`)
      else if (diff < 3600) setLabel(`${Math.floor(diff / 60)}m ago`)
      else setLabel(`${Math.floor(diff / 3600)}h ago`)
    }
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [lastUpdated])

  return { label, refreshing, refresh, lastUpdated }
}
