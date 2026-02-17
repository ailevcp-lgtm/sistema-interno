'use client'

import { useMemo, useRef, useState } from 'react'
import {
  CalendarDays,
  Clock3,
  MapPin,
  Users,
  UserCheck,
  Megaphone,
  ShieldAlert,
  Pencil,
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
  ReunionCalendario,
  ReunionCalendarioParticipante,
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

interface MeetingFormState {
  titulo: string
  descripcion: string
  lugar: string
  fechaInicio: string
  fechaFin: string
  alcance: CalendarioAlcanceReunion
}

function toDateTimeLocalValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
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

function dateKey(date: Date): string
function dateKey(date: string): string
function dateKey(date: Date | string): string {
  const parsed = typeof date === 'string' ? new Date(date) : date
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

export default function CalendarioPage() {
  const { user } = useAuth()
  const {
    reuniones,
    sociosDisponibles,
    loading,
    creating,
    updating,
    calendarAvailable,
    canSchedule,
    retryCalendarCheck,
    crearReunion,
    actualizarReunion,
  } = useCalendario()

  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [searchUsers, setSearchUsers] = useState('')
  const [form, setForm] = useState<MeetingFormState>(() => buildDefaultFormState())
  const [involucrados, setInvolucrados] = useState<string[]>([])
  const [invitados, setInvitados] = useState<string[]>([])
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null)
  const scheduleFormRef = useRef<HTMLDivElement | null>(null)
  const titleInputRef = useRef<HTMLInputElement | null>(null)
  const savingMeeting = creating || updating

  const reunionesDelDia = useMemo(() => {
    const selectedKey = dateKey(selectedDate)
    return reuniones.filter((r) => dateKey(r.fecha_inicio) === selectedKey)
  }, [reuniones, selectedDate])

  const proximasReuniones = useMemo(() => {
    const now = Date.now()
    return [...reuniones]
      .filter((r) => new Date(r.fecha_fin).getTime() >= now)
      .sort((a, b) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime())
  }, [reuniones])

  const diasConReunion = useMemo(
    () => reuniones.map((r) => new Date(r.fecha_inicio)),
    [reuniones]
  )

  const reunionesSemana = useMemo(() => {
    const now = Date.now()
    const in7Days = now + 7 * 24 * 60 * 60 * 1000
    return reuniones.filter((r) => {
      const start = new Date(r.fecha_inicio).getTime()
      return start >= now && start <= in7Days
    }).length
  }, [reuniones])

  const reunionesMes = useMemo(() => {
    const selectedMonth = selectedDate.getMonth()
    const selectedYear = selectedDate.getFullYear()
    return reuniones.filter((r) => {
      const d = new Date(r.fecha_inicio)
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear
    }).length
  }, [reuniones, selectedDate])

  const reunionesComoInvolucrado = useMemo(() => {
    if (!user?.id) return 0

    return reuniones.filter((r) => {
      if (r.created_by === user.id) return true
      return (r.participantes || []).some(
        (p) => p.usuario_id === user.id && p.participacion === 'involucrado'
      )
    }).length
  }, [reuniones, user?.id])

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

  const focusScheduleForm = () => {
    window.requestAnimationFrame(() => {
      scheduleFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      window.setTimeout(() => {
        titleInputRef.current?.focus()
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

  if (!calendarAvailable) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Calendario</h1>
          <p className="text-sm text-muted-foreground">
            Agenda institucional con reuniones, invitados e involucrados.
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
          Agenda institucional con reuniones, invitados e involucrados.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-violet-200 bg-violet-50/40">
          <CardHeader className="pb-2">
            <CardDescription>Próximos 7 días</CardDescription>
            <CardTitle className="text-2xl text-violet-900">{reunionesSemana}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-violet-700">Reuniones con inicio en la próxima semana.</CardContent>
        </Card>

        <Card className="border-cyan-200 bg-cyan-50/40">
          <CardHeader className="pb-2">
            <CardDescription>Mes seleccionado</CardDescription>
            <CardTitle className="text-2xl text-cyan-900">{reunionesMes}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-cyan-700">Total de reuniones del mes visible en calendario.</CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardHeader className="pb-2">
            <CardDescription>Tus reuniones clave</CardDescription>
            <CardTitle className="text-2xl text-emerald-900">{reunionesComoInvolucrado}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-emerald-700">Organizadas por ti o donde figuras como involucrado/a.</CardContent>
        </Card>
      </div>

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="w-5 h-5" />
            Calendario mensual
          </CardTitle>
          <CardDescription>
            Días con reuniones marcados en violeta. Selecciona un día para ver el detalle.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="rounded-xl border bg-card p-3">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(value) => {
                if (value) {
                  setSelectedDate(value)
                  syncFormDateWithSelection(value)
                }
              }}
              modifiers={{ conReunion: diasConReunion }}
              modifiersClassNames={{ conReunion: 'bg-[#6314a7]/20 text-[#6314a7] font-semibold rounded-md' }}
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
                day_today: 'bg-muted text-foreground',
                day_selected: 'bg-[#6314a7] text-white hover:bg-[#6314a7]',
                day_outside: 'text-muted-foreground opacity-40',
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
                {reunionesDelDia.length} reunión/es
              </p>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">Cargando reuniones...</p>
            ) : reunionesDelDia.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay reuniones para este día.</p>
            ) : (
              <ScrollArea className="h-[300px] sm:h-[430px] pr-3">
                <div className="space-y-2">
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
              </ScrollArea>
            )}
          </div>
        </CardContent>
      </Card>

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
