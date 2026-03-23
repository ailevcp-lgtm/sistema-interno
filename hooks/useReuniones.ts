'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { runWithRecovery } from '@/lib/async-recovery'
import { useResumeRefresh } from '@/hooks/useResumeRefresh'
import { normalizeInstitutionalRole } from '@/lib/constants'
import { sendEmailNotificationFromClient } from '@/lib/email/client'
import type {
  DireccionBase,
  EstadoReunionDireccion,
  ReunionDireccion,
  ReunionDireccionAsistente,
  Socio,
} from '@/lib/types'

// ── Helpers de dirección ────────────────────────────────────

function normalizeText(raw?: string | null): string {
  return (raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function directionFromRoleName(raw?: string | null): DireccionBase | null {
  const n = normalizeText(raw)
  if (!n) return null
  if (n.includes('comunic')) return 'Comunicación'
  if (n.includes('finanza')) return 'Finanzas'
  if (n.includes('rrhh') || n.includes('recurso')) return 'Recursos Humanos'
  if (n.includes('cea') || n.includes('sec')) return 'CEA'
  return null
}

export function isDirectorRole(rolAile?: string | null): boolean {
  return normalizeText(rolAile).includes('director')
}

// ── Payloads ────────────────────────────────────────────────

export interface CrearReunionDireccionPayload {
  titulo: string
  descripcion?: string
  direccion: DireccionBase
  fechaInicio: string
  fechaFin: string
  lugar?: string
  /** IDs de usuario (auth.uid) para sincronizar con el calendario */
  usuarioIdsInvolucrados?: string[]
  /** Si true, también crea una tarea en el tablero de la dirección */
  crearTarea?: boolean
}

export interface RegistrarAsistenciaPayload {
  reunionId: string
  /** Array de IDs de socios que asistieron */
  socioIds: string[]
}

export interface EditarReunionPayload {
  titulo: string
  descripcion?: string
  fechaInicio: string
  fechaFin: string
  lugar?: string
  usuarioIdsInvolucrados?: string[]
}

export interface CargarHistoricaPayload {
  /** Opcional: si no se pasa, se genera automáticamente */
  titulo?: string
  descripcion?: string
  direccion: DireccionBase
  /** ISO date string YYYY-MM-DD o datetime */
  fecha: string
  lugar?: string
  socioIds: string[]
}

export interface FrecuenciaDireccion {
  direccion: DireccionBase
  ultimaReunion: string | null
  diasSinReunion: number | null
  totalReuniones: number
  enAlerta: boolean // más de 14 días sin reunión
}

export interface EstadisticaAsistencia {
  socioId: string
  nombre: string
  apellido: string
  rolAile: string | null
  direccion: DireccionBase | null
  totalAsistencias: number
  ultimaAsistencia: string | null
  /** Reuniones por dirección: { [dir]: count } */
  porDireccion: Partial<Record<DireccionBase, number>>
}

export interface EstadisticaDireccion {
  direccion: DireccionBase
  totalReuniones: number
  totalAsistencias: number
  promedioAsistentes: number
  miembrosUnicos: number
}

// ── Tipos internos de BD ────────────────────────────────────

interface ReunionRow {
  id: string
  titulo: string
  descripcion: string | null
  direccion: string
  fecha_inicio: string
  fecha_fin: string
  lugar: string | null
  creado_por_socio_id: string | null
  estado: string
  asistencia_registrada: boolean
  calendario_reunion_id: string | null
  created_at: string
  updated_at: string
  creado_por?: {
    id: string
    nombre: string
    apellido: string
    email: string
    rol_aile?: string | null
  } | null
  asistentes?: AsistenteRow[]
}

interface AsistenteRow {
  id: string
  reunion_id: string
  socio_id: string
  registrado_por_socio_id: string | null
  created_at: string
  socio?: {
    id: string
    nombre: string
    apellido: string
    email: string
    rol_aile?: string | null
  } | null
}

function normalizeReunion(row: ReunionRow): ReunionDireccion {
  return {
    id: row.id,
    titulo: row.titulo,
    descripcion: row.descripcion,
    direccion: row.direccion as DireccionBase,
    fecha_inicio: row.fecha_inicio,
    fecha_fin: row.fecha_fin,
    lugar: row.lugar,
    creado_por_socio_id: row.creado_por_socio_id,
    estado: row.estado as EstadoReunionDireccion,
    asistencia_registrada: row.asistencia_registrada,
    calendario_reunion_id: row.calendario_reunion_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    creado_por: row.creado_por
      ? ({
          id: row.creado_por.id,
          nombre: row.creado_por.nombre,
          apellido: row.creado_por.apellido,
          email: row.creado_por.email,
          rol_aile: row.creado_por.rol_aile,
        } as unknown as Socio)
      : undefined,
    asistentes: (row.asistentes || []).map(
      (a): ReunionDireccionAsistente => ({
        id: a.id,
        reunion_id: a.reunion_id,
        socio_id: a.socio_id,
        registrado_por_socio_id: a.registrado_por_socio_id,
        created_at: a.created_at,
        socio: a.socio
          ? {
              id: a.socio.id,
              nombre: a.socio.nombre,
              apellido: a.socio.apellido,
              email: a.socio.email,
              rol_aile: a.socio.rol_aile ?? undefined,
            }
          : undefined,
      })
    ),
  }
}

const REUNION_SELECT = `
  id, titulo, descripcion, direccion, fecha_inicio, fecha_fin, lugar,
  creado_por_socio_id, estado, asistencia_registrada, calendario_reunion_id,
  created_at, updated_at,
  creado_por:socios!reuniones_direccion_creado_por_socio_id_fkey(
    id, nombre, apellido, email, rol_aile
  ),
  asistentes:reunion_direccion_asistentes(
    id, reunion_id, socio_id, registrado_por_socio_id, created_at,
    socio:socios!reunion_direccion_asistentes_socio_id_fkey(
      id, nombre, apellido, email, rol_aile
    )
  )
`.trim()

// ── Hook principal ──────────────────────────────────────────

export function useReuniones() {
  const { user, rolAile, rol } = useAuth()
  const socioId = user?.socio_id || null

  const [reuniones, setReuniones] = useState<ReunionDireccion[]>([])
  const [sociosActivos, setSociosActivos] = useState<
    Array<{ id: string; usuario_id: string; nombre: string; apellido: string; rol_aile?: string | null; email?: string | null }>
  >([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [registrando, setRegistrando] = useState(false)
  const [editando, setEditando] = useState(false)

  // Datos derivados del rol del usuario
  const miDireccion = directionFromRoleName(rolAile)
  const esDirector = isDirectorRole(rolAile)
  const esAdmin = rol === 'admin' || rol === 'comision_directiva'

  // Puede crear reuniones: directores de su dirección, admin y CD
  const puedeCrear = esAdmin || esDirector

  // Puede ver todas las direcciones: admin y CD
  const puedeVerTodo = esAdmin

  // Fetch reuniones
  const fetchReuniones = useCallback(async () => {
    try {
      setLoading(true)

      let query = supabase
        .from('reuniones_direccion')
        .select(REUNION_SELECT)
        .order('fecha_inicio', { ascending: false })

      // Directores solo ven su dirección
      if (!puedeVerTodo && miDireccion) {
        query = query.eq('direccion', miDireccion)
      }

      const { data, error } = await runWithRecovery(() => query, {
        label: 'reuniones_direccion',
      })

      if (error) throw error
      setReuniones(((data || []) as unknown as ReunionRow[]).map(normalizeReunion))
    } catch (err) {
      console.error('Error al cargar reuniones:', err)
      toast.error('Error al cargar reuniones')
    } finally {
      setLoading(false)
    }
  }, [miDireccion, puedeVerTodo])

  // Fetch socios activos (para el formulario de asistencia)
  const fetchSociosActivos = useCallback(async () => {
    const { data } = await runWithRecovery(
      () =>
        supabase
          .from('socios')
          .select('id, usuario_id, nombre, apellido, rol_aile, email')
          .eq('estado', 'activo')
          .order('apellido'),
      { label: 'socios activos reuniones' }
    )
    setSociosActivos(
      (data || []) as Array<{
        id: string
        usuario_id: string
        nombre: string
        apellido: string
        rol_aile?: string | null
        email?: string | null
      }>
    )
  }, [])

  useEffect(() => {
    void fetchReuniones()
    void fetchSociosActivos()
  }, [fetchReuniones, fetchSociosActivos])

  useResumeRefresh(
    () => {
      void fetchReuniones()
    },
    { throttleMs: 5_000 }
  )

  // ── Crear reunión ─────────────────────────────────────────

  const crearReunion = useCallback(
    async (payload: CrearReunionDireccionPayload): Promise<ReunionDireccion | null> => {
      if (!puedeCrear) {
        toast.error('No tenés permiso para agendar reuniones')
        return null
      }

      if (!socioId) {
        toast.error('No se encontró tu perfil de socio')
        return null
      }

      // Directores solo pueden crear reuniones de su dirección
      if (!esAdmin && miDireccion && payload.direccion !== miDireccion) {
        toast.error(`Solo podés agendar reuniones de la dirección ${miDireccion}`)
        return null
      }

      try {
        setCreating(true)

        // 1. Crear evento en el calendario (sincronización)
        let calendarioReunionId: string | null = null
        try {
          const { data: calData, error: calError } = await supabase.rpc(
            'rpc_calendar_schedule_meeting',
            {
              p_titulo: payload.titulo,
              p_descripcion: payload.descripcion || null,
              p_lugar: payload.lugar || null,
              p_fecha_inicio: payload.fechaInicio,
              p_fecha_fin: payload.fechaFin,
              p_alcance: 'personalizada',
              p_usuario_ids_involucrados: payload.usuarioIdsInvolucrados || (user?.id ? [user.id] : []),
              p_usuario_ids_invitados: [],
            }
          )
          if (!calError && calData) {
            const calReunion = Array.isArray(calData) ? calData[0] : calData
            calendarioReunionId = (calReunion as { id?: string })?.id || null
          }
        } catch {
          // Si el calendario falla, continuamos igual — la reunión se crea sin sincronización
          console.warn('No se pudo sincronizar con el calendario')
        }

        // 2. Crear en reuniones_direccion
        const { data, error } = await supabase
          .from('reuniones_direccion')
          .insert({
            titulo: payload.titulo,
            descripcion: payload.descripcion || null,
            direccion: payload.direccion,
            fecha_inicio: payload.fechaInicio,
            fecha_fin: payload.fechaFin,
            lugar: payload.lugar || null,
            creado_por_socio_id: socioId,
            estado: 'programada',
            asistencia_registrada: false,
            calendario_reunion_id: calendarioReunionId,
          })
          .select(REUNION_SELECT)
          .single()

        if (error) throw error

        const nuevaReunion = normalizeReunion(data as unknown as ReunionRow)

        // 3. Opcionalmente crear tarea vinculada
        if (payload.crearTarea) {
          await crearTareaVinculada(nuevaReunion)
        }

        setReuniones((prev) => [nuevaReunion, ...prev])
        toast.success('Reunión agendada correctamente')

        // 4. Enviar email a los invitados al calendario (excluir al creador)
        const invitadoIds = payload.usuarioIdsInvolucrados || []
        if (invitadoIds.length > 0) {
          const recipients = sociosActivos
            .filter(
              (s) => s.usuario_id && invitadoIds.includes(s.usuario_id) && s.email
            )
            .map((s) => ({
              socio_id: s.id,
              email: s.email!,
              nombre: s.nombre,
              apellido: s.apellido,
            }))

          if (recipients.length > 0) {
            const creatorSocio = sociosActivos.find((s) => s.usuario_id === user?.id)
            const creatorName = creatorSocio ? `${creatorSocio.nombre} ${creatorSocio.apellido}` : 'Un miembro'
            void sendEmailNotificationFromClient('calendario_reunion_nueva', recipients, {
              type: 'calendario_reunion_nueva',
              reunion_titulo: payload.titulo,
              reunion_fecha: payload.fechaInicio,
              reunion_fecha_fin: payload.fechaFin,
              reunion_lugar: payload.lugar || null,
              reunion_alcance: 'personalizada',
              creado_por_nombre: creatorName,
              participacion: null,
            })
          }
        }

        return nuevaReunion
      } catch (err) {
        console.error('Error al crear reunión:', err)
        toast.error('Error al agendar la reunión')
        return null
      } finally {
        setCreating(false)
      }
    },
    [esAdmin, miDireccion, puedeCrear, socioId, sociosActivos, user?.id]
  )

  // ── Crear tarea vinculada en el proyecto de la dirección ──

  const crearTareaVinculada = useCallback(async (reunion: ReunionDireccion) => {
    const directionCode = (dir: DireccionBase) => {
      if (dir === 'CEA') return 'cea'
      if (dir === 'Finanzas') return 'finanzas'
      if (dir === 'Recursos Humanos') return 'recursos_humanos'
      return 'comunicacion'
    }

    // Intentar encontrar el proyecto de la dirección
    for (const tableName of ['proyectos_tareas', 'tareas_proyectos', 'kanban_proyectos']) {
      try {
        const { data: proyectos, error } = await supabase
          .from(tableName)
          .select('id, direccion')
          .eq('tipo', 'interno_direccion')
          .eq('estado', 'en_ejecucion')
          .order('created_at', { ascending: false })
          .limit(10)

        if (error || !proyectos?.length) continue

        const proyecto = proyectos.find((p: { direccion?: string | null }) => {
          const n = normalizeText(p.direccion || '')
          const d = normalizeText(reunion.direccion)
          return (
            n.includes(d.split(' ')[0]) ||
            n.includes(directionCode(reunion.direccion))
          )
        }) || proyectos[0]

        if (!proyecto) continue

        const rpcPayload = {
          proyecto_id: proyecto.id,
          titulo: `Reunión: ${reunion.titulo}`,
          descripcion: reunion.descripcion || null,
          estado: 'por_hacer',
          fecha_vencimiento: reunion.fecha_inicio.split('T')[0],
          direccion_responsable: reunion.direccion,
          direccion_responsable_codigo: directionCode(reunion.direccion),
          asignado_socio_id: null,
          prioridad: 2,
        }

        // Intentar con los RPCs conocidos
        for (const fn of ['rpc_tasks_create_task', 'rpc_tareas_crear_tarea']) {
          const { error: rpcError } = await supabase.rpc(fn as 'rpc_tasks_create_task', {
            p_payload: rpcPayload,
          })
          if (!rpcError) return
        }
        return
      } catch {
        continue
      }
    }
  }, [])

  // ── Registrar asistencia ──────────────────────────────────

  const registrarAsistencia = useCallback(
    async (payload: RegistrarAsistenciaPayload): Promise<boolean> => {
      if (!socioId) {
        toast.error('No se encontró tu perfil de socio')
        return false
      }

      try {
        setRegistrando(true)

        // Eliminar asistentes previos y re-insertar
        const { error: deleteError } = await supabase
          .from('reunion_direccion_asistentes')
          .delete()
          .eq('reunion_id', payload.reunionId)

        if (deleteError) throw deleteError

        if (payload.socioIds.length > 0) {
          const { error: insertError } = await supabase
            .from('reunion_direccion_asistentes')
            .insert(
              payload.socioIds.map((sid) => ({
                reunion_id: payload.reunionId,
                socio_id: sid,
                registrado_por_socio_id: socioId,
              }))
            )
          if (insertError) throw insertError
        }

        // Marcar asistencia registrada y estado finalizada
        const { error: updateError } = await supabase
          .from('reuniones_direccion')
          .update({
            asistencia_registrada: true,
            estado: 'finalizada',
          })
          .eq('id', payload.reunionId)

        if (updateError) throw updateError

        toast.success('Asistencia registrada correctamente')
        await fetchReuniones()
        return true
      } catch (err) {
        console.error('Error al registrar asistencia:', err)
        toast.error('Error al registrar la asistencia')
        return false
      } finally {
        setRegistrando(false)
      }
    },
    [fetchReuniones, socioId]
  )

  // ── Cancelar reunión ──────────────────────────────────────

  const cancelarReunion = useCallback(
    async (reunionId: string): Promise<boolean> => {
      if (!puedeCrear) return false

      const reunion = reuniones.find((item) => item.id === reunionId)

      try {
        const { error } = await supabase
          .from('reuniones_direccion')
          .update({ estado: 'cancelada' })
          .eq('id', reunionId)

        if (error) throw error

        if (reunion?.calendario_reunion_id) {
          const { error: deleteCalendarParticipantsError } = await supabase
            .from('reuniones_calendario_participantes')
            .delete()
            .eq('reunion_id', reunion.calendario_reunion_id)

          if (deleteCalendarParticipantsError) {
            console.warn('Error removing synced calendar participants:', deleteCalendarParticipantsError)
          } else {
            const { error: deleteCalendarError } = await supabase
              .from('reuniones_calendario')
              .delete()
              .eq('id', reunion.calendario_reunion_id)

            if (deleteCalendarError) {
              console.warn('Error removing synced calendar meeting:', deleteCalendarError)
            }
          }
        }

        setReuniones((prev) =>
          prev.map((r) => (r.id === reunionId ? { ...r, estado: 'cancelada' } : r))
        )
        toast.success('Reunión cancelada')
        return true
      } catch {
        toast.error('Error al cancelar la reunión')
        return false
      }
    },
    [puedeCrear, reuniones]
  )

  // ── Cargar reunión histórica ──────────────────────────────

  const cargarReunionHistorica = useCallback(
    async (payload: CargarHistoricaPayload): Promise<boolean> => {
      if (!puedeCrear) {
        toast.error('No tenés permiso para cargar reuniones')
        return false
      }
      if (!socioId) {
        toast.error('No se encontró tu perfil de socio')
        return false
      }
      if (!esAdmin && miDireccion && payload.direccion !== miDireccion) {
        toast.error(`Solo podés cargar reuniones de la dirección ${miDireccion}`)
        return false
      }

      try {
        setCreating(true)

        const fechaISO = payload.fecha.includes('T')
          ? payload.fecha
          : `${payload.fecha}T00:00:00`
        const fechaFinISO = payload.fecha.includes('T')
          ? payload.fecha
          : `${payload.fecha}T01:00:00`

        const titulo =
          payload.titulo?.trim() ||
          `Reunión ${payload.direccion} — ${new Date(fechaISO).toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })}`

        // Insertar la reunión ya finalizada
        const { data: reunionData, error: reunionError } = await supabase
          .from('reuniones_direccion')
          .insert({
            titulo,
            descripcion: payload.descripcion || null,
            direccion: payload.direccion,
            fecha_inicio: fechaISO,
            fecha_fin: fechaFinISO,
            lugar: payload.lugar || null,
            creado_por_socio_id: socioId,
            estado: 'finalizada',
            asistencia_registrada: true,
          })
          .select('id')
          .single()

        if (reunionError) throw reunionError

        const reunionId = (reunionData as { id: string }).id

        // Insertar asistentes
        if (payload.socioIds.length > 0) {
          const { error: asistenteError } = await supabase
            .from('reunion_direccion_asistentes')
            .insert(
              payload.socioIds.map((sid) => ({
                reunion_id: reunionId,
                socio_id: sid,
                registrado_por_socio_id: socioId,
              }))
            )
          if (asistenteError) throw asistenteError
        }

        toast.success('Reunión histórica cargada correctamente')
        await fetchReuniones()
        return true
      } catch (err) {
        console.error('Error al cargar reunión histórica:', err)
        toast.error('Error al cargar la reunión histórica')
        return false
      } finally {
        setCreating(false)
      }
    },
    [esAdmin, fetchReuniones, miDireccion, puedeCrear, socioId]
  )

  // ── Editar reunión ────────────────────────────────────────

  const editarReunion = useCallback(
    async (reunionId: string, payload: EditarReunionPayload): Promise<boolean> => {
      if (!puedeCrear) {
        toast.error('No tenés permiso para editar reuniones')
        return false
      }
      try {
        setEditando(true)
        const { error } = await supabase
          .from('reuniones_direccion')
          .update({
            titulo: payload.titulo,
            descripcion: payload.descripcion || null,
            fecha_inicio: payload.fechaInicio,
            fecha_fin: payload.fechaFin,
            lugar: payload.lugar || null,
          })
          .eq('id', reunionId)
        if (error) throw error

        // Actualizar participantes del calendario si se proporcionaron
        if (payload.usuarioIdsInvolucrados !== undefined) {
          const reunion = reuniones.find((r) => r.id === reunionId)
          let calReunionId = reunion?.calendario_reunion_id || null

          // Si no existe evento de calendario, crearlo ahora
          if (!calReunionId && payload.usuarioIdsInvolucrados.length > 0) {
            try {
              const { data: calData, error: calError } = await supabase.rpc(
                'rpc_calendar_schedule_meeting',
                {
                  p_titulo: payload.titulo,
                  p_descripcion: payload.descripcion || null,
                  p_lugar: payload.lugar || null,
                  p_fecha_inicio: payload.fechaInicio,
                  p_fecha_fin: payload.fechaFin,
                  p_alcance: 'personalizada',
                  p_usuario_ids_involucrados: payload.usuarioIdsInvolucrados,
                  p_usuario_ids_invitados: [],
                }
              )
              if (!calError && calData) {
                const calReunion = Array.isArray(calData) ? calData[0] : calData
                calReunionId = (calReunion as { id?: string })?.id || null
              }
              if (calReunionId) {
                await supabase
                  .from('reuniones_direccion')
                  .update({ calendario_reunion_id: calReunionId })
                  .eq('id', reunionId)
              }
            } catch {
              console.warn('No se pudo crear el evento de calendario')
            }
          } else if (calReunionId) {
            // Ya existe evento: actualizar participantes
            await supabase
              .from('reuniones_calendario_participantes')
              .delete()
              .eq('reunion_id', calReunionId)

            if (payload.usuarioIdsInvolucrados.length > 0) {
              const rows = payload.usuarioIdsInvolucrados
                .map((uid) => {
                  const socio = sociosActivos.find((s) => s.usuario_id === uid)
                  if (!socio) return null
                  return {
                    reunion_id: calReunionId!,
                    usuario_id: uid,
                    socio_id: socio.id,
                    participacion: 'involucrado' as const,
                  }
                })
                .filter(Boolean)
              if (rows.length > 0) {
                await supabase.from('reuniones_calendario_participantes').insert(rows)
              }
            }
          }
        }

        setReuniones((prev) =>
          prev.map((r) =>
            r.id === reunionId
              ? {
                  ...r,
                  titulo: payload.titulo,
                  descripcion: payload.descripcion || null,
                  fecha_inicio: payload.fechaInicio,
                  fecha_fin: payload.fechaFin,
                  lugar: payload.lugar || null,
                }
              : r
          )
        )
        // Enviar email a los invitados (excluir al editor)
        if (payload.usuarioIdsInvolucrados && payload.usuarioIdsInvolucrados.length > 0) {
          const recipients = sociosActivos
            .filter(
              (s) => s.usuario_id && payload.usuarioIdsInvolucrados!.includes(s.usuario_id) && s.email
            )
            .map((s) => ({
              socio_id: s.id,
              email: s.email!,
              nombre: s.nombre,
              apellido: s.apellido,
            }))
          if (recipients.length > 0) {
            const editorSocio = sociosActivos.find((s) => s.usuario_id === user?.id)
            const editorName = editorSocio ? `${editorSocio.nombre} ${editorSocio.apellido}` : 'Un miembro'
            void sendEmailNotificationFromClient('calendario_reunion_nueva', recipients, {
              type: 'calendario_reunion_nueva',
              reunion_titulo: payload.titulo,
              reunion_fecha: payload.fechaInicio,
              reunion_fecha_fin: payload.fechaFin,
              reunion_lugar: payload.lugar || null,
              reunion_alcance: 'personalizada',
              creado_por_nombre: editorName,
              participacion: null,
            })
          }
        }

        toast.success('Reunión actualizada')
        return true
      } catch {
        toast.error('Error al actualizar la reunión')
        return false
      } finally {
        setEditando(false)
      }
    },
    [puedeCrear, reuniones, sociosActivos, user?.id]
  )

  // ── Eliminar reunión ──────────────────────────────────────

  const eliminarReunion = useCallback(
    async (reunionId: string): Promise<boolean> => {
      if (!puedeCrear) return false
      const reunion = reuniones.find((r) => r.id === reunionId)
      try {
        await supabase
          .from('reunion_direccion_asistentes')
          .delete()
          .eq('reunion_id', reunionId)

        const { error } = await supabase
          .from('reuniones_direccion')
          .delete()
          .eq('id', reunionId)

        if (error) throw error

        if (reunion?.calendario_reunion_id) {
          await supabase
            .from('reuniones_calendario_participantes')
            .delete()
            .eq('reunion_id', reunion.calendario_reunion_id)
          await supabase
            .from('reuniones_calendario')
            .delete()
            .eq('id', reunion.calendario_reunion_id)
        }

        setReuniones((prev) => prev.filter((r) => r.id !== reunionId))
        toast.success('Reunión eliminada')
        return true
      } catch {
        toast.error('Error al eliminar la reunión')
        return false
      }
    },
    [puedeCrear, reuniones]
  )

  // ── Panel de frecuencia ───────────────────────────────────

  const frecuenciaPorDireccion: FrecuenciaDireccion[] = (['CEA', 'Finanzas', 'Recursos Humanos', 'Comunicación'] as DireccionBase[]).map(
    (dir) => {
      const deEstaDireccion = reuniones.filter(
        (r) => r.direccion === dir && r.estado !== 'cancelada'
      )
      const finalizadas = deEstaDireccion.filter((r) => r.estado === 'finalizada')
      const ultima =
        finalizadas.length > 0
          ? finalizadas.sort(
              (a, b) => new Date(b.fecha_inicio).getTime() - new Date(a.fecha_inicio).getTime()
            )[0]
          : null

      const diasSinReunion = ultima
        ? Math.floor(
            (Date.now() - new Date(ultima.fecha_inicio).getTime()) / (1000 * 60 * 60 * 24)
          )
        : null

      return {
        direccion: dir,
        ultimaReunion: ultima?.fecha_inicio || null,
        diasSinReunion,
        totalReuniones: finalizadas.length,
        enAlerta: diasSinReunion === null || diasSinReunion > 14,
      }
    }
  )

  // ── Estadísticas de asistencia ────────────────────────────

  const estadisticasAsistencia: EstadisticaAsistencia[] = (() => {
    const map = new Map<string, EstadisticaAsistencia>()

    for (const reunion of reuniones) {
      if (reunion.estado !== 'finalizada') continue
      for (const asistente of reunion.asistentes || []) {
        if (!asistente.socio) continue
        const s = asistente.socio
        const existing = map.get(asistente.socio_id)
        const dir = directionFromRoleName(s.rol_aile)
        const porDir = existing?.porDireccion || {}
        porDir[reunion.direccion] = (porDir[reunion.direccion] || 0) + 1

        const nuevaUltima =
          !existing?.ultimaAsistencia ||
          reunion.fecha_inicio > existing.ultimaAsistencia
            ? reunion.fecha_inicio
            : existing.ultimaAsistencia

        map.set(asistente.socio_id, {
          socioId: asistente.socio_id,
          nombre: s.nombre,
          apellido: s.apellido,
          rolAile: s.rol_aile || null,
          direccion: dir,
          totalAsistencias: (existing?.totalAsistencias || 0) + 1,
          ultimaAsistencia: nuevaUltima,
          porDireccion: porDir,
        })
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => b.totalAsistencias - a.totalAsistencias
    )
  })()

  const estadisticasPorDireccion: EstadisticaDireccion[] = (
    ['CEA', 'Finanzas', 'Recursos Humanos', 'Comunicación'] as DireccionBase[]
  ).map((dir) => {
    const reunionesDir = reuniones.filter(
      (r) => r.direccion === dir && r.estado === 'finalizada'
    )
    const totalAsistencias = reunionesDir.reduce(
      (acc, r) => acc + (r.asistentes?.length || 0),
      0
    )
    const miembrosUnicos = new Set(
      reunionesDir.flatMap((r) => (r.asistentes || []).map((a) => a.socio_id))
    ).size

    return {
      direccion: dir,
      totalReuniones: reunionesDir.length,
      totalAsistencias,
      promedioAsistentes:
        reunionesDir.length > 0
          ? Math.round(totalAsistencias / reunionesDir.length)
          : 0,
      miembrosUnicos,
    }
  })

  // Reuniones que ya pasaron pero no tienen asistencia registrada
  const reunionesPendientesAsistencia = reuniones.filter(
    (r) =>
      r.estado === 'programada' &&
      !r.asistencia_registrada &&
      new Date(r.fecha_fin) < new Date()
  )

  return {
    reuniones,
    sociosActivos,
    loading,
    creating,
    registrando,
    miDireccion,
    esDirector,
    esAdmin,
    puedeCrear,
    puedeVerTodo,
    frecuenciaPorDireccion,
    reunionesPendientesAsistencia,
    estadisticasAsistencia,
    estadisticasPorDireccion,
    crearReunion,
    cargarReunionHistorica,
    registrarAsistencia,
    cancelarReunion,
    editarReunion,
    eliminarReunion,
    editando,
    fetchReuniones,
  }
}
