'use client'

import { useMemo, useRef, useState } from 'react'
import {
  CalendarDays,
  Clock3,
  CalendarClock,
  Flag,
  MapPin,
  Users,
  UserCheck,
  Megaphone,
  ShieldAlert,
  Pencil,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { useCalendario } from '@/hooks/useCalendario'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type {
  CalendarioAlcanceReunion,
  CalendarioEstadoPlanificacion,
  PlanificacionCalendario,
  ReunionCalendario,
  ReunionCalendarioParticipante,
  TareaVencimientoCalendario,
} from '@/lib/types'

const ALCANCE_LABELS: Record<CalendarioAlcanceReunion, string> = {
  personalizada: 'Personalizada',
  comision_directiva: 'Comisión Directiva',
  general: 'General',
}

const ALCANCE_BADGES: Record<CalendarioAlcanceReunion, string> = {
  personalizada: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  comision_directiva: 'bg-violet-100 text-violet-800 border-violet-200',
  general: 'bg-emerald-100 text-emerald-800 border-emerald-200',
}

const PLANIFICACION_ESTADO_LABELS: Record<CalendarioEstadoPlanificacion, string> = {
  tentativo: 'Tentativa',
  definitivo: 'Definitiva',
}

const PLANIFICACION_ESTADO_BADGES: Record<CalendarioEstadoPlanificacion, string> = {
  tentativo: 'bg-amber-100 text-amber-800 border-amber-200',
  definitivo: 'bg-emerald-100 text-emerald-800 border-emerald-200',
}

interface MeetingFormState {
  titulo: string
  descripcion: string
  lugar: string
  fechaInicio: string
  fechaFin: string
  alcance: CalendarioAlcanceReunion
}

interface PlanningFormState {
  titulo: string
  descripcion: string
  fechaInicio: string
  fechaFin: string
  estado: CalendarioEstadoPlanificacion
}

function toDateTimeLocalValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function toDateInputValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  const date = new Date(year, month - 1, day, 0, 0, 0, 0)
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }

  return date
}

function parseCalendarDate(value: string): Date {
  return parseDateOnly(value) ?? new Date(value)
}

function formatDateOnly(value: string): string {
  const parsed = parseCalendarDate(value)
  if (Number.isNaN(parsed.getTime())) return value

  return parsed.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatPlanningRange(item: Pick<PlanificacionCalendario, 'fecha_inicio' | 'fecha_fin'>): string {
  const inicio = formatDateOnly(item.fecha_inicio)
  if (item.fecha_fin === item.fecha_inicio) return inicio
  return `${inicio} - ${formatDateOnly(item.fecha_fin)}`
}

function dueDateMeta(value: string): {
  tone: string
  label: string
} {
  const due = parseDateOnly(value)
  if (!due) {
    return {
      tone: 'border-slate-200 bg-slate-50 text-slate-700',
      label: 'Sin fecha válida',
    }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000)

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

  return {
    tone: 'border-cyan-300 bg-cyan-50 text-cyan-900',
    label: `Faltan ${diffDays} días`,
  }
}

function parseLocalDateTime(localDateTime: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(localDateTime)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hours = Number(match[4])
  const minutes = Number(match[5])
  const seconds = Number(match[6] || 0)

  const date = new Date(year, month - 1, day, hours, minutes, seconds, 0)
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hours ||
    date.getMinutes() !== minutes
  ) {
    return null
  }

  return date
}

function toSupabaseTimestamptz(localDateTime: string): string {
  const date = parseLocalDateTime(localDateTime) ?? new Date(localDateTime)
  if (Number.isNaN(date.getTime())) return localDateTime

  const pad = (value: number) => String(Math.abs(Math.trunc(value))).padStart(2, '0')
  const offsetMinutes = -date.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const offsetHours = pad(Math.floor(Math.abs(offsetMinutes) / 60))
  const offsetMins = pad(Math.abs(offsetMinutes) % 60)

  const y = date.getFullYear()
  const m = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  const hh = pad(date.getHours())
  const mm = pad(date.getMinutes())

  return `${y}-${m}-${d}T${hh}:${mm}:00${sign}${offsetHours}:${offsetMins}`
}

function buildDefaultFormState(): MeetingFormState {
  const inicio = new Date()
  inicio.setMinutes(0, 0, 0)
  inicio.setHours(inicio.getHours() + 1)

  const fin = new Date(inicio)
  fin.setHours(fin.getHours() + 1)

  return {
    titulo: '',
    descripcion: '',
    lugar: '',
    fechaInicio: toDateTimeLocalValue(inicio),
    fechaFin: toDateTimeLocalValue(fin),
    alcance: 'comision_directiva',
  }
}

function buildDefaultPlanningFormState(baseDate: Date = new Date()): PlanningFormState {
  const startValue = toDateInputValue(baseDate)
  return {
    titulo: '',
    descripcion: '',
    fechaInicio: startValue,
    fechaFin: startValue,
    estado: 'tentativo',
  }
}

