'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { canAccessReintegrosModule } from '@/lib/constants'
import { useReintegrosDirector } from '@/hooks/useReintegrosDirector'
import { useReintegrosTesoreria } from '@/hooks/useReintegrosTesoreria'
import type { ReintegroEstado, SolicitudReintegro } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  CircleSlash,
  Loader2,
  Upload,
  ShieldAlert,
  Wallet,
  Plus,
  SendHorizonal,
  MessageSquareWarning,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'

interface CategoriaEgresoOption {
  id: string
  nombre: string
}

interface CuentaOption {
  id: string
  nombre: string
  tipo: string
}

type WorkflowDialogMode = 'observar' | 'aprobar' | 'rechazar' | 'pagar' | null

const ARS_FORMATTER = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
})
const FACTURA_UPLOAD_BUCKET = 'documentos'
const FACTURA_UPLOAD_FOLDER = 'reintegros/facturas'
const FACTURA_MAX_SIZE_BYTES = 10 * 1024 * 1024

function estadoBadge(estado: ReintegroEstado) {
  switch (estado) {
    case 'borrador':
      return { label: 'Borrador', className: 'bg-slate-100 text-slate-700 border-slate-200' }
    case 'pendiente_aprobacion':
      return { label: 'Pendiente de aprobación', className: 'bg-amber-100 text-amber-800 border-amber-200' }
    case 'observada':
      return { label: 'Observada', className: 'bg-orange-100 text-orange-800 border-orange-200' }
    case 'aprobada_pendiente_pago':
      return { label: 'Aprobada pendiente pago', className: 'bg-cyan-100 text-cyan-800 border-cyan-200' }
    case 'rechazada':
      return { label: 'Rechazada', className: 'bg-rose-100 text-rose-800 border-rose-200' }
    case 'pagada':
      return { label: 'Pagada', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' }
    case 'cancelada':
      return { label: 'Cancelada', className: 'bg-zinc-200 text-zinc-700 border-zinc-300' }
    default:
      return { label: estado, className: '' }
  }
}

function formatMoney(value?: number | null) {
  if (value == null) return '-'
  return ARS_FORMATTER.format(Number(value))
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('es-AR')
}

export default function ReintegrosPage() {
  const { rol, rolAile } = useAuth()

  const normalizedRolAile = (rolAile || '').trim().toLowerCase()
  const canAccessScreen = canAccessReintegrosModule(rol, rolAile)
  const canCreateSolicitud =
    rol === 'admin'
    || ['director de finanzas', 'presidente', 'tesorero', 'secretario general'].includes(normalizedRolAile)
  const canOperateAsTesoreria = rol === 'admin' || normalizedRolAile === 'tesorero'

  const director = useReintegrosDirector({ enabled: canAccessScreen })
  const tesoreria = useReintegrosTesoreria({ enabled: canAccessScreen })

  const [categoriasEgreso, setCategoriasEgreso] = useState<CategoriaEgresoOption[]>([])
  const [cuentasPago, setCuentasPago] = useState<CuentaOption[]>([])

  const [showNuevaSolicitud, setShowNuevaSolicitud] = useState(false)
  const [formFechaGasto, setFormFechaGasto] = useState(new Date().toISOString().split('T')[0])
  const [formCategoriaId, setFormCategoriaId] = useState('')
  const [formMonto, setFormMonto] = useState('')
  const [formDescripcion, setFormDescripcion] = useState('')
  const [formFacturaUrl, setFormFacturaUrl] = useState('')
  const [formFacturaFileName, setFormFacturaFileName] = useState('')
  const [formFacturaNumero, setFormFacturaNumero] = useState('')
  const [formFacturaEmisor, setFormFacturaEmisor] = useState('')
  const [creating, setCreating] = useState(false)
  const [uploadingFactura, setUploadingFactura] = useState(false)
  const [runningAction, setRunningAction] = useState<string | null>(null)
  const facturaInputRef = useRef<HTMLInputElement>(null)

  const [dialogMode, setDialogMode] = useState<WorkflowDialogMode>(null)
  const [dialogSolicitud, setDialogSolicitud] = useState<SolicitudReintegro | null>(null)
  const [dialogMotivo, setDialogMotivo] = useState('')
  const [dialogMontoAprobado, setDialogMontoAprobado] = useState('')
  const [dialogCuentaPago, setDialogCuentaPago] = useState('')
  const [dialogFechaPago, setDialogFechaPago] = useState(new Date().toISOString().split('T')[0])
  const [dialogComprobantePago, setDialogComprobantePago] = useState('')
  const [submittingDialog, setSubmittingDialog] = useState(false)

  const [searchDirector, setSearchDirector] = useState('')
  const [searchTesoreria, setSearchTesoreria] = useState('')

  const fetchReferences = useCallback(async () => {
    if (!canAccessScreen) return

    const [{ data: categorias, error: categoriasError }, { data: cuentas, error: cuentasError }] = await Promise.all([
      supabase
        .from('categorias_financieras')
        .select('id, nombre')
        .eq('tipo', 'egreso')
        .eq('activa', true)
        .order('nombre', { ascending: true }),
      supabase
        .from('cuentas')
        .select('id, nombre, tipo')
        .eq('activa', true)
        .order('nombre', { ascending: true }),
    ])

    if (!categoriasError) {
      setCategoriasEgreso((categorias || []) as CategoriaEgresoOption[])
    }

    if (!cuentasError) {
      setCuentasPago((cuentas || []) as CuentaOption[])
    }
  }, [canAccessScreen])

  useEffect(() => {
    void fetchReferences()
  }, [fetchReferences])

  const directorFiltered = useMemo(() => {
    const needle = searchDirector.trim().toLowerCase()
    if (!needle) return director.solicitudes

    return director.solicitudes.filter((solicitud) =>
      [
        solicitud.numero,
        solicitud.descripcion,
        solicitud.factura_numero,
        solicitud.factura_emisor,
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle))
    )
  }, [director.solicitudes, searchDirector])

  const bandejaFiltered = useMemo(() => {
    const needle = searchTesoreria.trim().toLowerCase()
    if (!needle) return tesoreria.bandejaAprobacion

    return tesoreria.bandejaAprobacion.filter((solicitud) =>
      [solicitud.numero, solicitud.descripcion, solicitud.factura_emisor]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle))
    )
  }, [tesoreria.bandejaAprobacion, searchTesoreria])

  const pendientesPagoFiltered = useMemo(() => {
    const needle = searchTesoreria.trim().toLowerCase()
    if (!needle) return tesoreria.pendientesPago

    return tesoreria.pendientesPago.filter((solicitud) =>
      [solicitud.numero, solicitud.descripcion, solicitud.factura_emisor]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle))
    )
  }, [tesoreria.pendientesPago, searchTesoreria])

  const directorMetrics = useMemo(() => {
    return {
      total: director.solicitudes.length,
      pendientes: director.solicitudes.filter((s) =>
        ['pendiente_aprobacion', 'observada', 'aprobada_pendiente_pago'].includes(s.estado)
      ).length,
      pagadas: director.solicitudes.filter((s) => s.estado === 'pagada').length,
    }
  }, [director.solicitudes])

  const resetCreateForm = () => {
    setFormFechaGasto(new Date().toISOString().split('T')[0])
    setFormCategoriaId('')
    setFormMonto('')
    setFormDescripcion('')
    setFormFacturaUrl('')
    setFormFacturaFileName('')
    setFormFacturaNumero('')
    setFormFacturaEmisor('')
    if (facturaInputRef.current) {
      facturaInputRef.current.value = ''
    }
  }

  const clearFacturaUpload = useCallback(() => {
    setFormFacturaUrl('')
    setFormFacturaFileName('')
    if (facturaInputRef.current) {
      facturaInputRef.current.value = ''
    }
  }, [])

  const handleFacturaUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten imágenes para la factura')
      event.target.value = ''
      return
    }

    if (file.size > FACTURA_MAX_SIZE_BYTES) {
      toast.error('La imagen supera el máximo de 10MB')
      event.target.value = ''
      return
    }

    setUploadingFactura(true)
    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const baseName = file.name
        .replace(/\.[^/.]+$/, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
      const randomSuffix = Math.random().toString(36).slice(2, 10)
      const fileName = `${Date.now()}-${randomSuffix}-${baseName || 'factura'}.${extension}`
      const filePath = `${FACTURA_UPLOAD_FOLDER}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from(FACTURA_UPLOAD_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        })

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from(FACTURA_UPLOAD_BUCKET)
        .getPublicUrl(filePath)

      setFormFacturaUrl(data.publicUrl)
      setFormFacturaFileName(file.name)
      toast.success('Imagen de factura subida')
    } catch (error) {
      console.error('Error uploading factura image:', error)
      clearFacturaUpload()
      toast.error('No se pudo subir la imagen de factura')
    } finally {
      setUploadingFactura(false)
    }
  }

  const handleCrearSolicitud = async () => {
    if (!canCreateSolicitud) return
    if (!formFechaGasto || !formCategoriaId || !formMonto || !formDescripcion || !formFacturaUrl || uploadingFactura) return

    setCreating(true)
    try {
      await director.crearSolicitud({
        fecha_gasto: formFechaGasto,
        categoria_id: formCategoriaId,
        monto_solicitado: Number(formMonto),
        descripcion: formDescripcion,
        factura_url: formFacturaUrl,
        factura_numero: formFacturaNumero || undefined,
        factura_emisor: formFacturaEmisor || undefined,
      })

      setShowNuevaSolicitud(false)
      resetCreateForm()
    } finally {
      setCreating(false)
    }
  }

  const handleEnviarSolicitud = async (solicitud: SolicitudReintegro) => {
    setRunningAction(`send-${solicitud.id}`)
    try {
      await director.enviarSolicitud(solicitud.id)
      await Promise.all([director.fetchSolicitudes(), tesoreria.fetchSolicitudes()])
    } finally {
      setRunningAction(null)
    }
  }

  const handleCancelarSolicitud = async (solicitud: SolicitudReintegro) => {
    setRunningAction(`cancel-${solicitud.id}`)
    try {
      await director.cancelarSolicitud(solicitud.id, 'Cancelada por solicitante')
      await Promise.all([director.fetchSolicitudes(), tesoreria.fetchSolicitudes()])
    } finally {
      setRunningAction(null)
    }
  }

  const openWorkflowDialog = (mode: WorkflowDialogMode, solicitud: SolicitudReintegro) => {
    setDialogMode(mode)
    setDialogSolicitud(solicitud)
    setDialogMotivo('')
    setDialogMontoAprobado(String(solicitud.monto_solicitado ?? ''))
    setDialogCuentaPago(cuentasPago[0]?.id || '')
    setDialogFechaPago(new Date().toISOString().split('T')[0])
    setDialogComprobantePago('')
  }

  const closeWorkflowDialog = () => {
    setDialogMode(null)
    setDialogSolicitud(null)
    setDialogMotivo('')
    setDialogMontoAprobado('')
    setDialogCuentaPago('')
    setDialogFechaPago(new Date().toISOString().split('T')[0])
    setDialogComprobantePago('')
    setSubmittingDialog(false)
  }

  const submitWorkflowDialog = async () => {
    if (!dialogMode || !dialogSolicitud) return

    setSubmittingDialog(true)
    try {
      if (dialogMode === 'observar') {
        await tesoreria.observarSolicitud(dialogSolicitud.id, dialogMotivo)
      }

      if (dialogMode === 'aprobar') {
        const montoAprobado = dialogMontoAprobado ? Number(dialogMontoAprobado) : undefined
        await tesoreria.aprobarSolicitud(dialogSolicitud.id, montoAprobado)
      }

      if (dialogMode === 'rechazar') {
        await tesoreria.rechazarSolicitud(dialogSolicitud.id, dialogMotivo)
      }

      if (dialogMode === 'pagar') {
        await tesoreria.registrarPago({
          solicitud_id: dialogSolicitud.id,
          cuenta_pago_id: dialogCuentaPago,
          fecha_pago: new Date(dialogFechaPago).toISOString(),
          comprobante_pago_url: dialogComprobantePago,
        })
      }

      await Promise.all([director.fetchSolicitudes(), tesoreria.fetchSolicitudes()])
      closeWorkflowDialog()
    } finally {
      setSubmittingDialog(false)
    }
  }

  if (!canAccessScreen) {
    return (
      <div className="flex items-center justify-center py-20">
        <Card className="max-w-2xl w-full border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-800">
              <ShieldAlert className="w-5 h-5" />
              Acceso restringido al módulo de reintegros
            </CardTitle>
            <CardDescription className="text-red-700">
              Este módulo está habilitado para Director de Finanzas, Tesorero, Presidente y Secretario General.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const loading = director.loading || tesoreria.loading

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reintegros</h1>
        <p className="text-sm text-muted-foreground">
          Circuito auditable entre Dirección de Finanzas y Tesorería para solicitudes, aprobación y pago.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader className="pb-2">
            <CardDescription>En curso</CardDescription>
            <CardTitle className="text-2xl text-amber-900">{directorMetrics.pendientes}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-amber-800">Pendientes de aprobación, observadas o pendientes de pago.</CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardHeader className="pb-2">
            <CardDescription>Pagadas</CardDescription>
            <CardTitle className="text-2xl text-emerald-900">{directorMetrics.pagadas}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-emerald-800">Solicitudes con movimiento contable generado.</CardContent>
        </Card>

        <Card className="border-slate-200 bg-slate-50/50">
          <CardHeader className="pb-2">
            <CardDescription>Total</CardDescription>
            <CardTitle className="text-2xl text-slate-900">{directorMetrics.total}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-700">Volumen de solicitudes visibles para tu perfil.</CardContent>
        </Card>
      </div>

      <Tabs defaultValue={canCreateSolicitud ? 'mis' : 'bandeja'} className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="mis" className="shrink-0">Mis reintegros</TabsTrigger>
          <TabsTrigger value="bandeja" className="shrink-0">Bandeja de aprobación</TabsTrigger>
          <TabsTrigger value="pagos" className="shrink-0">Pendientes de pago</TabsTrigger>
        </TabsList>

        <TabsContent value="mis" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Mis reintegros</CardTitle>
                <CardDescription>
                  Carga, seguimiento y envío de solicitudes de reintegro.
                </CardDescription>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  placeholder="Buscar por número, descripción o factura..."
                  value={searchDirector}
                  onChange={(event) => setSearchDirector(event.target.value)}
                  className="w-full sm:w-80"
                />
                {canCreateSolicitud && (
                  <Button onClick={() => setShowNuevaSolicitud(true)} className="w-full sm:w-auto gap-2">
                    <Plus className="w-4 h-4" />
                    Nueva solicitud
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent>
              {loading ? (
                <div className="text-sm text-muted-foreground py-8">Cargando reintegros...</div>
              ) : directorFiltered.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No hay solicitudes para mostrar con los filtros actuales.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="min-w-[960px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Fecha gasto</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Factura</TableHead>
                        <TableHead className="text-right">Solicitado</TableHead>
                        <TableHead className="text-right">Aprobado</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {directorFiltered.map((solicitud) => {
                        const badge = estadoBadge(solicitud.estado)
                        const canSend = canCreateSolicitud && ['borrador', 'observada'].includes(solicitud.estado)
                        const canCancel = canCreateSolicitud && solicitud.estado === 'borrador'

                        return (
                          <TableRow key={solicitud.id}>
                            <TableCell className="font-medium">{solicitud.numero || '-'}</TableCell>
                            <TableCell>{formatDate(solicitud.fecha_gasto)}</TableCell>
                            <TableCell className="max-w-[280px] truncate" title={solicitud.descripcion}>
                              {solicitud.descripcion}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {solicitud.factura_numero || solicitud.factura_emisor
                                ? `${solicitud.factura_emisor || 'Emisor'} ${solicitud.factura_numero || ''}`
                                : '-'}
                            </TableCell>
                            <TableCell className="text-right">{formatMoney(solicitud.monto_solicitado)}</TableCell>
                            <TableCell className="text-right">{formatMoney(solicitud.monto_aprobado)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={badge.className}>{badge.label}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-2">
                                {canSend && (
                                  <Button
                                    size="sm"
                                    className="gap-1"
                                    onClick={() => void handleEnviarSolicitud(solicitud)}
                                    disabled={runningAction === `send-${solicitud.id}`}
                                  >
                                    <SendHorizonal className="w-3.5 h-3.5" />
                                    Enviar
                                  </Button>
                                )}
                                {canCancel && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => void handleCancelarSolicitud(solicitud)}
                                    disabled={runningAction === `cancel-${solicitud.id}`}
                                  >
                                    Cancelar
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bandeja" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Bandeja de aprobación</CardTitle>
                <CardDescription>
                  Solicitudes pendientes de revisión por Tesorería.
                </CardDescription>
              </div>
              <Input
                placeholder="Buscar en bandeja..."
                value={searchTesoreria}
                onChange={(event) => setSearchTesoreria(event.target.value)}
                className="w-full sm:w-80"
              />
            </CardHeader>
            <CardContent>
              {!canOperateAsTesoreria && (
                <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
                  Vista de solo lectura. Solo Tesorería puede aprobar, observar o rechazar.
                </div>
              )}

              {loading ? (
                <div className="text-sm text-muted-foreground py-8">Cargando bandeja...</div>
              ) : bandejaFiltered.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No hay solicitudes pendientes de aprobación.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="min-w-[960px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Fecha gasto</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="text-right">Solicitado</TableHead>
                        <TableHead>Factura</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bandejaFiltered.map((solicitud) => {
                        const badge = estadoBadge(solicitud.estado)
                        return (
                          <TableRow key={solicitud.id}>
                            <TableCell className="font-medium">{solicitud.numero || '-'}</TableCell>
                            <TableCell>{formatDate(solicitud.fecha_gasto)}</TableCell>
                            <TableCell className="max-w-[280px] truncate" title={solicitud.descripcion}>
                              {solicitud.descripcion}
                            </TableCell>
                            <TableCell className="text-right">{formatMoney(solicitud.monto_solicitado)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {solicitud.factura_numero || solicitud.factura_emisor
                                ? `${solicitud.factura_emisor || 'Emisor'} ${solicitud.factura_numero || ''}`
                                : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={badge.className}>{badge.label}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1"
                                  disabled={!canOperateAsTesoreria}
                                  onClick={() => openWorkflowDialog('observar', solicitud)}
                                >
                                  <MessageSquareWarning className="w-3.5 h-3.5" />
                                  Observar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1"
                                  disabled={!canOperateAsTesoreria}
                                  onClick={() => openWorkflowDialog('rechazar', solicitud)}
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  Rechazar
                                </Button>
                                <Button
                                  size="sm"
                                  className="gap-1"
                                  disabled={!canOperateAsTesoreria}
                                  onClick={() => openWorkflowDialog('aprobar', solicitud)}
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Aprobar
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pagos" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Pendientes de pago</CardTitle>
                <CardDescription>
                  Solicitudes aprobadas listas para registrar la transferencia.
                </CardDescription>
              </div>
              <Input
                placeholder="Buscar pendientes de pago..."
                value={searchTesoreria}
                onChange={(event) => setSearchTesoreria(event.target.value)}
                className="w-full sm:w-80"
              />
            </CardHeader>
            <CardContent>
              {!canOperateAsTesoreria && (
                <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
                  Vista de solo lectura. Solo Tesorería puede registrar pagos.
                </div>
              )}

              {loading ? (
                <div className="text-sm text-muted-foreground py-8">Cargando pendientes...</div>
              ) : pendientesPagoFiltered.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No hay solicitudes pendientes de pago.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="min-w-[920px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Fecha aprobación</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="text-right">Monto aprobado</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendientesPagoFiltered.map((solicitud) => {
                        const badge = estadoBadge(solicitud.estado)
                        return (
                          <TableRow key={solicitud.id}>
                            <TableCell className="font-medium">{solicitud.numero || '-'}</TableCell>
                            <TableCell>{formatDate(solicitud.fecha_aprobacion)}</TableCell>
                            <TableCell className="max-w-[280px] truncate" title={solicitud.descripcion}>
                              {solicitud.descripcion}
                            </TableCell>
                            <TableCell className="text-right">{formatMoney(solicitud.monto_aprobado)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={badge.className}>{badge.label}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  className="gap-1"
                                  disabled={!canOperateAsTesoreria}
                                  onClick={() => openWorkflowDialog('pagar', solicitud)}
                                >
                                  <Wallet className="w-3.5 h-3.5" />
                                  Registrar pago
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showNuevaSolicitud} onOpenChange={setShowNuevaSolicitud}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Nueva solicitud de reintegro</DialogTitle>
            <DialogDescription>
              Crea la solicitud en estado borrador para luego enviarla a aprobación.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fecha_gasto">Fecha del gasto</Label>
              <Input
                id="fecha_gasto"
                type="date"
                value={formFechaGasto}
                onChange={(event) => setFormFechaGasto(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Categoría (egreso)</Label>
              <Select value={formCategoriaId} onValueChange={setFormCategoriaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categoriasEgreso.map((categoria) => (
                    <SelectItem key={categoria.id} value={categoria.id}>{categoria.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="monto">Monto solicitado</Label>
              <Input
                id="monto"
                type="number"
                step="0.01"
                min="0"
                value={formMonto}
                onChange={(event) => setFormMonto(event.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="factura_file">Factura (imagen)</Label>
              <Input
                id="factura_file"
                type="file"
                accept="image/*"
                onChange={(event) => void handleFacturaUpload(event)}
                disabled={uploadingFactura || creating}
                ref={facturaInputRef}
              />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {uploadingFactura ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Subiendo imagen...
                  </>
                ) : formFacturaFileName ? (
                  <>
                    <Upload className="h-3.5 w-3.5" />
                    {formFacturaFileName}
                  </>
                ) : (
                  'Formatos permitidos: JPG, PNG, WEBP. Máximo 10MB.'
                )}
              </div>
              {formFacturaFileName && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={clearFacturaUpload}
                  disabled={uploadingFactura || creating}
                >
                  Quitar imagen
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="factura_numero">Número de factura</Label>
              <Input
                id="factura_numero"
                value={formFacturaNumero}
                onChange={(event) => setFormFacturaNumero(event.target.value)}
                placeholder="A-0001-00000001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="factura_emisor">Emisor de factura</Label>
              <Input
                id="factura_emisor"
                value={formFacturaEmisor}
                onChange={(event) => setFormFacturaEmisor(event.target.value)}
                placeholder="Proveedor / Comercio"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="descripcion">Descripción del gasto</Label>
              <Textarea
                id="descripcion"
                value={formDescripcion}
                onChange={(event) => setFormDescripcion(event.target.value)}
                rows={3}
                placeholder="Detalle del gasto a reintegrar"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNuevaSolicitud(false)} disabled={creating}>
              Cancelar
            </Button>
            <Button
              onClick={() => void handleCrearSolicitud()}
              disabled={creating || uploadingFactura || !formFechaGasto || !formCategoriaId || !formMonto || !formDescripcion || !formFacturaUrl}
            >
              {creating ? 'Guardando...' : 'Guardar borrador'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!dialogMode && !!dialogSolicitud} onOpenChange={(open) => !open && closeWorkflowDialog()}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'observar' && 'Observar solicitud'}
              {dialogMode === 'aprobar' && 'Aprobar solicitud'}
              {dialogMode === 'rechazar' && 'Rechazar solicitud'}
              {dialogMode === 'pagar' && 'Registrar pago'}
            </DialogTitle>
            <DialogDescription>
              {dialogSolicitud
                ? `Solicitud ${dialogSolicitud.numero || ''} · ${dialogSolicitud.descripcion}`
                : 'Completa los campos requeridos para continuar.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {(dialogMode === 'observar' || dialogMode === 'rechazar') && (
              <div className="space-y-2">
                <Label htmlFor="motivo">Motivo</Label>
                <Textarea
                  id="motivo"
                  rows={4}
                  value={dialogMotivo}
                  onChange={(event) => setDialogMotivo(event.target.value)}
                  placeholder="Detalle el motivo para continuar"
                />
              </div>
            )}

            {dialogMode === 'aprobar' && (
              <div className="space-y-2">
                <Label htmlFor="monto_aprobado">Monto aprobado</Label>
                <Input
                  id="monto_aprobado"
                  type="number"
                  min="0"
                  step="0.01"
                  value={dialogMontoAprobado}
                  onChange={(event) => setDialogMontoAprobado(event.target.value)}
                />
              </div>
            )}

            {dialogMode === 'pagar' && (
              <>
                <div className="space-y-2">
                  <Label>Cuenta de pago</Label>
                  <Select value={dialogCuentaPago} onValueChange={setDialogCuentaPago}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar cuenta" />
                    </SelectTrigger>
                    <SelectContent>
                      {cuentasPago.map((cuenta) => (
                        <SelectItem key={cuenta.id} value={cuenta.id}>
                          {cuenta.nombre} ({cuenta.tipo})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fecha_pago">Fecha de pago</Label>
                  <Input
                    id="fecha_pago"
                    type="date"
                    value={dialogFechaPago}
                    onChange={(event) => setDialogFechaPago(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="comprobante_pago">URL comprobante de pago</Label>
                  <Input
                    id="comprobante_pago"
                    value={dialogComprobantePago}
                    onChange={(event) => setDialogComprobantePago(event.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </>
            )}

            {dialogMode === 'pagar' && (!dialogCuentaPago || !dialogComprobantePago) && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5" />
                Para registrar el pago se requiere cuenta y comprobante.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeWorkflowDialog} disabled={submittingDialog}>
              Cerrar
            </Button>
            <Button
              onClick={() => void submitWorkflowDialog()}
              disabled={
                submittingDialog
                || (dialogMode === 'observar' && !dialogMotivo.trim())
                || (dialogMode === 'rechazar' && !dialogMotivo.trim())
                || (dialogMode === 'aprobar' && !dialogMontoAprobado)
                || (dialogMode === 'pagar' && (!dialogCuentaPago || !dialogFechaPago || !dialogComprobantePago))
              }
            >
              {submittingDialog ? 'Procesando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 gap-3 text-xs text-muted-foreground sm:grid-cols-3">
        <div className="flex items-center gap-2"><Clock3 className="w-4 h-4" /> Revisión y aprobación centralizada</div>
        <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Pago con trazabilidad contable</div>
        <div className="flex items-center gap-2"><CircleSlash className="w-4 h-4" /> Estados bloquean transiciones inválidas</div>
      </div>
    </div>
  )
}
