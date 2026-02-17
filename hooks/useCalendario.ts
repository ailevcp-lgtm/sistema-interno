import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { runWithRecovery } from '@/lib/async-recovery'
import { useResumeRefresh } from '@/hooks/useResumeRefresh'
import type {
  CalendarioAlcanceReunion,
  ReunionCalendario,
  ReunionCalendarioParticipante,
  SocioCalendario,
} from '@/lib/types'

interface SocioCalendarioRow {
  id: string
  usuario_id: string
  nombre: string
  apellido: string
  email?: string | null
  rol: SocioCalendario['rol']
  rol_aile?: string | null
  rol_aile_definition?: {
    nombre?: string | null
  } | null
}

interface SupabaseErrorLike {
  code?: string
  message?: string
  details?: string
  hint?: string
  error_description?: string
}

export interface CrearReunionPayload {
  titulo: string
  descripcion?: string
  lugar?: string
  fechaInicio: string
  fechaFin: string
  alcance: CalendarioAlcanceReunion
  involucrados?: string[]
  invitados?: string[]
}

export interface ActualizarReunionPayload extends CrearReunionPayload {
  reunionId: string
}

function normalizeSocio(row: SocioCalendarioRow): SocioCalendario {
  return {
    id: row.id,
    usuario_id: row.usuario_id,
    nombre: row.nombre,
    apellido: row.apellido,
    email: row.email ?? null,
    rol: row.rol,
    rol_aile: row.rol_aile_definition?.nombre || row.rol_aile || null,
  }
}

function toErrorDetails(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === 'object' && error) {
    const maybe = error as SupabaseErrorLike

    const chunks = [
      maybe.code,
      maybe.message,
      maybe.details,
      maybe.hint,
      maybe.error_description,
    ].filter(Boolean)

    if (chunks.length > 0) return chunks.join(' | ')
  }

  return 'Error desconocido'
}

function isCalendarSchemaMissing(error: unknown): boolean {
  const maybe = (typeof error === 'object' && error ? error as SupabaseErrorLike : null)
  const code = (maybe?.code || '').toUpperCase()

  // Códigos inequívocos de objeto inexistente en Postgres/PostgREST.
  if (code === 'PGRST205' || code === '42P01' || code === '42883') {
    return true
  }

  const details = toErrorDetails(error).toLowerCase()
  if (!details) return false

  return (
    details.includes("could not find the table 'public.reuniones_calendario'") ||
    details.includes('relation "reuniones_calendario" does not exist') ||
    details.includes('function public.rpc_calendar_schedule_meeting')
  )
}

function isCalendarRlsRecursion(error: unknown): boolean {
  const maybe = (typeof error === 'object' && error ? error as SupabaseErrorLike : null)
  const code = (maybe?.code || '').toUpperCase()
  if (code === '42P17') return true

  return toErrorDetails(error).toLowerCase().includes(
    'infinite recursion detected in policy for relation "reuniones_calendario"'
  )
}

