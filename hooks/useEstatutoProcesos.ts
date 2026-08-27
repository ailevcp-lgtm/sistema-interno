"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { runWithRecovery } from '@/lib/async-recovery'
import { useResumeRefresh } from '@/hooks/useResumeRefresh'
import type {
  AsambleaEstatutaria,
  EstadoAsambleaEstatutaria,
  ListaElectoralEstatutaria,
  PadronAsambleaEstatutaria,
  ProcesoDisciplinarioEstatutario,
  ProtocoloMenorEstatutario,
  RemocionAutoridadEstatutaria,
  SocioEstatutario,
  TipoAsambleaEstatutaria,
  ModalidadAsambleaEstatutaria,
} from '@/lib/types'

const ASAMBLEAS_ABIERTAS: EstadoAsambleaEstatutaria[] = ['borrador', 'convocada', 'en_curso']
const PROCESOS_ACTIVOS = ['borrador', 'notificado', 'descargo_recibido', 'pendiente_resolucion', 'apelado']
const MENORES_PENDIENTES = ['pendiente', 'vencido']

export interface EstatutoProcesosSummary {
  totalSocios: number
  sociosConVoto: number
  requierenNotificacion: number
  sociosMenoresDetectados: number
  asambleasAbiertas: number
  listasActivas: number
  procesosActivos: number
  remocionesActivas: number
  protocolosPendientes: number
}

export interface CreateAsambleaPayload {
  tipo: TipoAsambleaEstatutaria
  titulo: string
  fecha?: string | null
  lugar?: string | null
  modalidad: ModalidadAsambleaEstatutaria
  convocatoria_fecha?: string | null
  publicacion_boletin_fecha?: string | null
  notificacion_socios_fecha?: string | null
  documentacion_disponible_fecha?: string | null
  cierre_ejercicio?: string | null
  orden_dia?: string | null
  notas?: string | null
}

function activeCount<T extends { estado: string }>(rows: T[], activeStates: string[]): number {
  return rows.filter((row) => activeStates.includes(row.estado)).length
}

