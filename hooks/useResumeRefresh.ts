'use client'

import { useEffect, useRef } from 'react'
import { AUTH_SESSION_RESUMED_EVENT } from '@/lib/constants'

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

    const runRefresh = (force: boolean = false) => {
      const now = Date.now()
      if (!force && now - lastRunRef.current < throttleMs) return

      lastRunRef.current = now
      void refreshRef.current()
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runRefresh()
      }
    }

    const onAuthSessionResumed = () => {
      runRefresh(true)
    }

    const onFocus = () => {
      runRefresh()
    }

    const onOnline = () => {
      runRefresh()
    }

    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener(AUTH_SESSION_RESUMED_EVENT, onAuthSessionResumed)

    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener(AUTH_SESSION_RESUMED_EVENT, onAuthSessionResumed)
    }
  }, [enabled, throttleMs])
}
