// Tipos para el sistema de notificaciones por email
import type { PrioridadTarea } from '@/lib/types'

export type EmailNotificationType =
  // Tareas
  | 'tarea_asignada'
  | 'tarea_estado_cambio'
  | 'tarea_vencimiento_proximo'
  | 'tareas_vencidas_resumen'
  | 'subtarea_creada'
  | 'handoff_solicitado'
  | 'handoff_resuelto'
  | 'aprobacion_cd_pendiente'
  | 'aprobacion_cd_resuelta'
  // Calendario
  | 'calendario_reunion_nueva'
  | 'calendario_reunion_modificada'
  | 'calendario_reunion_cancelada'
  | 'calendario_planificacion_definitiva'
  | 'reunion_asistencia_pendiente_recordatorio'
  // Resoluciones y Decretos
  | 'resolucion_nueva'
  | 'decreto_nuevo'
  | 'balance_nuevo'

export interface EmailRecipient {
  socio_id: string
  email: string
  nombre: string
  apellido: string
}

export interface EmailNotificationPayload {
  type: EmailNotificationType
  recipients: EmailRecipient[]
  data: EmailNotificationData
}

// ── Tareas ──────────────────────────────────────────────

export interface TareaAsignadaData {
  type: 'tarea_asignada'
  tarea_titulo: string
  proyecto_nombre: string
  asignado_por_nombre: string
  prioridad?: PrioridadTarea | null
  fecha_limite?: string | null
  descripcion?: string | null
}

export interface TareaEstadoCambioData {
  type: 'tarea_estado_cambio'
  tarea_titulo: string
  proyecto_nombre: string
  estado_anterior: string
  estado_nuevo: string
  cambiado_por_nombre: string
}

export interface TareaVencimientoData {
  type: 'tarea_vencimiento_proximo'
  tarea_titulo: string
  proyecto_nombre: string
  fecha_limite: string
  dias_restantes: number
}

export interface TareasVencidasResumenItemData {
  id: string
  tarea_titulo: string
  proyecto_nombre: string
  fecha_limite: string
  dias_vencida: number
}

export interface TareasVencidasResumenData {
  type: 'tareas_vencidas_resumen'
  cantidad_tareas: number
  tareas: TareasVencidasResumenItemData[]
}

export interface SubtareaCreadaData {
  type: 'subtarea_creada'
  subtarea_titulo: string
  tarea_titulo: string
  proyecto_nombre: string
  creado_por_nombre: string
}

export interface HandoffSolicitadoData {
  type: 'handoff_solicitado'
  tarea_titulo: string
  proyecto_nombre: string
  solicitado_por_nombre: string
  motivo?: string | null
}

export interface HandoffResueltoData {
  type: 'handoff_resuelto'
  tarea_titulo: string
  proyecto_nombre: string
  resuelto_por_nombre: string
  aceptado: boolean
  comentario?: string | null
}

export interface AprobacionCdPendienteData {
  type: 'aprobacion_cd_pendiente'
  tarea_titulo: string
  proyecto_nombre: string
  enviado_por_nombre: string
  comentario?: string | null
}

export interface AprobacionCdResueltaData {
  type: 'aprobacion_cd_resuelta'
  tarea_titulo: string
  proyecto_nombre: string
  decision: 'aprobada' | 'observada' | 'rechazada'
  resuelto_por_nombre: string
  observacion?: string | null
}

// ── Calendario ──────────────────────────────────────────

export interface CalendarioReunionNuevaData {
  type: 'calendario_reunion_nueva'
  reunion_titulo: string
  reunion_fecha: string
  reunion_fecha_fin: string
  reunion_lugar?: string | null
  reunion_alcance: string
  creado_por_nombre: string
  participacion?: string | null
}

export interface CalendarioReunionModificadaData {
  type: 'calendario_reunion_modificada'
  reunion_titulo: string
  reunion_fecha: string
  reunion_fecha_fin: string
  reunion_lugar?: string | null
  modificado_por_nombre: string
}

export interface CalendarioReunionCanceladaData {
  type: 'calendario_reunion_cancelada'
  reunion_titulo: string
  reunion_fecha: string
  cancelado_por_nombre: string
}

export interface CalendarioPlanificacionDefinitivaData {
  type: 'calendario_planificacion_definitiva'
  planificacion_titulo: string
  planificacion_fecha_inicio: string
  planificacion_fecha_fin: string
  planificacion_descripcion?: string | null
  definido_por_nombre: string
}

export interface ReunionAsistenciaPendienteRecordatorioData {
  type: 'reunion_asistencia_pendiente_recordatorio'
  reunion_titulo: string
  reunion_fecha: string
  reunion_fecha_fin: string
  reunion_lugar?: string | null
  reunion_direccion: string
  dias_pendiente: number
}

// ── Resoluciones y Decretos ─────────────────────────────

export interface ResolucionNuevaData {
  type: 'resolucion_nueva'
  resolucion_titulo: string
  resolucion_numero: number
  resolucion_anio: number
  resolucion_fecha: string
  creado_por_nombre: string
}

