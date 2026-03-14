'use client'

import { useMemo, useState } from 'react'
import {
  ArrowRightLeft,
  CalendarClock,
  ChevronDown,
  Check,
  CheckCircle2,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  Save,
  Send,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LinkifiedText } from '@/components/ui/linkified-text'
import { cn } from '@/lib/utils'
import type {
  DireccionBase,
  EstadoTareaKanban,
  PrioridadTarea,
  SubtareaProyecto,
  TareaProyecto,
  TipoProyectoTarea,
  UsuarioAsignableTarea,
} from '@/lib/types'
import type {
  ActualizarSubtareaPayload,
  ActualizarTareaPayload,
  CrearSubtareaPayload,
} from '@/hooks/useTareas'

interface TareasTaskCardProps {
  task: TareaProyecto
  projectType: TipoProyectoTarea
  projectDirection?: DireccionBase | null
  directions: DireccionBase[]
  subtasks: SubtareaProyecto[]
  users: UsuarioAsignableTarea[]
  canManageTask: boolean
  canEditTask: boolean
  canEditSubtask: (subtask: SubtareaProyecto) => boolean
  canSendToCd: boolean
  canResolveCd: boolean
  busy: boolean
  onMoveTask: (taskId: string, estado: EstadoTareaKanban) => Promise<unknown>
  onAssignTask: (
    taskId: string,
    usuarioId: string,
    socioId?: string | null
  ) => Promise<unknown>
  onHandoffTask: (
    taskId: string,
    usuarioId: string,
    socioId?: string | null,
    comentario?: string
  ) => Promise<unknown>
  onDeleteTask: (taskId: string) => Promise<unknown>
  onUpdateTask: (taskId: string, payload: ActualizarTareaPayload) => Promise<unknown>
  onUpdateSubtask: (subtaskId: string, payload: ActualizarSubtareaPayload) => Promise<unknown>
  onCreateSubtask: (payload: CrearSubtareaPayload) => Promise<unknown>
  onSendToCd: (taskId: string, comment?: string) => Promise<unknown>
  onResolveCd: (taskId: string, approve: boolean, comment?: string) => Promise<unknown>
}

function statusLabel(status: EstadoTareaKanban) {
  switch (status) {
    case 'pendiente':
      return 'Pendiente'
    case 'en_progreso':
      return 'En progreso'
    case 'en_revision':
      return 'En revisión'
    case 'completada':
      return 'Completada'
    default:
      return status
  }
}

function statusBadge(status: EstadoTareaKanban) {
  switch (status) {
    case 'pendiente':
      return 'bg-slate-100 text-slate-700 border-slate-200'
    case 'en_progreso':
      return 'bg-sky-100 text-sky-700 border-sky-200'
    case 'en_revision':
      return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'completada':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    default:
      return ''
  }
}

function statusMarker(status: EstadoTareaKanban) {
  switch (status) {
    case 'pendiente':
      return 'border-slate-400 text-slate-500'
    case 'en_progreso':
      return 'border-sky-500 text-sky-500'
    case 'en_revision':
      return 'border-amber-500 text-amber-500'
    case 'completada':
      return 'border-emerald-500 text-emerald-500'
    default:
      return 'border-slate-400 text-slate-500'
  }
}

const STATUS_OPTIONS: EstadoTareaKanban[] = ['pendiente', 'en_progreso', 'en_revision', 'completada']
const PRIORITY_OPTIONS: PrioridadTarea[] = [1, 2, 3, 4]

function priorityLabel(priority: PrioridadTarea) {
  return `P${priority}`
}

function priorityDescription(priority: PrioridadTarea) {
  switch (priority) {
    case 1:
      return 'Crítica'
    case 2:
      return 'Alta'
    case 3:
      return 'Media'
    case 4:
      return 'Baja'
    default:
      return ''
  }
}

function priorityBadge(priority: PrioridadTarea) {
  switch (priority) {
    case 1:
      return 'bg-rose-100 text-rose-700 border-rose-200'
    case 2:
      return 'bg-orange-100 text-orange-700 border-orange-200'
    case 3:
      return 'bg-sky-100 text-sky-700 border-sky-200'
    case 4:
      return 'bg-slate-100 text-slate-700 border-slate-200'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200'
  }
}

