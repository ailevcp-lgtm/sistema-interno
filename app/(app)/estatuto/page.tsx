'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileWarning,
  Gavel,
  Loader2,
  Plus,
  Scale,
  ShieldCheck,
  Users,
  Vote,
} from 'lucide-react'
import { useAuth, useRequirePermission } from '@/hooks/useAuth'
import { useEstatutoProcesos, type CreateAsambleaPayload } from '@/hooks/useEstatutoProcesos'
import { formatDate, formatDateTime } from '@/lib/utils'
import type {
  AsambleaEstatutaria,
  EstadoAsambleaEstatutaria,
  EstadoListaElectoral,
  EstadoProcesoDisciplinario,
  EstadoProtocoloMenor,
  EstadoRemocionAutoridad,
  ModalidadAsambleaEstatutaria,
  TipoAsambleaEstatutaria,
} from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

type AsambleaFormState = {
  tipo: TipoAsambleaEstatutaria
  titulo: string
  fecha: string
  lugar: string
  modalidad: ModalidadAsambleaEstatutaria
  convocatoria_fecha: string
  notificacion_socios_fecha: string
  documentacion_disponible_fecha: string
  cierre_ejercicio: string
  orden_dia: string
}

const INITIAL_ASAMBLEA_FORM: AsambleaFormState = {
  tipo: 'ordinaria',
  titulo: '',
  fecha: '',
  lugar: '',
  modalidad: 'presencial',
  convocatoria_fecha: '',
  notificacion_socios_fecha: '',
  documentacion_disponible_fecha: '',
  cierre_ejercicio: '',
  orden_dia: '',
}

const ASAMBLEA_ESTADO_LABELS: Record<EstadoAsambleaEstatutaria, string> = {
  borrador: 'Borrador',
  convocada: 'Convocada',
  en_curso: 'En curso',
  cerrada: 'Cerrada',
  cancelada: 'Cancelada',
}

const LISTA_ESTADO_LABELS: Record<EstadoListaElectoral, string> = {
  borrador: 'Borrador',
  presentada: 'Presentada',
  observada: 'Observada',
  aprobada: 'Aprobada',
  proclamada: 'Proclamada',
  retirada: 'Retirada',
}

const PROCESO_ESTADO_LABELS: Record<EstadoProcesoDisciplinario, string> = {
  borrador: 'Borrador',
  notificado: 'Notificado',
  descargo_recibido: 'Descargo recibido',
  pendiente_resolucion: 'Pendiente resolución',
  resuelto: 'Resuelto',
  apelado: 'Apelado',
  cerrado: 'Cerrado',
  anulado: 'Anulado',
}

const REMOCION_ESTADO_LABELS: Record<EstadoRemocionAutoridad, string> = {
  borrador: 'Borrador',
  notificado: 'Notificado',
  descargo_recibido: 'Descargo recibido',
  pendiente_resolucion: 'Pendiente resolución',
  resuelta: 'Resuelta',
  apelada: 'Apelada',
  cerrada: 'Cerrada',
  anulada: 'Anulada',
}

const MENOR_ESTADO_LABELS: Record<EstadoProtocoloMenor, string> = {
  pendiente: 'Pendiente',
  vigente: 'Vigente',
  vencido: 'Vencido',
  revocado: 'Revocado',
}

function stateBadgeClass(estado: string): string {
  if (['cerrada', 'resuelto', 'resuelta', 'cerrado', 'cerrada', 'vigente', 'proclamada'].includes(estado)) {
    return 'border-green-500/30 bg-green-500/10 text-green-600'
  }
  if (['convocada', 'presentada', 'aprobada', 'notificado'].includes(estado)) {
    return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-600'
  }
  if (['observada', 'pendiente_resolucion', 'pendiente', 'vencido', 'apelado', 'apelada'].includes(estado)) {
    return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-600'
  }
  if (['cancelada', 'retirada', 'anulado', 'anulada', 'revocado'].includes(estado)) {
    return 'border-red-500/30 bg-red-500/10 text-red-600'
  }
  return 'border-muted bg-muted/40 text-muted-foreground'
}

