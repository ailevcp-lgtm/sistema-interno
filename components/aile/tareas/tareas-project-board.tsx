'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, Pencil, Plus, ShieldAlert, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { LinkifiedText } from '@/components/ui/linkified-text'
import { cn } from '@/lib/utils'
import { TareasTaskCard } from '@/components/aile/tareas/tareas-task-card'
import type {
  AccesoProyectoTarea,
  DireccionBase,
  EstadoTareaKanban,
  ProyectoTarea,
  SubtareaProyecto,
  TareaProyecto,
  UsuarioAsignableTarea,
} from '@/lib/types'
import type {
  ActualizarProyectoPayload,
  ActualizarSubtareaPayload,
  ActualizarTareaPayload,
  CrearSubtareaPayload,
} from '@/hooks/useTareas'

interface TareasProjectBoardProps {
  project: ProyectoTarea
  tasks: TareaProyecto[]
  subtasksByTaskId: Map<string, SubtareaProyecto[]>
  users: UsuarioAsignableTarea[]
  directions: DireccionBase[]
  access: AccesoProyectoTarea
  columns: Array<{ id: EstadoTareaKanban; title: string; tone: string }>
  directionScope?: DireccionBase | null
  canManageTask: (task: TareaProyecto) => boolean
  canEditTask: (task: TareaProyecto) => boolean
  canEditSubtask: (subtask: SubtareaProyecto) => boolean
  canSendToCd: (task: TareaProyecto) => boolean
  canResolveCd: (task: TareaProyecto) => boolean
  busy: boolean
  onOpenNewTask: (project: ProyectoTarea, defaultDirection?: DireccionBase | null) => void
  onUpdateProject: (projectId: string, payload: ActualizarProyectoPayload) => Promise<unknown>
  onDeleteProject: (projectId: string) => Promise<unknown>
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
  showCompletedTasks: boolean
  isCollapsed?: boolean
  onToggleCollapse?: () => void
  canMoveUp?: boolean
  canMoveDown?: boolean
  onMoveUp?: () => void
  onMoveDown?: () => void
}

function projectTypeBadge(type: ProyectoTarea['tipo']) {
  return type === 'institucional'
    ? 'bg-violet-100 text-violet-800 border-violet-200'
    : 'bg-cyan-100 text-cyan-800 border-cyan-200'
}

function projectTypeLabel(type: ProyectoTarea['tipo']) {
  return type === 'institucional' ? 'Institucional (Proyecto madre)' : 'Interno dirección'
}

function projectStateLabel(state: ProyectoTarea['estado']) {
  switch (state) {
    case 'borrador':
      return 'Borrador'
    case 'en_ejecucion':
      return 'En ejecución'
    case 'enviado_cd':
      return 'Enviado a CD'
    case 'aprobado_cd':
      return 'Aprobado por CD'
    case 'archivado':
      return 'Archivado'
    default:
      return state
  }
}

function projectStateBadge(state: ProyectoTarea['estado']) {
  switch (state) {
    case 'borrador':
      return 'bg-slate-100 text-slate-700 border-slate-200'
    case 'en_ejecucion':
      return 'bg-sky-100 text-sky-700 border-sky-200'
    case 'enviado_cd':
      return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'aprobado_cd':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    case 'archivado':
      return 'bg-zinc-200 text-zinc-700 border-zinc-300'
    default:
      return ''
  }
}

