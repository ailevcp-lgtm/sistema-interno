'use client'

import { useEffect, useRef } from 'react'

interface ResumeRefreshOptions {
  enabled?: boolean
  throttleMs?: number
}

const DEFAULT_THROTTLE_MS = 4_000

export function useResumeRefresh(
  refreshFn: () => void | Promise<void>,
  options: ResumeRefreshOptions = {}
) {
  const enabled = options.enabled ?? true
  const throttleMs = options.throttleMs ?? DEFAULT_THROTTLE_MS
  const refreshRef = useRef(refreshFn)
  const lastRunRef = useRef(0)

  useEffect(() => {
    refreshRef.current = refreshFn
  }, [refreshFn])

  useEffect(() => {
    if (!enabled) return

    const runRefresh = () => {
      const now = Date.now()
      if (now - lastRunRef.current < throttleMs) return

      lastRunRef.current = now
      void refreshRef.current()
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runRefresh()
      }
    }

    window.addEventListener('focus', runRefresh)
    window.addEventListener('online', runRefresh)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.removeEventListener('focus', runRefresh)
      window.removeEventListener('online', runRefresh)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [enabled, throttleMs])
}