function nullableDate(value?: string | null): string | null {
  return value?.trim() || null
}

function nullableTimestampFromLocal(value?: string | null): string | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

export default function EstatutoPage() {
  const { user, hasPermission } = useAuth()
  const { loading: checkingAccess, hasPermission: canAccess } = useRequirePermission('estatuto', 'ver', '/dashboard')
  const {
    loading,
    loadingPadron,
    sociosEstatutarios,
    asambleas,
    listas,
    procesos,
    remociones,
    menores,
    padron,
    summary,
    loadPadron,
    createAsamblea,
    generarPadron,
  } = useEstatutoProcesos(canAccess)

  const [selectedAsambleaId, setSelectedAsambleaId] = useState<string>('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generatingPadron, setGeneratingPadron] = useState(false)
  const [form, setForm] = useState<AsambleaFormState>(INITIAL_ASAMBLEA_FORM)

  const canManage = hasPermission('estatuto', 'crear') || hasPermission('estatuto', 'editar')
  const selectedAsamblea = asambleas.find((asamblea) => asamblea.id === selectedAsambleaId) || null
  const sociosMenoresSinProtocolo = useMemo(() => {
    const sociosConProtocolo = new Set(menores.map((menor) => menor.socio_id))
    return sociosEstatutarios.filter((socio) => typeof socio.edad === 'number' && socio.edad < 18 && !sociosConProtocolo.has(socio.id))
  }, [menores, sociosEstatutarios])

  useEffect(() => {
    if (!selectedAsambleaId && asambleas.length > 0) {
      setSelectedAsambleaId(asambleas[0].id)
    }
  }, [asambleas, selectedAsambleaId])

  useEffect(() => {
    if (selectedAsambleaId) {
      void loadPadron(selectedAsambleaId)
    }
  }, [loadPadron, selectedAsambleaId])

  if (checkingAccess) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        Validando permisos...
      </div>
    )
  }

  if (!canAccess) {
    return null
  }

  const handleCreateAsamblea = async () => {
    if (!form.titulo.trim()) return

    const payload: CreateAsambleaPayload = {
      tipo: form.tipo,
      titulo: form.titulo.trim(),
      fecha: nullableTimestampFromLocal(form.fecha),
      lugar: nullableDate(form.lugar),
      modalidad: form.modalidad,
      convocatoria_fecha: nullableDate(form.convocatoria_fecha),
      notificacion_socios_fecha: nullableDate(form.notificacion_socios_fecha),
      documentacion_disponible_fecha: nullableDate(form.documentacion_disponible_fecha),
      cierre_ejercicio: nullableDate(form.cierre_ejercicio),
      orden_dia: nullableDate(form.orden_dia),
    }

    setSaving(true)
    try {
      const asamblea = await createAsamblea(payload, user?.socio_id)
      setSelectedAsambleaId(asamblea.id)
      setForm(INITIAL_ASAMBLEA_FORM)
      setDialogOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const handleGenerarPadron = async () => {
    if (!selectedAsambleaId) return
    setGeneratingPadron(true)
    try {
      await generarPadron(selectedAsambleaId)
    } finally {
      setGeneratingPadron(false)
    }
  }

  const padronHabilitados = padron.filter((item) => item.puede_votar).length
  const padronNoHabilitados = padron.length - padronHabilitados

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <BookOpenCheck className="h-6 w-6 text-primary" />
            Centro estatutario
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Asamblea, padrón, elecciones, disciplina y menores
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => setDialogOpen(true)}
            className="w-full border-0 bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nueva asamblea
          </Button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <SummaryCard icon={Users} label="Socios" value={summary.totalSocios} />
          <SummaryCard icon={Vote} label="Con voto" value={summary.sociosConVoto} color="text-green-600" />
          <SummaryCard icon={AlertTriangle} label="Morosidad formal" value={summary.requierenNotificacion} color="text-red-600" />
          <SummaryCard icon={ShieldCheck} label="Menores pendientes" value={summary.protocolosPendientes + sociosMenoresSinProtocolo.length} color="text-yellow-600" />
        </div>
      )}

      <Tabs defaultValue="asambleas" className="w-full">
        <TabsList className="flex h-auto flex-wrap justify-start border border-border bg-muted p-1">
          <TabsTrigger value="asambleas" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <CalendarDays className="mr-2 h-4 w-4" />
            Asambleas
          </TabsTrigger>
          <TabsTrigger value="padron" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <ClipboardList className="mr-2 h-4 w-4" />
            Padrón
          </TabsTrigger>
          <TabsTrigger value="listas" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Vote className="mr-2 h-4 w-4" />
            Listas
          </TabsTrigger>
          <TabsTrigger value="disciplina" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Gavel className="mr-2 h-4 w-4" />
            Disciplina
          </TabsTrigger>
          <TabsTrigger value="menores" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <ShieldCheck className="mr-2 h-4 w-4" />
            Menores
          </TabsTrigger>
        </TabsList>

        <TabsContent value="asambleas" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <ProcessCounter icon={CalendarDays} label="Abiertas" value={summary.asambleasAbiertas} />
            <ProcessCounter icon={Vote} label="Listas activas" value={summary.listasActivas} />
            <ProcessCounter icon={FileWarning} label="Procesos activos" value={summary.procesosActivos + summary.remocionesActivas} />
          </div>

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base text-foreground">Asambleas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {asambleas.length === 0 ? (
                <EmptyState text="Sin asambleas registradas" />
              ) : (
                asambleas.map((asamblea) => (
                  <AsambleaRow
                    key={asamblea.id}
                    asamblea={asamblea}
                    selected={asamblea.id === selectedAsambleaId}
                    onSelect={() => setSelectedAsambleaId(asamblea.id)}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="padron" className="mt-4 space-y-4">
          <Card className="border-border bg-card">
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <CardTitle className="text-base text-foreground">Padrón electoral</CardTitle>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Select value={selectedAsambleaId} onValueChange={setSelectedAsambleaId}>
                    <SelectTrigger className="w-full sm:w-[260px]">
                      <SelectValue placeholder="Seleccionar asamblea" />
                    </SelectTrigger>
                    <SelectContent>
                      {asambleas.map((asamblea) => (
                        <SelectItem key={asamblea.id} value={asamblea.id}>
                          {asamblea.titulo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {canManage && (
                    <Button
                      onClick={handleGenerarPadron}
                      disabled={!selectedAsambleaId || generatingPadron}
                      className="border-0 bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {generatingPadron ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardList className="mr-2 h-4 w-4" />}
                      Generar padrón
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedAsamblea ? (
                <div className="grid gap-4 sm:grid-cols-3">
                  <ProcessCounter icon={Users} label="Total padrón" value={padron.length} />
                  <ProcessCounter icon={CheckCircle2} label="Habilitados" value={padronHabilitados} color="text-green-600" />
                  <ProcessCounter icon={AlertTriangle} label="Observados" value={padronNoHabilitados} color="text-yellow-600" />
                </div>
              ) : (
                <EmptyState text="Seleccioná una asamblea" />
              )}

              {loadingPadron ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-16" />
                  ))}
                </div>
              ) : padron.length === 0 ? (
                <EmptyState text="Sin padrón generado" />
              ) : (
                <div className="space-y-2">
                  {padron.slice(0, 12).map((item) => (
                    <div key={item.id} className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium text-foreground">{item.socio_apellido}, {item.socio_nombre}</p>
                        <p className="text-xs text-muted-foreground">
                          DNI {item.dni || '-'} · {item.categoria_socio} · {item.cuotas_impagas_count} cuotas impagas
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={item.puede_votar ? 'border-green-500/30 bg-green-500/10 text-green-600' : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-600'}>
                          {item.puede_votar ? 'Vota' : 'Observado'}
                        </Badge>
                        {item.motivo_no_vota && (
                          <span className="text-xs text-muted-foreground">{item.motivo_no_vota}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="listas" className="mt-4">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base text-foreground">Listas electorales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {listas.length === 0 ? (
                <EmptyState text="Sin listas registradas" />
              ) : (
                listas.map((lista) => (
                  <div key={lista.id} className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-foreground">{lista.nombre}</p>
                      <p className="text-xs text-muted-foreground">{lista.presentada_at ? formatDateTime(lista.presentada_at) : 'Sin presentación'}</p>
                    </div>
                    <Badge variant="outline" className={stateBadgeClass(lista.estado)}>
                      {LISTA_ESTADO_LABELS[lista.estado]}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="disciplina" className="mt-4 space-y-4">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base text-foreground">Sanciones y cesantía</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {procesos.length === 0 ? (
                <EmptyState text="Sin procesos disciplinarios" />
              ) : (
                procesos.map((proceso) => (
                  <div key={proceso.id} className="rounded-lg border border-border bg-muted/30 p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium capitalize text-foreground">{proceso.tipo}</p>
                        <p className="text-xs text-muted-foreground">
                          {proceso.socio ? `${proceso.socio.apellido}, ${proceso.socio.nombre}` : 'Socio sin detalle'} · Inicio {formatDate(proceso.fecha_inicio)}
                        </p>
                      </div>
                      <Badge variant="outline" className={stateBadgeClass(proceso.estado)}>
                        {PROCESO_ESTADO_LABELS[proceso.estado]}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base text-foreground">Remociones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {remociones.length === 0 ? (
                <EmptyState text="Sin remociones registradas" />
              ) : (
                remociones.map((remocion) => (
                  <div key={remocion.id} className="rounded-lg border border-border bg-muted/30 p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium text-foreground">{remocion.cargo}</p>
                        <p className="text-xs text-muted-foreground">
                          {remocion.socio ? `${remocion.socio.apellido}, ${remocion.socio.nombre}` : 'Autoridad sin detalle'} · Inicio {formatDate(remocion.fecha_inicio)}
                        </p>
                      </div>
                      <Badge variant="outline" className={stateBadgeClass(remocion.estado)}>
                        {REMOCION_ESTADO_LABELS[remocion.estado]}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="menores" className="mt-4 space-y-4">
          {sociosMenoresSinProtocolo.length > 0 && (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-700">
              Hay {sociosMenoresSinProtocolo.length} socio{sociosMenoresSinProtocolo.length === 1 ? '' : 's'} menor{sociosMenoresSinProtocolo.length === 1 ? '' : 'es'} sin protocolo cargado.
            </div>
          )}

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base text-foreground">Protocolos de menores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {menores.length === 0 ? (
                <EmptyState text="Sin protocolos registrados" />
              ) : (
                menores.map((menor) => (
                  <div key={menor.id} className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-foreground">
                        {menor.socio ? `${menor.socio.apellido}, ${menor.socio.nombre}` : 'Socio sin detalle'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Responsable: {menor.responsable_nombre || '-'} · Vence {menor.vencimiento_autorizacion ? formatDate(menor.vencimiento_autorizacion) : '-'}
                      </p>
                    </div>
                    <Badge variant="outline" className={stateBadgeClass(menor.estado)}>
                      {MENOR_ESTADO_LABELS[menor.estado]}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nueva asamblea</DialogTitle>
            <DialogDescription>Crear registro formal</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(value) => setForm((current) => ({ ...current, tipo: value as TipoAsambleaEstatutaria }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ordinaria">Ordinaria</SelectItem>
                    <SelectItem value="extraordinaria">Extraordinaria</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Modalidad</Label>
                <Select value={form.modalidad} onValueChange={(value) => setForm((current) => ({ ...current, modalidad: value as ModalidadAsambleaEstatutaria }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="presencial">Presencial</SelectItem>
                    <SelectItem value="virtual">Virtual</SelectItem>
                    <SelectItem value="mixta">Mixta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={form.titulo}
                onChange={(event) => setForm((current) => ({ ...current, titulo: event.target.value }))}
                placeholder="Asamblea General Ordinaria"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Fecha y hora</Label>
                <Input
                  type="datetime-local"
                  value={form.fecha}
                  onChange={(event) => setForm((current) => ({ ...current, fecha: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Lugar</Label>
                <Input
                  value={form.lugar}
                  onChange={(event) => setForm((current) => ({ ...current, lugar: event.target.value }))}
                  placeholder="Sede / plataforma"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Convocatoria</Label>
                <Input
                  type="date"
                  value={form.convocatoria_fecha}
                  onChange={(event) => setForm((current) => ({ ...current, convocatoria_fecha: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Notificación socios</Label>
                <Input
                  type="date"
                  value={form.notificacion_socios_fecha}
                  onChange={(event) => setForm((current) => ({ ...current, notificacion_socios_fecha: event.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Documentación disponible</Label>
                <Input
                  type="date"
                  value={form.documentacion_disponible_fecha}
                  onChange={(event) => setForm((current) => ({ ...current, documentacion_disponible_fecha: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Cierre ejercicio</Label>
                <Input
                  type="date"
                  value={form.cierre_ejercicio}
                  onChange={(event) => setForm((current) => ({ ...current, cierre_ejercicio: event.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Orden del día</Label>
              <Textarea
                value={form.orden_dia}
                onChange={(event) => setForm((current) => ({ ...current, orden_dia: event.target.value }))}
                className="min-h-[120px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateAsamblea}
              disabled={saving || !form.titulo.trim()}
              className="border-0 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear asamblea
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  color = 'text-primary',
}: {
  icon: React.ElementType
  label: string
  value: number
  color?: string
}) {
  return (
    <Card className="border-border bg-card">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
          <div>
            <p className="text-2xl font-semibold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ProcessCounter({
  icon: Icon,
  label,
  value,
  color = 'text-primary',
}: {
  icon: React.ElementType
  label: string
  value: number
  color?: string
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex items-center gap-3">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span className="text-lg font-semibold text-foreground">{value}</span>
    </div>
  )
}

function AsambleaRow({
  asamblea,
  selected,
  onSelect,
}: {
  asamblea: AsambleaEstatutaria
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg border p-4 text-left transition-colors ${
        selected ? 'border-primary/50 bg-primary/10' : 'border-border bg-muted/30 hover:border-primary/30'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-foreground">{asamblea.titulo}</p>
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              {asamblea.tipo === 'ordinaria' ? 'Ordinaria' : 'Extraordinaria'}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {asamblea.fecha ? formatDateTime(asamblea.fecha) : 'Sin fecha'} · {asamblea.lugar || 'Sin lugar'}
          </p>
        </div>
        <Badge variant="outline" className={stateBadgeClass(asamblea.estado)}>
          {ASAMBLEA_ESTADO_LABELS[asamblea.estado]}
        </Badge>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
        <span>Convocatoria: {asamblea.convocatoria_fecha ? formatDate(asamblea.convocatoria_fecha) : '-'}</span>
        <span>Notificación: {asamblea.notificacion_socios_fecha ? formatDate(asamblea.notificacion_socios_fecha) : '-'}</span>
        <span>Docs: {asamblea.documentacion_disponible_fecha ? formatDate(asamblea.documentacion_disponible_fecha) : '-'}</span>
      </div>
    </button>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      <Scale className="mx-auto mb-3 h-8 w-8 text-primary/70" />
      {text}
    </div>
  )
}