export interface DecretoNuevoData {
  type: 'decreto_nuevo'
  decreto_titulo: string
  decreto_numero: number
  decreto_anio: number
  decreto_fecha: string
  creado_por_nombre: string
}

export interface BalanceNuevoData {
  type: 'balance_nuevo'
  balance_periodo: string
  balance_fecha_publicacion: string
  creado_por_nombre: string
}

// ── Union type ──────────────────────────────────────────

export type EmailNotificationData =
  | TareaAsignadaData
  | TareaEstadoCambioData
  | TareaVencimientoData
  | TareasVencidasResumenData
  | SubtareaCreadaData
  | HandoffSolicitadoData
  | HandoffResueltoData
  | AprobacionCdPendienteData
  | AprobacionCdResueltaData
  | CalendarioReunionNuevaData
  | CalendarioReunionModificadaData
  | CalendarioReunionCanceladaData
  | CalendarioPlanificacionDefinitivaData
  | ReunionAsistenciaPendienteRecordatorioData
  | ResolucionNuevaData
  | DecretoNuevoData
  | BalanceNuevoData

// Mapeo de tipo de notificación a columna de preferencia
export const NOTIFICATION_PREFERENCE_MAP: Record<EmailNotificationType, string> = {
  tarea_asignada: 'tarea_asignada',
  tarea_estado_cambio: 'tarea_estado_cambio',
  tarea_vencimiento_proximo: 'tarea_vencimiento_proximo',
  tareas_vencidas_resumen: 'tareas_vencidas_resumen',
  subtarea_creada: 'subtarea_creada',
  handoff_solicitado: 'handoff_solicitado',
  handoff_resuelto: 'handoff_resuelto',
  aprobacion_cd_pendiente: 'aprobacion_cd_pendiente',
  aprobacion_cd_resuelta: 'aprobacion_cd_resuelta',
  calendario_reunion_nueva: 'calendario_reunion_nueva',
  calendario_reunion_modificada: 'calendario_reunion_modificada',
  calendario_reunion_cancelada: 'calendario_reunion_cancelada',
  calendario_planificacion_definitiva: 'calendario_planificacion_definitiva',
  reunion_asistencia_pendiente_recordatorio: 'reunion_asistencia_pendiente_recordatorio',
  resolucion_nueva: 'resolucion_nueva',
  decreto_nuevo: 'decreto_nuevo',
  balance_nuevo: 'balance_nuevo',
}

export const NOTIFICATION_LABELS: Record<EmailNotificationType, string> = {
  // Tareas
  tarea_asignada: 'Cuando me asignan una tarea',
  tarea_estado_cambio: 'Cuando cambia el estado de mis tareas',
  tarea_vencimiento_proximo: 'Recordatorio de tareas por vencer',
  tareas_vencidas_resumen: 'Resumen diario de tareas vencidas',
  subtarea_creada: 'Cuando crean una subtarea en mis tareas',
  handoff_solicitado: 'Cuando me solicitan un handoff',
  handoff_resuelto: 'Cuando se resuelve un handoff que solicité',
  aprobacion_cd_pendiente: 'Cuando una tarea requiere mi aprobación en CD',
  aprobacion_cd_resuelta: 'Cuando CD resuelve una tarea que envié',
  // Calendario
  calendario_reunion_nueva: 'Cuando me invitan a una reunión',
  calendario_reunion_modificada: 'Cuando se modifica una reunión',
  calendario_reunion_cancelada: 'Cuando se cancela una reunión',
  calendario_planificacion_definitiva: 'Cuando una fecha de planificación es definitiva',
  reunion_asistencia_pendiente_recordatorio: 'Recordatorio para registrar asistencia de mis reuniones',
  // Resoluciones y Decretos
  resolucion_nueva: 'Cuando se publica una nueva resolución de CD',
  decreto_nuevo: 'Cuando se publica un nuevo decreto',
  balance_nuevo: 'Cuando se publica un nuevo balance',
}

export const NOTIFICATION_CATEGORIES = [
  {
    label: 'Tareas',
    types: [
      'tarea_asignada',
      'tarea_estado_cambio',
      'tarea_vencimiento_proximo',
      'tareas_vencidas_resumen',
      'subtarea_creada',
      'handoff_solicitado',
      'handoff_resuelto',
      'aprobacion_cd_pendiente',
      'aprobacion_cd_resuelta',
    ] as EmailNotificationType[],
  },
  {
    label: 'Calendario',
    types: [
      'calendario_reunion_nueva',
      'calendario_reunion_modificada',
      'calendario_reunion_cancelada',
      'calendario_planificacion_definitiva',
      'reunion_asistencia_pendiente_recordatorio',
    ] as EmailNotificationType[],
  },
  {
    label: 'Documentos institucionales',
    types: [
      'resolucion_nueva',
      'decreto_nuevo',
      'balance_nuevo',
    ] as EmailNotificationType[],
  },
]
