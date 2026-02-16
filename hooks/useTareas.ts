'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { runWithRecovery } from '@/lib/async-recovery'
import { useResumeRefresh } from '@/hooks/useResumeRefresh'
import type {
  AccesoProyectoTarea,
  DireccionBase,
  EstadoProyectoTarea,
  EstadoTareaKanban,
  EstadoTareaWorkflow,
  ProyectoTarea,
  Rol,
  SubtareaProyecto,
  TareaAprobacionCD,
  TareaProyecto,
  TipoProyectoTarea,
  UsuarioAsignableTarea,
} from '@/lib/types'

const PROJECT_TABLE_CANDIDATES = [
  'proyectos_tareas',
  'tareas_proyectos',
  'kanban_proyectos',
] as const

const TASK_TABLE_CANDIDATES = [
  'tareas',
  'proyecto_tareas',
  'kanban_tareas',
] as const

const SUBTASK_TABLE_CANDIDATES = [
  'subtareas',
  'tarea_subtareas',
  'kanban_subtareas',
] as const

const APPROVAL_TABLE_CANDIDATES = [
  'tareas_aprobaciones_cd',
] as const

const DIRECTIONS_TABLE_CANDIDATES = [
  'direcciones',
] as const

const DIRECTOR_MEMBERSHIP_TABLE_CANDIDATES = [
  'socios_direcciones',
] as const

export const DIRECCIONES_BASE: DireccionBase[] = [
  'CEA',
  'Finanzas',
  'Recursos Humanos',
  'Comunicación',
]

export const KANBAN_COLUMNS: Array<{ id: EstadoTareaKanban; title: string; tone: string }> = [
  { id: 'pendiente', title: 'Pendiente', tone: 'border-slate-200 bg-slate-50' },
  { id: 'en_progreso', title: 'En progreso', tone: 'border-sky-200 bg-sky-50' },
  { id: 'en_revision', title: 'En revisión', tone: 'border-amber-200 bg-amber-50' },
  { id: 'completada', title: 'Completada', tone: 'border-emerald-200 bg-emerald-50' },
]

interface SourceMeta {
  proyectos: string | null
  tareas: string | null
  subtareas: string | null
  aprobacionesCd: string | null
}

interface SupabaseErrorLike {
  code?: string
  message?: string
  details?: string
  hint?: string
  error_description?: string
}

interface RpcAttempt {
  fn: string
  args: Record<string, unknown>
}

interface DirectionRow {
  id: string
  codigo: string
  nombre: string
}

type GenericRow = Record<string, unknown>

export interface CrearProyectoPayload {
  nombre: string
  descripcion?: string
  tipo: TipoProyectoTarea
  direccion?: DireccionBase | null
}

export interface ActualizarProyectoPayload {
  nombre?: string
  descripcion?: string | null
  tipo?: TipoProyectoTarea
  direccion?: DireccionBase | null
  activo?: boolean
  orden_tablero?: number | null
}

export interface CrearTareaPayload {
  proyecto_id: string
  titulo: string
  descripcion?: string
  estado?: EstadoTareaKanban
  fecha_limite?: string | null
  direccion_responsable?: DireccionBase | null
  asignado_usuario_id?: string | null
  asignado_socio_id?: string | null
}

export interface CrearSubtareaPayload {
  tarea_id: string
  titulo: string
  descripcion?: string
  estado?: EstadoTareaKanban
  asignado_usuario_id?: string | null
  asignado_socio_id?: string | null
}

export interface ActualizarTareaPayload {
  titulo?: string
  descripcion?: string | null
  estado?: EstadoTareaKanban
  fecha_limite?: string | null
  direccion_responsable?: DireccionBase | null
}

export interface ActualizarSubtareaPayload {
  titulo?: string
  descripcion?: string | null
  estado?: EstadoTareaKanban
}

class FrontendPermissionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FrontendPermissionError'
  }
}

class TaskSchemaUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TaskSchemaUnavailableError'
  }
}

function normalizeText(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === 'object' && error) {
    const maybe = error as SupabaseErrorLike
    const pieces = [
      maybe.code,
      maybe.message,
      maybe.details,
      maybe.hint,
      maybe.error_description,
    ].filter(Boolean)

    if (pieces.length > 0) return pieces.join(' | ')
  }

  return 'Error desconocido'
}

function isMissingRelationError(error: unknown): boolean {
  const maybe = (typeof error === 'object' && error ? error as SupabaseErrorLike : null)
  const code = (maybe?.code || '').toUpperCase()

  if (code === 'PGRST205' || code === '42P01') return true

  const details = toErrorMessage(error).toLowerCase()
  return (
    details.includes('could not find the table') ||
    details.includes('relation') && details.includes('does not exist')
  )
}

function isMissingFunctionError(error: unknown): boolean {
  const maybe = (typeof error === 'object' && error ? error as SupabaseErrorLike : null)
  const code = (maybe?.code || '').toUpperCase()

  if (code === 'PGRST202' || code === '42883') return true

  const details = toErrorMessage(error).toLowerCase()
  return (
    details.includes('could not find the function') ||
    details.includes('function') && details.includes('does not exist')
  )
}

function isPermissionDeniedError(error: unknown): boolean {
  const maybe = (typeof error === 'object' && error ? error as SupabaseErrorLike : null)
  const code = (maybe?.code || '').toUpperCase()
  if (code === '42501') return true

  const details = toErrorMessage(error).toLowerCase()
  return (
    details.includes('permission denied') ||
    details.includes('not authorized') ||
    details.includes('no autorizado') ||
    details.includes('permiso')
  )
}

function readString(row: GenericRow, keys: string[], fallback = ''): string {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim() !== '') return value.trim()
  }
  return fallback
}

function readNullableString(row: GenericRow, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string') return value.trim() || null
  }
  return null
}

function readBoolean(row: GenericRow, keys: string[], fallback = false) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') {
      const normalized = normalizeText(value)
      if (normalized === 'true') return true
      if (normalized === 'false') return false
    }
  }
  return fallback
}

