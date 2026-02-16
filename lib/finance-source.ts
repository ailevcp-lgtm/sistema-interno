import { supabase } from '@/lib/supabase'
import type { CategoriaFinanciera, Cuenta, Evento } from '@/lib/types'
import { runWithRecovery } from '@/lib/async-recovery'

export const ACTIVE_MOVEMENTS_FILTER = 'anulado.eq.false'

const REFERENCE_TTL_MS = 60 * 1000

interface FinancialReferenceData {
  categorias: CategoriaFinanciera[]
  eventos: Evento[]
  cuentas: Cuenta[]
  availableYears: number[]
}

let referenceCache: { expiresAt: number; data: FinancialReferenceData } | null = null
let inFlightReferenceRequest: Promise<FinancialReferenceData> | null = null

async function fetchFinancialReferenceData(): Promise<FinancialReferenceData> {
  const [catResult, evResult, cuentasResult, yearsResult] = await Promise.all([
    supabase.from('categorias_financieras').select('*').eq('activa', true).order('nombre'),
    supabase.from('eventos').select('*').eq('activo', true).order('nombre'),
    supabase.from('cuentas').select('*').eq('activa', true).order('nombre'),
    supabase
      .from('movimientos')
      .select('periodo')
      .eq('anulado', false)
      .order('periodo', { ascending: false })
      .limit(1500),
  ])

  if (catResult.error) throw catResult.error
  if (evResult.error) throw evResult.error
  if (cuentasResult.error) throw cuentasResult.error
  if (yearsResult.error) throw yearsResult.error

  const years = new Set<number>()

  ;(yearsResult.data || []).forEach((row: { periodo?: string | null }) => {
    if (!row.periodo) return
    const year = Number.parseInt(row.periodo.slice(0, 4), 10)
    if (Number.isFinite(year)) years.add(year)
  })

  return {
    categorias: (catResult.data || []) as CategoriaFinanciera[],
    eventos: (evResult.data || []) as Evento[],
    cuentas: (cuentasResult.data || []) as Cuenta[],
    availableYears: Array.from(years).sort((a, b) => b - a),
  }
}

export async function getFinancialReferenceData(forceRefresh = false): Promise<FinancialReferenceData> {
  const now = Date.now()

  if (!forceRefresh && referenceCache && referenceCache.expiresAt > now) {
    return referenceCache.data
  }

  if (!inFlightReferenceRequest) {
    inFlightReferenceRequest = runWithRecovery(() => fetchFinancialReferenceData(), {
      label: 'financial reference data',
    })
      .then((data) => {
        referenceCache = { data, expiresAt: Date.now() + REFERENCE_TTL_MS }
        return data
      })
      .finally(() => {
        inFlightReferenceRequest = null
      })
  }

  return inFlightReferenceRequest
}

export function invalidateFinancialReferenceData() {
  referenceCache = null
}
