'use client'

import { useState, useMemo } from 'react'
import {
  Users2,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  X,
  CalendarDays,
  MapPin,
  ChevronDown,
  ChevronUp,
  Loader2,
  ClipboardList,
  TrendingUp,
  History,
  BarChart3,
  Medal,
  Pencil,
  Trash2,
} from 'lucide-react'
import { cn, formatDate, formatDateTime } from '@/lib/utils'
import { useRequireAuth } from '@/hooks/useAuth'
import {
  useReuniones,
  directionFromRoleName,
  type CargarHistoricaPayload,
  type EditarReunionPayload,
  type EstadisticaAsistencia,
  type EstadisticaDireccion,
} from '@/hooks/useReuniones'
import type { DireccionBase, ReunionDireccion } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'

const DIRECCIONES: DireccionBase[] = ['CEA', 'Comunicación', 'Finanzas', 'Recursos Humanos']

const ESTADO_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  programada: { label: 'Programada', color: 'bg-blue-500/20 text-blue-400', icon: Clock },
  finalizada: { label: 'Finalizada', color: 'bg-green-500/20 text-green-400', icon: CheckCircle2 },
  cancelada: { label: 'Cancelada', color: 'bg-gray-500/20 text-gray-400', icon: X },
}

// ── Componente principal ────────────────────────────────────

