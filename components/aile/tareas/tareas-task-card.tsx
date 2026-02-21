'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRightLeft,
  CalendarClock,
  CheckCircle2,
  GripVertical,
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

const STATUS_OPTIONS: EstadoTareaKanban[] = ['pendiente', 'en_progreso', 'en_revision', 'completada']

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
    year: 'numeric',
  })
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

  useEffect(() => {
    setEditTitle(task.titulo)
    setEditDescription(task.descripcion || '')
    setEditStatus(task.estado)
    setEditDueDate(task.fecha_limite || '')
    setEditDirectionResponsible(task.direccion_responsable || projectDirection || '')
    setSelectedAssignee(task.asignado_usuario_id || '')
  }, [
    task.titulo,
    task.descripcion,
    task.estado,
    task.fecha_limite,
    task.direccion_responsable,
    task.asignado_usuario_id,
    projectDirection,
  ])

  const userById = useMemo(() => {
    const map = new Map<string, UsuarioAsignableTarea>()
    for (const member of users) {
      map.set(member.usuario_id, member)
    }
    return map
  }, [users])

  const assignee = task.asignado_usuario_id ? userById.get(task.asignado_usuario_id) : undefined
  const assigneeName = assignee ? `${assignee.nombre} ${assignee.apellido}`.trim() : 'Sin asignar'
  const backendWorkflowLabel = workflowLabel(task.estado_backend)
  const dueDate = parseDateOnly(task.fecha_limite)
  const dueDateLabel = formatDueDate(task.fecha_limite)
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

  const submitTaskUpdate = async () => {
    await onUpdateTask(task.id, {
      titulo: canManageTask ? editTitle.trim() : undefined,
      descripcion: editDescription.trim() || null,
      estado: editStatus,
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
          'border border-border bg-card p-3 shadow-sm transition-all',
          canManageTask || canEditTask ? 'cursor-grab active:cursor-grabbing hover:border-primary/30' : 'opacity-90'
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{task.titulo}</p>
            {task.descripcion && (
              <div className="text-xs text-muted-foreground leading-relaxed">
                <LinkifiedText text={task.descripcion} />
              </div>
            )}
          </div>
          {(canManageTask || canEditTask) && <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />}
        </div>

        {dueDate && dueDateLabel && dueDateMeta && (
          <div className={cn('mt-3 flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs font-semibold', dueDateMeta.tone)}>
            <CalendarClock className="h-3.5 w-3.5 shrink-0" />
            <span>Fecha límite: {dueDateLabel}</span>
            <span className="ml-auto">{dueDateMeta.label}</span>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badge className={cn('text-[11px] border', statusBadge(task.estado))}>
            {statusLabel(task.estado)}
          </Badge>
          {backendWorkflowLabel && (
            <Badge variant="outline" className="text-[11px]">
              {backendWorkflowLabel}
            </Badge>
          )}
          <Badge variant="outline" className="text-[11px]">
            {assigneeName}
          </Badge>
          {task.direccion_responsable && (
            <Badge variant="outline" className="text-[11px]">
              Dirección: {task.direccion_responsable}
            </Badge>
          )}
        </div>

        {subtasks.length > 0 && (
          <div className="mt-3 space-y-1.5 rounded-md border border-border/70 bg-muted/30 p-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Subtareas
            </p>
            {subtasks.slice(0, 3).map((subtask) => (
              <div
                key={subtask.id}
                className="flex items-center justify-between gap-2 rounded px-1 py-1 hover:bg-background/60"
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  <CheckCircle2 className={cn(
                    'h-3.5 w-3.5 shrink-0',
                    subtask.estado === 'completada' ? 'text-emerald-500' : 'text-muted-foreground'
                  )} />
                  <p className="truncate text-xs text-foreground">{subtask.titulo}</p>
                </div>
                {canEditSubtask(subtask) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => openSubtaskEditor(subtask)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
            {subtasks.length > 3 && (
              <p className="px-1 text-[11px] text-muted-foreground">
                +{subtasks.length - 3} subtareas más
              </p>
            )}
          </div>
        )}

        {(canManageTask || canEditTask || canResolveCd) && (
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {(canManageTask || canEditTask) && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-[11px]"
                  onClick={() => setOpenEdit(true)}
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" />
                  Editar
                </Button>

                <Select
                  value={task.estado}
                  onValueChange={(value) => {
                    void onMoveTask(task.id, value as EstadoTareaKanban)
                  }}
                  disabled={busy}
                >
                  <SelectTrigger className="h-8 text-[11px] px-2">
                    <SelectValue placeholder="Mover" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {statusLabel(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}

            {canManageTask && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-[11px]"
                  onClick={() => setOpenAssign(true)}
                >
                  <UserPlus className="mr-1 h-3.5 w-3.5" />
                  Asignar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-[11px]"
                  onClick={() => setOpenHandoff(true)}
                >
                  <ArrowRightLeft className="mr-1 h-3.5 w-3.5" />
                  Handoff
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-[11px]"
                  onClick={() => setOpenNewSubtask(true)}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Subtarea
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="h-8 text-[11px]"
                  onClick={() => void onDeleteTask(task.id)}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Borrar
                </Button>
                {canSendToCd && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-[11px]"
                    onClick={() => setOpenSendToCd(true)}
                  >
                    <Send className="mr-1 h-3.5 w-3.5" />
                    Enviar CD
                  </Button>
                )}
              </>
            )}

            {canResolveCd && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-[11px]"
                  onClick={() => {
                    setResolveApprove(true)
                    setOpenResolveCd(true)
                  }}
                >
                  <ThumbsUp className="mr-1 h-3.5 w-3.5" />
                  Aprobar CD
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-[11px]"
                  onClick={() => {
                    setResolveApprove(false)
                    setOpenResolveCd(true)
                  }}
                >
                  <ThumbsDown className="mr-1 h-3.5 w-3.5" />
                  Observar/Rechazar
                </Button>
              </>
            )}
          </div>
        )}

        {!canManageTask && !canEditTask && !canResolveCd && (
          <div className="mt-3 rounded-md border border-dashed border-muted-foreground/35 bg-muted/30 px-2 py-1.5 text-[11px] text-muted-foreground">
            Solo lectura
          </div>
        )}
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
            <div className="grid gap-3 sm:grid-cols-2">
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
                    <SelectValue placeholder="Sin dirección" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin dirección</SelectItem>
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
