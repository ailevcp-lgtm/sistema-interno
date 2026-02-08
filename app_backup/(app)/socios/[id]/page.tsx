'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useSocios, useCuotas } from '@/hooks/useSocios'
import { hasPermission } from '@/lib/constants'
import { formatARS, formatDate, getInitials, generateAvatarColor, calcularAntiguedad } from '@/lib/utils'
import { ESTADO_CUOTA_COLORS, ESTADO_SOCIO_COLORS } from '@/lib/constants'
import type { Cuota } from '@/lib/types'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
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
  ArrowLeft,
  Edit,
  Mail,
  Phone,
  Calendar,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Clock,
  FileText,
} from 'lucide-react'

export default function SocioDetailPage() {
  const params = useParams()
  const { user } = useAuth()
  const { getSocio } = useSocios()
  const { cuotas: allCuotas, registrarPago } = useCuotas(params.id as string)

  const socio = getSocio(params.id as string)
  const canEdit = user && hasPermission(user.rol, 'socios', 'editar')

  const [showPagoModal, setShowPagoModal] = useState(false)
  const [selectedCuota, setSelectedCuota] = useState<Cuota | null>(null)
  const [pagoData, setPagoData] = useState({ monto: '', fecha: new Date().toISOString().split('T')[0] })

  if (!socio) {
    return (
      <div className="text-center py-12">
        <p className="text-[#7c6a94]">Socio no encontrado</p>
        <Link href="/socios">
          <Button variant="link" className="text-[#9341bf]">
            Volver a socios
          </Button>
        </Link>
      </div>
    )
  }

  const avatarColor = generateAvatarColor(socio.id)
  const estadoColors = ESTADO_SOCIO_COLORS[socio.estado]

  // Calculate stats
  const cuotasPagadas = allCuotas.filter(c => c.estado === 'pagada').length
  const cuotasPendientes = allCuotas.filter(c => c.estado === 'pendiente' || c.estado === 'parcial').length
  const cuotasVencidas = allCuotas.filter(c => c.estado === 'vencida').length

  const totalPagado = allCuotas
    .filter(c => c.estado === 'pagada' || c.estado === 'parcial')
    .reduce((sum, c) => sum + c.monto_pagado, 0)
  const totalDeuda = allCuotas
    .filter(c => c.estado === 'vencida' || c.estado === 'pendiente' || c.estado === 'parcial')
    .reduce((sum, c) => sum + (c.monto_esperado - c.monto_pagado), 0)

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
      {/* Back Button */}
      <Link href="/socios">
        <Button
          variant="ghost"
          className="text-[#7c6a94] hover:text-white hover:bg-[#6314a7]/20 -ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a socios
        </Button>
      </Link>

      {/* Header Card */}
      <Card className="bg-[#13121d] border-[#6314a7]/30 overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-[#6314a7]/30 to-[#e50051]/30" />
        <CardContent className="p-6 pt-0 -mt-12">
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <Avatar className={`w-24 h-24 border-4 border-[#13121d] bg-gradient-to-br ${avatarColor}`}>
              <AvatarFallback className="bg-transparent text-white text-2xl font-bold">
                {getInitials(socio.nombre, socio.apellido)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-white">
                  {socio.apellido}, {socio.nombre}
                </h1>
                <Badge className={`${estadoColors.bg} ${estadoColors.text} border-0 capitalize`}>
                  {socio.estado}
                </Badge>
                {socio.tiene_deuda && (
                  <Badge variant="outline" className="border-red-500/30 text-red-400 bg-red-500/10">
                    Con deuda
                  </Badge>
                )}
              </div>
              <p className="text-[#7c6a94] mt-1">
                {socio.rol_aile || 'Socio'} • DNI {socio.dni}
              </p>
            </div>
            {canEdit && (
              <Button
                variant="outline"
                className="border-[#6314a7]/30 text-white hover:bg-[#6314a7]/20"
              >
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Info & Stats */}
        <div className="space-y-6">
          {/* Contact Info */}
          <Card className="bg-[#13121d] border-[#6314a7]/20">
            <CardHeader>
              <CardTitle className="text-white text-base">Información de contacto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 text-[#7c6a94]">
                <Mail className="w-4 h-4 text-[#9341bf]" />
                <span>{socio.email}</span>
              </div>
              {socio.telefono && (
                <div className="flex items-center gap-3 text-[#7c6a94]">
                  <Phone className="w-4 h-4 text-[#9341bf]" />
                  <span>{socio.telefono}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-[#7c6a94]">
                <Calendar className="w-4 h-4 text-[#9341bf]" />
                <span>Ingresó el {formatDate(socio.fecha_ingreso)}</span>
              </div>
              <div className="flex items-center gap-3 text-[#7c6a94]">
                <Clock className="w-4 h-4 text-[#9341bf]" />
                <span>{calcularAntiguedad(socio.fecha_ingreso)} de antigüedad</span>
              </div>
            </CardContent>
          </Card>

          {/* Payment Stats */}
          <Card className="bg-[#13121d] border-[#6314a7]/20">
            <CardHeader>
              <CardTitle className="text-white text-base">Resumen de pagos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <StatItem
                icon={CheckCircle}
                label="Cuotas pagadas"
                value={cuotasPagadas}
                color="text-green-500"
              />
              <StatItem
                icon={Clock}
                label="Cuotas pendientes"
                value={cuotasPendientes}
                color="text-yellow-500"
              />
              <StatItem
                icon={AlertCircle}
                label="Cuotas vencidas"
                value={cuotasVencidas}
                color="text-red-500"
              />
              <Separator className="bg-[#6314a7]/20" />
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#7c6a94]">Total pagado</span>
                  <span className="text-green-500 font-medium">{formatARS(totalPagado)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#7c6a94]">Deuda actual</span>
                  <span className={`font-medium ${totalDeuda > 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {formatARS(totalDeuda)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Tabs */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="cuotas" className="w-full">
            <TabsList className="bg-[#13121d] border border-[#6314a7]/30 p-1">
              <TabsTrigger
                value="cuotas"
                className="data-[state=active]:bg-[#6314a7] data-[state=active]:text-white text-[#7c6a94]"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Estado de cuenta
              </TabsTrigger>
              <TabsTrigger
                value="historial"
                className="data-[state=active]:bg-[#6314a7] data-[state=active]:text-white text-[#7c6a94]"
              >
                <FileText className="w-4 h-4 mr-2" />
                Historial
              </TabsTrigger>
            </TabsList>

            <TabsContent value="cuotas" className="mt-4">
              <Card className="bg-[#13121d] border-[#6314a7]/20">
                <CardHeader>
                  <CardTitle className="text-white text-base">Cuotas</CardTitle>
                </CardHeader>
                <CardContent>
                  {allCuotas.length === 0 ? (
                    <div className="text-center py-8 text-[#7c6a94]">
                      No hay cuotas registradas
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {allCuotas.map((cuota) => (
                        <CuotaItem
                          key={cuota.id}
                          cuota={cuota}
                          onRegistrarPago={() => openPagoModal(cuota)}
                          canEdit={canEdit}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="historial" className="mt-4">
              <Card className="bg-[#13121d] border-[#6314a7]/20">
                <CardHeader>
                  <CardTitle className="text-white text-base">Historial de pagos</CardTitle>
                </CardHeader>
                <CardContent>
                  {allCuotas.filter(c => c.monto_pagado > 0).length === 0 ? (
                    <div className="text-center py-8 text-[#7c6a94]">
                      No hay pagos registrados
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {allCuotas
                        .filter(c => c.monto_pagado > 0)
                        .sort((a, b) => new Date(b.fecha_pago || '').getTime() - new Date(a.fecha_pago || '').getTime())
                        .map((cuota) => (
                          <div
                            key={cuota.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-[#0d0618] border border-[#6314a7]/10"
                          >
                            <div>
                              <p className="text-white font-medium">
                                {formatARS(cuota.monto_pagado)}
                              </p>
                              <p className="text-sm text-[#7c6a94]">
                                Cuota {cuota.periodo}
                              </p>
                            </div>
                            {cuota.fecha_pago && (
                              <p className="text-sm text-[#7c6a94]">
                                {formatDate(cuota.fecha_pago)}
                              </p>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Pago Modal */}
      <Dialog open={showPagoModal} onOpenChange={setShowPagoModal}>
        <DialogContent className="bg-[#13121d] border-[#6314a7]/30 text-white">
          <DialogHeader>
            <DialogTitle>Registrar pago</DialogTitle>
            <DialogDescription className="text-[#7c6a94]">
              {selectedCuota && (
                <>Cuota {selectedCuota.periodo} - Restante: {formatARS(selectedCuota.monto_esperado - selectedCuota.monto_pagado)}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[#7c6a94]">Monto pagado</Label>
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
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CuotaItem({
  cuota,
  onRegistrarPago,
  canEdit,
}: {
  cuota: Cuota
  onRegistrarPago: () => void
  canEdit: boolean
}) {
  const estadoColors = ESTADO_CUOTA_COLORS[cuota.estado]
  const progress = Math.min(100, (cuota.monto_pagado / cuota.monto_esperado) * 100)

  return (
    <div className="p-4 rounded-lg bg-[#0d0618] border border-[#6314a7]/10">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-white font-medium">{cuota.periodo}</p>
          <p className="text-sm text-[#7c6a94]">
            {formatARS(cuota.monto_pagado)} / {formatARS(cuota.monto_esperado)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`${estadoColors.bg} ${estadoColors.text} border-0 capitalize`}>
            {cuota.estado}
          </Badge>
          {canEdit && cuota.estado !== 'pagada' && (
            <Button
              size="sm"
              onClick={onRegistrarPago}
              className="bg-[#6314a7] hover:bg-[#7a1bc9] text-white"
            >
              Pagar
            </Button>
          )}
        </div>
      </div>
      <Progress value={progress} className="h-2 bg-[#6314a7]/20" />
    </div>
  )
}

function StatItem({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType
  label: string
  value: number
  color: string
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-[#7c6a94]">{label}</span>
      </div>
      <span className={`font-medium ${color}`}>{value}</span>
    </div>
  )
}
