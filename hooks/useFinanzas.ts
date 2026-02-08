import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type {
  CategoriaFinanciera,
  Evento,
  FinanceFilters,
  FinanceSummary,
  MonthlyDetail,
  CategoryContribution,
  EventSummary,
  CategorySummaryRow,
  TransactionRow,
  TipoMovimiento,
  Movimiento,
} from '@/lib/types'
import { useAuth } from './useAuth'
import { toast } from 'sonner'

interface RawJoinResult {
  id: string
  tipo: string
  monto: number
  fecha: string
  periodo: string
  descripcion: string
  categoria_id: string | null
  evento_id: string | null
  cuenta_id: string | null
  voluntario_nombre: string | null
  comprobante_url: string | null
  categoria: { id: string; nombre: string; tipo: string }[] | { id: string; nombre: string; tipo: string } | null
  evento: { id: string; nombre: string }[] | { id: string; nombre: string } | null
  cuenta: { id: string; nombre: string }[] | { id: string; nombre: string } | null
}

interface RawMovimiento {
  id: string
  tipo: string
  monto: number
  fecha: string
  periodo: string
  descripcion: string
  categoria_id: string | null
  evento_id: string | null
  cuenta_id: string | null
  voluntario_nombre: string | null
  comprobante_url: string | null
  categoria?: { id: string; nombre: string; tipo: string } | null
  evento?: { id: string; nombre: string } | null
  cuenta?: { id: string; nombre: string } | null
}

function normalizeJoinResult(data: RawJoinResult[]): RawMovimiento[] {
  return data.map(row => ({
    ...row,
    categoria: Array.isArray(row.categoria) ? row.categoria[0] || null : row.categoria,
    evento: Array.isArray(row.evento) ? row.evento[0] || null : row.evento,
    cuenta: Array.isArray(row.cuenta) ? row.cuenta[0] || null : row.cuenta,
  }))
}