export function useEstatutoProcesos(enabled = true) {
  const [loading, setLoading] = useState(true)
  const [sociosEstatutarios, setSociosEstatutarios] = useState<SocioEstatutario[]>([])
  const [asambleas, setAsambleas] = useState<AsambleaEstatutaria[]>([])
  const [listas, setListas] = useState<ListaElectoralEstatutaria[]>([])
  const [procesos, setProcesos] = useState<ProcesoDisciplinarioEstatutario[]>([])
  const [remociones, setRemociones] = useState<RemocionAutoridadEstatutaria[]>([])
  const [menores, setMenores] = useState<ProtocoloMenorEstatutario[]>([])
  const [padron, setPadron] = useState<PadronAsambleaEstatutaria[]>([])
  const [loadingPadron, setLoadingPadron] = useState(false)

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    if (!enabled) {
      setLoading(false)
      return
    }

    const silent = options?.silent ?? false
    try {
      if (!silent) setLoading(true)

      const [
        sociosResult,
        asambleasResult,
        listasResult,
        procesosResult,
        remocionesResult,
        menoresResult,
      ] = await Promise.all([
        runWithRecovery(() => supabase
          .from('socios_estatutarios')
          .select('*')
          .neq('estado', 'eliminado'), {
          label: 'socios estatutarios',
        }),
        runWithRecovery(() => supabase
          .from('estatuto_asambleas')
          .select('*')
          .order('fecha', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false }), {
          label: 'asambleas estatutarias',
        }),
        runWithRecovery(() => supabase
          .from('estatuto_listas_electorales')
          .select('*')
          .order('created_at', { ascending: false }), {
          label: 'listas electorales',
        }),
        runWithRecovery(() => supabase
          .from('estatuto_procesos_disciplinarios')
          .select('*, socio:socios!estatuto_procesos_disciplinarios_socio_id_fkey(id, nombre, apellido, dni, email)')
          .order('created_at', { ascending: false }), {
          label: 'procesos disciplinarios',
        }),
        runWithRecovery(() => supabase
          .from('estatuto_remociones_autoridades')
          .select('*, socio:socios!estatuto_remociones_autoridades_socio_id_fkey(id, nombre, apellido, dni, email)')
          .order('created_at', { ascending: false }), {
          label: 'remociones estatutarias',
        }),
        runWithRecovery(() => supabase
          .from('estatuto_socios_menores')
          .select('*, socio:socios!estatuto_socios_menores_socio_id_fkey(id, nombre, apellido, dni, email, fecha_nacimiento)')
          .order('created_at', { ascending: false }), {
          label: 'protocolos de menores',
        }),
      ])

      if (sociosResult.error) throw sociosResult.error
      if (asambleasResult.error) throw asambleasResult.error
      if (listasResult.error) throw listasResult.error
      if (procesosResult.error) throw procesosResult.error
      if (remocionesResult.error) throw remocionesResult.error
      if (menoresResult.error) throw menoresResult.error

      setSociosEstatutarios((sociosResult.data || []) as SocioEstatutario[])
      setAsambleas((asambleasResult.data || []) as AsambleaEstatutaria[])
      setListas((listasResult.data || []) as ListaElectoralEstatutaria[])
      setProcesos((procesosResult.data || []) as ProcesoDisciplinarioEstatutario[])
      setRemociones((remocionesResult.data || []) as RemocionAutoridadEstatutaria[])
      setMenores((menoresResult.data || []) as ProtocoloMenorEstatutario[])
    } catch (error) {
      console.error('Error al cargar procesos estatutarios:', error)
      if (!silent) toast.error('Error al cargar procesos estatutarios')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useResumeRefresh(() => {
    void refresh({ silent: true })
  }, { throttleMs: 5_000 })

  const loadPadron = useCallback(async (asambleaId: string) => {
    try {
      setLoadingPadron(true)
      const { data, error } = await runWithRecovery(() => supabase
        .from('estatuto_asamblea_padron')
        .select('*')
        .eq('asamblea_id', asambleaId)
        .order('socio_apellido', { ascending: true })
        .order('socio_nombre', { ascending: true }), {
        label: 'padron de asamblea',
      })

      if (error) throw error
      setPadron((data || []) as PadronAsambleaEstatutaria[])
    } catch (error) {
      console.error('Error al cargar padron:', error)
      toast.error('Error al cargar padrón')
      setPadron([])
    } finally {
      setLoadingPadron(false)
    }
  }, [])

  const createAsamblea = useCallback(async (
    payload: CreateAsambleaPayload,
    createdBySocioId?: string | null
  ) => {
    const { data, error } = await supabase
      .from('estatuto_asambleas')
      .insert([{
        ...payload,
        created_by_socio_id: createdBySocioId || null,
      }])
      .select()
      .single()

    if (error) {
      toast.error('Error al crear asamblea')
      throw error
    }

    toast.success('Asamblea creada')
    await refresh({ silent: true })
    return data as AsambleaEstatutaria
  }, [refresh])

  const generarPadron = useCallback(async (asambleaId: string) => {
    const { data, error } = await supabase.rpc('fn_estatuto_generar_padron', {
      p_asamblea_id: asambleaId,
    })

    if (error) {
      toast.error('Error al generar padrón')
      throw error
    }

    const affectedRows = Number(data || 0)
    toast.success(`Padrón actualizado: ${affectedRows} registros`)
    await loadPadron(asambleaId)
    return affectedRows
  }, [loadPadron])

  const summary = useMemo<EstatutoProcesosSummary>(() => {
    return {
      totalSocios: sociosEstatutarios.length,
      sociosConVoto: sociosEstatutarios.filter((socio) => socio.puede_votar).length,
      requierenNotificacion: sociosEstatutarios.filter((socio) => socio.requiere_notificacion_morosidad).length,
      sociosMenoresDetectados: sociosEstatutarios.filter((socio) => typeof socio.edad === 'number' && socio.edad < 18).length,
      asambleasAbiertas: activeCount(asambleas, ASAMBLEAS_ABIERTAS),
      listasActivas: activeCount(listas, ['borrador', 'presentada', 'observada', 'aprobada']),
      procesosActivos: activeCount(procesos, PROCESOS_ACTIVOS),
      remocionesActivas: activeCount(remociones, PROCESOS_ACTIVOS),
      protocolosPendientes: activeCount(menores, MENORES_PENDIENTES),
    }
  }, [asambleas, listas, menores, procesos, remociones, sociosEstatutarios])

  return {
    loading,
    loadingPadron,
    sociosEstatutarios,
    asambleas,
    listas,
    procesos,
    remociones,
    menores,
    padron,
    summary,
    refresh,
    loadPadron,
    createAsamblea,
    generarPadron,
  }
}