function readNumber(row: GenericRow, keys: string[]): number | null {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function asIsoDate(value?: string | null): string {
  if (value && !Number.isNaN(Date.parse(value))) return value
  return new Date().toISOString()
}

function directionFromCodeOrName(raw: string): DireccionBase {
  const normalized = normalizeText(raw)

  if (normalized.includes('cea')) return 'CEA'
  if (normalized.includes('finanza')) return 'Finanzas'
  if (normalized.includes('recurso') || normalized.includes('rrhh')) return 'Recursos Humanos'
  if (normalized.includes('comunic')) return 'Comunicación'

  return 'CEA'
}

function directionCode(direction: DireccionBase) {
  switch (direction) {
    case 'CEA':
      return 'cea'
    case 'Finanzas':
      return 'finanzas'
    case 'Recursos Humanos':
      return 'recursos_humanos'
    case 'Comunicación':
      return 'comunicacion'
    default:
      return 'cea'
  }
}

function normalizeWorkflowState(raw: unknown): EstadoTareaWorkflow {
  const normalized = normalizeText(typeof raw === 'string' ? raw : null)

  if (normalized === 'backlog') return 'backlog'
  if (normalized === 'por_hacer' || normalized === 'por hacer') return 'por_hacer'
  if (normalized === 'en_progreso' || normalized === 'en progreso') return 'en_progreso'
  if (normalized === 'en_revision_direccion' || normalized === 'en revision direccion') return 'en_revision_direccion'
  if (normalized === 'pendiente_handoff' || normalized === 'pendiente handoff') return 'pendiente_handoff'
  if (normalized === 'pendiente_aprobacion_cd' || normalized === 'pendiente aprobacion cd') return 'pendiente_aprobacion_cd'
  if (normalized === 'observada_cd' || normalized === 'observada cd') return 'observada_cd'
  if (normalized === 'aprobada_cd' || normalized === 'aprobada cd') return 'aprobada_cd'
  if (normalized === 'cerrada') return 'cerrada'

  return 'por_hacer'
}

function toKanbanState(workflowState: EstadoTareaWorkflow): EstadoTareaKanban {
  if (workflowState === 'backlog' || workflowState === 'por_hacer') return 'pendiente'
  if (workflowState === 'en_progreso') return 'en_progreso'
  if (
    workflowState === 'en_revision_direccion' ||
    workflowState === 'pendiente_handoff' ||
    workflowState === 'pendiente_aprobacion_cd' ||
    workflowState === 'observada_cd'
  ) {
    return 'en_revision'
  }
  return 'completada'
}

function toBackendState(kanbanState: EstadoTareaKanban): EstadoTareaWorkflow {
  switch (kanbanState) {
    case 'pendiente':
      return 'por_hacer'
    case 'en_progreso':
      return 'en_progreso'
    case 'en_revision':
      return 'en_revision_direccion'
    case 'completada':
      return 'cerrada'
    default:
      return 'por_hacer'
  }
}

function mapPriority(priority?: number | null): TareaProyecto['prioridad'] {
  if (priority == null) return null
  if (priority <= 1) return 'critica'
  if (priority === 2) return 'alta'
  if (priority === 3) return 'media'
  return 'baja'
}

function roleIsCoreManager(rol: Rol) {
  return rol === 'admin' || rol === 'comision_directiva'
}

export function useTareas() {
  const { user, rol } = useAuth()

  const [loading, setLoading] = useState(true)
  const [mutatingAction, setMutatingAction] = useState<string | null>(null)
  const [backendAvailable, setBackendAvailable] = useState(true)
  const [backendMessage, setBackendMessage] = useState<string | null>(null)
  const [sourceMeta, setSourceMeta] = useState<SourceMeta>({
    proyectos: null,
    tareas: null,
    subtareas: null,
    aprobacionesCd: null,
  })

  const [proyectos, setProyectos] = useState<ProyectoTarea[]>([])
  const [tareas, setTareas] = useState<TareaProyecto[]>([])
  const [subtareas, setSubtareas] = useState<SubtareaProyecto[]>([])
  const [aprobacionesCd, setAprobacionesCd] = useState<TareaAprobacionCD[]>([])
  const [usuariosAsignables, setUsuariosAsignables] = useState<UsuarioAsignableTarea[]>([])
  const [direcciones, setDirecciones] = useState<DirectionRow[]>([])
  const [directorDirectionIds, setDirectorDirectionIds] = useState<string[]>([])

  const missingSchemaNotifiedRef = useRef(false)
  const fetchDataRef = useRef<() => Promise<void>>(async () => undefined)

  const socioById = useMemo(() => {
    const map = new Map<string, UsuarioAsignableTarea>()
    for (const socio of usuariosAsignables) {
      map.set(socio.socio_id, socio)
    }
    return map
  }, [usuariosAsignables])

  const usuarioById = useMemo(() => {
    const map = new Map<string, UsuarioAsignableTarea>()
    for (const socio of usuariosAsignables) {
      map.set(socio.usuario_id, socio)
    }
    return map
  }, [usuariosAsignables])

  const tasksByProjectId = useMemo(() => {
    const map = new Map<string, TareaProyecto[]>()
    for (const task of tareas) {
      const current = map.get(task.proyecto_id) || []
      current.push(task)
      map.set(task.proyecto_id, current)
    }

    for (const [key, value] of map.entries()) {
      value.sort((a, b) => {
        const left = a.orden ?? 0
        const right = b.orden ?? 0
        if (left !== right) return left - right
        return Date.parse(a.created_at) - Date.parse(b.created_at)
      })
      map.set(key, value)
    }

    return map
  }, [tareas])

  const subtasksByTaskId = useMemo(() => {
    const map = new Map<string, SubtareaProyecto[]>()
    for (const subtask of subtareas) {
      const current = map.get(subtask.tarea_id) || []
      current.push(subtask)
      map.set(subtask.tarea_id, current)
    }

    for (const [key, value] of map.entries()) {
      value.sort((a, b) => {
        const left = a.orden ?? 0
        const right = b.orden ?? 0
        if (left !== right) return left - right
        return Date.parse(a.created_at) - Date.parse(b.created_at)
      })
      map.set(key, value)
    }

    return map
  }, [subtareas])

  const approvalsByTaskId = useMemo(() => {
    const map = new Map<string, TareaAprobacionCD[]>()
    for (const approval of aprobacionesCd) {
      const current = map.get(approval.tarea_id) || []
      current.push(approval)
      map.set(approval.tarea_id, current)
    }
    return map
  }, [aprobacionesCd])

  const projectById = useMemo(() => {
    const map = new Map<string, ProyectoTarea>()
    for (const project of proyectos) {
      map.set(project.id, project)
    }
    return map
  }, [proyectos])

  const taskById = useMemo(() => {
    const map = new Map<string, TareaProyecto>()
    for (const task of tareas) {
      map.set(task.id, task)
    }
    return map
  }, [tareas])

  const directionById = useMemo(() => {
    const map = new Map<string, DirectionRow>()
    for (const direction of direcciones) {
      map.set(direction.id, direction)
    }
    return map
  }, [direcciones])

  const directorDirectionIdSet = useMemo(() => new Set(directorDirectionIds), [directorDirectionIds])

  const isAssignedToCurrentUser = useCallback((item: {
    asignado_usuario_id?: string | null
    asignado_socio_id?: string | null
  }) => {
    if (!user) return false
    if (item.asignado_socio_id && item.asignado_socio_id === user.socio_id) return true
    if (item.asignado_usuario_id && item.asignado_usuario_id === user.id) return true
    return false
  }, [user])

  const canCreateProjectInDirection = useCallback((direction: DireccionBase) => {
    if (!user) return false
    if (roleIsCoreManager(rol)) return true

    const directionCodeValue = directionCode(direction)
    const candidate = direcciones.find((item) => item.codigo === directionCodeValue)
    if (!candidate) return false

    return directorDirectionIdSet.has(candidate.id)
  }, [direcciones, directorDirectionIdSet, rol, user])

  const canCreateInstitutionalProject = useCallback(() => {
    if (!user) return false
    return roleIsCoreManager(rol)
  }, [rol, user])

  const canManageProject = useCallback((project: ProyectoTarea) => {
    if (!user) return false
    if (roleIsCoreManager(rol)) return true
    if (project.responsable_socio_id && project.responsable_socio_id === user.socio_id) return true
    if (project.direccion_id && directorDirectionIdSet.has(project.direccion_id)) return true
    return false
  }, [directorDirectionIdSet, rol, user])

  const canManageTask = useCallback((task: TareaProyecto) => {
    if (!user) return false
    const project = projectById.get(task.proyecto_id)
    if (project && canManageProject(project)) return true
    if (task.direccion_responsable_id && directorDirectionIdSet.has(task.direccion_responsable_id)) return true
    return false
  }, [canManageProject, directorDirectionIdSet, projectById, user])

  const canEditTask = useCallback((task: TareaProyecto) => {
    if (canManageTask(task)) return true
    return isAssignedToCurrentUser(task)
  }, [canManageTask, isAssignedToCurrentUser])

  const canEditSubtask = useCallback((subtask: SubtareaProyecto) => {
    const parentTask = taskById.get(subtask.tarea_id)
    if (parentTask && canManageTask(parentTask)) return true
    return isAssignedToCurrentUser(subtask)
  }, [canManageTask, isAssignedToCurrentUser, taskById])

  const canSendTaskToCd = useCallback((task: TareaProyecto) => {
    if (!canManageTask(task)) return false
    return task.estado_backend !== 'cerrada'
  }, [canManageTask])

  const canResolveTaskCd = useCallback((taskId: string) => {
    if (!user) return false
    if (!(rol === 'admin' || rol === 'comision_directiva')) return false

    const approvals = approvalsByTaskId.get(taskId) || []
    if (rol === 'admin') {
      return approvals.some((approval) => approval.decision === 'pendiente')
    }

    return approvals.some((approval) => approval.decision === 'pendiente' && approval.socio_id === user.socio_id)
  }, [approvalsByTaskId, rol, user])

  const getPendingApprovalForTask = useCallback((taskId: string) => {
    const approvals = approvalsByTaskId.get(taskId) || []

    if (rol === 'admin') {
      return approvals.find((approval) => approval.decision === 'pendiente') || null
    }

    if (!user) return null

    return approvals.find(
      (approval) => approval.decision === 'pendiente' && approval.socio_id === user.socio_id
    ) || null
  }, [approvalsByTaskId, rol, user])

  const projectAccess = useCallback((project: ProyectoTarea): AccesoProyectoTarea => {
    const canManage = canManageProject(project)
    if (canManage) {
      return {
        canManage: true,
        canCreate: true,
        canAssign: true,
        canHandoff: true,
        canDelete: true,
        canSubmitCd: true,
        canApproveCd: true,
        canEditAssigned: true,
        readOnly: false,
      }
    }

    const assignedTasks = (tasksByProjectId.get(project.id) || []).some((task) => isAssignedToCurrentUser(task))
    const assignedSubtasks = (tasksByProjectId.get(project.id) || []).some((task) =>
      (subtasksByTaskId.get(task.id) || []).some((subtask) => isAssignedToCurrentUser(subtask))
    )
    const canEditAssigned = assignedTasks || assignedSubtasks

    return {
      canManage: false,
      canCreate: false,
      canAssign: false,
      canHandoff: false,
      canDelete: false,
      canSubmitCd: false,
      canApproveCd: false,
      canEditAssigned,
      readOnly: !canEditAssigned,
    }
  }, [canManageProject, isAssignedToCurrentUser, subtasksByTaskId, tasksByProjectId])

  const throwPermissionError = useCallback((message: string): never => {
    toast.error(message)
    throw new FrontendPermissionError(message)
  }, [])

  const callRpcWithFallback = useCallback(async (actionLabel: string, attempts: RpcAttempt[]) => {
    let lastError: unknown = null

    for (const attempt of attempts) {
      const { data, error } = await supabase.rpc(attempt.fn, attempt.args)
      if (!error) return data

      if (isMissingFunctionError(error)) {
        lastError = error
        continue
      }

      throw error
    }

    const fallbackError = lastError || new Error(`RPC no disponible para ${actionLabel}`)
    throw fallbackError
  }, [])

  const runMutation = useCallback(async <T,>(
    actionKey: string,
    actionLabel: string,
    run: () => Promise<T>,
    successMessage?: string
  ) => {
    try {
      setMutatingAction(actionKey)
      const result = await run()
      if (successMessage) toast.success(successMessage)
      await fetchDataRef.current()
      return result
    } catch (error) {
      if (error instanceof FrontendPermissionError) {
        throw error
      }

      if (isMissingFunctionError(error)) {
        toast.error('Backend de tareas desactualizado: faltan RPC del módulo.')
        throw error
      }

      if (isPermissionDeniedError(error)) {
        toast.error(`Permiso denegado al ${actionLabel}.`)
        throw error
      }

      toast.error(toErrorMessage(error))
      throw error
    } finally {
      setMutatingAction(null)
    }
  }, [])

  const fetchTableRows = useCallback(async (
    candidates: readonly string[],
    label: string,
    required: boolean
  ): Promise<{ table: string | null; rows: GenericRow[] }> => {
    let lastError: unknown = null

    for (const table of candidates) {
      const { data, error } = await runWithRecovery(
        () => supabase.from(table).select('*'),
        { label: `${label}:${table}` }
      )

      if (error) {
        if (isMissingRelationError(error)) {
          lastError = error
          continue
        }
        throw error
      }

      return { table, rows: (data || []) as GenericRow[] }
    }

    if (required) {
      throw new TaskSchemaUnavailableError(`No se encontraron tablas compatibles para ${label}.`)
    }

    if (lastError) {
      console.warn(`Submódulo opcional no disponible (${label}):`, toErrorMessage(lastError))
    }

    return { table: null, rows: [] }
  }, [])

  const fetchAssignableUsers = useCallback(async () => {
    const { data, error } = await runWithRecovery(
      () => supabase
        .from('socios')
        .select('id, usuario_id, nombre, apellido, email, rol, rol_aile, rol_aile_definition:rol_aile_definitions(nombre)')
        .eq('estado', 'activo')
        .not('usuario_id', 'is', null)
        .order('apellido', { ascending: true }),
      { label: 'tareas usuarios asignables' }
    )

    if (error) throw error

    return ((data || []) as GenericRow[]).flatMap((row) => {
      const usuarioId = readNullableString(row, ['usuario_id'])
      const socioId = readString(row, ['id'])
      if (!usuarioId || !socioId) return []

      const roleDefinition = row.rol_aile_definition as { nombre?: string } | null
      const rolAile = roleDefinition?.nombre || readNullableString(row, ['rol_aile'])

      return [{
        socio_id: socioId,
        usuario_id: usuarioId,
        nombre: readString(row, ['nombre'], 'Sin nombre'),
        apellido: readString(row, ['apellido'], ''),
        email: readNullableString(row, ['email']),
        rol: (readString(row, ['rol'], 'socio') as Rol),
        rol_aile: rolAile,
      }] as UsuarioAsignableTarea[]
    })
  }, [])

  const fetchDirectorMembershipRows = useCallback(async () => {
    if (!user?.socio_id) return [] as GenericRow[]

    const { table, rows } = await fetchTableRows(
      DIRECTOR_MEMBERSHIP_TABLE_CANDIDATES,
      'socios_direcciones',
      false
    )

    if (!table) return []

    const now = new Date()

    return rows.filter((row) => {
      const socioId = readString(row, ['socio_id'])
      if (!socioId || socioId !== user.socio_id) return false
      if (!readBoolean(row, ['activo'], true)) return false
      if (!readBoolean(row, ['es_director'], false)) return false

      const endDate = readNullableString(row, ['fecha_hasta'])
      if (!endDate) return true

      const parsedEndDate = new Date(endDate)
      if (Number.isNaN(parsedEndDate.getTime())) return true
      return parsedEndDate >= new Date(now.toDateString())
    })
  }, [fetchTableRows, user?.socio_id])

  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false)
      setProyectos([])
      setTareas([])
      setSubtareas([])
      setAprobacionesCd([])
      setUsuariosAsignables([])
      setDirecciones([])
      setDirectorDirectionIds([])
      return
    }

    setLoading(true)

    try {
      const [
        users,
        directionsResult,
        projectsResult,
        tasksResult,
        subtasksResult,
        approvalsResult,
        directorMembershipRows,
      ] = await Promise.all([
        fetchAssignableUsers(),
        fetchTableRows(DIRECTIONS_TABLE_CANDIDATES, 'direcciones', true),
        fetchTableRows(PROJECT_TABLE_CANDIDATES, 'proyectos', true),
        fetchTableRows(TASK_TABLE_CANDIDATES, 'tareas', true),
        fetchTableRows(SUBTASK_TABLE_CANDIDATES, 'subtareas', false),
        fetchTableRows(APPROVAL_TABLE_CANDIDATES, 'tareas_aprobaciones_cd', false),
        fetchDirectorMembershipRows(),
      ])

      const parsedDirections = directionsResult.rows
        .map((row) => {
          const id = readString(row, ['id'])
          if (!id) return null
          return {
            id,
            codigo: readString(row, ['codigo']),
            nombre: readString(row, ['nombre']),
          }
        })
        .filter((row): row is DirectionRow => row !== null)

      const directionByIdMap = new Map<string, DirectionRow>()
      for (const direction of parsedDirections) {
        directionByIdMap.set(direction.id, direction)
      }

      const socioToUsuarioMap = new Map<string, string>()
      users.forEach((item) => socioToUsuarioMap.set(item.socio_id, item.usuario_id))

      const parsedProjects = projectsResult.rows
        .map((row) => {
          const id = readString(row, ['id'])
          if (!id) return null

          const projectType = (normalizeText(readString(row, ['tipo'], 'interno_direccion')) === 'institucional'
            ? 'institucional'
            : 'interno_direccion') as TipoProyectoTarea
          const directionId = readNullableString(row, ['direccion_id'])
          const linkedDirection = directionId ? directionByIdMap.get(directionId) : undefined
          const rowDirection = readNullableString(row, ['direccion', 'direccion_codigo', 'direccion_nombre'])
          const directionLabel = linkedDirection
            ? directionFromCodeOrName(linkedDirection.nombre || linkedDirection.codigo)
            : rowDirection
              ? directionFromCodeOrName(rowDirection)
              : (projectType === 'institucional' ? null : 'CEA')

          const active = readBoolean(row, ['activo'], true)
          const fechaCierre = readNullableString(row, ['fecha_cierre'])

          let projectState: EstadoProyectoTarea = 'en_ejecucion'
          if (!active || fechaCierre) {
            projectState = 'archivado'
          }

          return {
            id,
            nombre: readString(row, ['nombre', 'titulo', 'name'], 'Proyecto sin nombre'),
            descripcion: readNullableString(row, ['descripcion', 'description']),
            tipo: projectType,
            orden: readNumber(row, ['orden_tablero', 'orden']),
            direccion_id: directionId,
            direccion: directionLabel,
            estado: projectState,
            activo: active,
            fecha_cierre: fechaCierre,
            responsable_socio_id: readNullableString(row, ['responsable_socio_id']),
            created_by: readNullableString(row, ['creado_por_socio_id', 'created_by']),
            updated_by: readNullableString(row, ['updated_by_socio_id', 'updated_by']),
            created_at: asIsoDate(readNullableString(row, ['created_at'])),
            updated_at: readNullableString(row, ['updated_at']),
          } as ProyectoTarea
        })
        .filter((project): project is ProyectoTarea => project !== null)
        .sort((left, right) => {
          const leftOrder = left.orden
          const rightOrder = right.orden
          const leftHasOrder = typeof leftOrder === 'number' && Number.isFinite(leftOrder)
          const rightHasOrder = typeof rightOrder === 'number' && Number.isFinite(rightOrder)

          if (leftHasOrder && rightHasOrder && leftOrder !== rightOrder) {
            return leftOrder - rightOrder
          }

          if (leftHasOrder !== rightHasOrder) {
            return leftHasOrder ? -1 : 1
          }

          const leftCreatedAt = Date.parse(left.created_at || '')
          const rightCreatedAt = Date.parse(right.created_at || '')
          if (Number.isFinite(leftCreatedAt) && Number.isFinite(rightCreatedAt) && leftCreatedAt !== rightCreatedAt) {
            return leftCreatedAt - rightCreatedAt
          }

          return left.nombre.localeCompare(right.nombre, 'es', { sensitivity: 'base' })
        })
      const parsedProjectById = new Map(parsedProjects.map((project) => [project.id, project]))

      const parsedTasks = tasksResult.rows
        .map((row) => {
          const id = readString(row, ['id'])
          const projectId = readString(row, ['proyecto_id'])
          if (!id || !projectId) return null

          const workflowState = normalizeWorkflowState(readString(row, ['estado'], 'por_hacer'))
          const assigneeSocioId = readNullableString(row, ['asignado_socio_id'])
          const assigneeUserId = assigneeSocioId ? socioToUsuarioMap.get(assigneeSocioId) || null : null
          const parentProject = parsedProjectById.get(projectId)
          const fallbackDirectionId = parentProject?.tipo === 'interno_direccion'
            ? (parentProject.direccion_id || null)
            : null
          const directionResponsibleId = readNullableString(row, ['direccion_responsable_id']) || fallbackDirectionId
          const linkedDirection = directionResponsibleId
            ? directionByIdMap.get(directionResponsibleId)
            : undefined
          const rowDirection = readNullableString(row, ['direccion_responsable', 'direccion_responsable_codigo'])
          const fallbackDirection = parentProject?.tipo === 'interno_direccion'
            ? (parentProject.direccion || null)
            : null
          const directionResponsible = linkedDirection
            ? directionFromCodeOrName(linkedDirection.nombre || linkedDirection.codigo)
            : rowDirection
              ? directionFromCodeOrName(rowDirection)
              : fallbackDirection

          return {
            id,
            proyecto_id: projectId,
            titulo: readString(row, ['titulo', 'nombre'], 'Tarea sin título'),
            descripcion: readNullableString(row, ['descripcion']),
            estado: toKanbanState(workflowState),
            estado_backend: workflowState,
            prioridad: mapPriority(readNumber(row, ['prioridad'])),
            orden: readNumber(row, ['orden_en_columna', 'orden']),
            fecha_limite: readNullableString(row, ['fecha_vencimiento']),
            direccion_responsable_id: directionResponsibleId,
            direccion_responsable: directionResponsible,
            asignado_usuario_id: assigneeUserId,
            asignado_socio_id: assigneeSocioId,
            created_by: readNullableString(row, ['creado_por_socio_id']),
            updated_by: readNullableString(row, ['updated_by_socio_id']),
            created_at: asIsoDate(readNullableString(row, ['created_at'])),
            updated_at: readNullableString(row, ['updated_at']),
          } as TareaProyecto
        })
        .filter((task): task is TareaProyecto => task !== null)

      const parsedSubtasks = subtasksResult.rows
        .map((row) => {
          const id = readString(row, ['id'])
          const taskId = readString(row, ['tarea_id'])
          if (!id || !taskId) return null

          const workflowState = normalizeWorkflowState(readString(row, ['estado'], 'por_hacer'))
          const assigneeSocioId = readNullableString(row, ['asignado_socio_id'])
          const assigneeUserId = assigneeSocioId ? socioToUsuarioMap.get(assigneeSocioId) || null : null

          return {
            id,
            tarea_id: taskId,
            titulo: readString(row, ['titulo', 'nombre'], 'Subtarea sin título'),
            descripcion: readNullableString(row, ['descripcion']),
            estado: toKanbanState(workflowState),
            estado_backend: workflowState,
            orden: readNumber(row, ['orden_en_columna', 'orden']),
            asignado_usuario_id: assigneeUserId,
            asignado_socio_id: assigneeSocioId,
            created_by: readNullableString(row, ['creado_por_socio_id']),
            updated_by: readNullableString(row, ['updated_by_socio_id']),
            created_at: asIsoDate(readNullableString(row, ['created_at'])),
            updated_at: readNullableString(row, ['updated_at']),
          } as SubtareaProyecto
        })
        .filter((subtask): subtask is SubtareaProyecto => subtask !== null)

      const parsedApprovals = approvalsResult.rows
        .map((row) => {
          const id = readString(row, ['id'])
          const taskId = readString(row, ['tarea_id'])
          const socioId = readString(row, ['socio_id'])
          if (!id || !taskId || !socioId) return null

          const decisionRaw = normalizeText(readString(row, ['decision'], 'pendiente'))
          const decision = (
            decisionRaw === 'aprobada' ||
            decisionRaw === 'observada' ||
            decisionRaw === 'rechazada'
              ? decisionRaw
              : 'pendiente'
          ) as TareaAprobacionCD['decision']

          return {
            id,
            tarea_id: taskId,
            socio_id: socioId,
            decision,
            observacion: readNullableString(row, ['observacion']),
            aprobado_at: readNullableString(row, ['aprobado_at']),
            metadata: (row.metadata as Record<string, unknown> | undefined) || {},
            created_at: asIsoDate(readNullableString(row, ['created_at'])),
            updated_at: readNullableString(row, ['updated_at']),
          } as TareaAprobacionCD
        })
        .filter((approval): approval is TareaAprobacionCD => approval !== null)

      const directorIds = directorMembershipRows
        .map((row) => readString(row, ['direccion_id']))
        .filter(Boolean)

      setUsuariosAsignables(users)
      setDirecciones(parsedDirections)
      setDirectorDirectionIds(directorIds)
      setProyectos(parsedProjects)
      setTareas(parsedTasks)
      setSubtareas(parsedSubtasks)
      setAprobacionesCd(parsedApprovals)
      setSourceMeta({
        proyectos: projectsResult.table,
        tareas: tasksResult.table,
        subtareas: subtasksResult.table,
        aprobacionesCd: approvalsResult.table,
      })

      setBackendAvailable(true)
      setBackendMessage(null)
      missingSchemaNotifiedRef.current = false
    } catch (error) {
      if (error instanceof TaskSchemaUnavailableError || isMissingRelationError(error)) {
        setBackendAvailable(false)
        const message = 'Módulo de tareas no habilitado en base de datos. Ejecuta migraciones/RPC del módulo.'
        setBackendMessage(message)
        setProyectos([])
        setTareas([])
        setSubtareas([])
        setAprobacionesCd([])

        if (!missingSchemaNotifiedRef.current) {
          toast.error(message)
          missingSchemaNotifiedRef.current = true
        }
      } else {
        console.error('Error cargando tareas:', error)
        toast.error('No se pudieron cargar proyectos y tareas')
      }
    } finally {
      setLoading(false)
    }
  }, [fetchAssignableUsers, fetchDirectorMembershipRows, fetchTableRows, user])

  useEffect(() => {
    fetchDataRef.current = fetchData
  }, [fetchData])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  useResumeRefresh(() => {
    void fetchData()
  }, { throttleMs: 5_000 })

  const createProject = useCallback(async (payload: CrearProyectoPayload) => {
    if (payload.tipo === 'institucional') {
      if (!canCreateInstitutionalProject()) {
        throwPermissionError('Solo Comisión Directiva/Admin puede crear proyectos institucionales globales.')
      }
    } else if (!payload.direccion || !canCreateProjectInDirection(payload.direccion)) {
      throwPermissionError('No tienes permisos para crear proyectos en esa dirección.')
    }

    const rpcPayload: Record<string, unknown> = {
      nombre: payload.nombre,
      descripcion: payload.descripcion || null,
      tipo: payload.tipo,
    }

    if (payload.direccion) {
      rpcPayload.direccion = payload.direccion
      rpcPayload.direccion_codigo = directionCode(payload.direccion)
    }

    return runMutation(
      'create-project',
      'crear proyecto',
      async () => callRpcWithFallback('crear proyecto', [
        { fn: 'rpc_tasks_create_project', args: { p_payload: rpcPayload } },
        { fn: 'rpc_tareas_crear_proyecto', args: { p_payload: rpcPayload } },
      ]),
      'Proyecto creado'
    )
  }, [callRpcWithFallback, canCreateInstitutionalProject, canCreateProjectInDirection, runMutation, throwPermissionError])

  const updateProject = useCallback(async (projectId: string, payload: ActualizarProyectoPayload) => {
    const project = projectById.get(projectId)
    if (!project) throw new Error('Proyecto no encontrado')

    if (!canManageProject(project)) {
      throwPermissionError('No tienes permisos para editar este proyecto.')
    }

    const rpcPayload: Record<string, unknown> = {}
    if (payload.nombre !== undefined) rpcPayload.nombre = payload.nombre
    if (payload.descripcion !== undefined) rpcPayload.descripcion = payload.descripcion ?? null
    if (payload.tipo !== undefined) rpcPayload.tipo = payload.tipo
    if (payload.activo !== undefined) rpcPayload.activo = payload.activo
    if (payload.orden_tablero !== undefined) rpcPayload.orden_tablero = payload.orden_tablero

    if (Object.prototype.hasOwnProperty.call(payload, 'direccion')) {
      rpcPayload.direccion = payload.direccion || null
      rpcPayload.direccion_codigo = payload.direccion ? directionCode(payload.direccion) : null
    }

    if (Object.keys(rpcPayload).length === 0) {
      return project
    }

    return runMutation(
      'update-project',
      'editar proyecto',
      async () => callRpcWithFallback('editar proyecto', [
        {
          fn: 'rpc_tasks_update_project',
          args: { p_proyecto_id: projectId, p_payload: rpcPayload },
        },
        {
          fn: 'rpc_tareas_actualizar_proyecto',
          args: { p_proyecto_id: projectId, p_payload: rpcPayload },
        },
      ]),
      'Proyecto actualizado'
    )
  }, [callRpcWithFallback, canManageProject, projectById, runMutation, throwPermissionError])

  const reorderProjects = useCallback(async (updates: Array<{ proyecto_id: string; orden_tablero: number }>) => {
    if (updates.length === 0) return

    for (const update of updates) {
      const project = projectById.get(update.proyecto_id)
      if (!project) {
        throw new Error('Proyecto no encontrado')
      }

      if (!canManageProject(project)) {
        throwPermissionError('No tienes permisos para reordenar este proyecto.')
      }
    }

    const payload = updates.map((update) => ({
      proyecto_id: update.proyecto_id,
      orden_tablero: update.orden_tablero,
    }))

    return runMutation(
      'reorder-projects',
      'reordenar proyectos',
      async () => callRpcWithFallback('reordenar proyectos', [
        { fn: 'rpc_tasks_reorder_projects', args: { p_payload: payload } },
        { fn: 'rpc_tareas_reordenar_proyectos', args: { p_payload: payload } },
      ]),
      'Orden de proyectos actualizado'
    )
  }, [callRpcWithFallback, canManageProject, projectById, runMutation, throwPermissionError])

  const deleteProject = useCallback(async (projectId: string) => {
    const project = projectById.get(projectId)
    if (!project) throw new Error('Proyecto no encontrado')

    if (!canManageProject(project)) {
      throwPermissionError('No tienes permisos para borrar este proyecto.')
    }

    return runMutation(
      'delete-project',
      'borrar proyecto',
      async () => callRpcWithFallback('borrado de proyecto', [
        { fn: 'rpc_tasks_delete_project', args: { p_proyecto_id: projectId } },
        { fn: 'rpc_tareas_delete_project', args: { p_proyecto_id: projectId } },
        {
          fn: 'rpc_tasks_update_project',
          args: {
            p_proyecto_id: projectId,
            p_payload: { activo: false },
          },
        },
        {
          fn: 'rpc_tareas_actualizar_proyecto',
          args: {
            p_proyecto_id: projectId,
            p_payload: { activo: false },
          },
        },
      ]),
      'Proyecto archivado'
    )
  }, [callRpcWithFallback, canManageProject, projectById, runMutation, throwPermissionError])

  const createTask = useCallback(async (payload: CrearTareaPayload) => {
    const project = projectById.get(payload.proyecto_id)
    if (!project) throw new Error('Proyecto no encontrado')
    if (!canManageProject(project)) {
      throwPermissionError('No tienes permisos para crear tareas en este proyecto.')
    }

    const assigneeSocioId = payload.asignado_socio_id
      || (payload.asignado_usuario_id ? usuarioById.get(payload.asignado_usuario_id)?.socio_id || null : null)

    const rpcPayload = {
      proyecto_id: payload.proyecto_id,
      titulo: payload.titulo,
      descripcion: payload.descripcion || null,
      estado: toBackendState(payload.estado || 'pendiente'),
      fecha_vencimiento: payload.fecha_limite || null,
      direccion_responsable: payload.direccion_responsable || null,
      direccion_responsable_codigo: payload.direccion_responsable
        ? directionCode(payload.direccion_responsable)
        : null,
      asignado_socio_id: assigneeSocioId,
    }

    return runMutation(
      'create-task',
      'crear tarea',
      async () => callRpcWithFallback('crear tarea', [
        { fn: 'rpc_tasks_create_task', args: { p_payload: rpcPayload } },
        { fn: 'rpc_tareas_crear_tarea', args: { p_payload: rpcPayload } },
      ]),
      'Tarea creada'
    )
  }, [callRpcWithFallback, canManageProject, projectById, runMutation, throwPermissionError, usuarioById])

  const createSubtask = useCallback(async (payload: CrearSubtareaPayload) => {
    const parentTask = taskById.get(payload.tarea_id)
    if (!parentTask) throw new Error('Tarea no encontrada')

    const project = projectById.get(parentTask.proyecto_id)
    if (!project) throw new Error('Proyecto no encontrado')

    if (!canManageProject(project)) {
      throwPermissionError('No tienes permisos para crear subtareas en este proyecto.')
    }

    const assigneeSocioId = payload.asignado_socio_id
      || (payload.asignado_usuario_id ? usuarioById.get(payload.asignado_usuario_id)?.socio_id || null : null)

    const rpcPayload = {
      tarea_id: payload.tarea_id,
      titulo: payload.titulo,
      descripcion: payload.descripcion || null,
      estado: toBackendState(payload.estado || 'pendiente'),
      asignado_socio_id: assigneeSocioId,
    }

    return runMutation(
      'create-subtask',
      'crear subtarea',
      async () => callRpcWithFallback('crear subtarea', [
        { fn: 'rpc_tasks_create_subtask', args: { p_payload: rpcPayload } },
        { fn: 'rpc_tareas_crear_subtarea', args: { p_payload: rpcPayload } },
      ]),
      'Subtarea creada'
    )
  }, [callRpcWithFallback, canManageProject, projectById, runMutation, taskById, throwPermissionError, usuarioById])

  const assignTask = useCallback(async (
    taskId: string,
    assigneeUserId: string,
    assigneeSocioId?: string | null
  ) => {
    const task = taskById.get(taskId)
    if (!task) throw new Error('Tarea no encontrada')

    if (!canManageTask(task)) {
      throwPermissionError('Solo gestión del proyecto puede asignar o reasignar tareas.')
    }

    const targetSocioId = assigneeSocioId || usuarioById.get(assigneeUserId)?.socio_id
    if (!targetSocioId) {
      throw new Error('No se pudo determinar el socio destino para la asignación')
    }

    return runMutation(
      'assign-task',
      'asignar tarea',
      async () => callRpcWithFallback('asignar tarea', [
        {
          fn: 'rpc_tasks_assign_task',
          args: {
            p_tarea_id: taskId,
            p_asignado_socio_id: targetSocioId,
            p_motivo: null,
          },
        },
        {
          fn: 'rpc_tareas_asignar_tarea',
          args: {
            p_tarea_id: taskId,
            p_socio_id: targetSocioId,
          },
        },
      ]),
      'Tarea asignada'
    )
  }, [callRpcWithFallback, canManageTask, runMutation, taskById, throwPermissionError, usuarioById])

  const handoffTask = useCallback(async (
    taskId: string,
    newAssigneeUserId: string,
    newAssigneeSocioId?: string | null,
    note?: string
  ) => {
    const task = taskById.get(taskId)
    if (!task) throw new Error('Tarea no encontrada')

    if (!canManageTask(task)) {
      throwPermissionError('Solo gestión del proyecto puede hacer handoff de tareas.')
    }

    const targetSocioId = newAssigneeSocioId || usuarioById.get(newAssigneeUserId)?.socio_id
    if (!targetSocioId) {
      throw new Error('No se pudo determinar el socio destino para el handoff')
    }

    return runMutation(
      'handoff-task',
      'realizar handoff',
      async () => callRpcWithFallback('handoff de tarea', [
        {
          fn: 'rpc_tasks_handoff_task',
          args: {
            p_tarea_id: taskId,
            p_hacia_socio_id: targetSocioId,
            p_motivo: note || null,
          },
        },
        {
          fn: 'rpc_tareas_handoff_tarea',
          args: {
            p_tarea_id: taskId,
            p_hacia_socio_id: targetSocioId,
            p_motivo: note || null,
          },
        },
      ]),
      'Handoff aplicado'
    )
  }, [callRpcWithFallback, canManageTask, runMutation, taskById, throwPermissionError, usuarioById])

  const deleteTask = useCallback(async (taskId: string) => {
    const task = taskById.get(taskId)
    if (!task) throw new Error('Tarea no encontrada')

    if (!canManageTask(task)) {
      throwPermissionError('No tienes permisos para borrar tareas de este proyecto.')
    }

    return runMutation(
      'delete-task',
      'borrar tarea',
      async () => callRpcWithFallback('borrado de tarea', [
        { fn: 'rpc_tasks_delete_task', args: { p_tarea_id: taskId } },
        { fn: 'rpc_tareas_delete_task', args: { p_tarea_id: taskId } },
        {
          fn: 'rpc_tasks_update_task_editable',
          args: {
            p_tarea_id: taskId,
            p_payload: { estado: 'cerrada' },
          },
        },
      ]),
      'Tarea archivada'
    )
  }, [callRpcWithFallback, canManageTask, runMutation, taskById, throwPermissionError])

  const moveTask = useCallback(async (taskId: string, status: EstadoTareaKanban) => {
    const task = taskById.get(taskId)
    if (!task) throw new Error('Tarea no encontrada')

    const canManage = canManageTask(task)
    const canEditAssigned = isAssignedToCurrentUser(task)
    if (!canManage && !canEditAssigned) {
      throwPermissionError('Solo gestión o persona asignada puede mover esta tarea.')
    }

    return runMutation(
      'move-task',
      'mover tarea',
      async () => callRpcWithFallback('mover tarea', [
        {
          fn: 'rpc_tasks_update_task_editable',
          args: {
            p_tarea_id: taskId,
            p_payload: {
              estado: toBackendState(status),
            },
          },
        },
        {
          fn: 'rpc_tareas_actualizar_tarea_asignada',
          args: {
            p_tarea_id: taskId,
            p_payload: {
              estado: toBackendState(status),
            },
          },
        },
      ])
    )
  }, [callRpcWithFallback, canManageTask, isAssignedToCurrentUser, runMutation, taskById, throwPermissionError])

  const updateAssignedTask = useCallback(async (taskId: string, payload: ActualizarTareaPayload) => {
    const task = taskById.get(taskId)
    if (!task) throw new Error('Tarea no encontrada')

    const canManage = canManageTask(task)
    const canEdit = canManage || isAssignedToCurrentUser(task)
    if (!canEdit) {
      throwPermissionError('Solo gestión o la persona asignada puede editar la tarea.')
    }

    const rpcPayload: Record<string, unknown> = {
      descripcion: payload.descripcion ?? null,
      fecha_vencimiento: payload.fecha_limite ?? null,
    }

    if (payload.estado) {
      rpcPayload.estado = toBackendState(payload.estado)
    }

    if (canManage && payload.titulo !== undefined) {
      rpcPayload.titulo = payload.titulo
    }

    if (canManage && Object.prototype.hasOwnProperty.call(payload, 'direccion_responsable')) {
      rpcPayload.direccion_responsable = payload.direccion_responsable || null
      rpcPayload.direccion_responsable_codigo = payload.direccion_responsable
        ? directionCode(payload.direccion_responsable)
        : null
    }

    return runMutation(
      'update-task',
      'editar tarea',
      async () => callRpcWithFallback('editar tarea', [
        {
          fn: 'rpc_tasks_update_task_editable',
          args: {
            p_tarea_id: taskId,
            p_payload: rpcPayload,
          },
        },
        {
          fn: 'rpc_tareas_actualizar_tarea_asignada',
          args: {
            p_tarea_id: taskId,
            p_payload: rpcPayload,
          },
        },
      ]),
      'Tarea actualizada'
    )
  }, [callRpcWithFallback, canManageTask, isAssignedToCurrentUser, runMutation, taskById, throwPermissionError])

  const updateAssignedSubtask = useCallback(async (subtaskId: string, payload: ActualizarSubtareaPayload) => {
    const subtask = subtareas.find((item) => item.id === subtaskId)
    if (!subtask) throw new Error('Subtarea no encontrada')

    const parentTask = taskById.get(subtask.tarea_id)
    const canManage = parentTask ? canManageTask(parentTask) : false
    const canEdit = canManage || isAssignedToCurrentUser(subtask)

    if (!canEdit) {
      throwPermissionError('Solo gestión o la persona asignada puede editar la subtarea.')
    }

    const rpcPayload: Record<string, unknown> = {
      descripcion: payload.descripcion ?? null,
    }

    if (payload.estado) {
      rpcPayload.estado = toBackendState(payload.estado)
    }

    if (canManage && payload.titulo !== undefined) {
      rpcPayload.titulo = payload.titulo
    }

    return runMutation(
      'update-subtask',
      'editar subtarea',
      async () => callRpcWithFallback('editar subtarea', [
        {
          fn: 'rpc_tasks_update_subtask_editable',
          args: {
            p_subtarea_id: subtaskId,
            p_payload: rpcPayload,
          },
        },
        {
          fn: 'rpc_tareas_actualizar_subtarea_asignada',
          args: {
            p_subtarea_id: subtaskId,
            p_payload: rpcPayload,
          },
        },
      ]),
      'Subtarea actualizada'
    )
  }, [callRpcWithFallback, canManageTask, isAssignedToCurrentUser, runMutation, subtareas, taskById, throwPermissionError])

  const sendTaskToCd = useCallback(async (taskId: string, comment?: string) => {
    const task = taskById.get(taskId)
    if (!task) throw new Error('Tarea no encontrada')

    if (!canSendTaskToCd(task)) {
      throwPermissionError('No tienes permisos para enviar esta tarea a CD.')
    }

    return runMutation(
      'send-cd',
      'enviar a CD',
      async () => callRpcWithFallback('enviar a CD', [
        {
          fn: 'rpc_tasks_send_to_cd',
          args: {
            p_tarea_id: taskId,
            p_comentario: comment || null,
          },
        },
        {
          fn: 'rpc_tareas_send_to_cd',
          args: {
            p_tarea_id: taskId,
            p_comentario: comment || null,
          },
        },
      ]),
      'Tarea enviada a CD'
    )
  }, [callRpcWithFallback, canSendTaskToCd, runMutation, taskById, throwPermissionError])

  const resolveTaskCd = useCallback(async (taskId: string, approve: boolean, comment?: string) => {
    const task = taskById.get(taskId)
    if (!task) throw new Error('Tarea no encontrada')

    if (!canResolveTaskCd(taskId)) {
      throwPermissionError('No tienes una aprobación pendiente para esta tarea.')
    }

    const pendingApproval = getPendingApprovalForTask(taskId)
    if (!pendingApproval) {
      throw new Error('No se encontró aprobación pendiente para resolver')
    }

    return runMutation(
      approve ? 'approve-cd' : 'reject-cd',
      approve ? 'aprobar en CD' : 'rechazar en CD',
      async () => callRpcWithFallback('resolver aprobación de CD', [
        {
          fn: 'rpc_tasks_cd_resolve',
          args: {
            p_aprobacion_id: pendingApproval.id,
            p_aprobar: approve,
            p_comentario: comment || null,
          },
        },
        {
          fn: 'rpc_tareas_cd_resolve',
          args: {
            p_aprobacion_id: pendingApproval.id,
            p_aprobar: approve,
            p_comentario: comment || null,
          },
        },
      ]),
      approve ? 'Aprobación registrada' : 'Rechazo registrado'
    )
  }, [callRpcWithFallback, canResolveTaskCd, getPendingApprovalForTask, runMutation, taskById, throwPermissionError])

  const retryBackendCheck = useCallback(async () => {
    setBackendAvailable(true)
    setBackendMessage(null)
    missingSchemaNotifiedRef.current = false
    await fetchData()
  }, [fetchData])

  return {
    loading,
    mutatingAction,
    backendAvailable,
    backendMessage,
    sourceMeta,
    directions: DIRECCIONES_BASE,
    columns: KANBAN_COLUMNS,
    proyectos,
    tareas,
    subtareas,
    aprobacionesCd,
    usuariosAsignables,
    direcciones,
    directorDirectionIds,
    directionById,
    projectById,
    taskById,
    tasksByProjectId,
    subtasksByTaskId,
    approvalsByTaskId,
    socioById,
    usuarioById,
    canCreateInstitutionalProject,
    canCreateProjectInDirection,
    canManageProject,
    canManageTask,
    canEditTask,
    canEditSubtask,
    canSendTaskToCd,
    canResolveTaskCd,
    getPendingApprovalForTask,
    projectAccess,
    fetchData,
    retryBackendCheck,
    createProject,
    updateProject,
    reorderProjects,
    deleteProject,
    createTask,
    createSubtask,
    assignTask,
    handoffTask,
    deleteTask,
    moveTask,
    updateAssignedTask,
    updateAssignedSubtask,
    sendTaskToCd,
    resolveTaskCd,
  }
}