export function useFinanzas(filters: FinanceFilters = {}) {
  const { user } = useAuth()
  const [rawMovimientos, setRawMovimientos] = useState<RawMovimiento[]>([])
  const [categorias, setCategorias] = useState<CategoriaFinanciera[]>([])
  const [eventos, setEventos] = useState<Evento[]>([])
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const [loading, setLoading] = useState(true)

  // ── Fetch all base data ────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)

    // Build query with filters
    let query = supabase
      .from('movimientos')
      .select('id, tipo, monto, fecha, periodo, descripcion, categoria_id, evento_id, cuenta_id, voluntario_nombre, comprobante_url, categoria:categorias_financieras(id, nombre, tipo), evento:eventos(id, nombre), cuenta:cuentas(id, nombre)')
      .order('fecha', { ascending: false })

    if (filters.anio) {
      const start = `${filters.anio}-01-01`
      const end = `${filters.anio}-12-31`
      query = query.gte('fecha', start).lte('fecha', end)
    }
    if (filters.categoriaId) {
      query = query.eq('categoria_id', filters.categoriaId)
    }
    if (filters.eventoId) {
      query = query.eq('evento_id', filters.eventoId)
    }

    const [movResult, catResult, evResult, yearsResult] = await Promise.all([
      query,
      supabase.from('categorias_financieras').select('*').eq('activa', true).order('nombre'),
      supabase.from('eventos').select('*').eq('activo', true).order('nombre'),
      supabase.from('movimientos').select('fecha'),
    ])

    if (movResult.error) {
      toast.error('Error al cargar movimientos')
      console.error(movResult.error)
    } else {
      setRawMovimientos(normalizeJoinResult(movResult.data as RawJoinResult[]))
    }

    if (catResult.data) setCategorias(catResult.data as CategoriaFinanciera[])
    if (evResult.data) setEventos(evResult.data as Evento[])

    // Extract available years
    if (yearsResult.data) {
      const years = new Set<number>()
      yearsResult.data.forEach(m => {
        const y = new Date(m.fecha).getFullYear()
        if (y >= 2024 && y <= 2030) years.add(y)
      })
      setAvailableYears(Array.from(years).sort((a, b) => b - a))
    }

    setLoading(false)
  }, [filters.anio, filters.categoriaId, filters.eventoId])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Computed: Finance Summary (KPIs) ───────────────────
  const summary: FinanceSummary = useMemo(() => {
    let ingresos = 0
    let egresos = 0
    rawMovimientos.forEach(m => {
      if (m.tipo === 'ingreso') ingresos += Number(m.monto)
      else egresos += Number(m.monto)
    })
    const balance = ingresos - egresos
    const gananciaPorcentual = egresos > 0 ? ((ingresos - egresos) / egresos) * 100 : 0
    return { balance, ingresos, egresos, gananciaPorcentual }
  }, [rawMovimientos])

  // ── Computed: Monthly Detail ───────────────────────────
  const monthlyDetail: MonthlyDetail[] = useMemo(() => {
    const map = new Map<string, { ingresos: number; egresos: number; mesNum: number; anio: number }>()

    rawMovimientos.forEach(m => {
      const p = m.periodo
      if (!map.has(p)) {
        const [y, mo] = p.split('-')
        map.set(p, { ingresos: 0, egresos: 0, mesNum: parseInt(mo), anio: parseInt(y) })
      }
      const entry = map.get(p)!
      if (m.tipo === 'ingreso') entry.ingresos += Number(m.monto)
      else entry.egresos += Number(m.monto)
    })

    const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

    const sorted = Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))

    let acumulado = 0
    return sorted.map(([periodo, d]) => {
      const saldo = d.ingresos - d.egresos
      acumulado += saldo
      return {
        periodo,
        mes: MESES[d.mesNum - 1],
        mesNum: d.mesNum,
        ingresos: d.ingresos,
        egresos: d.egresos,
        saldo,
        acumulado,
      }
    })
  }, [rawMovimientos])

  // ── Computed: Category Contribution ────────────────────
  const categoryContribution: CategoryContribution[] = useMemo(() => {
    const map = new Map<string, { categoriaId: string; categoria: string; tipo: string; ingresos: number; egresos: number }>()

    rawMovimientos.forEach(m => {
      const catId = m.categoria_id || 'sin-categoria'
      const catName = m.categoria?.nombre || 'Sin categoría'
      const catTipo = m.categoria?.tipo || m.tipo
      if (!map.has(catId)) {
        map.set(catId, { categoriaId: catId, categoria: catName, tipo: catTipo, ingresos: 0, egresos: 0 })
      }
      const entry = map.get(catId)!
      if (m.tipo === 'ingreso') entry.ingresos += Number(m.monto)
      else entry.egresos += Number(m.monto)
    })

    return Array.from(map.values())
      .map(d => ({
        ...d,
        tipo: d.tipo as 'ingreso' | 'egreso',
        balance: d.ingresos - d.egresos,
      }))
      .sort((a, b) => b.balance - a.balance)
  }, [rawMovimientos])

  // ── Computed: Event Summary ────────────────────────────
  const eventSummary: EventSummary[] = useMemo(() => {
    const map = new Map<string, { eventoId: string; evento: string; ingresos: number; egresos: number }>()

    rawMovimientos.forEach(m => {
      if (!m.evento_id || !m.evento) return
      const eId = m.evento_id
      if (!map.has(eId)) {
        map.set(eId, { eventoId: eId, evento: m.evento.nombre, ingresos: 0, egresos: 0 })
      }
      const entry = map.get(eId)!
      if (m.tipo === 'ingreso') entry.ingresos += Number(m.monto)
      else entry.egresos += Number(m.monto)
    })

    return Array.from(map.values())
      .map(d => ({ ...d, saldo: d.ingresos - d.egresos }))
      .sort((a, b) => b.saldo - a.saldo)
  }, [rawMovimientos])

  // ── Computed: Category Summary (for ingresos/egresos tabs) ──
  const getCategorySummary = useCallback((tipo: TipoMovimiento): CategorySummaryRow[] => {
    const filtered = rawMovimientos.filter(m => m.tipo === tipo)
    const total = filtered.reduce((sum, m) => sum + Number(m.monto), 0)

    const map = new Map<string, { categoriaId: string; categoria: string; total: number }>()
    filtered.forEach(m => {
      const catId = m.categoria_id || 'sin-categoria'
      const catName = m.categoria?.nombre || 'Sin categoría'
      if (!map.has(catId)) {
        map.set(catId, { categoriaId: catId, categoria: catName, total: 0 })
      }
      map.get(catId)!.total += Number(m.monto)
    })

    return Array.from(map.values())
      .map(d => ({
        ...d,
        porcentaje: total > 0 ? (d.total / total) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total)
  }, [rawMovimientos])

  // ── Computed: Transaction Detail ───────────────────────
  const getTransactionDetail = useCallback((tipo?: TipoMovimiento): TransactionRow[] => {
    let filtered = rawMovimientos
    if (tipo) filtered = filtered.filter(m => m.tipo === tipo)

    return filtered.map(m => ({
      id: m.id,
      fecha: m.fecha,
      descripcion: m.descripcion,
      categoria: m.categoria?.nombre || 'Sin categoría',
      categoriaId: m.categoria_id || '',
      monto: Number(m.monto),
      tipo: m.tipo as TipoMovimiento,
      evento: m.evento?.nombre,
      voluntario: m.voluntario_nombre || undefined,
      cuenta: m.cuenta?.nombre,
    }))
  }, [rawMovimientos])

  // ── Event-filtered data for ingresos/egresos by event ──
  const getEventComparison = useCallback((tipo: TipoMovimiento): EventSummary[] => {
    const map = new Map<string, { eventoId: string; evento: string; total: number }>()

    rawMovimientos.filter(m => m.tipo === tipo && m.evento_id && m.evento).forEach(m => {
      const eId = m.evento_id!
      if (!map.has(eId)) {
        map.set(eId, { eventoId: eId, evento: m.evento!.nombre, total: 0 })
      }
      map.get(eId)!.total += Number(m.monto)
    })

    return Array.from(map.values())
      .map(d => ({
        eventoId: d.eventoId,
        evento: d.evento,
        ingresos: tipo === 'ingreso' ? d.total : 0,
        egresos: tipo === 'egreso' ? d.total : 0,
        saldo: tipo === 'ingreso' ? d.total : -d.total,
      }))
      .sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo))
  }, [rawMovimientos])

  // ── Register movement (kept from original) ─────────────
  const registrarMovimiento = async (movimiento: Omit<Movimiento, 'id' | 'created_at' | 'periodo' | 'registrado_por'>) => {
    if (!user) return

    const periodo = movimiento.fecha.substring(0, 7)

    const { data, error } = await supabase
      .from('movimientos')
      .insert([{
        ...movimiento,
        periodo,
        registrado_por: user.id,
      }])
      .select()

    if (error) {
      toast.error('Error al registrar movimiento')
      throw error
    }

    await supabase.from('logs_actividad').insert([{
      usuario_id: user.id,
      accion: 'CREAR_MOVIMIENTO',
      detalle: `${movimiento.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} registrado: ${movimiento.descripcion} por ${Number(movimiento.monto).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}`,
    }])

    toast.success('Movimiento registrado correctamente')
    fetchData()
    return data[0]
  }

  return {
    // Data
    categorias,
    eventos,
    availableYears,
    loading,
    // KPIs
    summary,
    // Computed views
    monthlyDetail,
    categoryContribution,
    eventSummary,
    // Functions
    getCategorySummary,
    getTransactionDetail,
    getEventComparison,
    registrarMovimiento,
    refreshData: fetchData,
  }
}