export function TareasProjectBoard({
  project,
  tasks,
  subtasksByTaskId,
  users,
  directions,
  access,
  columns,
  directionScope,
  canManageTask,
  canEditTask,
  canEditSubtask,
  canSendToCd,
  canResolveCd,
  busy,
  onOpenNewTask,
  onUpdateProject,
  onDeleteProject,
  onMoveTask,
  onAssignTask,
  onHandoffTask,
  onDeleteTask,
  onUpdateTask,
  onUpdateSubtask,
  onCreateSubtask,
  onSendToCd,
  onResolveCd,
  showCompletedTasks,
  isCollapsed = false,
  onToggleCollapse,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
}: TareasProjectBoardProps) {
  const [openEditProject, setOpenEditProject] = useState(false)
  const [editProjectName, setEditProjectName] = useState(project.nombre)
  const [editProjectDescription, setEditProjectDescription] = useState(project.descripcion || '')
  const [editProjectType, setEditProjectType] = useState<ProyectoTarea['tipo']>(project.tipo)
  const [editProjectDirection, setEditProjectDirection] = useState<DireccionBase>('CEA')

  const openProjectEditor = () => {
    setEditProjectName(project.nombre)
    setEditProjectDescription(project.descripcion || '')
    setEditProjectType(project.tipo)
    setEditProjectDirection(project.direccion || 'CEA')
    setOpenEditProject(true)
  }

  const submitProjectUpdate = async () => {
    if (!editProjectName.trim()) return

    await onUpdateProject(project.id, {
      nombre: editProjectName.trim(),
      descripcion: editProjectDescription.trim() || null,
      tipo: editProjectType,
      direccion: editProjectType === 'institucional' ? null : editProjectDirection,
    })

    setOpenEditProject(false)
  }

  const submitProjectDelete = async () => {
    if (!window.confirm('Esto archivará el proyecto y cerrará sus tareas activas. ¿Continuar?')) {
      return
    }
    await onDeleteProject(project.id)
  }

  const canCreateTaskInThisBoard = access.canCreate && (!directionScope || project.tipo === 'institucional')
  const projectDirectionLabel = project.direccion ? `Dirección: ${project.direccion}` : 'Proyecto madre global'
  const hiddenCompletedCount = tasks.filter((task) => task.estado === 'completada').length
  const visibleColumns = showCompletedTasks
    ? columns
    : columns.filter((column) => column.id !== 'completada')

  return (
    <>
      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardHeader className="border-b border-border/70 bg-gradient-to-r from-primary/5 via-background to-background p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <CardTitle className="text-lg sm:text-xl font-black text-foreground">
                {project.nombre}
              </CardTitle>
              {project.descripcion && (
                <div className="text-sm leading-relaxed text-muted-foreground">
                  <LinkifiedText text={project.descripcion} />
                </div>
              )}
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge className={cn('border text-xs', projectTypeBadge(project.tipo))}>
                  {projectTypeLabel(project.tipo)}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {projectDirectionLabel}
                </Badge>
                {directionScope && project.tipo === 'institucional' && (
                  <Badge variant="outline" className="text-xs">
                    Espacio por dirección: {directionScope}
                  </Badge>
                )}
                <Badge className={cn('border text-xs', projectStateBadge(project.estado))}>
                  {projectStateLabel(project.estado)}
                </Badge>
                {!showCompletedTasks && hiddenCompletedCount > 0 && (
                  <Badge className="border border-emerald-200 bg-emerald-50 text-xs text-emerald-800">
                    Completadas ocultas: {hiddenCompletedCount}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {access.readOnly && (
                <Badge variant="outline" className="h-8 gap-1 border-amber-300 bg-amber-50 text-amber-800">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Solo lectura
                </Badge>
              )}

              {access.canManage && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onMoveUp?.()}
                  disabled={busy || !canMoveUp}
                >
                  <ArrowUp className="mr-1.5 h-4 w-4" />
                  Subir
                </Button>
              )}

              {access.canManage && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onMoveDown?.()}
                  disabled={busy || !canMoveDown}
                >
                  <ArrowDown className="mr-1.5 h-4 w-4" />
                  Bajar
                </Button>
              )}

              {access.canManage && (
                <Button size="sm" variant="outline" onClick={openProjectEditor} disabled={busy}>
                  <Pencil className="mr-1.5 h-4 w-4" />
                  Editar proyecto
                </Button>
              )}

              {access.canManage && (
                <Button size="sm" variant="destructive" onClick={() => void submitProjectDelete()} disabled={busy}>
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Borrar proyecto
                </Button>
              )}

              {canCreateTaskInThisBoard && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onOpenNewTask(project, directionScope || project.direccion || null)}
                  disabled={busy}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Nueva tarea
                </Button>
              )}

              <Button size="sm" variant="outline" onClick={() => onToggleCollapse?.()}>
                <ChevronDown
                  className={cn(
                    'mr-1.5 h-4 w-4 transition-transform',
                    isCollapsed ? '-rotate-90' : 'rotate-0'
                  )}
                />
                {isCollapsed ? 'Desplegar' : 'Plegar'}
              </Button>
            </div>
          </div>
        </CardHeader>

        {!isCollapsed && (
          <CardContent className="p-3 sm:p-4">
            <div className={cn(
              'grid gap-3',
              visibleColumns.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
            )}>
              {visibleColumns.map((column) => {
                const tasksInColumn = tasks.filter((task) => task.estado === column.id)

                return (
                  <div
                    key={column.id}
                    className={cn(
                      'rounded-lg border p-2 sm:p-3 min-h-[220px] transition-colors',
                      column.tone
                    )}
                    onDragOver={(event) => {
                      event.preventDefault()
                      event.dataTransfer.dropEffect = 'move'
                    }}
                    onDrop={(event) => {
                      const taskId = event.dataTransfer.getData('text/tarea-id')
                      if (!taskId) return
                      void onMoveTask(taskId, column.id)
                    }}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">{column.title}</p>
                      <Badge variant="outline" className="h-6 px-2 text-[11px]">
                        {tasksInColumn.length}
                      </Badge>
                    </div>

                    {tasksInColumn.length === 0 ? (
                      <div className="flex min-h-[140px] items-center justify-center rounded-md border border-dashed border-border/70 bg-background/40 px-2 text-center text-xs text-muted-foreground">
                        Sin tareas en esta columna
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {tasksInColumn.map((task) => (
                          <TareasTaskCard
                            key={task.id}
                            task={task}
                            projectType={project.tipo}
                            projectDirection={project.direccion || null}
                            directions={directions}
                            subtasks={subtasksByTaskId.get(task.id) || []}
                            users={users}
                            canManageTask={canManageTask(task)}
                            canEditTask={canEditTask(task)}
                            canEditSubtask={canEditSubtask}
                            canSendToCd={canSendToCd(task)}
                            canResolveCd={canResolveCd(task)}
                            busy={busy}
                            onMoveTask={onMoveTask}
                            onAssignTask={onAssignTask}
                            onHandoffTask={onHandoffTask}
                            onDeleteTask={onDeleteTask}
                            onUpdateTask={onUpdateTask}
                            onUpdateSubtask={onUpdateSubtask}
                            onCreateSubtask={onCreateSubtask}
                            onSendToCd={onSendToCd}
                            onResolveCd={onResolveCd}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        )}
      </Card>

      <Dialog open={openEditProject} onOpenChange={setOpenEditProject}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar proyecto</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input
                value={editProjectName}
                onChange={(event) => setEditProjectName(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Textarea
                rows={4}
                value={editProjectDescription}
                onChange={(event) => setEditProjectDescription(event.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select
                  value={editProjectType}
                  onValueChange={(value) => setEditProjectType(value as ProyectoTarea['tipo'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="institucional">Institucional (madre)</SelectItem>
                    <SelectItem value="interno_direccion">Interno dirección</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Dirección</Label>
                <Select
                  value={editProjectDirection}
                  onValueChange={(value) => setEditProjectDirection(value as DireccionBase)}
                  disabled={editProjectType === 'institucional'}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {directions.map((direction) => (
                      <SelectItem key={direction} value={direction}>
                        {direction}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => void submitProjectUpdate()}
              disabled={busy || !editProjectName.trim()}
            >
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