export default function ReunionesPage() {
  useRequireAuth()

  const {
    reuniones,
    sociosActivos,
    loading,
    creating,
    registrando,
    miDireccion,
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
  } = useReuniones()

  const [dialogoHistoricaAbierto, setDialogoHistoricaAbierto] = useState(false)

  const [tabActiva, setTabActiva] = useState<'reuniones' | 'asistencias' | 'frecuencia'>('reuniones')
  const [filtroDir, setFiltroDir] = useState<DireccionBase | 'todas'>('todas')

  // Diálogo de nueva reunión
  const [dialogoNuevaAbierto, setDialogoNuevaAbierto] = useState(false)

  // Diálogo de asistencia
  const [reunionAsistencia, setReunionAsistencia] = useState<ReunionDireccion | null>(null)
  const [sociosSeleccionados, setSociosSeleccionados] = useState<Set<string>>(new Set())

  // Diálogo de edición
  const [reunionEditando, setReunionEditando] = useState<ReunionDireccion | null>(null)

  // Diálogo de confirmación de eliminación
  const [reunionAEliminar, setReunionAEliminar] = useState<ReunionDireccion | null>(null)

  // Expandir detalles de asistentes
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())

  const reunionesFiltradas = useMemo(() => {
    if (filtroDir === 'todas') return reuniones
    return reuniones.filter((r) => r.direccion === filtroDir)
  }, [reuniones, filtroDir])

  function toggleExpandido(id: string) {
    setExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function abrirDialogoAsistencia(reunion: ReunionDireccion) {
    const ids = new Set((reunion.asistentes || []).map((a) => a.socio_id))
    setSociosSeleccionados(ids)
    setReunionAsistencia(reunion)
  }

  async function confirmarAsistencia() {
    if (!reunionAsistencia) return
    await registrarAsistencia({
      reunionId: reunionAsistencia.id,
      socioIds: Array.from(sociosSeleccionados),
    })
    setReunionAsistencia(null)
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users2 className="w-6 h-6 text-primary" />
            Reuniones de Dirección
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {miDireccion
              ? `Dirección: ${miDireccion}`
              : 'Vista global — todas las direcciones'}
          </p>
        </div>

        {puedeCrear && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogoHistoricaAbierto(true)}
            >
              <History className="w-4 h-4 mr-2" />
              Cargar histórica
            </Button>
            <Button
              onClick={() => setDialogoNuevaAbierto(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Plus className="w-4 h-4 mr-2" />
              Agendar reunión
            </Button>
          </div>
        )}
      </div>

      {/* Banner de asistencias pendientes */}
      {reunionesPendientesAsistencia.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium text-amber-300">
                {reunionesPendientesAsistencia.length === 1
                  ? 'Hay 1 reunión que necesita registro de asistencia'
                  : `Hay ${reunionesPendientesAsistencia.length} reuniones que necesitan registro de asistencia`}
              </p>
              <div className="flex flex-wrap gap-2">
                {reunionesPendientesAsistencia.map((r) => (
                  <Button
                    key={r.id}
                    size="sm"
                    variant="outline"
                    className="border-amber-500/50 text-amber-300 hover:bg-amber-500/20 text-xs"
                    onClick={() => abrirDialogoAsistencia(r)}
                  >
                    <ClipboardList className="w-3 h-3 mr-1.5" />
                    {r.titulo} — {formatDate(r.fecha_inicio)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={tabActiva} onValueChange={(v) => setTabActiva(v as 'reuniones' | 'asistencias' | 'frecuencia')}>
        <TabsList className="bg-muted border border-border">
          <TabsTrigger
            value="reuniones"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <CalendarDays className="w-4 h-4 mr-2" />
            Reuniones
          </TabsTrigger>
          <TabsTrigger
            value="asistencias"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Asistencias
          </TabsTrigger>
          {esAdmin && (
            <TabsTrigger
              value="frecuencia"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Frecuencia
            </TabsTrigger>
          )}
        </TabsList>

        {/* Lista de reuniones */}
        <TabsContent value="reuniones" className="mt-4 space-y-4">
          {/* Filtro por dirección (solo admin/CD) */}
          {puedeVerTodo && (
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant={filtroDir === 'todas' ? 'default' : 'outline'}
                onClick={() => setFiltroDir('todas')}
                className={filtroDir === 'todas' ? 'bg-primary text-primary-foreground' : ''}
              >
                Todas
              </Button>
              {DIRECCIONES.map((d) => (
                <Button
                  key={d}
                  size="sm"
                  variant={filtroDir === d ? 'default' : 'outline'}
                  onClick={() => setFiltroDir(d)}
                  className={filtroDir === d ? 'bg-primary text-primary-foreground' : ''}
                >
                  {d}
                </Button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : reunionesFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users2 className="w-10 h-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No hay reuniones registradas</p>
              {puedeCrear && (
                <Button
                  className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={() => setDialogoNuevaAbierto(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Agendar primera reunión
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {reunionesFiltradas.map((r) => (
                <TarjetaReunion
                  key={r.id}
                  reunion={r}
                  expandido={expandidos.has(r.id)}
                  puedeCrear={puedeCrear}
                  onToggleExpandir={() => toggleExpandido(r.id)}
                  onRegistrarAsistencia={() => abrirDialogoAsistencia(r)}
                  onCancelar={() => cancelarReunion(r.id)}
                  onEditar={() => setReunionEditando(r)}
                  onEliminar={() => setReunionAEliminar(r)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab asistencias */}
        <TabsContent value="asistencias" className="mt-4">
          <TabAsistencias
            estadisticas={estadisticasAsistencia}
            estadisticasDireccion={estadisticasPorDireccion}
            loading={loading}
            filtroDir={miDireccion || undefined}
            puedeVerTodo={puedeVerTodo}
          />
        </TabsContent>

        {/* Panel de frecuencia */}
        {esAdmin && (
          <TabsContent value="frecuencia" className="mt-4">
            <PanelFrecuencia datos={frecuenciaPorDireccion} />
          </TabsContent>
        )}
      </Tabs>

      {/* Diálogo histórica */}
      <DialogHistorica
        abierto={dialogoHistoricaAbierto}
        onCerrar={() => setDialogoHistoricaAbierto(false)}
        miDireccion={miDireccion}
        esAdmin={esAdmin}
        sociosActivos={sociosActivos}
        creating={creating}
        onCargar={async (payload) => {
          const ok = await cargarReunionHistorica(payload)
          if (ok) setDialogoHistoricaAbierto(false)
        }}
      />

      {/* Diálogo nueva reunión */}
      <DialogNuevaReunion
        abierto={dialogoNuevaAbierto}
        onCerrar={() => setDialogoNuevaAbierto(false)}
        miDireccion={miDireccion}
        esAdmin={esAdmin}
        sociosActivos={sociosActivos}
        creating={creating}
        onCrear={async (payload) => {
          const result = await crearReunion(payload)
          if (result) setDialogoNuevaAbierto(false)
        }}
      />

      {/* Diálogo de asistencia */}
      {/* Diálogo de edición */}
      {reunionEditando && (
        <DialogEditarReunion
          reunion={reunionEditando}
          editando={editando}
          onCerrar={() => setReunionEditando(null)}
          onGuardar={async (payload) => {
            const ok = await editarReunion(reunionEditando.id, payload)
            if (ok) setReunionEditando(null)
          }}
        />
      )}

      {/* Diálogo de confirmación de eliminación */}
      {reunionAEliminar && (
        <Dialog open onOpenChange={() => setReunionAEliminar(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="w-5 h-5" />
                Eliminar reunión
              </DialogTitle>
              <DialogDescription>
                ¿Seguro que querés eliminar <strong>{reunionAEliminar.titulo}</strong>? Esta acción no se puede deshacer.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReunionAEliminar(null)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  const ok = await eliminarReunion(reunionAEliminar.id)
                  if (ok) setReunionAEliminar(null)
                }}
              >
                Eliminar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {reunionAsistencia && (
        <Dialog open onOpenChange={() => setReunionAsistencia(null)}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Registrar asistencia</DialogTitle>
              <DialogDescription>
                {reunionAsistencia.titulo} — {formatDate(reunionAsistencia.fecha_inicio)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 py-2">
              <p className="text-sm text-muted-foreground mb-3">
                Seleccioná quiénes asistieron a esta reunión:
              </p>
              {sociosActivos.map((s) => {
                const checked = sociosSeleccionados.has(s.id)
                return (
                  <div
                    key={s.id}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                      checked ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-border/80'
                    )}
                    onClick={() => {
                      setSociosSeleccionados((prev) => {
                        const next = new Set(prev)
                        if (next.has(s.id)) next.delete(s.id)
                        else next.add(s.id)
                        return next
                      })
                    }}
                  >
                    <Checkbox checked={checked} className="pointer-events-none" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {s.nombre} {s.apellido}
                      </p>
                      {s.rol_aile && (
                        <p className="text-xs text-muted-foreground truncate">{s.rol_aile}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <DialogFooter>
              <div className="flex items-center justify-between w-full">
                <span className="text-sm text-muted-foreground">
                  {sociosSeleccionados.size} asistente{sociosSeleccionados.size !== 1 ? 's' : ''} seleccionado{sociosSeleccionados.size !== 1 ? 's' : ''}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setReunionAsistencia(null)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={confirmarAsistencia}
                    disabled={registrando}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {registrando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Confirmar asistencia
                  </Button>
                </div>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

// ── Tarjeta de reunión ──────────────────────────────────────

interface TarjetaReunionProps {
  reunion: ReunionDireccion
  expandido: boolean
  puedeCrear: boolean
  onToggleExpandir: () => void
  onRegistrarAsistencia: () => void
  onCancelar: () => void
  onEditar: () => void
  onEliminar: () => void
}

function TarjetaReunion({
  reunion,
  expandido,
  puedeCrear,
  onToggleExpandir,
  onRegistrarAsistencia,
  onCancelar,
  onEditar,
  onEliminar,
}: TarjetaReunionProps) {
  const estadoConfig = ESTADO_CONFIG[reunion.estado] || ESTADO_CONFIG.programada
  const EstadoIcon = estadoConfig.icon

  const yaPaso = new Date(reunion.fecha_fin) < new Date()
  const necesitaAsistencia =
    reunion.estado === 'programada' && !reunion.asistencia_registrada && yaPaso

  return (
    <Card
      className={cn(
        'bg-card border-border transition-colors',
        necesitaAsistencia && 'border-amber-500/40'
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {/* Encabezado */}
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge className="text-xs bg-primary/20 text-primary border-0">
                {reunion.direccion}
              </Badge>
              <Badge className={cn('text-xs border-0', estadoConfig.color)}>
                <EstadoIcon className="w-3 h-3 mr-1" />
                {estadoConfig.label}
              </Badge>
              {reunion.asistencia_registrada && (
                <Badge className="text-xs border-0 bg-green-500/20 text-green-400">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Asistencia registrada
                </Badge>
              )}
              {necesitaAsistencia && (
                <Badge className="text-xs border-0 bg-amber-500/20 text-amber-400">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Pendiente de asistencia
                </Badge>
              )}
            </div>

            <h3 className="font-semibold text-foreground text-sm">{reunion.titulo}</h3>

            <div className="flex items-center gap-4 mt-1 flex-wrap">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <CalendarDays className="w-3 h-3" />
                {formatDateTime(reunion.fecha_inicio)}
                {' — '}
                {formatDateTime(reunion.fecha_fin).split(' ')[1]}
              </span>
              {reunion.lugar && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {reunion.lugar}
                </span>
              )}
            </div>

            {reunion.descripcion && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{reunion.descripcion}</p>
            )}

            {/* Asistentes (expandido) */}
            {expandido && reunion.asistentes && reunion.asistentes.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Asistentes ({reunion.asistentes.length}):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {reunion.asistentes.map((a) => (
                    <Badge key={a.id} className="text-xs bg-muted text-muted-foreground border-0">
                      {a.socio ? `${a.socio.nombre} ${a.socio.apellido}` : a.socio_id}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Acciones */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            {reunion.asistentes && reunion.asistentes.length > 0 && (
              <button
                onClick={onToggleExpandir}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                {expandido ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {reunion.asistentes.length} asistente{reunion.asistentes.length !== 1 ? 's' : ''}
              </button>
            )}

            {necesitaAsistencia && puedeCrear && (
              <Button
                size="sm"
                onClick={onRegistrarAsistencia}
                className="text-xs bg-amber-600 hover:bg-amber-700 text-white"
              >
                <ClipboardList className="w-3 h-3 mr-1" />
                Registrar
              </Button>
            )}

            {reunion.estado === 'finalizada' && puedeCrear && (
              <Button
                size="sm"
                variant="outline"
                onClick={onRegistrarAsistencia}
                className="text-xs"
              >
                <ClipboardList className="w-3 h-3 mr-1" />
                Editar asistencia
              </Button>
            )}

            {reunion.estado === 'programada' && !yaPaso && puedeCrear && (
              <Button
                size="sm"
                variant="outline"
                onClick={onCancelar}
                className="text-xs text-destructive hover:text-destructive"
              >
                <X className="w-3 h-3 mr-1" />
                Cancelar
              </Button>
            )}

            {puedeCrear && (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onEditar}
                  className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground"
                  title="Editar reunión"
                >
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onEliminar}
                  className="text-xs h-7 px-2 text-muted-foreground hover:text-destructive"
                  title="Eliminar reunión"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Panel de frecuencia ─────────────────────────────────────

interface PanelFrecuenciaProps {
  datos: Array<{
    direccion: DireccionBase
    ultimaReunion: string | null
    diasSinReunion: number | null
    totalReuniones: number
    enAlerta: boolean
  }>
}

function PanelFrecuencia({ datos }: PanelFrecuenciaProps) {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground text-base">
          Frecuencia de reuniones por dirección
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Cada dirección debe reunirse al menos cada 14 días
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {datos.map((d) => (
            <div
              key={d.direccion}
              className={cn(
                'flex items-center gap-4 p-4 rounded-lg border',
                d.enAlerta ? 'border-red-500/40 bg-red-500/5' : 'border-green-500/30 bg-green-500/5'
              )}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-foreground text-sm">{d.direccion}</span>
                  {d.enAlerta ? (
                    <Badge className="text-xs border-0 bg-red-500/20 text-red-400">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      En alerta
                    </Badge>
                  ) : (
                    <Badge className="text-xs border-0 bg-green-500/20 text-green-400">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Al día
                    </Badge>
                  )}
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
                  <span>
                    Última reunión:{' '}
                    {d.ultimaReunion ? formatDate(d.ultimaReunion) : 'Sin registros'}
                  </span>
                  <span>Total finalizadas: {d.totalReuniones}</span>
                </div>
              </div>

              <div className="text-right shrink-0">
                {d.diasSinReunion !== null ? (
                  <div>
                    <span
                      className={cn(
                        'text-2xl font-bold',
                        d.enAlerta ? 'text-red-400' : 'text-green-400'
                      )}
                    >
                      {d.diasSinReunion}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">días</span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Diálogo nueva reunión ───────────────────────────────────

interface DialogNuevaReunionProps {
  abierto: boolean
  onCerrar: () => void
  miDireccion: DireccionBase | null
  esAdmin: boolean
  sociosActivos: Array<{
    id: string
    usuario_id: string
    nombre: string
    apellido: string
    rol_aile?: string | null
  }>
  creating: boolean
  onCrear: (payload: {
    titulo: string
    descripcion?: string
    direccion: DireccionBase
    fechaInicio: string
    fechaFin: string
    lugar?: string
    usuarioIdsInvolucrados?: string[]
    crearTarea?: boolean
  }) => Promise<void>
}

function DialogNuevaReunion({
  abierto,
  onCerrar,
  miDireccion,
  esAdmin,
  sociosActivos,
  creating,
  onCrear,
}: DialogNuevaReunionProps) {
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [direccion, setDireccion] = useState<DireccionBase>(miDireccion || 'CEA')
  const [lugar, setLugar] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [horaInicio, setHoraInicio] = useState('09:00')
  const [horaFin, setHoraFin] = useState('10:00')
  const [involucrados, setInvolucrados] = useState<Set<string>>(new Set())
  const [crearTarea, setCrearTarea] = useState(false)

  // Si es director, la dirección está fija
  const dirFija = !esAdmin && miDireccion

  async function handleSubmit() {
    if (!titulo.trim()) {
      toast.error('El título es obligatorio')
      return
    }
    if (!fechaInicio) {
      toast.error('La fecha es obligatoria')
      return
    }

    const fechaInicioISO = `${fechaInicio}T${horaInicio}:00`
    const fechaFinISO = `${fechaInicio}T${horaFin}:00`

    if (fechaFinISO <= fechaInicioISO) {
      toast.error('La hora de fin debe ser posterior a la de inicio')
      return
    }

    await onCrear({
      titulo: titulo.trim(),
      descripcion: descripcion.trim() || undefined,
      direccion,
      fechaInicio: fechaInicioISO,
      fechaFin: fechaFinISO,
      lugar: lugar.trim() || undefined,
      usuarioIdsInvolucrados: Array.from(involucrados),
      crearTarea,
    })
  }

  // Reset al cerrar
  function handleCerrar() {
    setTitulo('')
    setDescripcion('')
    setDireccion(miDireccion || 'CEA')
    setLugar('')
    setFechaInicio('')
    setHoraInicio('09:00')
    setHoraFin('10:00')
    setInvolucrados(new Set())
    setCrearTarea(false)
    onCerrar()
  }

  return (
    <Dialog open={abierto} onOpenChange={handleCerrar}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agendar reunión</DialogTitle>
          <DialogDescription>
            Completá los datos de la reunión. Se sincronizará con el calendario automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Dirección */}
          <div className="space-y-2">
            <Label>Dirección</Label>
            {dirFija ? (
              <div className="px-3 py-2 rounded-md bg-muted text-sm text-foreground">
                {miDireccion}
              </div>
            ) : (
              <Select value={direccion} onValueChange={(v) => setDireccion(v as DireccionBase)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIRECCIONES.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Título */}
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Reunión semanal de planificación"
            />
          </div>

          {/* Descripción */}
          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Temas a tratar, agenda, etc."
              rows={3}
            />
          </div>

          {/* Fecha */}
          <div className="space-y-2">
            <Label>Fecha *</Label>
            <Input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          </div>

          {/* Horario */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Hora inicio</Label>
              <Input
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Hora fin</Label>
              <Input
                type="time"
                value={horaFin}
                onChange={(e) => setHoraFin(e.target.value)}
              />
            </div>
          </div>

          {/* Lugar */}
          <div className="space-y-2">
            <Label>Lugar (opcional)</Label>
            <Input
              value={lugar}
              onChange={(e) => setLugar(e.target.value)}
              placeholder="Ej: Sala virtual, Google Meet, etc."
            />
          </div>

          {/* Involucrados (para el calendario) */}
          <div className="space-y-2">
            <Label>Invitar al calendario (opcional)</Label>
            <p className="text-xs text-muted-foreground">
              Estos miembros verán la reunión en su calendario
            </p>
            <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-md p-2">
              {sociosActivos.map((s) => {
                const checked = involucrados.has(s.usuario_id)
                const dir = directionFromRoleName(s.rol_aile)
                if (!esAdmin && dir !== null && dir !== direccion) return null
                return (
                  <div
                    key={s.id}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted/50',
                      checked && 'bg-primary/5'
                    )}
                    onClick={() => {
                      setInvolucrados((prev) => {
                        const next = new Set(prev)
                        if (next.has(s.usuario_id)) next.delete(s.usuario_id)
                        else next.add(s.usuario_id)
                        return next
                      })
                    }}
                  >
                    <Checkbox checked={checked} className="pointer-events-none" />
                    <span className="text-sm text-foreground">
                      {s.nombre} {s.apellido}
                    </span>
                    {s.rol_aile && (
                      <span className="text-xs text-muted-foreground ml-auto">{s.rol_aile}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Opción crear tarea */}
          <div
            className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/30"
            onClick={() => setCrearTarea((v) => !v)}
          >
            <Checkbox checked={crearTarea} className="pointer-events-none mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Crear tarea vinculada</p>
              <p className="text-xs text-muted-foreground">
                Agrega una tarea en el tablero de tareas de la dirección con la fecha de la reunión
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCerrar}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={creating}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Agendar reunión
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Diálogo editar reunión ──────────────────────────────────

interface DialogEditarReunionProps {
  reunion: ReunionDireccion
  editando: boolean
  onCerrar: () => void
  onGuardar: (payload: EditarReunionPayload) => Promise<void>
}

function DialogEditarReunion({ reunion, editando, onCerrar, onGuardar }: DialogEditarReunionProps) {
  const fechaLocal = reunion.fecha_inicio.split('T')[0]
  const horaInicioLocal = reunion.fecha_inicio.split('T')[1]?.slice(0, 5) || '09:00'
  const horaFinLocal = reunion.fecha_fin.split('T')[1]?.slice(0, 5) || '10:00'

  const [titulo, setTitulo] = useState(reunion.titulo)
  const [descripcion, setDescripcion] = useState(reunion.descripcion || '')
  const [lugar, setLugar] = useState(reunion.lugar || '')
  const [fecha, setFecha] = useState(fechaLocal)
  const [horaInicio, setHoraInicio] = useState(horaInicioLocal)
  const [horaFin, setHoraFin] = useState(horaFinLocal)

  async function handleSubmit() {
    if (!titulo.trim()) {
      toast.error('El título es obligatorio')
      return
    }
    if (!fecha) {
      toast.error('La fecha es obligatoria')
      return
    }
    const fechaInicioISO = `${fecha}T${horaInicio}:00`
    const fechaFinISO = `${fecha}T${horaFin}:00`
    if (fechaFinISO <= fechaInicioISO) {
      toast.error('La hora de fin debe ser posterior a la de inicio')
      return
    }
    await onGuardar({
      titulo: titulo.trim(),
      descripcion: descripcion.trim() || undefined,
      fechaInicio: fechaInicioISO,
      fechaFin: fechaFinISO,
      lugar: lugar.trim() || undefined,
    })
  }

  return (
    <Dialog open onOpenChange={onCerrar}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar reunión</DialogTitle>
          <DialogDescription>
            Modificá los datos de la reunión.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Fecha *</Label>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Hora inicio</Label>
              <Input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Hora fin</Label>
              <Input type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Lugar (opcional)</Label>
            <Input value={lugar} onChange={(e) => setLugar(e.target.value)} placeholder="Ej: Sala virtual, Google Meet, etc." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={editando}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {editando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Tab de Asistencias ──────────────────────────────────────

interface TabAsistenciasProps {
  estadisticas: EstadisticaAsistencia[]
  estadisticasDireccion: EstadisticaDireccion[]
  loading: boolean
  filtroDir?: DireccionBase
  puedeVerTodo: boolean
}

function TabAsistencias({
  estadisticas,
  estadisticasDireccion,
  loading,
  filtroDir,
  puedeVerTodo,
}: TabAsistenciasProps) {
  const [busqueda, setBusqueda] = useState('')
  const [filtroDirTab, setFiltroDirTab] = useState<DireccionBase | 'todas'>(
    filtroDir || 'todas'
  )

  const datos = useMemo(() => {
    let lista = estadisticas
    if (filtroDirTab !== 'todas') {
      lista = lista.filter(
        (e) =>
          e.direccion === filtroDirTab ||
          (e.porDireccion[filtroDirTab] || 0) > 0
      )
    }
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      lista = lista.filter(
        (e) =>
          e.nombre.toLowerCase().includes(q) ||
          e.apellido.toLowerCase().includes(q) ||
          (e.rolAile || '').toLowerCase().includes(q)
      )
    }
    return lista
  }, [estadisticas, filtroDirTab, busqueda])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Resumen por dirección */}
      {puedeVerTodo && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {estadisticasDireccion.map((d) => (
            <Card key={d.direccion} className="bg-card border-border">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium mb-1">{d.direccion}</p>
                <p className="text-2xl font-bold text-foreground">{d.totalReuniones}</p>
                <p className="text-xs text-muted-foreground">reuniones finalizadas</p>
                <div className="mt-2 pt-2 border-t border-border flex justify-between text-xs text-muted-foreground">
                  <span>~{d.promedioAsistentes} asist./reunión</span>
                  <span>{d.miembrosUnicos} únicos</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 max-w-xs">
          <input
            type="text"
            placeholder="Buscar miembro..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        {puedeVerTodo && (
          <div className="flex gap-1.5 flex-wrap">
            {(['todas', 'CEA', 'Comunicación', 'Finanzas', 'Recursos Humanos'] as const).map(
              (d) => (
                <Button
                  key={d}
                  size="sm"
                  variant={filtroDirTab === d ? 'default' : 'outline'}
                  onClick={() => setFiltroDirTab(d as DireccionBase | 'todas')}
                  className={filtroDirTab === d ? 'bg-primary text-primary-foreground' : 'text-xs'}
                >
                  {d === 'todas' ? 'Todas' : d}
                </Button>
              )
            )}
          </div>
        )}
      </div>

      {/* Tabla de asistencias */}
      {datos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <BarChart3 className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground text-sm">
            {estadisticas.length === 0
              ? 'Aún no hay reuniones finalizadas con asistencia registrada'
              : 'Sin resultados para la búsqueda'}
          </p>
        </div>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 text-muted-foreground font-medium">#</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">Miembro</th>
                    <th className="text-left p-3 text-muted-foreground font-medium hidden md:table-cell">Rol / Dirección</th>
                    {filtroDirTab === 'todas' && puedeVerTodo ? (
                      DIRECCIONES.map((d) => (
                        <th key={d} className="text-center p-3 text-muted-foreground font-medium hidden lg:table-cell text-xs">
                          {d === 'Recursos Humanos' ? 'RRHH' : d}
                        </th>
                      ))
                    ) : null}
                    <th className="text-center p-3 text-muted-foreground font-medium">Total</th>
                    <th className="text-left p-3 text-muted-foreground font-medium hidden sm:table-cell">Última</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.map((e, idx) => (
                    <tr
                      key={e.socioId}
                      className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                    >
                      <td className="p-3 text-muted-foreground">
                        {idx === 0 && <Medal className="w-4 h-4 text-amber-400" />}
                        {idx === 1 && <Medal className="w-4 h-4 text-slate-400" />}
                        {idx === 2 && <Medal className="w-4 h-4 text-amber-600" />}
                        {idx > 2 && <span className="text-xs">{idx + 1}</span>}
                      </td>
                      <td className="p-3">
                        <p className="font-medium text-foreground">
                          {e.apellido}, {e.nombre}
                        </p>
                      </td>
                      <td className="p-3 hidden md:table-cell">
                        <div>
                          {e.rolAile && (
                            <p className="text-xs text-muted-foreground">{e.rolAile}</p>
                          )}
                          {e.direccion && (
                            <Badge className="text-xs bg-primary/20 text-primary border-0 mt-0.5">
                              {e.direccion}
                            </Badge>
                          )}
                        </div>
                      </td>
                      {filtroDirTab === 'todas' && puedeVerTodo
                        ? DIRECCIONES.map((d) => (
                            <td key={d} className="p-3 text-center hidden lg:table-cell">
                              <span
                                className={cn(
                                  'text-sm font-medium',
                                  (e.porDireccion[d] || 0) > 0
                                    ? 'text-foreground'
                                    : 'text-muted-foreground/30'
                                )}
                              >
                                {e.porDireccion[d] || '—'}
                              </span>
                            </td>
                          ))
                        : null}
                      <td className="p-3 text-center">
                        <span className="text-lg font-bold text-primary">
                          {filtroDirTab !== 'todas'
                            ? (e.porDireccion[filtroDirTab as DireccionBase] || 0)
                            : e.totalAsistencias}
                        </span>
                      </td>
                      <td className="p-3 hidden sm:table-cell text-xs text-muted-foreground">
                        {e.ultimaAsistencia ? formatDate(e.ultimaAsistencia) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Diálogo cargar reunión histórica ───────────────────────

interface DialogHistoricaProps {
  abierto: boolean
  onCerrar: () => void
  miDireccion: DireccionBase | null
  esAdmin: boolean
  sociosActivos: Array<{
    id: string
    usuario_id: string
    nombre: string
    apellido: string
    rol_aile?: string | null
  }>
  creating: boolean
  onCargar: (payload: CargarHistoricaPayload) => Promise<void>
}

function DialogHistorica({
  abierto,
  onCerrar,
  miDireccion,
  esAdmin,
  sociosActivos,
  creating,
  onCargar,
}: DialogHistoricaProps) {
  const [titulo, setTitulo] = useState('')
  const [fecha, setFecha] = useState('')
  const [direccion, setDireccion] = useState<DireccionBase>(miDireccion || 'CEA')
  const [lugar, setLugar] = useState('')
  const [sociosSeleccionados, setSociosSeleccionados] = useState<Set<string>>(new Set())
  const [busqueda, setBusqueda] = useState('')

  const dirFija = !esAdmin && miDireccion

  const sociosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return sociosActivos
    const q = busqueda.toLowerCase()
    return sociosActivos.filter(
      (s) =>
        s.nombre.toLowerCase().includes(q) ||
        s.apellido.toLowerCase().includes(q)
    )
  }, [sociosActivos, busqueda])

  function toggleSocio(id: string) {
    setSociosSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function seleccionarTodos() {
    setSociosSeleccionados(new Set(sociosFiltrados.map((s) => s.id)))
  }

  function limpiarSeleccion() {
    setSociosSeleccionados(new Set())
  }

  async function handleSubmit() {
    if (!fecha) {
      toast.error('La fecha es obligatoria')
      return
    }
    if (sociosSeleccionados.size === 0) {
      toast.error('Seleccioná al menos un asistente')
      return
    }

    await onCargar({
      titulo: titulo.trim() || undefined,
      fecha,
      direccion,
      lugar: lugar.trim() || undefined,
      socioIds: Array.from(sociosSeleccionados),
    })
  }

  function handleCerrar() {
    setTitulo('')
    setFecha('')
    setDireccion(miDireccion || 'CEA')
    setLugar('')
    setSociosSeleccionados(new Set())
    setBusqueda('')
    onCerrar()
  }

  return (
    <Dialog open={abierto} onOpenChange={handleCerrar}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Cargar reunión histórica
          </DialogTitle>
          <DialogDescription>
            Cargá reuniones que ya ocurrieron para mantener el historial de asistencias completo.
            Solo necesitás la fecha y quiénes asistieron.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Dirección */}
          <div className="space-y-2">
            <Label>Dirección</Label>
            {dirFija ? (
              <div className="px-3 py-2 rounded-md bg-muted text-sm text-foreground">
                {miDireccion}
              </div>
            ) : (
              <Select value={direccion} onValueChange={(v) => setDireccion(v as DireccionBase)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIRECCIONES.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Fecha */}
          <div className="space-y-2">
            <Label>Fecha de la reunión *</Label>
            <Input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
            <p className="text-xs text-muted-foreground">
              Podés cargar reuniones de cualquier fecha pasada
            </p>
          </div>

          {/* Título opcional */}
          <div className="space-y-2">
            <Label>Título (opcional)</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder={`Ej: Reunión semanal — se genera automáticamente si no completás`}
            />
          </div>

          {/* Lugar opcional */}
          <div className="space-y-2">
            <Label>Lugar (opcional)</Label>
            <Input
              value={lugar}
              onChange={(e) => setLugar(e.target.value)}
              placeholder="Ej: Sala virtual, oficina, etc."
            />
          </div>

          {/* Asistentes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Asistentes * ({sociosSeleccionados.size} seleccionados)</Label>
              <div className="flex gap-2">
                <button
                  onClick={seleccionarTodos}
                  className="text-xs text-primary hover:underline"
                >
                  Todos
                </button>
                <span className="text-xs text-muted-foreground">·</span>
                <button
                  onClick={limpiarSeleccion}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  Ninguno
                </button>
              </div>
            </div>

            <input
              type="text"
              placeholder="Buscar miembro..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />

            <div className="max-h-52 overflow-y-auto space-y-1 border border-border rounded-md p-2">
              {sociosFiltrados.map((s) => {
                const checked = sociosSeleccionados.has(s.id)
                return (
                  <div
                    key={s.id}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded cursor-pointer transition-colors',
                      checked ? 'bg-primary/10' : 'hover:bg-muted/50'
                    )}
                    onClick={() => toggleSocio(s.id)}
                  >
                    <Checkbox checked={checked} className="pointer-events-none" />
                    <span className="text-sm text-foreground flex-1">
                      {s.apellido}, {s.nombre}
                    </span>
                    {s.rol_aile && (
                      <span className="text-xs text-muted-foreground">{s.rol_aile}</span>
                    )}
                  </div>
                )
              })}
              {sociosFiltrados.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Sin resultados
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCerrar}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={creating}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Cargar reunión histórica
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