function dateKey(date: Date): string
function dateKey(date: string): string
function dateKey(date: Date | string): string {
  const parsed = typeof date === 'string' ? parseCalendarDate(date) : date
  if (Number.isNaN(parsed.getTime())) return ''

  const pad = (value: number) => String(value).padStart(2, '0')
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`
}

function participantName(participante: ReunionCalendarioParticipante): string {
  if (participante.socio) {
    return `${participante.socio.nombre} ${participante.socio.apellido}`.trim()
  }
  return 'Usuario'
}

function ReunionCard({
  reunion,
  currentUserId,
  compact = false,
  canEdit = false,
  onEdit,
}: {
  reunion: ReunionCalendario
  currentUserId?: string
  compact?: boolean
  canEdit?: boolean
  onEdit?: (reunion: ReunionCalendario) => void
}) {
  const inicio = new Date(reunion.fecha_inicio)
  const fin = new Date(reunion.fecha_fin)
  const participantes = reunion.participantes || []
  const involucrados = participantes.filter((p) => p.participacion === 'involucrado')
  const invitados = participantes.filter((p) => p.participacion === 'invitado')

  const userParticipation = participantes.find((p) => p.usuario_id === currentUserId)?.participacion
  const userLabel = reunion.created_by === currentUserId
    ? 'Organiza'
    : userParticipation === 'involucrado'
      ? 'Involucrado/a'
      : userParticipation === 'invitado'
        ? 'Invitado/a'
        : null

  const participantPreview = participantes.slice(0, compact ? 2 : 4).map(participantName)
  const hasMoreParticipants = participantes.length > participantPreview.length

  return (
    <div className={cn(
      'rounded-xl border bg-card/90 p-4 transition-colors hover:bg-muted/20',
      compact ? 'space-y-2' : 'space-y-3'
    )}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={cn('font-medium', ALCANCE_BADGES[reunion.alcance])}>
          {ALCANCE_LABELS[reunion.alcance]}
        </Badge>
        {userLabel && (
          <Badge variant="secondary" className="bg-slate-100 text-slate-700 border border-slate-200">
            {userLabel}
          </Badge>
        )}
        {canEdit && onEdit && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs ml-auto"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onEdit(reunion)
            }}
          >
            <Pencil className="w-3.5 h-3.5 mr-1" />
            Editar
          </Button>
        )}
      </div>

      <div>
        <p className={cn('text-foreground font-semibold leading-tight', compact ? 'text-sm' : 'text-base')}>
          {reunion.titulo}
        </p>
        {reunion.descripcion && (
          <p className={cn('text-muted-foreground', compact ? 'text-xs mt-1' : 'text-sm mt-1')}>
            {reunion.descripcion}
          </p>
        )}
      </div>

      <div className={cn('flex flex-wrap gap-3 text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="w-3.5 h-3.5" />
          {inicio.toLocaleString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
          {' - '}
          {fin.toLocaleString('es-AR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
        {reunion.lugar && (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            {reunion.lugar}
          </span>
        )}
      </div>

      <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>
        <span className="inline-flex items-center gap-1.5">
          <UserCheck className="w-3.5 h-3.5" />
          {involucrados.length} involucrado/s
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" />
          {invitados.length} invitado/s
        </span>
      </div>

      {participantPreview.length > 0 && (
        <p className={cn('text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>
          {participantPreview.join(', ')}
          {hasMoreParticipants ? '…' : ''}
        </p>
      )}
    </div>
  )
}

function PlanificacionCard({
  planificacion,
  compact = false,
  canEdit = false,
  canDelete = false,
  onEdit,
  onDelete,
}: {
  planificacion: PlanificacionCalendario
  compact?: boolean
  canEdit?: boolean
  canDelete?: boolean
  onEdit?: (planificacion: PlanificacionCalendario) => void
  onDelete?: (planificacion: PlanificacionCalendario) => void
}) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-card/90 p-4 transition-colors hover:bg-muted/20',
        compact ? 'space-y-2' : 'space-y-3'
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={cn('font-medium', PLANIFICACION_ESTADO_BADGES[planificacion.estado])}>
          {PLANIFICACION_ESTADO_LABELS[planificacion.estado]}
        </Badge>

        {(canEdit || canDelete) && (
          <div className="ml-auto flex items-center gap-1">
            {canEdit && onEdit && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onEdit(planificacion)
                }}
              >
                <Pencil className="w-3.5 h-3.5 mr-1" />
                Editar
              </Button>
            )}
            {canDelete && onDelete && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs text-red-700 border-red-200 hover:bg-red-50"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onDelete(planificacion)
                }}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Eliminar
              </Button>
            )}
          </div>
        )}
      </div>

      <div>
        <p className={cn('text-foreground font-semibold leading-tight', compact ? 'text-sm' : 'text-base')}>
          {planificacion.titulo}
        </p>
        {planificacion.descripcion && (
          <p className={cn('text-muted-foreground', compact ? 'text-xs mt-1' : 'text-sm mt-1')}>
            {planificacion.descripcion}
          </p>
        )}
      </div>

      <div className={cn('flex flex-wrap gap-3 text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>
        <span className="inline-flex items-center gap-1.5">
          <CalendarClock className="w-3.5 h-3.5" />
          {formatPlanningRange(planificacion)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Flag className="w-3.5 h-3.5" />
          Comisión Directiva
        </span>
      </div>
    </div>
  )
}

function TareaVencimientoCard({
  tarea,
  compact = false,
}: {
  tarea: TareaVencimientoCalendario
  compact?: boolean
}) {
  const meta = dueDateMeta(tarea.fecha_limite)

  return (
    <div
      className={cn(
        'rounded-xl border bg-card/90 p-4 transition-colors hover:bg-muted/20',
        compact ? 'space-y-2' : 'space-y-3'
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={cn('font-medium', meta.tone)}>
          Vencimiento de tarea
        </Badge>
      </div>

      <div>
        <p className={cn('text-foreground font-semibold leading-tight', compact ? 'text-sm' : 'text-base')}>
          {tarea.titulo}
        </p>
        <p className={cn('text-muted-foreground', compact ? 'text-xs mt-1' : 'text-sm mt-1')}>
          {tarea.proyecto_nombre ? `Proyecto: ${tarea.proyecto_nombre}` : 'Proyecto institucional'}
        </p>
      </div>

      <div className={cn('rounded-lg border px-2.5 py-2 text-xs font-semibold', meta.tone)}>
        Fecha límite: {formatDateOnly(tarea.fecha_limite)} · {meta.label}
      </div>
    </div>
  )
}

export default function CalendarioPage() {
  const { user } = useAuth()
  const {
    reuniones,
    planificaciones,
    tareasConVencimiento,
    sociosDisponibles,
    loading,
    planningLoading,
    tasksLoading,
    creating,
    updating,
    creatingPlanning,
    updatingPlanning,
    deletingPlanning,
    calendarAvailable,
    planningAvailable,
    canSchedule,
    canCreatePlanning,
    canEditPlanning,
    canDeletePlanning,
    canManagePlanning,
    retryCalendarCheck,
    crearReunion,
    actualizarReunion,
    crearPlanificacion,
    actualizarPlanificacion,
    eliminarPlanificacion,
  } = useCalendario()

  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [searchUsers, setSearchUsers] = useState('')
  const [form, setForm] = useState<MeetingFormState>(() => buildDefaultFormState())
  const [planningForm, setPlanningForm] = useState<PlanningFormState>(() => buildDefaultPlanningFormState())
  const [involucrados, setInvolucrados] = useState<string[]>([])
  const [invitados, setInvitados] = useState<string[]>([])
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null)
  const [editingPlanningId, setEditingPlanningId] = useState<string | null>(null)
  const scheduleFormRef = useRef<HTMLDivElement | null>(null)
  const planningFormRef = useRef<HTMLDivElement | null>(null)
  const titleInputRef = useRef<HTMLInputElement | null>(null)
  const planningTitleInputRef = useRef<HTMLInputElement | null>(null)
  const savingMeeting = creating || updating
  const savingPlanning = creatingPlanning || updatingPlanning || deletingPlanning
  const planningSubmitDisabled = savingPlanning || (editingPlanningId ? !canEditPlanning : !canCreatePlanning)

  const selectedDayKey = dateKey(selectedDate)

  const reunionesDelDia = useMemo(() => (
    reuniones.filter((r) => dateKey(r.fecha_inicio) === selectedDayKey)
  ), [reuniones, selectedDayKey])

  const planificacionesOrdenadas = useMemo(
    () => [...planificaciones].sort((a, b) => (
      a.fecha_inicio.localeCompare(b.fecha_inicio) || a.titulo.localeCompare(b.titulo)
    )),
    [planificaciones]
  )

  const planificacionesDelDia = useMemo(() => (
    planificacionesOrdenadas.filter((item) => (
      item.fecha_inicio <= selectedDayKey && item.fecha_fin >= selectedDayKey
    ))
  ), [planificacionesOrdenadas, selectedDayKey])

  const tareasVencenDelDia = useMemo(() => (
    tareasConVencimiento.filter((tarea) => dateKey(tarea.fecha_limite) === selectedDayKey)
  ), [tareasConVencimiento, selectedDayKey])

  const proximasReuniones = useMemo(() => {
    const now = Date.now()
    return [...reuniones]
      .filter((r) => new Date(r.fecha_fin).getTime() >= now)
      .sort((a, b) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime())
  }, [reuniones])

  const proximasPlanificaciones = useMemo(() => {
    const todayKey = dateKey(new Date())
    return planificacionesOrdenadas.filter((item) => item.fecha_fin >= todayKey)
  }, [planificacionesOrdenadas])

  const proximosVencimientosTareas = useMemo(() => {
    const todayKey = dateKey(new Date())
    return tareasConVencimiento.filter((tarea) => tarea.fecha_limite >= todayKey)
  }, [tareasConVencimiento])

  const reunionesSemana = useMemo(() => {
    const now = Date.now()
    const in7Days = now + 7 * 24 * 60 * 60 * 1000
    return reuniones.filter((r) => {
      const start = new Date(r.fecha_inicio).getTime()
      return start >= now && start <= in7Days
    }).length
  }, [reuniones])

  const planificacionesSemana = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const in7Days = new Date(today)
    in7Days.setDate(in7Days.getDate() + 7)

    return planificaciones.filter((item) => {
      const inicio = parseDateOnly(item.fecha_inicio)
      const fin = parseDateOnly(item.fecha_fin)
      if (!inicio || !fin) return false
      return inicio.getTime() <= in7Days.getTime() && fin.getTime() >= today.getTime()
    }).length
  }, [planificaciones])

  const vencimientosSemana = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const in7Days = new Date(today)
    in7Days.setDate(in7Days.getDate() + 7)

    return tareasConVencimiento.filter((item) => {
      const due = parseDateOnly(item.fecha_limite)
      if (!due) return false
      return due.getTime() >= today.getTime() && due.getTime() <= in7Days.getTime()
    }).length
  }, [tareasConVencimiento])

  const totalEventosSemana = reunionesSemana + planificacionesSemana + vencimientosSemana

  const reunionesMes = useMemo(() => {
    const selectedMonth = selectedDate.getMonth()
    const selectedYear = selectedDate.getFullYear()
    return reuniones.filter((r) => {
      const d = new Date(r.fecha_inicio)
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear
    }).length
  }, [reuniones, selectedDate])

  const planificacionesMes = useMemo(() => {
    const selectedMonth = selectedDate.getMonth()
    const selectedYear = selectedDate.getFullYear()
    return planificaciones.filter((item) => {
      const start = parseDateOnly(item.fecha_inicio)
      if (!start) return false
      return start.getMonth() === selectedMonth && start.getFullYear() === selectedYear
    }).length
  }, [planificaciones, selectedDate])

  const vencimientosMes = useMemo(() => {
    const selectedMonth = selectedDate.getMonth()
    const selectedYear = selectedDate.getFullYear()
    return tareasConVencimiento.filter((item) => {
      const due = parseDateOnly(item.fecha_limite)
      if (!due) return false
      return due.getMonth() === selectedMonth && due.getFullYear() === selectedYear
    }).length
  }, [tareasConVencimiento, selectedDate])

  const totalEventosMes = reunionesMes + planificacionesMes + vencimientosMes
  const totalVencimientosAbiertos = tareasConVencimiento.length

  const diasConReunion = useMemo(
    () => reuniones.map((r) => new Date(r.fecha_inicio)),
    [reuniones]
  )

  const diasPlanificacion = useMemo(() => {
    const dayStatus = new Map<string, CalendarioEstadoPlanificacion>()

    for (const item of planificaciones) {
      const inicio = parseDateOnly(item.fecha_inicio)
      const fin = parseDateOnly(item.fecha_fin)
      if (!inicio || !fin) continue

      const cursor = new Date(inicio)
      while (cursor.getTime() <= fin.getTime()) {
        const key = dateKey(cursor)
        const prev = dayStatus.get(key)
        if (!prev || item.estado === 'definitivo') {
          dayStatus.set(key, item.estado)
        }
        cursor.setDate(cursor.getDate() + 1)
      }
    }

    const tentativas: Date[] = []
    const definitivas: Date[] = []

    for (const [key, status] of dayStatus.entries()) {
      const parsed = parseDateOnly(key)
      if (!parsed) continue

      if (status === 'definitivo') {
        definitivas.push(parsed)
      } else {
        tentativas.push(parsed)
      }
    }

    return { tentativas, definitivas }
  }, [planificaciones])

  const diasConVencimiento = useMemo(() => {
    const days: Date[] = []
    for (const item of tareasConVencimiento) {
      const parsed = parseDateOnly(item.fecha_limite)
      if (parsed) {
        days.push(parsed)
      }
    }
    return days
  }, [tareasConVencimiento])

  const sociosFiltrados = useMemo(() => {
    const needle = searchUsers.trim().toLowerCase()
    if (!needle) return sociosDisponibles

    return sociosDisponibles.filter((socio) => {
      const fullName = `${socio.nombre} ${socio.apellido}`.toLowerCase()
      const role = (socio.rol_aile || '').toLowerCase()
      return fullName.includes(needle) || role.includes(needle) || (socio.email || '').toLowerCase().includes(needle)
    })
  }, [sociosDisponibles, searchUsers])

  const handleScopeChange = (value: CalendarioAlcanceReunion) => {
    setForm((prev) => ({ ...prev, alcance: value }))
    if (value !== 'personalizada') {
      setInvolucrados([])
      setInvitados([])
      setSearchUsers('')
    }
  }

  const toggleInvolucrado = (usuarioId: string) => {
    setInvolucrados((prev) => {
      if (prev.includes(usuarioId)) {
        return prev.filter((id) => id !== usuarioId)
      }
      return [...prev, usuarioId]
    })
    setInvitados((prev) => prev.filter((id) => id !== usuarioId))
  }

  const toggleInvitado = (usuarioId: string) => {
    setInvitados((prev) => {
      if (prev.includes(usuarioId)) {
        return prev.filter((id) => id !== usuarioId)
      }
      return [...prev, usuarioId]
    })
    setInvolucrados((prev) => prev.filter((id) => id !== usuarioId))
  }

  const resetForm = () => {
    setForm(buildDefaultFormState())
    setInvolucrados([])
    setInvitados([])
    setSearchUsers('')
    setEditingMeetingId(null)
  }

  const resetPlanningForm = (baseDate: Date = selectedDate) => {
    setPlanningForm(buildDefaultPlanningFormState(baseDate))
    setEditingPlanningId(null)
  }

  const focusScheduleForm = () => {
    window.requestAnimationFrame(() => {
      scheduleFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      window.setTimeout(() => {
        titleInputRef.current?.focus()
      }, 250)
    })
  }

  const focusPlanningForm = () => {
    window.requestAnimationFrame(() => {
      planningFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      window.setTimeout(() => {
        planningTitleInputRef.current?.focus()
      }, 250)
    })
  }

  const startEditingMeeting = (reunion: ReunionCalendario) => {
    const participantes = reunion.participantes || []
    const nuevosInvolucrados = participantes
      .filter((p) => p.participacion === 'involucrado')
      .map((p) => p.usuario_id)

    const nuevosInvitados = participantes
      .filter((p) => p.participacion === 'invitado')
      .map((p) => p.usuario_id)

    setForm({
      titulo: reunion.titulo,
      descripcion: reunion.descripcion || '',
      lugar: reunion.lugar || '',
      fechaInicio: toDateTimeLocalValue(new Date(reunion.fecha_inicio)),
      fechaFin: toDateTimeLocalValue(new Date(reunion.fecha_fin)),
      alcance: reunion.alcance,
    })
    setInvolucrados(nuevosInvolucrados)
    setInvitados(nuevosInvitados)
    setEditingMeetingId(reunion.id)
    setSelectedDate(new Date(reunion.fecha_inicio))
    toast.success(`Editando: ${reunion.titulo}`)
    focusScheduleForm()
  }

  const syncFormDateWithSelection = (day: Date) => {
    if (!canSchedule || editingMeetingId) return

    const start = parseLocalDateTime(form.fechaInicio)
    const end = parseLocalDateTime(form.fechaFin)

    const mergedStart = new Date(day)
    mergedStart.setHours(
      !start ? 10 : start.getHours(),
      !start ? 0 : start.getMinutes(),
      0,
      0
    )

    const durationMs = !start || !end
      ? 60 * 60 * 1000
      : Math.max(30 * 60 * 1000, end.getTime() - start.getTime())
    const mergedEnd = new Date(mergedStart.getTime() + durationMs)

    setForm((prev) => ({
      ...prev,
      fechaInicio: toDateTimeLocalValue(mergedStart),
      fechaFin: toDateTimeLocalValue(mergedEnd),
    }))
  }

  const submitMeeting = async () => {
    const titulo = form.titulo.trim()
    if (!titulo) {
      toast.error('Debes completar el título de la reunión')
      return
    }

    const inicio = parseLocalDateTime(form.fechaInicio)
    const fin = parseLocalDateTime(form.fechaFin)
    if (!inicio || !fin) {
      toast.error('Fechas inválidas')
      return
    }

    if (fin <= inicio) {
      toast.error('La fecha de finalización debe ser posterior al inicio')
      return
    }

    if (form.alcance === 'personalizada' && involucrados.length + invitados.length === 0) {
      toast.error('Selecciona al menos una persona invitada o involucrada')
      return
    }

    const payloadBase = {
      titulo,
      descripcion: form.descripcion.trim(),
      lugar: form.lugar.trim(),
      fechaInicio: toSupabaseTimestamptz(form.fechaInicio),
      fechaFin: toSupabaseTimestamptz(form.fechaFin),
      alcance: form.alcance,
      involucrados,
      invitados,
    }

    if (editingMeetingId) {
      await actualizarReunion({
        reunionId: editingMeetingId,
        ...payloadBase,
      })
    } else {
      await crearReunion(payloadBase)
    }

    setSelectedDate(new Date(inicio))
    resetForm()
  }

  const startEditingPlanning = (planificacion: PlanificacionCalendario) => {
    setPlanningForm({
      titulo: planificacion.titulo,
      descripcion: planificacion.descripcion || '',
      fechaInicio: planificacion.fecha_inicio,
      fechaFin: planificacion.fecha_fin,
      estado: planificacion.estado,
    })
    setEditingPlanningId(planificacion.id)
    const startDate = parseDateOnly(planificacion.fecha_inicio)
    if (startDate) {
      setSelectedDate(startDate)
    }
    toast.success(`Editando fecha: ${planificacion.titulo}`)
    focusPlanningForm()
  }

  const syncPlanningFormDateWithSelection = (day: Date) => {
    if (!canCreatePlanning || editingPlanningId) return

    const currentStart = parseDateOnly(planningForm.fechaInicio)
    const currentEnd = parseDateOnly(planningForm.fechaFin)
    const durationDays = (!currentStart || !currentEnd)
      ? 0
      : Math.max(0, Math.round((currentEnd.getTime() - currentStart.getTime()) / (24 * 60 * 60 * 1000)))

    const mergedStart = new Date(day)
    mergedStart.setHours(0, 0, 0, 0)

    const mergedEnd = new Date(mergedStart)
    mergedEnd.setDate(mergedEnd.getDate() + durationDays)

    setPlanningForm((prev) => ({
      ...prev,
      fechaInicio: toDateInputValue(mergedStart),
      fechaFin: toDateInputValue(mergedEnd),
    }))
  }

  const submitPlanning = async () => {
    if (editingPlanningId && !canEditPlanning) {
      toast.error('No tienes permisos para editar fechas de planificación')
      return
    }

    if (!editingPlanningId && !canCreatePlanning) {
      toast.error('No tienes permisos para crear fechas de planificación')
      return
    }

    const titulo = planningForm.titulo.trim()
    if (!titulo) {
      toast.error('Debes completar el título de la actividad')
      return
    }

    const inicio = parseDateOnly(planningForm.fechaInicio)
    const fin = parseDateOnly(planningForm.fechaFin)
    if (!inicio || !fin) {
      toast.error('Fechas inválidas')
      return
    }

    if (fin.getTime() < inicio.getTime()) {
      toast.error('La fecha de finalización debe ser igual o posterior al inicio')
      return
    }

    const payloadBase = {
      titulo,
      descripcion: planningForm.descripcion.trim(),
      fechaInicio: planningForm.fechaInicio,
      fechaFin: planningForm.fechaFin,
      estado: planningForm.estado,
    }

    if (editingPlanningId) {
      await actualizarPlanificacion({
        planificacionId: editingPlanningId,
        ...payloadBase,
      })
    } else {
      await crearPlanificacion(payloadBase)
    }

    setSelectedDate(new Date(inicio))
    resetPlanningForm(new Date(inicio))
  }

  const handleDeletePlanning = async (planificacion: PlanificacionCalendario) => {
    if (!canDeletePlanning) return
    if (!window.confirm(`¿Eliminar la fecha "${planificacion.titulo}"? Esta acción no se puede deshacer.`)) {
      return
    }

    await eliminarPlanificacion(planificacion.id)

    if (editingPlanningId === planificacion.id) {
      resetPlanningForm()
    }
  }

  if (!calendarAvailable) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Calendario</h1>
          <p className="text-sm text-muted-foreground">
            Agenda única institucional con reuniones, planificación de comisión y vencimientos de tareas.
          </p>
        </div>

        <Card className="border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <ShieldAlert className="w-5 h-5" />
              Módulo no inicializado en base de datos
            </CardTitle>
            <CardDescription className="text-amber-800">
              Ejecuta la migración <code>024_calendar_module.sql</code> en Supabase para habilitar el calendario.
              Si ya la corriste y aparece error <code>42P17</code>, ejecuta también <code>025_fix_calendar_rls_recursion.sql</code>.
            </CardDescription>
            <div className="pt-2">
              <Button
                variant="outline"
                className="border-amber-300 text-amber-900 hover:bg-amber-100"
                onClick={retryCalendarCheck}
              >
                Reintentar validación
              </Button>
            </div>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Calendario</h1>
        <p className="text-sm text-muted-foreground">
          Agenda única institucional con reuniones, planificación de comisión y vencimientos de tareas.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-violet-200 bg-violet-50/40">
          <CardHeader className="pb-2">
            <CardDescription>Próximos 7 días (todo)</CardDescription>
            <CardTitle className="text-2xl text-violet-900">{totalEventosSemana}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-violet-700">
            {reunionesSemana} reuniones, {planificacionesSemana} actividades de comisión y {vencimientosSemana} vencimientos.
          </CardContent>
        </Card>

        <Card className="border-cyan-200 bg-cyan-50/40">
          <CardHeader className="pb-2">
            <CardDescription>Mes seleccionado (todo)</CardDescription>
            <CardTitle className="text-2xl text-cyan-900">{totalEventosMes}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-cyan-700">
            Incluye reuniones, planificación y fechas límite de tareas.
          </CardContent>
        </Card>

        <Card className="border-rose-200 bg-rose-50/40">
          <CardHeader className="pb-2">
            <CardDescription>Vencimientos de tareas activos</CardDescription>
            <CardTitle className="text-2xl text-rose-900">{totalVencimientosAbiertos}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-rose-700">
            Tareas abiertas con fecha límite asignada.
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="w-5 h-5" />
            Calendario único unificado
          </CardTitle>
          <CardDescription>
            Un solo calendario para reuniones, planificación anual de comisión y vencimientos de tareas.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-xl border bg-card p-3">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(value) => {
                if (value) {
                  setSelectedDate(value)
                  syncFormDateWithSelection(value)
                  syncPlanningFormDateWithSelection(value)
                }
              }}
              modifiers={{
                conReunion: diasConReunion,
                planTentativa: diasPlanificacion.tentativas,
                planDefinitiva: diasPlanificacion.definitivas,
                vencimientoTarea: diasConVencimiento,
              }}
              modifiersClassNames={{
                conReunion: 'ring-1 ring-violet-400 text-violet-950 font-semibold rounded-md',
                planTentativa: 'ring-1 ring-amber-500 text-amber-950 font-semibold rounded-md',
                planDefinitiva: 'ring-2 ring-emerald-600 text-emerald-950 font-semibold rounded-md',
                vencimientoTarea: 'ring-2 ring-rose-600 text-rose-950 font-semibold rounded-md',
              }}
              className="w-full p-0"
              classNames={{
                months: 'w-full',
                month: 'w-full space-y-3',
                caption: 'relative flex items-center justify-center py-2',
                caption_label: 'text-sm sm:text-base font-semibold',
                nav: 'absolute inset-x-0 top-2 flex items-center justify-between px-1 sm:px-2',
                nav_button: 'h-8 w-8 bg-transparent',
                table: 'w-full border-collapse',
                head_row: 'grid grid-cols-7',
                head_cell: 'text-center text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-muted-foreground py-2',
                row: 'mt-1 grid grid-cols-7',
                cell: 'p-0 text-center',
                day: 'h-11 sm:h-14 w-full rounded-md text-xs sm:text-sm font-medium transition-colors hover:bg-muted',
                day_today: 'bg-white text-foreground ring-2 ring-violet-300',
                day_selected: 'bg-[#4f0f86] text-white hover:bg-[#4f0f86] focus:bg-[#4f0f86] shadow-sm',
                day_outside: 'text-muted-foreground/65',
                day_disabled: 'text-muted-foreground/50',
              }}
            />
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Día seleccionado</p>
              <p className="mt-1 text-base font-semibold text-foreground">
                {selectedDate.toLocaleDateString('es-AR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {reunionesDelDia.length + planificacionesDelDia.length + tareasVencenDelDia.length} evento/s
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="font-medium bg-violet-100 text-violet-900 border-violet-200">
                Reunión
              </Badge>
              <Badge variant="outline" className={cn('font-medium', PLANIFICACION_ESTADO_BADGES.tentativo)}>
                Planificación tentativo
              </Badge>
              <Badge variant="outline" className={cn('font-medium', PLANIFICACION_ESTADO_BADGES.definitivo)}>
                Planificación definitivo
              </Badge>
              <Badge variant="outline" className="font-medium bg-rose-100 text-rose-900 border-rose-200">
                Vencimiento de tarea
              </Badge>
            </div>

            {loading || planningLoading || tasksLoading ? (
              <p className="text-sm text-muted-foreground">Cargando eventos del día...</p>
            ) : (reunionesDelDia.length + planificacionesDelDia.length + tareasVencenDelDia.length) === 0 ? (
              <p className="text-sm text-muted-foreground">No hay eventos para este día.</p>
            ) : (
              <ScrollArea className="h-[300px] sm:h-[430px] pr-3">
                <div className="space-y-4">
                  {reunionesDelDia.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Reuniones</p>
                      {reunionesDelDia.map((reunion) => (
                        <ReunionCard
                          key={`day-${reunion.id}`}
                          reunion={reunion}
                          currentUserId={user?.id}
                          compact
                          canEdit={canSchedule}
                          onEdit={startEditingMeeting}
                        />
                      ))}
                    </div>
                  )}

                  {planificacionesDelDia.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Planificación de comisión</p>
                      {planificacionesDelDia.map((planificacion) => (
                        <PlanificacionCard
                          key={`day-plan-${planificacion.id}`}
                          planificacion={planificacion}
                          compact
                          canEdit={canEditPlanning}
                          canDelete={canDeletePlanning}
                          onEdit={startEditingPlanning}
                          onDelete={(item) => { void handleDeletePlanning(item) }}
                        />
                      ))}
                    </div>
                  )}

                  {tareasVencenDelDia.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Vencimientos de tareas</p>
                      {tareasVencenDelDia.map((tarea) => (
                        <TareaVencimientoCard key={`day-task-${tarea.id}`} tarea={tarea} compact />
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>
        </CardContent>
      </Card>

      {!planningAvailable ? (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <ShieldAlert className="w-5 h-5" />
              Planificación anual no inicializada
            </CardTitle>
            <CardDescription className="text-amber-800">
              Ejecuta la migración <code>035_calendar_planning_module.sql</code> para habilitar este espacio.
            </CardDescription>
            <div className="pt-2">
              <Button
                variant="outline"
                className="border-amber-300 text-amber-900 hover:bg-amber-100"
                onClick={retryCalendarCheck}
              >
                Reintentar validación
              </Button>
            </div>
          </CardHeader>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fechas de comisión</CardTitle>
              <CardDescription>
                Listado de próximas actividades para seguimiento institucional de socios.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {planningLoading ? (
                <p className="text-sm text-muted-foreground">Cargando listado de planificación...</p>
              ) : proximasPlanificaciones.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay actividades de comisión planificadas.</p>
              ) : (
                <div className="space-y-3">
                  {proximasPlanificaciones.map((planificacion) => (
                    <PlanificacionCard
                      key={`upcoming-plan-${planificacion.id}`}
                      planificacion={planificacion}
                      canEdit={canEditPlanning}
                      canDelete={canDeletePlanning}
                      onEdit={startEditingPlanning}
                      onDelete={(item) => { void handleDeletePlanning(item) }}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {canManagePlanning ? (
            <Card ref={planningFormRef} className="border border-cyan-200/70">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-cyan-900">
                  <Flag className="w-5 h-5" />
                  {editingPlanningId ? 'Editar fecha de planificación' : 'Nueva fecha de planificación'}
                </CardTitle>
                <CardDescription>
                  {editingPlanningId
                    ? 'Actualiza estado y rango de fechas de una actividad de comisión.'
                    : 'Por defecto solo Comisión Directiva puede cargar fechas. Puedes habilitar otros roles desde Ajustes > Roles > Permisos del módulo Calendario.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {!editingPlanningId && !canCreatePlanning && (
                  <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-800">
                    Tu rol puede editar o eliminar fechas existentes, pero no crear nuevas.
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="space-y-2">
                    <Label htmlFor="titulo-planificacion">Actividad</Label>
                    <Input
                      id="titulo-planificacion"
                      ref={planningTitleInputRef}
                      placeholder="Ej.: Jornada de liderazgo violeta"
                      value={planningForm.titulo}
                      onChange={(e) => setPlanningForm((prev) => ({ ...prev, titulo: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="estado-planificacion">Estado</Label>
                    <Select
                      value={planningForm.estado}
                      onValueChange={(value) => setPlanningForm((prev) => ({
                        ...prev,
                        estado: value as CalendarioEstadoPlanificacion,
                      }))}
                    >
                      <SelectTrigger id="estado-planificacion">
                        <SelectValue placeholder="Seleccionar estado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tentativo">Tentativa</SelectItem>
                        <SelectItem value="definitivo">Definitiva</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="descripcion-planificacion">Descripción</Label>
                  <Textarea
                    id="descripcion-planificacion"
                    rows={3}
                    placeholder="Objetivo, observaciones o notas de seguimiento."
                    value={planningForm.descripcion}
                    onChange={(e) => setPlanningForm((prev) => ({ ...prev, descripcion: e.target.value }))}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="inicio-planificacion">Fecha de inicio</Label>
                    <Input
                      id="inicio-planificacion"
                      type="date"
                      value={planningForm.fechaInicio}
                      onChange={(e) => {
                        const value = e.target.value
                        setPlanningForm((prev) => ({ ...prev, fechaInicio: value }))
                        const parsed = parseDateOnly(value)
                        if (parsed) {
                          setSelectedDate(parsed)
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fin-planificacion">Fecha de finalización</Label>
                    <Input
                      id="fin-planificacion"
                      type="date"
                      value={planningForm.fechaFin}
                      onChange={(e) => setPlanningForm((prev) => ({ ...prev, fechaFin: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => void submitPlanning()}
                    disabled={planningSubmitDisabled}
                    className="bg-cyan-700 hover:bg-cyan-800 text-white"
                  >
                    {savingPlanning
                      ? (editingPlanningId ? 'Guardando cambios...' : 'Guardando fecha...')
                      : (editingPlanningId ? 'Guardar cambios' : 'Guardar fecha')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => resetPlanningForm()}
                    disabled={savingPlanning}
                  >
                    {editingPlanningId ? 'Cancelar edición' : 'Limpiar'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-amber-200 bg-amber-50/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-900">
                  <ShieldAlert className="w-5 h-5" />
                  Edición de planificación restringida
                </CardTitle>
                <CardDescription className="text-amber-700">
                  Solo la Comisión Directiva puede crear, editar o eliminar fechas de planificación.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Próximas reuniones</CardTitle>
          <CardDescription>
            Incluye las reuniones en las que participas o que creaste.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando agenda...</p>
          ) : proximasReuniones.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay reuniones agendadas por el momento.</p>
          ) : (
            <div className="space-y-3">
              {proximasReuniones.map((reunion) => (
                <ReunionCard
                  key={`upcoming-${reunion.id}`}
                  reunion={reunion}
                  currentUserId={user?.id}
                  canEdit={canSchedule}
                  onEdit={startEditingMeeting}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Próximos vencimientos de tareas</CardTitle>
          <CardDescription>
            Fechas límite activas sincronizadas con el tablero de tareas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tasksLoading ? (
            <p className="text-sm text-muted-foreground">Cargando vencimientos...</p>
          ) : proximosVencimientosTareas.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay tareas activas con fecha límite.</p>
          ) : (
            <div className="space-y-3">
              {proximosVencimientosTareas.map((tarea) => (
                <TareaVencimientoCard key={`upcoming-task-${tarea.id}`} tarea={tarea} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {canSchedule ? (
        <Card ref={scheduleFormRef} className="border border-violet-200/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-violet-900">
              <Megaphone className="w-5 h-5" />
              {editingMeetingId ? 'Editar reunión' : 'Agendar reunión'}
            </CardTitle>
            <CardDescription>
              {editingMeetingId
                ? 'Actualiza datos, participantes y alcance de una reunión existente.'
                : 'Disponible para la Comisión Directiva (incluye control global).'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="titulo-reunion">Título</Label>
                <Input
                  id="titulo-reunion"
                  ref={titleInputRef}
                  placeholder="Ej.: Reunión mensual de comisión"
                  value={form.titulo}
                  onChange={(e) => setForm((prev) => ({ ...prev, titulo: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lugar-reunion">Lugar</Label>
                <Input
                  id="lugar-reunion"
                  placeholder="Sede central / Meet / Zoom"
                  value={form.lugar}
                  onChange={(e) => setForm((prev) => ({ ...prev, lugar: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcion-reunion">Descripción</Label>
              <Textarea
                id="descripcion-reunion"
                rows={3}
                placeholder="Temario, objetivos y notas previas"
                value={form.descripcion}
                onChange={(e) => setForm((prev) => ({ ...prev, descripcion: e.target.value }))}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="inicio-reunion">Inicio</Label>
                <Input
                  id="inicio-reunion"
                  type="datetime-local"
                  value={form.fechaInicio}
                  onChange={(e) => {
                    const value = e.target.value
                    setForm((prev) => ({ ...prev, fechaInicio: value }))

                    const parsed = parseLocalDateTime(value)
                    if (parsed) {
                      setSelectedDate(parsed)
                    }
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fin-reunion">Fin</Label>
                <Input
                  id="fin-reunion"
                  type="datetime-local"
                  value={form.fechaFin}
                  onChange={(e) => setForm((prev) => ({ ...prev, fechaFin: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="alcance-reunion">Alcance</Label>
                <Select
                  value={form.alcance}
                  onValueChange={(value) => handleScopeChange(value as CalendarioAlcanceReunion)}
                >
                  <SelectTrigger id="alcance-reunion">
                    <SelectValue placeholder="Seleccionar alcance" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comision_directiva">Comisión Directiva</SelectItem>
                    <SelectItem value="general">General (todos los socios)</SelectItem>
                    <SelectItem value="personalizada">Personalizada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.alcance === 'comision_directiva' && (
              <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-800">
                Para este tipo, el sistema invitará solamente a miembros de Comisión Directiva.
              </div>
            )}

            {form.alcance === 'general' && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                Se invitará automáticamente a todos los socios activos.
              </div>
            )}

            {form.alcance === 'personalizada' && (
              <div className="space-y-3">
                <Label htmlFor="buscar-usuario">Seleccionar involucrados e invitados</Label>
                <Input
                  id="buscar-usuario"
                  placeholder="Buscar por nombre, email o rol institucional..."
                  value={searchUsers}
                  onChange={(e) => setSearchUsers(e.target.value)}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border">
                    <div className="border-b px-3 py-2 text-sm font-medium text-foreground">
                      Involucrados ({involucrados.length})
                    </div>
                    <ScrollArea className="h-48 px-2 py-2">
                      <div className="space-y-1">
                        {sociosFiltrados.map((socio) => (
                          <button
                            key={`involucrado-${socio.usuario_id}`}
                            type="button"
                            onClick={() => toggleInvolucrado(socio.usuario_id)}
                            className={cn(
                              'w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                              involucrados.includes(socio.usuario_id)
                                ? 'bg-violet-100 text-violet-900'
                                : 'hover:bg-muted'
                            )}
                          >
                            <p className="font-medium">{socio.nombre} {socio.apellido}</p>
                            <p className="text-xs text-muted-foreground">{socio.rol_aile || 'Sin rol institucional'}</p>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>

                  <div className="rounded-lg border">
                    <div className="border-b px-3 py-2 text-sm font-medium text-foreground">
                      Invitados ({invitados.length})
                    </div>
                    <ScrollArea className="h-48 px-2 py-2">
                      <div className="space-y-1">
                        {sociosFiltrados.map((socio) => (
                          <button
                            key={`invitado-${socio.usuario_id}`}
                            type="button"
                            onClick={() => toggleInvitado(socio.usuario_id)}
                            className={cn(
                              'w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                              invitados.includes(socio.usuario_id)
                                ? 'bg-cyan-100 text-cyan-900'
                                : 'hover:bg-muted'
                            )}
                          >
                            <p className="font-medium">{socio.nombre} {socio.apellido}</p>
                            <p className="text-xs text-muted-foreground">{socio.rol_aile || 'Sin rol institucional'}</p>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => void submitMeeting()}
                disabled={savingMeeting}
                className="bg-[#6314a7] hover:bg-[#53108c]"
              >
                {savingMeeting
                  ? (editingMeetingId ? 'Guardando cambios...' : 'Agendando...')
                  : (editingMeetingId ? 'Guardar cambios y notificar' : 'Agendar y notificar')}
              </Button>
              <Button variant="outline" onClick={resetForm} disabled={savingMeeting}>
                {editingMeetingId ? 'Cancelar edición' : 'Limpiar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <ShieldAlert className="w-5 h-5" />
              Agendamiento restringido
            </CardTitle>
            <CardDescription className="text-amber-700">
              Solo la Comisión Directiva puede crear o editar reuniones.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  )
}
