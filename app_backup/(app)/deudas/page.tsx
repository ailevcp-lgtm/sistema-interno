'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { useCuotas } from '@/hooks/useSocios'
import { hasPermission } from '@/lib/constants'
import { formatARS, formatDate, formatPeriodo, getInitials, generateAvatarColor } from '@/lib/utils'
import { ESTADO_CUOTA_COLORS, ESTADO_CUOTA_INLINE } from '@/lib/constants'
import type { Cuota, EstadoCuota } from '@/lib/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
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
  FileDown,
  AlertCircle,
  CheckCircle,
  Clock,
  User,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Wallet,
} from 'lucide-react'

export default function DeudasPage() {
  const { user } = useAuth()
  const {
    cuotas,
    allCuotas,
    totalCuotas,
    totalPages,
    summary,
    periodos,
    filters,
    setSearch,
    setPeriodo,
    setEstado,
    setPage,
    registrarPago,
    exportCSV,
  } = useCuotas()

  const canEdit = user && hasPermission(user.rol, 'deudas', 'editar')

  const [showPagoModal, setShowPagoModal] = useState(false)
  const [selectedCuota, setSelectedCuota] = useState<Cuota | null>(null)
  const [pagoData, setPagoData] = useState({
    monto: '',
    fecha: new Date().toISOString().split('T')[0],
  })

  const handleRegistrarPago = () => {
    if (selectedCuota && pagoData.monto) {
      registrarPago(selectedCuota.id, parseFloat(pagoData.monto), pagoData.fecha)
      setShowPagoModal(false)
      setSelectedCuota(null)
      setPagoData({ monto: '', fecha: new Date().toISOString().split('T')[0] })
    }
  }

  const openPagoModal = (cuota: Cuota) => {
    setSelectedCuota(cuota)
    const remaining = cuota.monto_esperado - cuota.monto_pagado
    setPagoData({ ...pagoData, monto: remaining.toString() })
    setShowPagoModal(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Gestión de deudas</h1>
          <p className="text-[#7c6a94] mt-1">
            {totalCuotas} cuotas registradas
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={exportCSV}
            className="border-[#6314a7]/30 text-white hover:bg-[#6314a7]/20"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Wallet}
          label="Total recaudado"
          value={formatARS(summary.totalRecaudado)}
          color="text-green-400"
        />
        <StatCard
          icon={Clock}
          label="Pendiente"
          value={formatARS(summary.totalPendiente)}
          color="text-yellow-400"
        />
        <StatCard
          icon={AlertCircle}
          label="Vencido"
          value={formatARS(summary.totalVencido)}
          color="text-red-400"
        />
        <StatCard
          icon={CreditCard}
          label="% Cobranza"
          value={`${summary.porcentajeCobranza}%`}
          color="text-[#9341bf]"
        />
      </div>

      {/* Progress Bar */}
      <Card className="bg-[#13121d] border-[#6314a7]/20">
        <CardContent className="p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-[#7c6a94]">Progreso de cobranza</span>
            <span className="text-white font-medium">{summary.porcentajeCobranza}%</span>
          </div>
          <Progress value={summary.porcentajeCobranza} className="h-3 bg-[#6314a7]/20" />
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="bg-[#13121d] border-[#6314a7]/30">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7c6a94]" />
              <Input
                placeholder="Buscar por nombre de socio..."
                value={filters.search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-[#0d0618] border-[#6314a7]/30 text-white placeholder:text-[#7c6a94]"
              />
            </div>
            <div className="flex gap-4">
              <Select value={filters.periodo} onValueChange={setPeriodo}>
                <SelectTrigger className="w-[160px] bg-[#0d0618] border-[#6314a7]/30 text-white">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1625] border-[#6314a7]/30">
                  <SelectItem value="todos">Todos los períodos</SelectItem>
                  {periodos.map((p) => (
                    <SelectItem key={p} value={p}>
                      {formatPeriodo(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.estado} onValueChange={(v) => setEstado(v as EstadoCuota | 'todos')}>
                <SelectTrigger className="w-[140px] bg-[#0d0618] border-[#6314a7]/30 text-white">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1625] border-[#6314a7]/30">
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
      <Card className="bg-[#13121d] border-[#6314a7]/20 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-[#6314a7]/20 hover:bg-transparent">
                <TableHead className="text-[#7c6a94]">Socio</TableHead>
                <TableHead className="text-[#7c6a94]">Período</TableHead>
                <TableHead className="text-[#7c6a94]">Monto esperado</TableHead>
                <TableHead className="text-[#7c6a94]">Monto pagado</TableHead>
                <TableHead className="text-[#7c6a94]">Estado</TableHead>
                <TableHead className="text-[#7c6a94]">Fecha pago</TableHead>
                <TableHead className="text-[#7c6a94] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cuotas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-[#7c6a94]">
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
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-[#7c6a94]">
            Mostrando {(filters.page - 1) * 20 + 1} - {Math.min(filters.page * 20, totalCuotas)} de {totalCuotas}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(filters.page - 1)}
              disabled={filters.page === 1}
              className="border-[#6314a7]/30 text-white hover:bg-[#6314a7]/20 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-[#7c6a94] px-2">
              Página {filters.page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(filters.page + 1)}
              disabled={filters.page === totalPages}
              className="border-[#6314a7]/30 text-white hover:bg-[#6314a7]/20 disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Pago Modal */}
      <Dialog open={showPagoModal} onOpenChange={setShowPagoModal}>
        <DialogContent className="bg-[#13121d] border-[#6314a7]/30 text-white">
          {selectedCuota && selectedCuota.socio && (
            <>
              <DialogHeader>
                <DialogTitle>Registrar pago</DialogTitle>
                <DialogDescription className="text-[#7c6a94]">
                  {selectedCuota.socio.apellido}, {selectedCuota.socio.nombre} - Cuota {selectedCuota.periodo}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="p-3 rounded-lg bg-[#0d0618] space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#7c6a94]">Monto esperado</span>
                    <span className="text-white">{formatARS(selectedCuota.monto_esperado)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#7c6a94]">Monto pagado</span>
                    <span className="text-white">{formatARS(selectedCuota.monto_pagado)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#7c6a94]">Restante</span>
                    <span className="text-red-400 font-medium">
                      {formatARS(selectedCuota.monto_esperado - selectedCuota.monto_pagado)}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[#7c6a94]">Monto a pagar</Label>
                  <Input
                    type="number"
                    value={pagoData.monto}
                    onChange={(e) => setPagoData({ ...pagoData, monto: e.target.value })}
                    className="bg-[#0d0618] border-[#6314a7]/30 text-white"
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#7c6a94]">Fecha de pago</Label>
                  <Input
                    type="date"
                    value={pagoData.fecha}
                    onChange={(e) => setPagoData({ ...pagoData, fecha: e.target.value })}
                    className="bg-[#0d0618] border-[#6314a7]/30 text-white"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowPagoModal(false)}
                  className="border-[#6314a7]/30 text-white hover:bg-[#6314a7]/20"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleRegistrarPago}
                  className="bg-gradient-to-r from-[#6314a7] to-[#e50051] hover:from-[#7a1bc9] hover:to-[#ff1a6b] text-white border-0"
                >
                  Registrar pago
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CuotaRow({
  cuota,
  canEdit,
  onRegistrarPago,
}: {
  cuota: Cuota & { socio?: { id: string; nombre: string; apellido: string } }
  canEdit: boolean
  onRegistrarPago: () => void
}) {
  const estadoColors = ESTADO_CUOTA_COLORS[cuota.estado]
  const avatarColor = cuota.socio ? generateAvatarColor(cuota.socio.id) : 'from-gray-500 to-gray-600'

  return (
    <TableRow className="border-[#6314a7]/10 hover:bg-[#6314a7]/5">
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className={`w-8 h-8 bg-gradient-to-br ${avatarColor}`}>
            <AvatarFallback className="bg-transparent text-white text-xs font-semibold">
              {cuota.socio ? getInitials(cuota.socio.nombre, cuota.socio.apellido) : '?'}
            </AvatarFallback>
          </Avatar>
          <div>
            {cuota.socio ? (
              <Link
                href={`/socios/${cuota.socio.id}`}
                className="text-white hover:text-[#9341bf] transition-colors"
              >
                {cuota.socio.apellido}, {cuota.socio.nombre}
              </Link>
            ) : (
              <span className="text-[#7c6a94]">Desconocido</span>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="text-white">{formatPeriodo(cuota.periodo)}</TableCell>
      <TableCell className="text-white">{formatARS(cuota.monto_esperado)}</TableCell>
      <TableCell className={cuota.monto_pagado >= cuota.monto_esperado ? 'text-green-400' : 'text-white'}>
        {formatARS(cuota.monto_pagado)}
      </TableCell>
      <TableCell>
        <Badge className={`${estadoColors.bg} ${estadoColors.text} border-0 capitalize`}>
          {cuota.estado}
        </Badge>
      </TableCell>
      <TableCell className="text-[#7c6a94]">
        {cuota.fecha_pago ? formatDate(cuota.fecha_pago) : '-'}
      </TableCell>
      <TableCell className="text-right">
        {canEdit && cuota.estado !== 'pagada' && (
          <Button
            size="sm"
            onClick={onRegistrarPago}
            className="bg-[#6314a7] hover:bg-[#7a1bc9] text-white"
          >
            Pagar
          </Button>
        )}
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
    <Card className="bg-[#13121d] border-[#6314a7]/20">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#6314a7]/10">
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
          <div>
            <p className={`text-lg font-semibold ${color}`}>{value}</p>
            <p className="text-xs text-[#7c6a94]">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
