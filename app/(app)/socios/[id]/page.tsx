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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { SocioDialog } from '@/components/aile/socio-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Socio } from '@/lib/types'
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
  const { getSocio, updateSocio, uploadAvatar } = useSocios()
  const { cuotas: allCuotas, registrarPago } = useCuotas(params.id as string)

  const socio = getSocio(params.id as string)
  const canEdit = !!user && hasPermission(user.rol, 'socios', 'editar')

  const [showPagoModal, setShowPagoModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedCuota, setSelectedCuota] = useState<Cuota | null>(null)
  const [pagoData, setPagoData] = useState({ monto: '', fecha: new Date().toISOString().split('T')[0] })

  const handleSaveSocio = async (data: Partial<Socio>) => {
    if (!socio) return
    try {
      await updateSocio(socio.id, data)
      setShowEditModal(false)
    } catch {
      // Error handled in hook
    }
  }

  if (!socio) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Socio no encontrado</p>
        <Link href="/socios">
          <Button variant="link" className="text-primary">
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
          className="text-muted-foreground hover:text-foreground hover:bg-primary/10 -ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a socios
        </Button>
      </Link>

      {/* Header Card */}
      <Card className="bg-card border-border overflow-hidden shadow-sm">
        <div className="h-32 bg-gradient-to-r from-violet-500/20 via-primary/20 to-pink-500/20" />
        <CardContent className="p-6 pt-0 relative">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="-mt-16 relative">
              <Avatar className={`w-32 h-32 border-[6px] border-card shadow-lg bg-gradient-to-br ${avatarColor}`}>
                <AvatarImage src={socio.avatar_url} className="object-cover" />
                <AvatarFallback className="bg-transparent text-white text-4xl font-bold">
                  {getInitials(socio.nombre, socio.apellido)}
                </AvatarFallback>
              </Avatar>
              <div className={`absolute bottom-2 right-2 w-5 h-5 rounded-full border-2 border-card ${socio.estado === 'activo' ? 'bg-green-500' : 'bg-gray-400'}`} />
            </div>

            <div className="flex-1 pt-4 md:pt-2">
              <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold text-foreground">
                      {socio.apellido}, {socio.nombre}
                    </h1>
                    {canEdit && (
                      <Button variant="ghost" size="icon" onClick={() => setShowEditModal(true)} className="h-8 w-8 text-muted-foreground hover:text-primary">
                        <Edit className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                    <span className="font-medium text-foreground">{socio.rol_aile || 'Socio'}</span>
                    <span>•</span>
                    <span>DNI {socio.dni}</span>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <Badge className={`${estadoColors.bg} ${estadoColors.text} border-0 capitalize px-2.5 py-0.5`}>
                      {socio.estado}
                    </Badge>
                    {socio.tiene_deuda && (
                      <Badge variant="outline" className="border-red-500/30 text-red-500 bg-red-500/5 px-2.5 py-0.5">
                        Con deuda
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  {/* Actions placeholder if needed */}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Info & Stats */}
        <div className="space-y-6">
          {/* Contact Info */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground text-base">Información de contacto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Mail className="w-4 h-4 text-primary" />
                <span>{socio.email}</span>
              </div>
              {socio.telefono && (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Phone className="w-4 h-4 text-primary" />
                  <span>{socio.telefono}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-muted-foreground">
                <Calendar className="w-4 h-4 text-primary" />
                <span>Ingresó el {formatDate(socio.fecha_ingreso)}</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <Clock className="w-4 h-4 text-primary" />
                <span>{calcularAntiguedad(socio.fecha_ingreso)} de antigüedad</span>
              </div>
            </CardContent>
          </Card>

          {/* Payment Stats */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground text-base">Resumen de pagos</CardTitle>
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
              <Separator className="bg-border" />
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total pagado</span>
                  <span className="text-green-500 font-medium">{formatARS(totalPagado)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Deuda actual</span>
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
            <TabsList className="bg-muted border border-border p-1">
              <TabsTrigger
                value="cuotas"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Estado de cuenta
              </TabsTrigger>
              <TabsTrigger
                value="historial"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <FileText className="w-4 h-4 mr-2" />
                Historial
              </TabsTrigger>
            </TabsList>

            <TabsContent value="cuotas" className="mt-4">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground text-base">Cuotas</CardTitle>
                </CardHeader>
                <CardContent>
                  {allCuotas.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
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
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground text-base">Historial de pagos</CardTitle>
                </CardHeader>
                <CardContent>
                  {allCuotas.filter(c => c.monto_pagado > 0).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
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
                            className="flex items-center justify-between p-3 rounded-lg bg-muted border border-border"
                          >
                            <div>
                              <p className="text-foreground font-medium">
                                {formatARS(cuota.monto_pagado)}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Cuota {cuota.periodo}
                              </p>
                            </div>
                            {cuota.fecha_pago && (
                              <p className="text-sm text-muted-foreground">
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pago</DialogTitle>
            <DialogDescription>
              {selectedCuota && (
                <>Cuota {selectedCuota.periodo} - Restante: {formatARS(selectedCuota.monto_esperado - selectedCuota.monto_pagado)}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Monto pagado</Label>
              <Input
                type="number"
                value={pagoData.monto}
                onChange={(e) => setPagoData({ ...pagoData, monto: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha de pago</Label>
              <Input
                type="date"
                value={pagoData.fecha}
                onChange={(e) => setPagoData({ ...pagoData, fecha: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPagoModal(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleRegistrarPago}
              className="bg-primary hover:bg-primary/90 text-primary-foreground border-0"
            >
              Registrar pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {socio && (
        <SocioDialog
          open={showEditModal}
          onOpenChange={setShowEditModal}
          socio={socio}
          onSave={handleSaveSocio}
          onUploadAvatar={uploadAvatar}
        />
      )}
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
    <div className="p-4 rounded-lg bg-muted border border-border">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-foreground font-medium">{cuota.periodo}</p>
          <p className="text-sm text-muted-foreground">
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
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Pagar
            </Button>
          )}
        </div>
      </div>
      <Progress value={progress} className="h-2 bg-primary/20" />
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
        <span className="text-muted-foreground">{label}</span>
      </div>
      <span className={`font-medium ${color}`}>{value}</span>
    </div>
  )
}
