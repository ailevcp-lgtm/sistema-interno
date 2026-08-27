"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Socio, Cuota, EstadoSocio, EstadoCuota, Cuenta, PromocionCuota, MovimientoExtended, CuotaAplicacion } from '@/lib/types'
import { getCurrentPeriodo } from '@/lib/utils'
import { toast } from 'sonner'
import { runWithRecovery } from '@/lib/async-recovery'
import { useResumeRefresh } from '@/hooks/useResumeRefresh'

// ─── Hook: useSocios ────────────────────────────────────────────

interface SociosFilters {
  search: string
  estado: EstadoSocio | 'todos' | 'eliminado'
  rolAile: string
  sortBy: keyof Socio
  sortOrder: 'asc' | 'desc'
  page: number
}

interface SocioWithRoleDefinition extends Socio {
  rol_aile_definition?: { nombre?: string | null } | null
  membresias?: Array<NonNullable<Socio['membresia_formal']>> | null
}

export function useSocios(enabled: boolean = true) {
  const [socios, setSocios] = useState<Socio[]>([])
  const [loading, setLoading] = useState(true)
  const sociosRef = useRef<Socio[]>([])
  const [filters, setFilters] = useState<SociosFilters>({
    search: '',
    estado: 'todos',
    rolAile: 'todos',
    sortBy: 'apellido',
    sortOrder: 'asc',
    page: 1,
  })

  const pageSize = 15

  useEffect(() => {
    sociosRef.current = socios
  }, [socios])

  const fetchSocios = useCallback(async (options?: { silent?: boolean }) => {
    if (!enabled) {
      setSocios([])
      setLoading(false)
      return
    }

    const silent = options?.silent ?? false
    const hasCachedData = sociosRef.current.length > 0
    const showBlockingLoader = !silent || !hasCachedData

    try {
      if (showBlockingLoader) {
        setLoading(true)
      }
      const { data, error } = await runWithRecovery(() => supabase
        .from('socios')
        .select(`
        *,
        rol_aile_definition:rol_aile_definitions(nombre),
        membresias:asociados_membresias!asociados_membresias_socio_id_fkey(id, numero_asociado, categoria, origen, estado, fecha_inicio)
      `)
        .order('apellido', { ascending: true }), {
          label: 'socios',
        })

      if (error) {
        throw error
      }

      const normalizedSocios = ((data || []) as SocioWithRoleDefinition[]).map((s) => ({
        ...s,
        rol_aile: s.rol_aile_definition?.nombre || s.rol_aile,
        // Sólo una membresía formal activa acredita la condición de asociado actual.
        membresia_formal: s.membresias?.find((membership) => membership.estado === 'activo') || null,
      }))

      setSocios(normalizedSocios)
    } catch (error) {
      const details = error && typeof error === 'object'
        ? {
            code: 'code' in error ? String(error.code) : undefined,
            message: 'message' in error ? String(error.message) : undefined,
            details: 'details' in error ? error.details : undefined,
            hint: 'hint' in error ? error.hint : undefined,
          }
        : { message: String(error) }
      console.error('Error fetching socios:', details)
      if (showBlockingLoader) {
        toast.error('Error al cargar socios')
      }
    } finally {
      if (showBlockingLoader) {
        setLoading(false)
      }
    }
  }, [enabled])

  useEffect(() => {
    void fetchSocios()
  }, [fetchSocios])
  useResumeRefresh(() => {
    if (!enabled) return
    void fetchSocios({ silent: true })
  }, { throttleMs: 5_000 })

  const filtered = useMemo(() => {
    let result = [...socios]

    if (filters.search) {
      const q = filters.search.toLowerCase()
      result = result.filter(s =>
        `${s.nombre} ${s.apellido}`.toLowerCase().includes(q) ||
        s.dni.toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q)
      )
    }

    if (filters.estado !== 'todos') {
      result = result.filter(s => s.estado === filters.estado)
    }

    if (filters.rolAile !== 'todos') {
      result = result.filter(s => (s.rol_aile || 'Socio') === filters.rolAile)
    }

    result.sort((a, b) => {
      const key = filters.sortBy
      const aVal = a[key] ?? ''
      const bVal = b[key] ?? ''
      const cmp = String(aVal).localeCompare(String(bVal))
      return filters.sortOrder === 'asc' ? cmp : -cmp
    })

    return result
  }, [socios, filters])

  const totalPages = Math.ceil(filtered.length / pageSize)
  const paginated = filtered.slice((filters.page - 1) * pageSize, filters.page * pageSize)

  const setSearch = (search: string) => setFilters(f => ({ ...f, search, page: 1 }))
  const setEstado = (estado: EstadoSocio | 'todos' | 'eliminado') => setFilters(f => ({ ...f, estado, page: 1 }))
  const setRolAile = (rolAile: string) => setFilters(f => ({ ...f, rolAile, page: 1 }))
  const setPage = (page: number) => setFilters(f => ({ ...f, page }))
  const setSort = (sortBy: keyof Socio) => {
    setFilters(f => ({
      ...f,
      sortBy,
      sortOrder: f.sortBy === sortBy && f.sortOrder === 'asc' ? 'desc' : 'asc',
    }))
  }

  const getSocio = useCallback((id: string) => socios.find(s => s.id === id), [socios])

  const createSocio = useCallback(async (data: Omit<Socio, 'id' | 'usuario_id' | 'created_at' | 'tiene_deuda'>) => {
    const { data: newSocio, error } = await supabase
      .from('socios')
      .insert([{ ...data, tiene_deuda: false }])
      .select()
      .single()

    if (error) {
      toast.error('Error al crear la persona')
      throw error
    }

    toast.success('Persona creada correctamente')
    await fetchSocios()
    return newSocio as Socio
  }, [fetchSocios])

  const updateSocio = useCallback(async (id: string, data: Partial<Socio>) => {
    const { error } = await supabase
      .from('socios')
      .update(data)
      .eq('id', id)

    if (error) {
      toast.error('Error al actualizar la persona')
      throw error
    }

    toast.success('Socio actualizado correctamente')
    await fetchSocios()
  }, [fetchSocios])

  const toggleEstado = useCallback(async (id: string) => {
    const socio = socios.find(s => s.id === id)
    if (!socio) return

    const nuevoEstado: EstadoSocio = socio.estado === 'activo' ? 'inactivo' : 'activo'

    const { error } = await supabase
      .from('socios')
      .update({ estado: nuevoEstado })
      .eq('id', id)

    if (error) {
      toast.error('Error al cambiar el estado del vínculo')
      throw error
    }

    toast.success(`Vínculo ${nuevoEstado === 'activo' ? 'activado' : 'desactivado'}`)
    await fetchSocios()
  }, [socios, fetchSocios])

  const deleteSocio = useCallback(async (id: string) => {
    // Delete related fee_status records first (foreign key constraint)
    const { error: feeError } = await supabase
      .from('fee_status')
      .delete()
      .eq('socio_id', id)

    if (feeError) {
      console.error('Error al eliminar registros de cuotas:', feeError.message)
      toast.error(`Error al eliminar la persona: ${feeError.message}`)
      throw feeError
    }

    const { error } = await supabase
      .from('socios')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error al eliminar socio:', error.message, error.details, error.code)
      toast.error(`Error al eliminar la persona: ${error.message}`)
      throw error
    }

    toast.success('Persona eliminada correctamente')
    await fetchSocios()
  }, [fetchSocios])

  const uploadAvatar = useCallback(async (file: File, path: string) => {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${path}/${Math.random()}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (uploadError) {
        throw uploadError
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
      return data.publicUrl
    } catch (error) {
      console.error('Error uploading avatar:', error)
      toast.error('Error al subir imagen')
      throw error
    }
  }, [])

  return {
    socios: paginated,
    allSocios: socios,
    totalSocios: filtered.length,
    totalPages,
    filters,
    loading,
    setSearch,
    setEstado,
    setRolAile,
    setPage,
    setSort,
    getSocio,
    createSocio,
    updateSocio,
    toggleEstado,
    deleteSocio,
    uploadAvatar,
    refreshSocios: fetchSocios,
  }
}