export function useCalendario() {
  const { user, hasPermission } = useAuth()
  const userId = user?.id
  const [reuniones, setReuniones] = useState<ReunionCalendario[]>([])
  const [sociosDisponibles, setSociosDisponibles] = useState<SocioCalendario[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [calendarAvailable, setCalendarAvailable] = useState(true)
  const missingSchemaNotifiedRef = useRef(false)

  const canSchedule = hasPermission('calendario', 'crear')

  const retryCalendarCheck = useCallback(() => {
    setCalendarAvailable(true)
    missingSchemaNotifiedRef.current = false
  }, [])

  const fetchReuniones = useCallback(async () => {
    if (!userId || !calendarAvailable) {
      setReuniones([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { data: reunionesData, error: reunionesError } = await runWithRecovery(
        () => supabase
          .from('reuniones_calendario')
          .select('*')
          .order('fecha_inicio', { ascending: true }),
        { label: 'calendario reuniones' }
      )

      if (reunionesError) throw reunionesError

      const reunionesRows = (reunionesData || []) as ReunionCalendario[]
      if (reunionesRows.length === 0) {
        setReuniones([])
        return
      }

      const reunionIds = reunionesRows.map((r) => r.id)
      const { data: participantesData, error: participantesError } = await runWithRecovery(
        () => supabase
          .from('reuniones_calendario_participantes')
          .select('*')
          .in('reunion_id', reunionIds),
        { label: 'calendario participantes' }
      )

      if (participantesError) throw participantesError

      const participantesRows = (participantesData || []) as ReunionCalendarioParticipante[]
      const usuarioIds = Array.from(
        new Set(participantesRows.map((p) => p.usuario_id).filter(Boolean))
      )

      const sociosPorUsuario = new Map<string, SocioCalendario>()
      if (usuarioIds.length > 0) {
        const { data: sociosData, error: sociosError } = await runWithRecovery(
          () => supabase
            .from('socios')
            .select('id, usuario_id, nombre, apellido, email, rol, rol_aile, rol_aile_definition:rol_aile_definitions(nombre)')
            .in('usuario_id', usuarioIds),
          { label: 'calendario socios de participantes' }
        )

        if (sociosError) throw sociosError

        for (const row of (sociosData || []) as SocioCalendarioRow[]) {
          sociosPorUsuario.set(row.usuario_id, normalizeSocio(row))
        }
      }

      const participantesPorReunion: Record<string, ReunionCalendarioParticipante[]> = {}
      for (const participante of participantesRows) {
        const mapped: ReunionCalendarioParticipante = {
          ...participante,
          socio: sociosPorUsuario.get(participante.usuario_id),
        }

        if (!participantesPorReunion[participante.reunion_id]) {
          participantesPorReunion[participante.reunion_id] = []
        }

        participantesPorReunion[participante.reunion_id].push(mapped)
      }

      const reunionesConParticipantes: ReunionCalendario[] = reunionesRows.map((reunion) => ({
        ...reunion,
        participantes: participantesPorReunion[reunion.id] || [],
      }))

      setReuniones(reunionesConParticipantes)
    } catch (error) {
      if (isCalendarSchemaMissing(error)) {
        setCalendarAvailable(false)
        setReuniones([])

        if (!missingSchemaNotifiedRef.current) {
          missingSchemaNotifiedRef.current = true
          toast.error('Calendario no habilitado en base de datos. Ejecuta la migración 024_calendar_module.sql.')
        }

        console.warn('Calendar module unavailable:', {
          raw: error,
          parsed: toErrorDetails(error),
        })
        return
      }

      if (isCalendarRlsRecursion(error)) {
        toast.error('Políticas de calendario desactualizadas. Ejecuta la migración 025_fix_calendar_rls_recursion.sql.')
        console.warn('Calendar RLS recursion detected:', {
          raw: error,
          parsed: toErrorDetails(error),
        })
        return
      }

      console.error('Error fetching calendario meetings:', toErrorDetails(error))
      toast.error('No se pudo cargar el calendario')
    } finally {
      setLoading(false)
    }
  }, [calendarAvailable, userId])

  const fetchSociosDisponibles = useCallback(async () => {
    if (!canSchedule || !calendarAvailable) {
      setSociosDisponibles([])
      return
    }

    try {
      const { data, error } = await runWithRecovery(
        () => supabase
          .from('socios')
          .select('id, usuario_id, nombre, apellido, email, rol, rol_aile, rol_aile_definition:rol_aile_definitions(nombre)')
          .eq('estado', 'activo')
          .not('usuario_id', 'is', null)
          .order('apellido', { ascending: true }),
        { label: 'calendario socios activos' }
      )

      if (error) throw error

      setSociosDisponibles(((data || []) as SocioCalendarioRow[]).map(normalizeSocio))
    } catch (error) {
      console.error('Error fetching calendar users:', toErrorDetails(error))
      toast.error('No se pudo cargar la lista de usuarios para invitar')
    }
  }, [calendarAvailable, canSchedule])

  useEffect(() => {
    void fetchReuniones()
  }, [fetchReuniones])

  useEffect(() => {
    void fetchSociosDisponibles()
  }, [fetchSociosDisponibles])

  useResumeRefresh(() => {
    if (!calendarAvailable) return
    void fetchReuniones()
  }, { throttleMs: 5_000 })

  useEffect(() => {
    if (!userId || !calendarAvailable) return

    const channel = supabase
      .channel(`calendar-realtime-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reuniones_calendario' },
        () => {
          void fetchReuniones()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reuniones_calendario_participantes' },
        () => {
          void fetchReuniones()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [calendarAvailable, userId, fetchReuniones])

  const crearReunion = useCallback(async (payload: CrearReunionPayload) => {
    if (!calendarAvailable) {
      const err = new Error('Calendario no habilitado en base de datos. Ejecuta la migración 024_calendar_module.sql.')
      toast.error(err.message)
      throw err
    }

    if (!canSchedule) {
      const err = new Error('No tienes permisos para agendar reuniones')
      toast.error(err.message)
      throw err
    }

    const involucrados = Array.from(new Set((payload.involucrados || []).filter(Boolean)))
    const invitados = Array.from(
      new Set((payload.invitados || []).filter((usuarioId) => !involucrados.includes(usuarioId)))
    )

    try {
      setCreating(true)
      const { data, error } = await supabase.rpc('rpc_calendar_schedule_meeting', {
        p_titulo: payload.titulo,
        p_descripcion: payload.descripcion || null,
        p_lugar: payload.lugar || null,
        p_fecha_inicio: payload.fechaInicio,
        p_fecha_fin: payload.fechaFin,
        p_alcance: payload.alcance,
        p_usuario_ids_involucrados: involucrados,
        p_usuario_ids_invitados: invitados,
      })

      if (error) throw error

      toast.success('Reunión agendada y notificaciones enviadas')
      await fetchReuniones()

      return (Array.isArray(data) ? data[0] : data) as ReunionCalendario
    } catch (error) {
      console.error('Error scheduling meeting:', toErrorDetails(error))
      toast.error(toErrorDetails(error) || 'No se pudo agendar la reunión')
      throw error
    } finally {
      setCreating(false)
    }
  }, [calendarAvailable, canSchedule, fetchReuniones])

  const actualizarReunion = useCallback(async (payload: ActualizarReunionPayload) => {
    if (!calendarAvailable) {
      const err = new Error('Calendario no habilitado en base de datos. Ejecuta la migración 024_calendar_module.sql.')
      toast.error(err.message)
      throw err
    }

    if (!canSchedule) {
      const err = new Error('No tienes permisos para editar reuniones')
      toast.error(err.message)
      throw err
    }

    const involucrados = Array.from(new Set((payload.involucrados || []).filter(Boolean)))
    const invitados = Array.from(
      new Set((payload.invitados || []).filter((usuarioId) => !involucrados.includes(usuarioId)))
    )

    try {
      setUpdating(true)
      const { data, error } = await supabase.rpc('rpc_calendar_update_meeting', {
        p_reunion_id: payload.reunionId,
        p_titulo: payload.titulo,
        p_descripcion: payload.descripcion || null,
        p_lugar: payload.lugar || null,
        p_fecha_inicio: payload.fechaInicio,
        p_fecha_fin: payload.fechaFin,
        p_alcance: payload.alcance,
        p_usuario_ids_involucrados: involucrados,
        p_usuario_ids_invitados: invitados,
      })

      if (error) throw error

      toast.success('Reunión actualizada correctamente')
      await fetchReuniones()

      return (Array.isArray(data) ? data[0] : data) as ReunionCalendario
    } catch (error) {
      console.error('Error updating meeting:', toErrorDetails(error))
      toast.error(toErrorDetails(error) || 'No se pudo actualizar la reunión')
      throw error
    } finally {
      setUpdating(false)
    }
  }, [calendarAvailable, canSchedule, fetchReuniones])

  return {
    reuniones,
    sociosDisponibles,
    loading,
    creating,
    updating,
    calendarAvailable,
    canSchedule,
    retryCalendarCheck,
    fetchReuniones,
    crearReunion,
    actualizarReunion,
  }
}