function workflowLabel(value?: string | null) {
  const normalized = (value || '').trim()
  if (!normalized) return null

  const labels: Record<string, string> = {
    backlog: 'Backlog',
    por_hacer: 'Por hacer',
    en_progreso: 'En progreso',
    en_revision_direccion: 'En revisión dirección',
    pendiente_handoff: 'Pendiente handoff',
    pendiente_aprobacion_cd: 'Pendiente aprobación CD',
    observada_cd: 'Observada CD',
    aprobada_cd: 'Aprobada CD',
    cerrada: 'Cerrada',
  }

  return labels[normalized] || normalized
}

function parseDateOnly(value?: string | null): Date | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(year, month - 1, day, 0, 0, 0, 0)

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null
  }

  return parsed
}

function startOfDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function formatDueDate(value?: string | null): string | null {
  const parsed = parseDateOnly(value)
  if (!parsed) return null
  return parsed.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
  })
}

function truncateText(value?: string | null, maxLength = 120): string {
  const normalized = (value || '').replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1)}…`
}

export function TareasTaskCard({
  task,
  projectType,
  projectDirection,
  directions,
  subtasks,
  users,
  canManageTask,
  canEditTask,
  canEditSubtask,
  canSendToCd,
  canResolveCd,
  busy,
  onMoveTask,
  onAssignTask,
  onHandoffTask,
  onDeleteTask,
  onUpdateTask,
  onUpdateSubtask,
  onCreateSubtask,
  onSendToCd,
  onResolveCd,
}: TareasTaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [openEdit, setOpenEdit] = useState(false)
  const [openAssign, setOpenAssign] = useState(false)
  const [openHandoff, setOpenHandoff] = useState(false)
  const [openNewSubtask, setOpenNewSubtask] = useState(false)
  const [openSendToCd, setOpenSendToCd] = useState(false)
  const [openResolveCd, setOpenResolveCd] = useState(false)
  const [editingSubtask, setEditingSubtask] = useState<SubtareaProyecto | null>(null)

  const [editTitle, setEditTitle] = useState(task.titulo)
  const [editDescription, setEditDescription] = useState(task.descripcion || '')
  const [editStatus, setEditStatus] = useState<EstadoTareaKanban>(task.estado)
  const [editPriority, setEditPriority] = useState<PrioridadTarea>(task.prioridad || 3)
  const [editDueDate, setEditDueDate] = useState(task.fecha_limite || '')
  const [editDirectionResponsible, setEditDirectionResponsible] = useState<DireccionBase | ''>(
    task.direccion_responsable || projectDirection || ''
  )

  const [selectedAssignee, setSelectedAssignee] = useState(task.asignado_usuario_id || '')
  const [handoffAssignee, setHandoffAssignee] = useState('')
  const [handoffNote, setHandoffNote] = useState('')

  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [newSubtaskDescription, setNewSubtaskDescription] = useState('')
  const [newSubtaskStatus, setNewSubtaskStatus] = useState<EstadoTareaKanban>('pendiente')
  const [newSubtaskAssignee, setNewSubtaskAssignee] = useState('')

  const [editSubtaskTitle, setEditSubtaskTitle] = useState('')
  const [editSubtaskDescription, setEditSubtaskDescription] = useState('')
  const [editSubtaskStatus, setEditSubtaskStatus] = useState<EstadoTareaKanban>('pendiente')
  const [sendCdComment, setSendCdComment] = useState('')
  const [resolveApprove, setResolveApprove] = useState(true)
  const [resolveComment, setResolveComment] = useState('')

  const openEditDialog = () => {
    setEditTitle(task.titulo)
    setEditDescription(task.descripcion || '')
    setEditStatus(task.estado)
    setEditPriority(task.prioridad || 3)
    setEditDueDate(task.fecha_limite || '')
    setEditDirectionResponsible(task.direccion_responsable || projectDirection || '')
    setSelectedAssignee(task.asignado_usuario_id || '')
    setOpenEdit(true)
  }

  const openAssignDialog = () => {
    setSelectedAssignee(task.asignado_usuario_id || '')
    setOpenAssign(true)
  }

  const openHandoffDialog = () => {
    setHandoffAssignee('')
    setHandoffNote('')
    setOpenHandoff(true)
  }

  const openNewSubtaskDialog = () => {
    setNewSubtaskTitle('')
    setNewSubtaskDescription('')
    setNewSubtaskStatus('pendiente')
    setNewSubtaskAssignee('')
    setOpenNewSubtask(true)
  }

  const openSendToCdDialog = () => {
    setSendCdComment('')
    setOpenSendToCd(true)
  }

  const openResolveCdDialog = (approve: boolean) => {
    setResolveApprove(approve)
    setResolveComment('')
    setOpenResolveCd(true)
  }

  const userById = useMemo(() => {
    const map = new Map<string, UsuarioAsignableTarea>()
    for (const member of users) {
      map.set(member.usuario_id, member)
    }
    return map
  }, [users])

  const assignee = task.asignado_usuario_id ? userById.get(task.asignado_usuario_id) : undefined
  const assigneeName = assignee ? `${assignee.nombre} ${assignee.apellido}`.trim() : 'Sin asignar'
  const taskPriority = task.prioridad || 3
  const backendWorkflowLabel = workflowLabel(task.estado_backend)
  const dueDate = parseDateOnly(task.fecha_limite)
  const dueDateLabel = formatDueDate(task.fecha_limite)
  const dueDateCompactLabel = dueDateLabel || 'Sin fecha'
  const dueDateMeta = useMemo(() => {
    if (!dueDate) return null

    const today = startOfDay(new Date())
    const diffDays = Math.round((dueDate.getTime() - today.getTime()) / 86_400_000)

    if (diffDays < 0) {
      return {
        tone: 'border-rose-300 bg-rose-50 text-rose-800',
        label: `Vencida hace ${Math.abs(diffDays)} día${Math.abs(diffDays) === 1 ? '' : 's'}`,
      }
    }

    if (diffDays === 0) {
      return {
        tone: 'border-amber-300 bg-amber-50 text-amber-900',
        label: 'Vence hoy',
      }
    }

    if (diffDays === 1) {
      return {
        tone: 'border-amber-300 bg-amber-50 text-amber-900',
        label: 'Vence mañana',
      }
    }

    if (diffDays <= 3) {
      return {
        tone: 'border-orange-300 bg-orange-50 text-orange-900',
        label: `Faltan ${diffDays} días`,
      }
    }

    return {
      tone: 'border-cyan-300 bg-cyan-50 text-cyan-900',
      label: `Faltan ${diffDays} días`,
    }
  }, [dueDate])
  const canOpenActionsMenu = canManageTask || canEditTask || canResolveCd
  const canQuickComplete = (canManageTask || canEditTask) && task.estado !== 'completada'

  const submitTaskUpdate = async () => {
    await onUpdateTask(task.id, {
      titulo: canManageTask ? editTitle.trim() : undefined,
      descripcion: editDescription.trim() || null,
      estado: editStatus,
      prioridad: canManageTask ? editPriority : undefined,
      fecha_limite: editDueDate || null,
      direccion_responsable: canManageTask && projectType === 'institucional'
        ? (editDirectionResponsible || null)
        : undefined,
    })
    setOpenEdit(false)
  }

  const submitAssignment = async () => {
    const member = userById.get(selectedAssignee)
    if (!selectedAssignee || !member) return
    await onAssignTask(task.id, selectedAssignee, member.socio_id)
    setOpenAssign(false)
  }

  const submitHandoff = async () => {
    const member = userById.get(handoffAssignee)
    if (!handoffAssignee || !member) return
    await onHandoffTask(task.id, handoffAssignee, member.socio_id, handoffNote.trim() || undefined)
    setOpenHandoff(false)
    setHandoffNote('')
  }

  const submitNewSubtask = async () => {
    if (!newSubtaskTitle.trim()) return

    const member = userById.get(newSubtaskAssignee)
    await onCreateSubtask({
      tarea_id: task.id,
      titulo: newSubtaskTitle.trim(),
      descripcion: newSubtaskDescription.trim() || undefined,
      estado: newSubtaskStatus,
      asignado_usuario_id: member?.usuario_id || null,
      asignado_socio_id: member?.socio_id || null,
    })

    setNewSubtaskTitle('')
    setNewSubtaskDescription('')
    setNewSubtaskStatus('pendiente')
    setNewSubtaskAssignee('')
    setOpenNewSubtask(false)
  }

  const openSubtaskEditor = (subtask: SubtareaProyecto) => {
    setEditingSubtask(subtask)
    setEditSubtaskTitle(subtask.titulo)
    setEditSubtaskDescription(subtask.descripcion || '')
    setEditSubtaskStatus(subtask.estado)
  }

  const submitSubtaskEdit = async () => {
    if (!editingSubtask) return
    await onUpdateSubtask(editingSubtask.id, {
      titulo: canManageTask ? editSubtaskTitle.trim() : undefined,
      descripcion: editSubtaskDescription.trim() || null,
      estado: editSubtaskStatus,
    })
    setEditingSubtask(null)
  }

  const submitSendToCd = async () => {
    await onSendToCd(task.id, sendCdComment.trim() || undefined)
    setOpenSendToCd(false)
    setSendCdComment('')
  }

  const submitResolveCd = async () => {
    await onResolveCd(task.id, resolveApprove, resolveComment.trim() || undefined)
    setOpenResolveCd(false)
    setResolveComment('')
  }

  return (
    <>
      <Card
        draggable={canManageTask || canEditTask}
        onDragStart={(event) => {
          if (!(canManageTask || canEditTask)) return
          event.dataTransfer.setData('text/tarea-id', task.id)
          event.dataTransfer.effectAllowed = 'move'
        }}
        className={cn(
          'group rounded-2xl border border-slate-200 bg-white px-3.5 py-3 shadow-[0_1px_0_rgba(15,23,42,0.04)] transition-all',
          canManageTask || canEditTask
            ? 'cursor-grab active:cursor-grabbing hover:-translate-y-[1px] hover:border-slate-300 hover:shadow-[0_10px_20px_-16px_rgba(15,23,42,0.35)]'
            : 'opacity-95'
        )}
      >
        <div className="flex items-start gap-2.5">
          <button
            type="button"
            disabled={!canQuickComplete || busy}
            onClick={() => {
              if (!canQuickComplete || busy) return
              void onMoveTask(task.id, 'completada')
            }}
            aria-label={canQuickComplete ? 'Marcar tarea como completada' : 'Tarea completada'}
            title={canQuickComplete ? 'Marcar como completada' : 'Completada'}
            className={cn(
              'mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 bg-white transition-all',
              statusMarker(task.estado),
              canQuickComplete
                ? 'cursor-pointer hover:scale-105 hover:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-1'
                : 'cursor-default',
              task.estado === 'completada' && 'bg-emerald-50'
            )}
          >
            {task.estado === 'completada' && (
              <Check className="mx-auto h-3 w-3 text-emerald-600" />
            )}
          </button>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-[15px] font-semibold leading-snug text-slate-900">
                  {task.titulo}
                </p>
                {task.descripcion && (
                  <div className="min-w-0 text-[13px] leading-relaxed text-slate-600 break-all [overflow-wrap:anywhere]">
                    {isExpanded ? (
                      <LinkifiedText text={task.descripcion} />
                    ) : (
                      truncateText(task.descripcion, 110)
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge className={cn('rounded-full border text-[11px]', priorityBadge(taskPriority))}>
                    {priorityLabel(taskPriority)}
                  </Badge>
                  {isExpanded ? (
                    dueDate && dueDateLabel && dueDateMeta && (
                      <div className={cn(
                        'inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                        dueDateMeta.tone
                      )}>
                        <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                        <span className="whitespace-nowrap">{dueDateLabel}</span>
                        <span className="whitespace-nowrap opacity-80">· {dueDateMeta.label}</span>
                      </div>
                    )
                  ) : (
                    <div className="inline-flex items-center gap-1.5 text-[12px] text-slate-600">
                      <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                      <span className="font-medium">{dueDateCompactLabel}</span>
                    </div>
                  )}
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-slate-500 hover:bg-slate-100"
                onClick={() => setIsExpanded((prev) => !prev)}
                aria-label={isExpanded ? 'Plegar tarea' : 'Desplegar tarea'}
                title={isExpanded ? 'Plegar' : 'Desplegar'}
              >
                <ChevronDown className={cn('h-4 w-4 transition-transform', isExpanded ? 'rotate-180' : 'rotate-0')} />
              </Button>
            </div>

            {isExpanded && (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge className={cn('rounded-full text-[11px] border', statusBadge(task.estado))}>
                    {statusLabel(task.estado)}
                  </Badge>
                  {backendWorkflowLabel && (
                    <Badge variant="outline" className="rounded-full text-[11px] text-slate-600">
                      {backendWorkflowLabel}
                    </Badge>
                  )}
                  <Badge variant="outline" className="rounded-full text-[11px] text-slate-600">
                    {assigneeName}
                  </Badge>
                  {task.direccion_responsable && (
                    <Badge variant="outline" className="rounded-full text-[11px] text-slate-600">
                      Dirección: {task.direccion_responsable}
                    </Badge>
                  )}
                </div>

                {subtasks.length > 0 && (
                  <div className="space-y-1.5 rounded-xl border border-slate-200/90 bg-slate-50/70 px-2.5 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Subtareas
                    </p>
                    {subtasks.slice(0, 3).map((subtask) => (
                      <div
                        key={subtask.id}
                        className="flex items-center justify-between gap-2 rounded-md px-1 py-0.5 transition-colors hover:bg-white"
                      >
                        <div className="flex min-w-0 items-center gap-1.5">
                          <CheckCircle2 className={cn(
                            'h-3.5 w-3.5 shrink-0',
                            subtask.estado === 'completada' ? 'text-emerald-500' : 'text-slate-400'
                          )} />
                          <p className="truncate text-xs text-slate-700">{subtask.titulo}</p>
                        </div>
                        {canEditSubtask(subtask) && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                            onClick={() => openSubtaskEditor(subtask)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {subtasks.length > 3 && (
                      <p className="px-1 text-[11px] text-slate-500">
                        +{subtasks.length - 3} subtareas más
                      </p>
                    )}
                  </div>
                )}

                {(canManageTask || canEditTask || canResolveCd) && (
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    {(canManageTask || canEditTask) && (
                      <Select
                        value={task.estado}
                        onValueChange={(value) => {
                          void onMoveTask(task.id, value as EstadoTareaKanban)
                        }}
                        disabled={busy}
                      >
                        <SelectTrigger className="h-8 w-[140px] rounded-full border-slate-200 bg-slate-50 px-3 text-xs">
                          <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((status) => (
                            <SelectItem key={status} value={status}>
                              {statusLabel(status)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {(canManageTask || canEditTask) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-full px-3 text-[11px] text-slate-700 hover:bg-slate-100"
                        onClick={openEditDialog}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </Button>
                    )}

                    {canOpenActionsMenu && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="ml-auto h-8 w-8 rounded-full text-slate-600 hover:bg-slate-100"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          {(canManageTask || canEditTask) && (
                            <DropdownMenuItem onClick={openEditDialog}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar tarea
                            </DropdownMenuItem>
                          )}

                          {canManageTask && (
                            <>
                              <DropdownMenuItem onClick={openAssignDialog}>
                                <UserPlus className="mr-2 h-4 w-4" />
                                Asignar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={openHandoffDialog}>
                                <ArrowRightLeft className="mr-2 h-4 w-4" />
                                Handoff
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={openNewSubtaskDialog}>
                                <Plus className="mr-2 h-4 w-4" />
                                Nueva subtarea
                              </DropdownMenuItem>
                              {canSendToCd && (
                                <DropdownMenuItem onClick={openSendToCdDialog}>
                                  <Send className="mr-2 h-4 w-4" />
                                  Enviar CD
                                </DropdownMenuItem>
                              )}
                            </>
                          )}

                          {canResolveCd && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => openResolveCdDialog(true)}
                              >
                                <ThumbsUp className="mr-2 h-4 w-4" />
                                Aprobar CD
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => openResolveCdDialog(false)}
                              >
                                <ThumbsDown className="mr-2 h-4 w-4" />
                                Observar/Rechazar
                              </DropdownMenuItem>
                            </>
                          )}

                          {canManageTask && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => void onDeleteTask(task.id)}
                                className="text-rose-700 focus:text-rose-800"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Borrar
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                )}

                {!canManageTask && !canEditTask && !canResolveCd && (
                  <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-500">
                    Solo lectura
                  </div>
                )}
              </>
            )}
          </div>

          {(canManageTask || canEditTask) && (
            <GripVertical className="h-4 w-4 shrink-0 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100" />
          )}
        </div>
      </Card>

      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar tarea</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
                disabled={!canManageTask}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descripción / información adicional</Label>
              <Textarea
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                rows={4}
                placeholder="Incluye contexto, links, referencias y cualquier dato útil para la tarea."
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Select
                  value={editStatus}
                  onValueChange={(value) => setEditStatus(value as EstadoTareaKanban)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {statusLabel(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Prioridad</Label>
                <Select
                  value={String(editPriority)}
                  onValueChange={(value) => setEditPriority(Number(value) as PrioridadTarea)}
                  disabled={!canManageTask}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((priority) => (
                      <SelectItem key={priority} value={String(priority)}>
                        {priorityLabel(priority)} · {priorityDescription(priority)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Fecha límite</Label>
                <Input
                  type="date"
                  value={editDueDate || ''}
                  onChange={(event) => setEditDueDate(event.target.value)}
                />
              </div>
            </div>
            {projectType === 'institucional' && (
              <div className="space-y-1.5">
                <Label>Dirección responsable</Label>
                <Select
                  value={editDirectionResponsible}
                  onValueChange={(value) => setEditDirectionResponsible(value === '__none__' ? '' : value as DireccionBase)}
                  disabled={!canManageTask}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin dirección / Comisión Directiva" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin dirección / Comisión Directiva</SelectItem>
                    {directions.map((direction) => (
                      <SelectItem key={direction} value={direction}>
                        {direction}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => void submitTaskUpdate()}
              disabled={busy || (canManageTask && !editTitle.trim())}
            >
              <Save className="mr-1.5 h-4 w-4" />
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openAssign} onOpenChange={setOpenAssign}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Asignar/Reasignar tarea</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Persona asignada</Label>
            <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar usuario" />
              </SelectTrigger>
              <SelectContent>
                {users.map((member) => (
                  <SelectItem key={member.usuario_id} value={member.usuario_id}>
                    {member.nombre} {member.apellido}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => void submitAssignment()} disabled={!selectedAssignee || busy}>
              Confirmar asignación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openHandoff} onOpenChange={setOpenHandoff}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Handoff de tarea</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nuevo responsable</Label>
              <Select value={handoffAssignee} onValueChange={setHandoffAssignee}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar usuario" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((member) => (
                    <SelectItem key={member.usuario_id} value={member.usuario_id}>
                      {member.nombre} {member.apellido}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nota de handoff</Label>
              <Textarea
                rows={3}
                value={handoffNote}
                onChange={(event) => setHandoffNote(event.target.value)}
                placeholder="Opcional: contexto del traspaso"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => void submitHandoff()} disabled={!handoffAssignee || busy}>
              Confirmar handoff
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openNewSubtask} onOpenChange={setOpenNewSubtask}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva subtarea</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input value={newSubtaskTitle} onChange={(event) => setNewSubtaskTitle(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Descripción / información adicional</Label>
              <Textarea
                rows={3}
                value={newSubtaskDescription}
                onChange={(event) => setNewSubtaskDescription(event.target.value)}
                placeholder="Opcional: links o notas para esta subtarea."
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Select
                  value={newSubtaskStatus}
                  onValueChange={(value) => setNewSubtaskStatus(value as EstadoTareaKanban)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {statusLabel(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Asignado</Label>
                <Select value={newSubtaskAssignee} onValueChange={setNewSubtaskAssignee}>
                  <SelectTrigger>
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((member) => (
                      <SelectItem key={member.usuario_id} value={member.usuario_id}>
                        {member.nombre} {member.apellido}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => void submitNewSubtask()} disabled={!newSubtaskTitle.trim() || busy}>
              Crear subtarea
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingSubtask} onOpenChange={(isOpen) => !isOpen && setEditingSubtask(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar subtarea</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input
                value={editSubtaskTitle}
                onChange={(event) => setEditSubtaskTitle(event.target.value)}
                disabled={!canManageTask}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descripción / información adicional</Label>
              <Textarea
                rows={3}
                value={editSubtaskDescription}
                onChange={(event) => setEditSubtaskDescription(event.target.value)}
                placeholder="Incluye links o notas relevantes."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select
                value={editSubtaskStatus}
                onValueChange={(value) => setEditSubtaskStatus(value as EstadoTareaKanban)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {statusLabel(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => void submitSubtaskEdit()} disabled={busy || !editSubtaskTitle.trim()}>
              Guardar subtarea
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openSendToCd} onOpenChange={setOpenSendToCd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar tarea a CD</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Comentario (opcional)</Label>
            <Textarea
              rows={3}
              value={sendCdComment}
              onChange={(event) => setSendCdComment(event.target.value)}
              placeholder="Contexto para comisión directiva"
            />
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => void submitSendToCd()} disabled={busy}>
              Confirmar envío
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openResolveCd} onOpenChange={setOpenResolveCd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{resolveApprove ? 'Aprobar en CD' : 'Observar/Rechazar en CD'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>{resolveApprove ? 'Comentario (opcional)' : 'Comentario (obligatorio para rechazo)'}</Label>
            <Textarea
              rows={3}
              value={resolveComment}
              onChange={(event) => setResolveComment(event.target.value)}
              placeholder={resolveApprove ? 'Aprobación sin observaciones' : 'Detalle de observación/rechazo'}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => void submitResolveCd()}
              disabled={busy || (!resolveApprove && !resolveComment.trim())}
            >
              Confirmar decisión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