// ─── Hook: useCuotas ────────────────────────────────────────────

interface CuotasFilters {
  search: string
  periodo: string
  estado: EstadoCuota | 'todos'
  sortBy: string
  sortOrder: 'asc' | 'desc'
  page: number
}

export interface PagoSocio extends MovimientoExtended {
  cuota_aplicaciones: CuotaAplicacion[]
}

function getCuotaRemainingAmount(cuota: Pick<Cuota, 'monto_esperado' | 'monto_pagado'>): number {
  const remaining = Number(cuota.monto_esperado) - Number(cuota.monto_pagado)
  return Math.max(Math.round(remaining * 100) / 100, 0)
}

export function useCuotas(socioId?: string) {
  const [cuotas, setCuotas] = useState<(Cuota & { socio?: Socio })[]>([])
  const [loading, setLoading] = useState(true)
  const cuotasRef = useRef<(Cuota & { socio?: Socio })[]>([])
  const [cuentas, setCuentas] = useState<Cuenta[]>([])
  const [promociones, setPromociones] = useState<PromocionCuota[]>([])
  const [cuotasCategoriaId, setCuotasCategoriaId] = useState<string | null>(null)
  const [pagosSocio, setPagosSocio] = useState<PagoSocio[]>([])
  const [loadingPagos, setLoadingPagos] = useState(false)
  const [filters, setFilters] = useState<CuotasFilters>({
    search: '',
    periodo: 'todos',
    estado: 'todos',
    sortBy: 'estado',
    sortOrder: 'asc',
    page: 1,
  })

  const pageSize = 20

  useEffect(() => {
    cuotasRef.current = cuotas
  }, [cuotas])

  // Fetch cuotas_categoria_id from configuracion
  const fetchConfig = useCallback(async () => {
    try {
      const { data } = await runWithRecovery(() => supabase
        .from('configuracion')
        .select('valor')
        .eq('clave', 'cuotas_categoria_id')
        .single(), {
          label: 'configuracion de cuotas',
        })
      if (data) setCuotasCategoriaId(data.valor)
    } catch (error) {
      console.error('Error fetching cuotas config:', error)
    }
  }, [])

  // Fetch cuentas activas
  const fetchCuentas = useCallback(async () => {
    try {
      const { data } = await runWithRecovery(() => supabase
        .from('cuentas')
        .select('*')
        .eq('activa', true)
        .order('nombre'), {
          label: 'cuentas activas',
        })
      if (data) setCuentas(data as Cuenta[])
    } catch (error) {
      console.error('Error fetching cuentas:', error)
    }
  }, [])

  // Fetch promociones activas
  const fetchPromociones = useCallback(async () => {
    try {
      const { data } = await runWithRecovery(() => supabase
        .from('promociones_cuotas')
        .select('*')
        .eq('activa', true)
        .order('nombre'), {
          label: 'promociones de cuotas',
        })
      if (data) setPromociones(data as PromocionCuota[])
    } catch (error) {
      console.error('Error fetching promociones:', error)
    }
  }, [])

  const fetchCuotas = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false
    const hasCachedData = cuotasRef.current.length > 0
    const showBlockingLoader = !silent || !hasCachedData

    try {
      if (showBlockingLoader) {
        setLoading(true)
      }
      let query = supabase
        .from('cuotas')
        .select('*, socio:socios(id, nombre, apellido, dni, email)')
        .order('periodo', { ascending: false })

      if (socioId) {
        query = query.eq('socio_id', socioId)
      }

      const { data, error } = await runWithRecovery(() => query, {
        label: 'cuotas',
      })

      if (error) {
        throw error
      }

      setCuotas((data || []).map((c: Record<string, unknown>) => ({
        ...c,
        socio: c.socio as Socio | undefined,
      })) as (Cuota & { socio?: Socio })[])
    } catch (error) {
      console.error('Error fetching cuotas:', error)
      if (showBlockingLoader) {
        toast.error('Error al cargar cuotas')
      }
    } finally {
      if (showBlockingLoader) {
        setLoading(false)
      }
    }
  }, [socioId])

  useEffect(() => {
    void fetchCuotas()
    void fetchConfig()
    void fetchCuentas()
    void fetchPromociones()
  }, [fetchCuotas, fetchConfig, fetchCuentas, fetchPromociones])
  useResumeRefresh(() => {
    void fetchCuotas({ silent: true })
    void fetchConfig()
    void fetchCuentas()
    void fetchPromociones()
  }, { throttleMs: 5_000 })

  const filtered = useMemo(() => {
    let result = [...cuotas]

    if (filters.search) {
      const q = filters.search.toLowerCase()
      result = result.filter(c =>
        `${c.socio?.nombre} ${c.socio?.apellido}`.toLowerCase().includes(q)
      )
    }

    if (filters.periodo !== 'todos') {
      result = result.filter(c => c.periodo === filters.periodo)
    }

    if (filters.estado !== 'todos') {
      result = result.filter(c => c.estado === filters.estado)
    }

    // Sort: vencidas first by default
    const estadoOrder: Record<string, number> = { vencida: 0, pendiente: 1, parcial: 2, pagada: 3 }
    if (filters.sortBy === 'estado') {
      result.sort((a, b) => {
        const cmp = (estadoOrder[a.estado] ?? 9) - (estadoOrder[b.estado] ?? 9)
        return filters.sortOrder === 'asc' ? cmp : -cmp
      })
    }

    return result
  }, [cuotas, filters])

  const totalPages = Math.ceil(filtered.length / pageSize)
  const paginated = filtered.slice((filters.page - 1) * pageSize, filters.page * pageSize)

  // Summary stats
  const summary = useMemo(() => {
    const relevant = filtered
    const pagadas = relevant.filter(c => c.estado === 'pagada')
    const pendientes = relevant.filter(c => c.estado === 'pendiente' || c.estado === 'parcial')
    const vencidas = relevant.filter(c => c.estado === 'vencida')

    const totalRecaudado = pagadas.reduce((sum, c) => sum + c.monto_pagado, 0) +
      relevant.filter(c => c.estado === 'parcial').reduce((sum, c) => sum + c.monto_pagado, 0)
    const totalPendiente = pendientes.reduce((sum, c) => sum + getCuotaRemainingAmount(c), 0)
    const totalVencido = vencidas.reduce((sum, c) => sum + getCuotaRemainingAmount(c), 0)
    const totalEsperado = relevant.reduce((sum, c) => sum + c.monto_esperado, 0)
    const porcentajeCobranza = totalEsperado > 0 ? Math.round((totalRecaudado / totalEsperado) * 100) : 0

    return {
      pagadas: pagadas.length,
      pendientes: pendientes.length,
      vencidas: vencidas.length,
      totalRecaudado,
      totalPendiente,
      totalVencido,
      porcentajeCobranza,
    }
  }, [filtered])

  // Available periodos for filter
  const periodos = useMemo(() => {
    const set = new Set(cuotas.map(c => c.periodo))
    return Array.from(set).sort().reverse()
  }, [cuotas])

  const setSearch = (search: string) => setFilters(f => ({ ...f, search, page: 1 }))
  const setPeriodo = (periodo: string) => setFilters(f => ({ ...f, periodo, page: 1 }))
  const setEstado = (estado: EstadoCuota | 'todos') => setFilters(f => ({ ...f, estado, page: 1 }))
  const setPage = (page: number) => setFilters(f => ({ ...f, page }))

  // ── Nuevo flujo: registrar pago de cuotas como movimiento ──

  const registrarPagoCuotas = useCallback(async (
    socioId: string,
    cuotaIds: string[],
    cuentaId: string,
    fecha: string,
    promocionId?: string,
    notas?: string,
  ) => {
    if (!cuotasCategoriaId) {
      toast.error('No se encontró la categoría de cuotas. Contacte al administrador.')
      return
    }

    // 1. Obtener cuotas seleccionadas
    const cuotasSeleccionadas = cuotas
      .filter(c => c.socio_id === socioId && cuotaIds.includes(c.id))
      .map((cuota) => ({
        ...cuota,
        monto_restante: getCuotaRemainingAmount(cuota),
      }))

    if (cuotasSeleccionadas.length === 0) {
      toast.error('No se seleccionaron cuotas')
      return
    }

    const cuotasSinSaldo = cuotasSeleccionadas.filter((cuota) => cuota.monto_restante <= 0)
    if (cuotasSinSaldo.length > 0) {
      toast.error('Hay cuotas seleccionadas que ya no tienen saldo pendiente')
      return
    }

    const subtotal = cuotasSeleccionadas.reduce((sum, c) => sum + c.monto_restante, 0)

    // 2. Si hay promoción, calcular descuento
    let descuento = 0
    let promoSnapshot: Record<string, unknown> = {}
    if (promocionId) {
      const promo = promociones.find(p => p.id === promocionId)
      if (promo) {
        if (promo.tipo === 'percent') {
          descuento = subtotal * (promo.valor / 100)
        } else {
          descuento = promo.valor
        }
        promoSnapshot = {
          nombre: promo.nombre,
          tipo: promo.tipo,
          valor: promo.valor,
          meses_aplicados: cuotasSeleccionadas.length,
        }
      }
    }

    // 3. Calcular total
    const total = Math.max(subtotal - descuento, 0)

    // 4. Construir descripción
    const periodosList = cuotasSeleccionadas.map(c => c.periodo).join(', ')
    const socio = cuotasSeleccionadas[0]?.socio
    const socioNombre = socio ? `${socio.nombre} ${socio.apellido}` : 'Socio'
    const descripcion = notas
      ? `Pago cuotas ${socioNombre}: ${periodosList}. ${notas}`
      : `Pago cuotas ${socioNombre}: ${periodosList}`

    let movimientoId: string | null = null
    let errorMessage = 'Error al registrar el pago de cuotas'

    const rollbackPago = async () => {
      if (!movimientoId) return

      const cleanupSteps = await Promise.all([
        supabase.from('movimiento_promocion_cuotas').delete().eq('movimiento_id', movimientoId),
        supabase.from('cuota_aplicaciones').delete().eq('movimiento_id', movimientoId),
        supabase.from('movimientos').delete().eq('id', movimientoId),
      ])

      cleanupSteps.forEach((result, index) => {
        if (result.error) {
          console.error(`Error cleaning payment step ${index + 1}:`, result.error)
        }
      })
    }

    try {
      // 5. INSERT movimiento
      const { data: movimiento, error: movError } = await supabase
        .from('movimientos')
        .insert({
          tipo: 'ingreso',
          categoria_id: cuotasCategoriaId,
          cuenta_id: cuentaId,
          monto: total,
          fecha,
          descripcion,
          socio_id: socioId,
          periodo: cuotasSeleccionadas[0]?.periodo || '',
          anulado: false,
        })
        .select()
        .single()

      if (movError || !movimiento) {
        console.error('Error creating movimiento:', movError)
        errorMessage = 'Error al crear el movimiento de pago'
        throw movError || new Error('No se pudo crear el movimiento')
      }

      movimientoId = movimiento.id

      // 6. INSERT cuota_aplicaciones
      const aplicaciones = cuotasSeleccionadas.map(c => ({
        movimiento_id: movimiento.id,
        cuota_id: c.id,
        monto_aplicado: c.monto_restante,
      }))

      const { error: appError } = await supabase
        .from('cuota_aplicaciones')
        .insert(aplicaciones)

      if (appError) {
        console.error('Error creating cuota_aplicaciones:', appError)
        errorMessage = 'Error al aplicar el pago a las cuotas seleccionadas'
        throw appError
      }

      // 7. Si hay promo, INSERT movimiento_promocion_cuotas
      if (promocionId && descuento > 0) {
        const { error: promoError } = await supabase
          .from('movimiento_promocion_cuotas')
          .insert({
            movimiento_id: movimiento.id,
            promocion_id: promocionId,
            descuento_monto: descuento,
            snapshot: promoSnapshot,
          })

        if (promoError) {
          console.error('Error creating movimiento_promocion:', promoError)
          errorMessage = 'Error al registrar el descuento promocional'
          throw promoError
        }
      }

      toast.success('Pago registrado correctamente')
      await fetchCuotas()
    } catch (error) {
      await rollbackPago()
      toast.error(errorMessage)
      throw error
    }
  }, [cuotas, cuotasCategoriaId, promociones, fetchCuotas])

  // ── Anular pago (soft-delete) ──

  const anularPago = useCallback(async (movimientoId: string, motivo: string, userId: string) => {
    const { error } = await supabase
      .from('movimientos')
      .update({
        anulado: true,
        anulado_at: new Date().toISOString(),
        anulado_por: userId,
        anulado_motivo: motivo,
      })
      .eq('id', movimientoId)

    if (error) {
      console.error('Error al anular pago:', error)
      toast.error('Error al anular el pago')
      throw error
    }

    toast.success('Pago anulado correctamente')
    await fetchCuotas()
  }, [fetchCuotas])

  // ── Fetch pagos de un socio ──

  const fetchPagosSocio = useCallback(async (sid: string) => {
    if (!cuotasCategoriaId) return

    try {
      setLoadingPagos(true)
      const { data, error } = await runWithRecovery(() => supabase
        .from('movimientos')
        .select('*, cuenta:cuentas(id, nombre, tipo), cuota_aplicaciones:cuota_aplicaciones(id, cuota_id, monto_aplicado, cuota:cuotas(id, periodo, monto_esperado))')
        .eq('socio_id', sid)
        .eq('categoria_id', cuotasCategoriaId)
        .order('fecha', { ascending: false }), {
          label: 'pagos de socio',
        })

      if (error) {
        throw error
      }
      setPagosSocio((data || []) as unknown as PagoSocio[])
    } catch (error) {
      console.error('Error fetching pagos socio:', error)
    } finally {
      setLoadingPagos(false)
    }
  }, [cuotasCategoriaId])

  // Get cuotas pendientes for a specific socio
  const getCuotasPendientes = useCallback((sid: string) => {
    return cuotas.filter(c => c.socio_id === sid && (c.estado === 'pendiente' || c.estado === 'vencida' || c.estado === 'parcial'))
  }, [cuotas])

  // Export to CSV
  const exportCSV = useCallback(() => {
    const headers = ['Socio', 'Período', 'Monto Esperado', 'Monto Pagado', 'Estado', 'Fecha de Pago']
    const rows = filtered.map(c => [
      `${c.socio?.nombre} ${c.socio?.apellido}`,
      c.periodo,
      c.monto_esperado,
      c.monto_pagado,
      c.estado,
      c.fecha_pago || '-',
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `aile_cuotas_${getCurrentPeriodo()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [filtered])

  // ── CRUD Promociones ──

  const createPromocion = useCallback(async (data: Omit<PromocionCuota, 'id' | 'created_at'>) => {
    const { error } = await supabase
      .from('promociones_cuotas')
      .insert(data)

    if (error) {
      toast.error('Error al crear promoción')
      throw error
    }

    toast.success('Promoción creada correctamente')
    await fetchPromociones()
  }, [fetchPromociones])

  const updatePromocion = useCallback(async (id: string, data: Partial<PromocionCuota>) => {
    const { error } = await supabase
      .from('promociones_cuotas')
      .update(data)
      .eq('id', id)

    if (error) {
      toast.error('Error al actualizar promoción')
      throw error
    }

    toast.success('Promoción actualizada correctamente')
    await fetchPromociones()
  }, [fetchPromociones])

  const deletePromocion = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('promociones_cuotas')
      .delete()
      .eq('id', id)

    if (error) {
      toast.error('Error al eliminar promoción')
      throw error
    }

    toast.success('Promoción eliminada correctamente')
    await fetchPromociones()
  }, [fetchPromociones])

  // Fetch all promos (including inactive) for management
  const fetchAllPromociones = useCallback(async () => {
    const { data } = await runWithRecovery(() => supabase
      .from('promociones_cuotas')
      .select('*')
      .order('nombre'), {
        label: 'todas las promociones',
      })
    return (data || []) as PromocionCuota[]
  }, [])

  return {
    cuotas: paginated,
    allCuotas: filtered,
    totalCuotas: filtered.length,
    totalPages,
    summary,
    periodos,
    filters,
    loading,
    cuentas,
    promociones,
    cuotasCategoriaId,
    pagosSocio,
    loadingPagos,
    setSearch,
    setPeriodo,
    setEstado,
    setPage,
    registrarPagoCuotas,
    anularPago,
    fetchPagosSocio,
    getCuotasPendientes,
    exportCSV,
    refreshCuotas: fetchCuotas,
    createPromocion,
    updatePromocion,
    deletePromocion,
    fetchAllPromociones,
  }
}
