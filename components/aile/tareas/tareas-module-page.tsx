'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  FolderKanban,
  Loader2,
  Mail,
  Plus,
  Redo2,
  RefreshCcw,
  ShieldAlert,
  Undo2,
  UserCheck2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { useTareas } from '@/hooks/useTareas'
import { TareasProjectBoard } from '@/components/aile/tareas/tareas-project-board'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import type {
  AccesoProyectoTarea,
  DireccionBase,
  EstadoTareaKanban,
  ProyectoTarea,
  TipoProyectoTarea,
} from '@/lib/types'
import { EmailPreferencesDialog } from '@/components/aile/email-preferences-dialog'

const COLLAPSED_PROJECTS_STORAGE_KEY = 'aile:tareas:collapsed-projects:v1'
const HISTORY_LIMIT = 30

type HistoryEntry = {
  label: string
  undo: () => Promise<void>
  redo: () => Promise<void>
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'Error desconocido'
}

export function TareasModulePage() {
  const { user } = useAuth()
  const tareas = useTareas()
  const projectAccess = tareas.projectAccess
  const directions = tareas.directions
  const canCreateInstitutionalProject = tareas.canCreateInstitutionalProject
  const canCreateProjectInDirection = tareas.canCreateProjectInDirection
  const [activeTab, setActiveTab] = useState<'institucional' | 'direcciones'>('institucional')
  const [selectedDirection, setSelectedDirection] = useState<DireccionBase>('CEA')

  const [openProjectDialog, setOpenProjectDialog] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [projectType, setProjectType] = useState<TipoProyectoTarea>('institucional')
  const [projectDirection, setProjectDirection] = useState<DireccionBase>('CEA')

  const [projectForTask, setProjectForTask] = useState<ProyectoTarea | null>(null)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDescription, setTaskDescription] = useState('')
  const [taskStatus, setTaskStatus] = useState<EstadoTareaKanban>('pendiente')
  const [taskDueDate, setTaskDueDate] = useState('')
  const [taskAssignee, setTaskAssignee] = useState('')
  const [taskDirection, setTaskDirection] = useState<DireccionBase | ''>('')
  const [collapsedProjectIds, setCollapsedProjectIds] = useState<string[]>([])
  const searchParams = useSearchParams()
  const [emailPrefsOpen, setEmailPrefsOpen] = useState(false)

  // Abrir preferencias de email desde URL (footer de emails)
  useEffect(() => {
    if (searchParams.get('preferencias_email') === '1') {
      setEmailPrefsOpen(true)
    }
  }, [searchParams])
  const [preferencesLoaded, setPreferencesLoaded] = useState(false)
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([])
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([])
  const [historyBusy, setHistoryBusy] = useState(false)

  const activeProjects = useMemo(
    () => tareas.proyectos.filter((project) => project.activo !== false && project.estado !== 'archivado'),
    [tareas.proyectos]
  )

  useEffect(() => {
    try {
      const rawCollapsed = window.localStorage.getItem(COLLAPSED_PROJECTS_STORAGE_KEY)
      const parsedCollapsed = rawCollapsed ? JSON.parse(rawCollapsed) : []
      if (Array.isArray(parsedCollapsed)) {
        setCollapsedProjectIds(parsedCollapsed.filter((item): item is string => typeof item === 'string'))
      }
    } catch {
      setCollapsedProjectIds([])
    } finally {
      setPreferencesLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (!preferencesLoaded) return
    window.localStorage.setItem(COLLAPSED_PROJECTS_STORAGE_KEY, JSON.stringify(collapsedProjectIds))
  }, [collapsedProjectIds, preferencesLoaded])

  useEffect(() => {
    setCollapsedProjectIds((prev) => {
      if (prev.length === 0) return prev
      const activeIdSet = new Set(activeProjects.map((project) => project.id))
      const next = prev.filter((id) => activeIdSet.has(id))
      return next.length === prev.length ? prev : next
    })
  }, [activeProjects])

  const collapsedProjectIdSet = useMemo(() => new Set(collapsedProjectIds), [collapsedProjectIds])

  const institutionalProjects = useMemo(
    () => activeProjects.filter((project) => project.tipo === 'institucional'),
    [activeProjects]
  )

  const accessByProject = useMemo(() => {
    const map = new Map<string, AccesoProyectoTarea>()
    for (const project of activeProjects) {
      map.set(project.id, projectAccess(project))
    }
    return map
  }, [activeProjects, projectAccess])

  const taskProjectAccess = projectForTask
    ? accessByProject.get(projectForTask.id) || projectAccess(projectForTask)
    : null

  const canCreateInstitutionalTaskWithoutDirection = projectForTask?.tipo === 'institucional'
    ? Boolean(taskProjectAccess?.canManage)
    : true

  const directionProjects = useMemo(() => {
    const internalProjects = activeProjects.filter(
      (project) => project.tipo === 'interno_direccion' && project.direccion === selectedDirection
    )

    const institutionalForDirection = institutionalProjects.filter((project) => {
      const scopedTasks = (tareas.tasksByProjectId.get(project.id) || []).filter(
        (task) => task.direccion_responsable === selectedDirection
      )
      const hasScopeTasks = scopedTasks.length > 0
      const canManageProject = accessByProject.get(project.id)?.canManage || false
      return hasScopeTasks || canManageProject
    })

    return [...internalProjects, ...institutionalForDirection]
  }, [accessByProject, activeProjects, institutionalProjects, selectedDirection, tareas.tasksByProjectId])

  const canCreateAnyProject = useMemo(
    () => (
      canCreateInstitutionalProject()
      || directions.some((direction) => canCreateProjectInDirection(direction))
    ),
    [canCreateInstitutionalProject, canCreateProjectInDirection, directions]
  )

  const assignedTasksCount = useMemo(() => {
    if (!user) return 0
    return tareas.tareas.filter((task) => task.asignado_usuario_id === user.id).length
  }, [tareas.tareas, user])

  const readOnlyProjects = useMemo(
    () => activeProjects.filter((project) => accessByProject.get(project.id)?.readOnly).length,
    [accessByProject, activeProjects]
  )

  const moveProjectInView = useCallback(async (
    projectsInView: ProyectoTarea[],
    projectId: string,
    direction: 'up' | 'down'
  ) => {
    if (projectsInView.length < 2) return

    const currentIndex = projectsInView.findIndex((project) => project.id === projectId)
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= projectsInView.length) {
      return
    }

    const currentProject = projectsInView[currentIndex]
    const targetProject = projectsInView[targetIndex]

    const currentOrder = currentProject.orden ?? currentIndex
    const targetOrder = targetProject.orden ?? targetIndex

    await tareas.reorderProjects([
      { proyecto_id: currentProject.id, orden_tablero: targetOrder },
      { proyecto_id: targetProject.id, orden_tablero: currentOrder },
    ])
  }, [tareas])

  const toggleProjectCollapsed = useCallback((projectId: string) => {
    setCollapsedProjectIds((prev) => (
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId]
    ))
  }, [])

  const resetProjectForm = () => {
    setProjectName('')
    setProjectDescription('')
    setProjectType('institucional')
    setProjectDirection('CEA')
  }

  const resetTaskForm = () => {
    setTaskTitle('')
    setTaskDescription('')
    setTaskStatus('pendiente')
    setTaskDueDate('')
    setTaskAssignee('')
    setTaskDirection('')
  }

  const pushHistoryEntry = useCallback((entry: HistoryEntry) => {
    setUndoStack((prev) => {
      const next = [...prev, entry]
      return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next
    })
    setRedoStack([])
  }, [])

  const handleUndo = useCallback(async () => {
    if (historyBusy || undoStack.length === 0) return

    const entry = undoStack[undoStack.length - 1]
    setHistoryBusy(true)
    try {
      await entry.undo()
      setUndoStack((prev) => prev.slice(0, -1))
      setRedoStack((prev) => {
        const next = [...prev, entry]
        return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next
      })
      toast.success(`Deshecho: ${entry.label}`)
    } catch (error) {
      toast.error(`No se pudo deshacer: ${toErrorMessage(error)}`)
    } finally {
      setHistoryBusy(false)
    }
  }, [historyBusy, undoStack])

  const handleRedo = useCallback(async () => {
    if (historyBusy || redoStack.length === 0) return

    const entry = redoStack[redoStack.length - 1]
    setHistoryBusy(true)
    try {
      await entry.redo()
      setRedoStack((prev) => prev.slice(0, -1))
      setUndoStack((prev) => {
        const next = [...prev, entry]
        return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next
      })
      toast.success(`Rehecho: ${entry.label}`)
    } catch (error) {
      toast.error(`No se pudo rehacer: ${toErrorMessage(error)}`)
    } finally {
      setHistoryBusy(false)
    }
  }, [historyBusy, redoStack])

  const moveTaskWithHistory = useCallback(async (taskId: string, status: EstadoTareaKanban) => {
    const task = tareas.taskById.get(taskId)
    if (!task) {
      await tareas.moveTask(taskId, status)
      return
    }

    const previousStatus = task.estado
    if (previousStatus === status) return

    await tareas.moveTask(taskId, status)

    pushHistoryEntry({
      label: `Mover "${task.titulo}"`,
      undo: async () => {
        await tareas.moveTask(taskId, previousStatus)
      },
      redo: async () => {
        await tareas.moveTask(taskId, status)
      },
    })
  }, [pushHistoryEntry, tareas])

  const deleteTaskWithHistory = useCallback(async (taskId: string) => {
    const task = tareas.taskById.get(taskId)
    if (!task) {
      await tareas.deleteTask(taskId)
      return
    }

    const subtaskSnapshots = (tareas.subtasksByTaskId.get(taskId) || []).map((subtask) => ({
      titulo: subtask.titulo,
      descripcion: subtask.descripcion || undefined,
      estado: subtask.estado,
      asignado_usuario_id: subtask.asignado_usuario_id || null,
      asignado_socio_id: subtask.asignado_socio_id || null,
    }))

    const createPayload = {
      proyecto_id: task.proyecto_id,
      titulo: task.titulo,
      descripcion: task.descripcion || undefined,
      estado: task.estado,
      fecha_limite: task.fecha_limite || null,
      direccion_responsable: task.direccion_responsable || null,
      asignado_usuario_id: task.asignado_usuario_id || null,
      asignado_socio_id: task.asignado_socio_id || null,
    }

    let currentTaskId = task.id
    await tareas.deleteTask(taskId)

    pushHistoryEntry({
      label: `Eliminar "${task.titulo}"`,
      undo: async () => {
        const recreated = await tareas.createTask(createPayload) as { id?: string } | null
        const recreatedId = recreated && typeof recreated.id === 'string' ? recreated.id : null
        currentTaskId = recreatedId || currentTaskId

        for (const subtask of subtaskSnapshots) {
          await tareas.createSubtask({
            tarea_id: currentTaskId,
            titulo: subtask.titulo,
            descripcion: subtask.descripcion,
            estado: subtask.estado,
            asignado_usuario_id: subtask.asignado_usuario_id,
            asignado_socio_id: subtask.asignado_socio_id,
          })
        }
      },
      redo: async () => {
        await tareas.deleteTask(currentTaskId)
      },
    })

    toast.info('Puedes usar "Deshacer" para recuperar la tarea eliminada.')
  }, [pushHistoryEntry, tareas])

  const submitNewProject = async () => {
    await tareas.createProject({
      nombre: projectName.trim(),
      descripcion: projectDescription.trim(),
      tipo: projectType,
      direccion: projectType === 'institucional' ? null : projectDirection,
    })
    resetProjectForm()
    setOpenProjectDialog(false)
  }

  const submitNewTask = async () => {
    if (!projectForTask) return
    const selectedUser = taskAssignee ? tareas.usuarioById.get(taskAssignee) : undefined
    const directionForTask = taskDirection
      || (projectForTask.tipo === 'interno_direccion' ? (projectForTask.direccion || null) : null)

    await tareas.createTask({
      proyecto_id: projectForTask.id,
      titulo: taskTitle.trim(),
      descripcion: taskDescription.trim(),
      estado: taskStatus,
      fecha_limite: taskDueDate || null,
      direccion_responsable: directionForTask,
      asignado_usuario_id: selectedUser?.usuario_id || null,
      asignado_socio_id: selectedUser?.socio_id || null,
    })
    setProjectForTask(null)
    resetTaskForm()
  }

  const renderProjectList = (
    projects: ProyectoTarea[],
    mode: 'institucional' | 'direcciones'
  ) => {
    if (projects.length === 0) {
      return (
        <Card className="border-dashed border-border/80 bg-muted/20">
          <CardContent className="flex min-h-[180px] flex-col items-center justify-center gap-3 p-6 text-center">
            <FolderKanban className="h-9 w-9 text-muted-foreground" />
            <div className="space-y-1">
              <p className="font-medium text-foreground">No hay proyectos cargados</p>
              <p className="text-sm text-muted-foreground">
                Cuando existan proyectos, aquí se mostrará el tablero Kanban.
              </p>
            </div>
          </CardContent>
        </Card>
      )
    }

    return (
      <div className="space-y-4">
        {projects.map((project, index) => {
          const projectTasks = mode === 'direcciones' && project.tipo === 'institucional'
            ? (tareas.tasksByProjectId.get(project.id) || []).filter(
              (task) => task.direccion_responsable === selectedDirection
            )
            : (tareas.tasksByProjectId.get(project.id) || [])
          const baseAccess = accessByProject.get(project.id) || tareas.projectAccess(project)
          const hasTaskLevelManagement = projectTasks.some((task) => tareas.canManageTask(task))
          const scopedAccess = hasTaskLevelManagement
            ? { ...baseAccess, readOnly: false }
            : baseAccess

          return (
            <TareasProjectBoard
              key={project.id}
              project={project}
              tasks={projectTasks}
              subtasksByTaskId={tareas.subtasksByTaskId}
              users={tareas.usuariosAsignables}
              directions={tareas.directions}
              access={scopedAccess}
              columns={tareas.columns}
              directionScope={mode === 'direcciones' && project.tipo === 'institucional' ? selectedDirection : null}
              canManageTask={tareas.canManageTask}
              canEditTask={tareas.canEditTask}
              canEditSubtask={tareas.canEditSubtask}
              canSendToCd={tareas.canSendTaskToCd}
              canResolveCd={(task) => tareas.canResolveTaskCd(task.id)}
              busy={Boolean(tareas.mutatingAction)}
              onOpenNewTask={(selectedProject, defaultDirection) => {
                setProjectForTask(selectedProject)
                resetTaskForm()
                if (selectedProject.tipo === 'institucional') {
                  setTaskDirection(defaultDirection || '')
                } else {
                  setTaskDirection(selectedProject.direccion || defaultDirection || '')
                }
              }}
              onUpdateProject={tareas.updateProject}
              onDeleteProject={tareas.deleteProject}
              onMoveTask={moveTaskWithHistory}
              onAssignTask={tareas.assignTask}
              onHandoffTask={tareas.handoffTask}
              onDeleteTask={deleteTaskWithHistory}
              onUpdateTask={tareas.updateAssignedTask}
              onUpdateSubtask={tareas.updateAssignedSubtask}
              onCreateSubtask={tareas.createSubtask}
              onSendToCd={tareas.sendTaskToCd}
              onResolveCd={tareas.resolveTaskCd}
              isCollapsed={collapsedProjectIdSet.has(project.id)}
              onToggleCollapse={() => toggleProjectCollapsed(project.id)}
              canMoveUp={index > 0}
              canMoveDown={index < projects.length - 1}
              onMoveUp={() => void moveProjectInView(projects, project.id, 'up')}
              onMoveDown={() => void moveProjectInView(projects, project.id, 'down')}
            />
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-primary/5 to-background p-5 lg:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-black text-foreground lg:text-3xl">
              Gestión de Tareas
            </h1>
            <p className="text-sm text-muted-foreground lg:text-base">
              Tablero Kanban institucional con permisos por rol y asignación.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canCreateAnyProject && (
              <Button
                onClick={() => {
                  setProjectType(tareas.canCreateInstitutionalProject() ? 'institucional' : 'interno_direccion')
                  setOpenProjectDialog(true)
                }}
                className="shadow-sm"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Nuevo proyecto
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => void handleUndo()}
              disabled={historyBusy || Boolean(tareas.mutatingAction) || undoStack.length === 0}
              title={undoStack.length > 0 ? `Deshacer: ${undoStack[undoStack.length - 1].label}` : 'Nada para deshacer'}
            >
              <Undo2 className="mr-1.5 h-4 w-4" />
              Deshacer
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleRedo()}
              disabled={historyBusy || Boolean(tareas.mutatingAction) || redoStack.length === 0}
              title={redoStack.length > 0 ? `Rehacer: ${redoStack[redoStack.length - 1].label}` : 'Nada para rehacer'}
            >
              <Redo2 className="mr-1.5 h-4 w-4" />
              Rehacer
            </Button>
            <Button variant="outline" onClick={() => void tareas.fetchData()} disabled={tareas.loading}>
              <RefreshCcw className="mr-1.5 h-4 w-4" />
              Refrescar
            </Button>
            <Button variant="outline" onClick={() => setEmailPrefsOpen(true)}>
              <Mail className="mr-1.5 h-4 w-4" />
              Emails
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-border/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Proyectos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{activeProjects.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Tareas activas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{tareas.tareas.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Asignadas a mí</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-2xl font-bold text-foreground">{assignedTasksCount}</p>
            <UserCheck2 className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
      </div>

      {!tareas.backendAvailable && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Módulo backend no disponible</AlertTitle>
          <AlertDescription className="mt-2 space-y-3">
            <p>{tareas.backendMessage || 'No se encontró el esquema de tareas en Supabase.'}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void tareas.retryBackendCheck()}
              disabled={tareas.loading}
            >
              Reintentar conexión
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {activeProjects.length > 0 && readOnlyProjects === activeProjects.length && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Modo solo lectura</AlertTitle>
          <AlertDescription>
            Puedes ver todos los proyectos, tareas y subtareas. Para gestionar necesitas rol habilitado
            o estar asignado a la tarea/subtarea.
          </AlertDescription>
        </Alert>
      )}

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as 'institucional' | 'direcciones')}
        className="space-y-4"
      >
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="institucional" className="shrink-0">Proyectos Institucionales</TabsTrigger>
          <TabsTrigger value="direcciones" className="shrink-0">Espacios por Dirección</TabsTrigger>
        </TabsList>

        <TabsContent value="institucional" className="space-y-4">
          {tareas.loading && institutionalProjects.length === 0 ? (
            <Card>
              <CardContent className="flex h-40 items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Cargando proyectos institucionales...</p>
              </CardContent>
            </Card>
          ) : (
            renderProjectList(institutionalProjects, 'institucional')
          )}
        </TabsContent>

        <TabsContent value="direcciones" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {tareas.directions.map((direction) => {
              const selected = direction === selectedDirection
              return (
                <Button
                  key={direction}
                  type="button"
                  variant={selected ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedDirection(direction)}
                >
                  {direction}
                </Button>
              )
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="text-xs">
              Dirección activa: {selectedDirection}
            </Badge>
            {tareas.canCreateProjectInDirection(selectedDirection) && (
              <Badge className="text-xs bg-emerald-100 text-emerald-800 border border-emerald-200">
                Puedes gestionar esta dirección
              </Badge>
            )}
          </div>
          {tareas.loading && directionProjects.length === 0 ? (
            <Card>
              <CardContent className="flex h-40 items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Cargando proyectos por dirección...</p>
              </CardContent>
            </Card>
          ) : (
            renderProjectList(directionProjects, 'direcciones')
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={openProjectDialog} onOpenChange={setOpenProjectDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo proyecto</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="project-name">Nombre</Label>
              <Input
                id="project-name"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-description">Descripción</Label>
              <Textarea
                id="project-description"
                rows={4}
                value={projectDescription}
                onChange={(event) => setProjectDescription(event.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select
                  value={projectType}
                  onValueChange={(value) => setProjectType(value as TipoProyectoTarea)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tareas.canCreateInstitutionalProject() && (
                      <SelectItem value="institucional">Institucional</SelectItem>
                    )}
                    <SelectItem value="interno_direccion">Interno dirección</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{projectType === 'institucional' ? 'Dirección base (opcional)' : 'Dirección dueña'}</Label>
                <Select
                  value={projectDirection}
                  onValueChange={(value) => setProjectDirection(value as DireccionBase)}
                  disabled={projectType === 'institucional'}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No aplica para proyecto madre" />
                  </SelectTrigger>
                  <SelectContent>
                    {tareas.directions.map((direction) => (
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
              onClick={() => void submitNewProject()}
              disabled={!projectName.trim() || Boolean(tareas.mutatingAction)}
            >
              Crear proyecto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!projectForTask}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setProjectForTask(null)
            resetTaskForm()
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nueva tarea</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Proyecto</Label>
              <Input value={projectForTask?.nombre || ''} disabled />
            </div>
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Descripción / información adicional</Label>
              <Textarea
                rows={4}
                value={taskDescription}
                onChange={(event) => setTaskDescription(event.target.value)}
                placeholder="Incluye contexto, links, referencias y cualquier información útil."
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Select
                  value={taskStatus}
                  onValueChange={(value) => setTaskStatus(value as EstadoTareaKanban)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tareas.columns.map((column) => (
                      <SelectItem key={column.id} value={column.id}>
                        {column.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Fecha límite</Label>
                <Input
                  type="date"
                  value={taskDueDate}
                  onChange={(event) => setTaskDueDate(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Asignado</Label>
                <Select value={taskAssignee} onValueChange={setTaskAssignee}>
                  <SelectTrigger>
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    {tareas.usuariosAsignables.map((member) => (
                      <SelectItem key={member.usuario_id} value={member.usuario_id}>
                        {member.nombre} {member.apellido}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {projectForTask?.tipo === 'institucional' && (
              <div className="space-y-1.5">
                <Label>Dirección responsable</Label>
                <Select
                  value={taskDirection}
                  onValueChange={(value) => setTaskDirection(value === '__none__' ? '' : value as DireccionBase)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin dirección / Comisión Directiva" />
                  </SelectTrigger>
                  <SelectContent>
                    {canCreateInstitutionalTaskWithoutDirection && (
                      <SelectItem value="__none__">Sin dirección / Comisión Directiva</SelectItem>
                    )}
                    {tareas.directions.map((direction) => (
                      <SelectItem key={direction} value={direction}>
                        {direction}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {canCreateInstitutionalTaskWithoutDirection
                    ? 'Opcional. Déjala vacía para tareas generales o de Comisión Directiva. Esas tareas se verán en Proyectos Institucionales.'
                    : 'Selecciona una dirección para crear esta tarea institucional desde tu espacio de gestión.'}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => void submitNewTask()}
              disabled={
                !taskTitle.trim()
                || Boolean(tareas.mutatingAction)
                || (projectForTask?.tipo === 'institucional' && !taskDirection && !canCreateInstitutionalTaskWithoutDirection)
              }
            >
              Crear tarea
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EmailPreferencesDialog open={emailPrefsOpen} onOpenChange={setEmailPrefsOpen} />
    </div>
  )
}
