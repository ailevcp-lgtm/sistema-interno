'use client'

import { useState, useCallback, useMemo } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import type { FinanceFilters } from '@/lib/types'

export function useFinanceFilters() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const filters: FinanceFilters = useMemo(() => ({
    anio: searchParams.get('anio') ? Number(searchParams.get('anio')) : undefined,
    categoriaId: searchParams.get('categoria') || undefined,
    eventoId: searchParams.get('evento') || undefined,
  }), [searchParams])

  const activeTab = searchParams.get('tab') || 'balance'

  const updateParams = useCallback((updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === '') {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    })
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [searchParams, router, pathname])

  const setAnio = useCallback((anio?: number) => {
    updateParams({ anio: anio?.toString() })
  }, [updateParams])

  const setCategoriaId = useCallback((id?: string) => {
    updateParams({ categoria: id })
  }, [updateParams])

  const setEventoId = useCallback((id?: string) => {
    updateParams({ evento: id })
  }, [updateParams])

  const setTab = useCallback((tab: string) => {
    updateParams({ tab: tab === 'balance' ? undefined : tab })
  }, [updateParams])

  const clearFilters = useCallback(() => {
    const params = new URLSearchParams()
    if (activeTab !== 'balance') params.set('tab', activeTab)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [router, pathname, activeTab])

  const hasActiveFilters = !!(filters.anio || filters.categoriaId || filters.eventoId)

  return {
    filters,
    activeTab,
    setAnio,
    setCategoriaId,
    setEventoId,
    setTab,
    clearFilters,
    hasActiveFilters,
  }
}
