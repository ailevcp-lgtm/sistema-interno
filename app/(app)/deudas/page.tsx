'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useCuotas } from '@/hooks/useSocios'
import type { PagoSocio } from '@/hooks/useSocios'
import { formatARS, formatDate, formatPeriodo, getInitials, generateAvatarColor } from '@/lib/utils'
import { ESTADO_CUOTA_COLORS, ESTADO_CUOTA_INLINE } from '@/lib/constants'
import type { Cuota, EstadoCuota, PromocionCuota } from '@/lib/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Search,
  Download,
  AlertCircle,
  CheckCircle,
  Clock,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Wallet,
  XCircle,
  History,
  Tag,
  Plus,
  Pencil,
  ShieldAlert,
  Trash2,
} from 'lucide-react'

export default function DeudasPage() {
  const router = useRouter()
  const { user, hasPermission } = useAuth()
  const canViewAllDebt = !!user && hasPermission('deudas', 'ver')
  const canViewOwnDebt = !!user
  const cuotasScopeSocioId = canViewAllDebt ? undefined : (user?.socio_id || '__pending_auth__')

  const {
    cuotas,
    totalCuotas,
    totalPages,
    summary,
    periodos,
    filters,
    cuentas,
    promociones,
    pagosSocio,
    loadingPagos,
    setSearch,
    setPeriodo,
    setEstado,
    setPage,
    registrarPagoCuotas,
    anularPago,
    fetchPagosSocio,
    getCuotasPendientes,
    exportCSV,
    createPromocion,
    updatePromocion,
    deletePromocion,
    fetchAllPromociones,
  } = useCuotas(cuotasScopeSocioId)

  const canEdit = !!user && hasPermission('deudas', 'editar')
  const isAdmin = !!user && hasPermission('deudas', 'eliminar')
  const canAccessDebtModule = canViewAllDebt || canViewOwnDebt

  useEffect(() => {
    if (!user) return
    if (!canViewAllDebt && canViewOwnDebt) {
      router.replace('/deudas/mi-cuenta')
    }
  }, [canViewAllDebt, canViewOwnDebt, router, user])

  // ── POS Modal state ──
  const [showPagoModal, setShowPagoModal] = useState(false)
  const [selectedSocio, setSelectedSocio] = useState<{ id: string; nombre: string; apellido: string } | null>(null)
  const [selectedCuotaIds, setSelectedCuotaIds] = useState<string[]>([])
  const [selectedCuentaId, setSelectedCuentaId] = useState('')
  const [selectedPromocionId, setSelectedPromocionId] = useState('')
  const [pagoFecha, setPagoFecha] = useState(new Date().toISOString().split('T')[0])
  const [pagoNotas, setPagoNotas] = useState('')
  const [submittingPago, setSubmittingPago] = useState(false)

  // ── Historial Modal state ──
  const [showHistorial, setShowHistorial] = useState(false)
  const [historialSocio, setHistorialSocio] = useState<{ id: string; nombre: string; apellido: string } | null>(null)

  // ── Anulación state ──
  const [showAnularModal, setShowAnularModal] = useState(false)
  const [anularMovimientoId, setAnularMovimientoId] = useState('')
  const [anularMotivo, setAnularMotivo] = useState('')
  const [submittingAnular, setSubmittingAnular] = useState(false)

  // ── Promociones state ──
  const [showPromoModal, setShowPromoModal] = useState(false)
  const [allPromos, setAllPromos] = useState<PromocionCuota[]>([])
  const [editingPromo, setEditingPromo] = useState<PromocionCuota | null>(null)
  const [promoForm, setPromoForm] = useState({
    nombre: '',
    descripcion: '',
    tipo: 'percent' as 'percent' | 'fixed',
    valor: '',
    meses_min: '',
    meses_max: '',
    activa: true,
  })
  const [showPromoForm, setShowPromoForm] = useState(false)

  // ── POS calculations ──
  const socioCuotasPendientes = useMemo(() => {
    if (!selectedSocio) return []
    return getCuotasPendientes(selectedSocio.id)
  }, [selectedSocio, getCuotasPendientes])

  const selectedCuotas = useMemo(() => {
    return socioCuotasPendientes.filter(c => selectedCuotaIds.includes(c.id))
  }, [socioCuotasPendientes, selectedCuotaIds])

  const subtotal = useMemo(() => {
    return selectedCuotas.reduce((sum, c) => sum + c.monto_esperado, 0)
  }, [selectedCuotas])

  const descuento = useMemo(() => {
    if (!selectedPromocionId || selectedPromocionId === 'none') return 0
    const promo = promociones.find(p => p.id === selectedPromocionId)
    if (!promo) return 0
    if (promo.tipo === 'percent') return subtotal * (promo.valor / 100)
    return promo.valor
  }, [selectedPromocionId, promociones, subtotal])

  const total = useMemo(() => Math.max(subtotal - descuento, 0), [subtotal, descuento])

  // Filter applicable promos based on selected cuotas count
  const applicablePromos = useMemo(() => {
    const count = selectedCuotaIds.length
    return promociones.filter(p => {
      if (p.meses_min && count < p.meses_min) return false
      if (p.meses_max && count > p.meses_max) return false
      return true
    })
  }, [promociones, selectedCuotaIds.length])

  // ── Handlers ──

  const openPagoModal = (cuota: Cuota & { socio?: { id: string; nombre: string; apellido: string } }) => {
    if (!cuota.socio) return
    setSelectedSocio(cuota.socio)
    setSelectedCuotaIds([cuota.id])
    setSelectedCuentaId(cuentas.length > 0 ? cuentas[0].id : '')
    setSelectedPromocionId('none')
    setPagoFecha(new Date().toISOString().split('T')[0])
    setPagoNotas('')
    setShowPagoModal(true)
  }

  const handleToggleCuota = (cuotaId: string) => {
    setSelectedCuotaIds(prev =>
      prev.includes(cuotaId) ? prev.filter(id => id !== cuotaId) : [...prev, cuotaId]
    )
    // Reset promo if cuota count changes and promo no longer applicable
    setSelectedPromocionId('none')
  }

  const handleConfirmarPago = async () => {
    if (!selectedSocio || selectedCuotaIds.length === 0 || !selectedCuentaId) return
    setSubmittingPago(true)
    try {
      await registrarPagoCuotas(
        selectedSocio.id,
        selectedCuotaIds,
        selectedCuentaId,
        pagoFecha,
        (selectedPromocionId && selectedPromocionId !== 'none') ? selectedPromocionId : undefined,
        pagoNotas || undefined,
      )
      setShowPagoModal(false)
    } catch {
      // error handled by hook
    } finally {
      setSubmittingPago(false)
    }
  }

  const openHistorial = async (socio: { id: string; nombre: string; apellido: string }) => {
    setHistorialSocio(socio)
    setShowHistorial(true)
    await fetchPagosSocio(socio.id)
  }

  const handleAnular = (movimientoId: string) => {
    setAnularMovimientoId(movimientoId)
    setAnularMotivo('')
    setShowAnularModal(true)
  }

  const handleConfirmarAnular = async () => {
    if (!anularMovimientoId || !anularMotivo.trim() || !user) return
    setSubmittingAnular(true)
    try {
      await anularPago(anularMovimientoId, anularMotivo, user.id)
      setShowAnularModal(false)
      // Refresh historial
      if (historialSocio) await fetchPagosSocio(historialSocio.id)
    } catch {
      // handled by hook
    } finally {
      setSubmittingAnular(false)
    }
  }

  // ── Promos management ──

  const openPromosManagement = async () => {
    const data = await fetchAllPromociones()
    setAllPromos(data)
    setShowPromoModal(true)
  }

  const openPromoForm = (promo?: PromocionCuota) => {
    if (promo) {
      setEditingPromo(promo)
      setPromoForm({
        nombre: promo.nombre,
        descripcion: promo.descripcion || '',
        tipo: promo.tipo,
        valor: String(promo.valor),
        meses_min: promo.meses_min ? String(promo.meses_min) : '',
        meses_max: promo.meses_max ? String(promo.meses_max) : '',
        activa: promo.activa,
      })
    } else {
      setEditingPromo(null)
      setPromoForm({ nombre: '', descripcion: '', tipo: 'percent', valor: '', meses_min: '', meses_max: '', activa: true })
    }
    setShowPromoForm(true)
  }

  const handleSavePromo = async () => {
    const data = {
      nombre: promoForm.nombre,
      descripcion: promoForm.descripcion || undefined,
      tipo: promoForm.tipo,
      valor: parseFloat(promoForm.valor),
      meses_min: promoForm.meses_min ? parseInt(promoForm.meses_min) : undefined,
      meses_max: promoForm.meses_max ? parseInt(promoForm.meses_max) : undefined,
      activa: promoForm.activa,
    }

    if (editingPromo) {
      await updatePromocion(editingPromo.id, data)
    } else {
      await createPromocion(data as Parameters<typeof createPromocion>[0])
    }

    setShowPromoForm(false)
    const updated = await fetchAllPromociones()
    setAllPromos(updated)
  }

  const handleDeletePromo = async (id: string) => {
    await deletePromocion(id)
    const updated = await fetchAllPromociones()
    setAllPromos(updated)
  }

  if (!canAccessDebtModule) {
    return (
      <div className="flex items-center justify-center py-20">
        <Card className="max-w-2xl w-full border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-800">
              <ShieldAlert className="w-5 h-5" />
              Acceso restringido a Deudas
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-red-700">
            No tienes permisos para acceder al módulo de deudas.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {canViewAllDebt ? 'Gestión de deudas' : 'Mi deuda'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {canViewAllDebt ? `${totalCuotas} cuotas registradas` : `${totalCuotas} cuotas en tu cuenta`}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {isAdmin && (
            <Button variant="outline" onClick={openPromosManagement} className="w-full sm:w-auto">
              <Tag className="w-4 h-4 mr-2" />
              Promociones
            </Button>
          )}
          <Button variant="outline" onClick={exportCSV} className="w-full sm:w-auto">
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Wallet} label="Total recaudado" value={formatARS(summary.totalRecaudado)} color="text-green-600" />
        <StatCard icon={Clock} label="Pendiente" value={formatARS(summary.totalPendiente)} color="text-yellow-600" />
        <StatCard icon={AlertCircle} label="Vencido" value={formatARS(summary.totalVencido)} color="text-red-600" />
        <StatCard icon={CreditCard} label="% Cobranza" value={`${summary.porcentajeCobranza}%`} color="text-primary" />
      </div>

      {/* Progress Bar */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Progreso de cobranza</span>
            <span className="text-foreground font-medium">{summary.porcentajeCobranza}%</span>
          </div>
          <Progress value={summary.porcentajeCobranza} className="h-3 bg-primary/20" />
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={canViewAllDebt ? 'Buscar por nombre de socio...' : 'Buscar en tus cuotas...'}
                value={filters.search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
              <Select value={filters.periodo} onValueChange={setPeriodo}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los períodos</SelectItem>
                  {periodos.map((p) => (
                    <SelectItem key={p} value={p}>{formatPeriodo(p)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.estado} onValueChange={(v) => setEstado(v as EstadoCuota | 'todos')}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="vencida">Vencidas</SelectItem>
                  <SelectItem value="pendiente">Pendientes</SelectItem>
                  <SelectItem value="parcial">Parciales</SelectItem>
                  <SelectItem value="pagada">Pagadas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-card border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-[920px]">
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Socio</TableHead>
                <TableHead className="text-muted-foreground">Período</TableHead>
                <TableHead className="text-muted-foreground">Monto esperado</TableHead>
                <TableHead className="text-muted-foreground">Monto pagado</TableHead>
                <TableHead className="text-muted-foreground">Estado</TableHead>
                <TableHead className="text-muted-foreground">Fecha pago</TableHead>
                <TableHead className="text-muted-foreground text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cuotas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No se encontraron cuotas
                  </TableCell>
                </TableRow>
              ) : (
                cuotas.map((cuota) => (
                  <CuotaRow
                    key={cuota.id}
                    cuota={cuota}
                    canEdit={canEdit}
                    onRegistrarPago={() => openPagoModal(cuota)}
                    onVerHistorial={() => cuota.socio && openHistorial(cuota.socio)}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {(filters.page - 1) * 20 + 1} - {Math.min(filters.page * 20, totalCuotas)} de {totalCuotas}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(filters.page - 1)} disabled={filters.page === 1} className="disabled:opacity-50">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              Página {filters.page} de {totalPages}
            </span>
            <Button variant="outline" size="sm" onClick={() => setPage(filters.page + 1)} disabled={filters.page === totalPages} className="disabled:opacity-50">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ══════ POS Modal ══════ */}
      <Dialog open={showPagoModal} onOpenChange={setShowPagoModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedSocio && (
            <>
              <DialogHeader>
                <DialogTitle>Registrar pago de cuotas</DialogTitle>
                <DialogDescription>
                  {selectedSocio.apellido}, {selectedSocio.nombre}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-4">
                {/* Selector de cuotas */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Cuotas a pagar</Label>
                  <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                    {socioCuotasPendientes.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground">No hay cuotas pendientes</p>
                    ) : (
                      socioCuotasPendientes.map(c => {
                        const estadoStyle = ESTADO_CUOTA_INLINE[c.estado as keyof typeof ESTADO_CUOTA_INLINE]
                        return (
                          <label key={c.id} className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer">
                            <Checkbox
                              checked={selectedCuotaIds.includes(c.id)}
                              onCheckedChange={() => handleToggleCuota(c.id)}
                            />
                            <span className="flex-1 text-sm">{formatPeriodo(c.periodo)}</span>
                            <Badge
                              className="text-xs border-0"
                              style={{ backgroundColor: estadoStyle?.bg, color: estadoStyle?.text }}
                            >
                              {c.estado}
                            </Badge>
                            <span className="text-sm font-medium">{formatARS(c.monto_esperado)}</span>
                          </label>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* Método de pago */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Método de pago</Label>
                  <Select value={selectedCuentaId} onValueChange={setSelectedCuentaId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar cuenta..." />
                    </SelectTrigger>
                    <SelectContent>
                      {cuentas.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nombre} ({c.tipo})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Promoción */}
                {applicablePromos.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Promoción (opcional)</Label>
                    <Select value={selectedPromocionId} onValueChange={setSelectedPromocionId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sin promoción" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin promoción</SelectItem>
                        {applicablePromos.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nombre} ({p.tipo === 'percent' ? `${p.valor}%` : formatARS(p.valor)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Fecha */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Fecha de pago</Label>
                  <Input type="date" value={pagoFecha} onChange={e => setPagoFecha(e.target.value)} />
                </div>

                {/* Notas */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Notas (opcional)</Label>
                  <Textarea
                    value={pagoNotas}
                    onChange={e => setPagoNotas(e.target.value)}
                    placeholder="Observaciones del pago..."
                    rows={2}
                  />
                </div>

                {/* Resumen */}
                <div className="p-3 rounded-lg bg-muted space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal ({selectedCuotaIds.length} cuota{selectedCuotaIds.length !== 1 ? 's' : ''})</span>
                    <span className="text-foreground">{formatARS(subtotal)}</span>
                  </div>
                  {descuento > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Descuento</span>
                      <span className="text-green-600">-{formatARS(descuento)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-semibold border-t pt-2">
                    <span>Total a cobrar</span>
                    <span className="text-primary">{formatARS(total)}</span>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowPagoModal(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmarPago}
                  disabled={selectedCuotaIds.length === 0 || !selectedCuentaId || submittingPago}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground border-0"
                >
                  {submittingPago ? 'Procesando...' : 'Confirmar pago'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ══════ Historial Modal ══════ */}
      <Dialog open={showHistorial} onOpenChange={setShowHistorial}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {historialSocio && (
            <>
              <DialogHeader>
                <DialogTitle>Historial de pagos</DialogTitle>
                <DialogDescription>
                  {historialSocio.apellido}, {historialSocio.nombre}
                </DialogDescription>
              </DialogHeader>

              <div className="py-4">
                {loadingPagos ? (
                  <p className="text-center text-muted-foreground py-8">Cargando pagos...</p>
                ) : pagosSocio.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No hay pagos registrados</p>
                ) : (
                  <div className="space-y-3">
                    {pagosSocio.map(pago => (
                      <PagoCard
                        key={pago.id}
                        pago={pago}
                        isAdmin={isAdmin}
                        onAnular={() => handleAnular(pago.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ══════ Anular Modal ══════ */}
      <Dialog open={showAnularModal} onOpenChange={setShowAnularModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular pago</DialogTitle>
            <DialogDescription>
              Esta acción revertirá las cuotas asociadas. El movimiento quedará marcado como anulado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Motivo de anulación</Label>
              <Textarea
                value={anularMotivo}
                onChange={e => setAnularMotivo(e.target.value)}
                placeholder="Ingrese el motivo..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAnularModal(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={handleConfirmarAnular}
              disabled={!anularMotivo.trim() || submittingAnular}
            >
              {submittingAnular ? 'Anulando...' : 'Confirmar anulación'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════ Promociones Management Modal ══════ */}
      <Dialog open={showPromoModal} onOpenChange={setShowPromoModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gestión de Promociones</DialogTitle>
            <DialogDescription>Administrar promociones y descuentos para cuotas</DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="flex justify-end mb-4">
              <Button size="sm" onClick={() => openPromoForm()}>
                <Plus className="w-4 h-4 mr-2" />
                Nueva promoción
              </Button>
            </div>

            {allPromos.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No hay promociones creadas</p>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Meses</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allPromos.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.nombre}</TableCell>
                        <TableCell>{p.tipo === 'percent' ? 'Porcentaje' : 'Fijo'}</TableCell>
                        <TableCell>{p.tipo === 'percent' ? `${p.valor}%` : formatARS(p.valor)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {p.meses_min || '-'} - {p.meses_max || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge className={p.activa ? 'bg-green-500/20 text-green-500 border-0' : 'bg-gray-500/20 text-gray-400 border-0'}>
                            {p.activa ? 'Activa' : 'Inactiva'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openPromoForm(p)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeletePromo(p.id)}>
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ══════ Promo Form Modal ══════ */}
      <Dialog open={showPromoForm} onOpenChange={setShowPromoForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPromo ? 'Editar promoción' : 'Nueva promoción'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={promoForm.nombre} onChange={e => setPromoForm({ ...promoForm, nombre: e.target.value })} placeholder="Ej: Descuento semestral" />
            </div>
            <div className="space-y-2">
              <Label>Descripción (opcional)</Label>
              <Input value={promoForm.descripcion} onChange={e => setPromoForm({ ...promoForm, descripcion: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={promoForm.tipo} onValueChange={v => setPromoForm({ ...promoForm, tipo: v as 'percent' | 'fixed' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Porcentaje (%)</SelectItem>
                    <SelectItem value="fixed">Monto fijo ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input type="number" value={promoForm.valor} onChange={e => setPromoForm({ ...promoForm, valor: e.target.value })} placeholder={promoForm.tipo === 'percent' ? '10' : '5000'} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Meses mínimo (opcional)</Label>
                <Input type="number" value={promoForm.meses_min} onChange={e => setPromoForm({ ...promoForm, meses_min: e.target.value })} placeholder="3" />
              </div>
              <div className="space-y-2">
                <Label>Meses máximo (opcional)</Label>
                <Input type="number" value={promoForm.meses_max} onChange={e => setPromoForm({ ...promoForm, meses_max: e.target.value })} placeholder="12" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={promoForm.activa} onCheckedChange={v => setPromoForm({ ...promoForm, activa: v })} />
              <Label>Activa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPromoForm(false)}>Cancelar</Button>
            <Button onClick={handleSavePromo} disabled={!promoForm.nombre || !promoForm.valor}>
              {editingPromo ? 'Guardar cambios' : 'Crear promoción'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ══════ Sub-components ══════

function PagoCard({
  pago,
  isAdmin,
  onAnular,
}: {
  pago: PagoSocio
  isAdmin: boolean
  onAnular: () => void
}) {
  const isAnulado = pago.anulado === true
  return (
    <div className={`border rounded-lg p-4 ${isAnulado ? 'opacity-60 bg-red-500/5 border-red-500/20' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{formatARS(pago.monto)}</span>
            {pago.cuenta && (
              <Badge variant="outline" className="text-xs">{pago.cuenta.nombre}</Badge>
            )}
            {isAnulado && (
              <Badge className="bg-red-500/20 text-red-500 border-0 text-xs">Anulado</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{formatDate(pago.fecha)}</p>
          {pago.descripcion && (
            <p className="text-xs text-muted-foreground">{pago.descripcion}</p>
          )}
          {isAnulado && pago.anulado_motivo && (
            <p className="text-xs text-red-400 mt-1">Motivo: {pago.anulado_motivo}</p>
          )}
          {pago.cuota_aplicaciones && pago.cuota_aplicaciones.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {pago.cuota_aplicaciones.map(app => (
                <Badge key={app.id} variant="secondary" className="text-xs">
                  {app.cuota?.periodo ? formatPeriodo(app.cuota.periodo) : 'Cuota'}
                  {' '}{formatARS(app.monto_aplicado)}
                </Badge>
              ))}
            </div>
          )}
        </div>
        {isAdmin && !isAnulado && (
          <Button variant="ghost" size="sm" onClick={onAnular} className="text-red-500 hover:text-red-600 hover:bg-red-500/10">
            <XCircle className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

function CuotaRow({
  cuota,
  canEdit,
  onRegistrarPago,
  onVerHistorial,
}: {
  cuota: Cuota & { socio?: { id: string; nombre: string; apellido: string } }
  canEdit: boolean
  onRegistrarPago: () => void
  onVerHistorial: () => void
}) {
  const estadoColors = ESTADO_CUOTA_COLORS[cuota.estado]
  const avatarColor = cuota.socio ? generateAvatarColor(cuota.socio.id) : 'from-gray-500 to-gray-600'

  return (
    <TableRow className="border-border hover:bg-muted/50">
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className={`w-8 h-8 bg-gradient-to-br ${avatarColor}`}>
            <AvatarFallback className="bg-transparent text-white text-xs font-semibold">
              {cuota.socio ? getInitials(cuota.socio.nombre, cuota.socio.apellido) : '?'}
            </AvatarFallback>
          </Avatar>
          <div>
            {cuota.socio ? (
              <Link href={`/socios/${cuota.socio.id}`} className="text-foreground hover:text-primary transition-colors">
                {cuota.socio.apellido}, {cuota.socio.nombre}
              </Link>
            ) : (
              <span className="text-muted-foreground">Desconocido</span>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="text-foreground">{formatPeriodo(cuota.periodo)}</TableCell>
      <TableCell className="text-foreground">{formatARS(cuota.monto_esperado)}</TableCell>
      <TableCell className={cuota.monto_pagado >= cuota.monto_esperado ? 'text-green-600' : 'text-foreground'}>
        {formatARS(cuota.monto_pagado)}
      </TableCell>
      <TableCell>
        <Badge className={`${estadoColors.bg} ${estadoColors.text} border-0 capitalize`}>
          {cuota.estado}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {cuota.fecha_pago ? formatDate(cuota.fecha_pago) : '-'}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          {cuota.socio && (
            <Button variant="ghost" size="sm" onClick={onVerHistorial} title="Ver historial">
              <History className="w-4 h-4" />
            </Button>
          )}
          {canEdit && cuota.estado !== 'pagada' && (
            <Button
              size="sm"
              onClick={onRegistrarPago}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Pagar
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType
  label: string
  value: string
  color: string
}) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
          <div>
            <p className={`text-base sm:text-lg font-semibold ${color}`}>{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
