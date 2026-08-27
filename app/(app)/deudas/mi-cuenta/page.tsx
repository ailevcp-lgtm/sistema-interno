'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useCuotas } from '@/hooks/useSocios'
import { formatARS, formatDate, formatPeriodo } from '@/lib/utils'
import { ESTADO_CUOTA_COLORS } from '@/lib/constants'
import { getUnpaidFeesCount } from '@/lib/statutory'
import type { Cuota } from '@/lib/types'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Wallet,
  AlertCircle,
  CheckCircle,
  Clock,
  CreditCard,
  FileText,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react'

export default function MiCuentaPage() {
  const { user } = useAuth()
  const cuotasScopeSocioId = user?.socio_id || '__pending_auth__'
  const { allCuotas, summary } = useCuotas(cuotasScopeSocioId)

  const [showDetalle, setShowDetalle] = useState(false)
  const [selectedCuota, setSelectedCuota] = useState<Cuota | null>(null)

  // Separate cuotas by status
  const cuotasVencidas = allCuotas.filter(c => c.estado === 'vencida')
  const cuotasPendientes = allCuotas.filter(c => c.estado === 'pendiente' || c.estado === 'parcial')
  const cuotasPagadas = allCuotas.filter(c => c.estado === 'pagada')

  // Calculate total debt
  const totalDeuda = cuotasVencidas.reduce((sum, c) => sum + c.monto_esperado, 0) +
    cuotasPendientes.reduce((sum, c) => sum + (c.monto_esperado - c.monto_pagado), 0)

  const cuotasImpagas = getUnpaidFeesCount(allCuotas)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Mi estado de cuenta</h1>
        <p className="text-muted-foreground mt-1">
          Visualizá tu historial de cuotas y pagos
        </p>
      </div>

      {/* Alerts */}
      {cuotasVencidas.length > 0 && (
        <Alert className="bg-red-500/10 border-red-500/30 text-red-700">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <AlertDescription>
            Tenés {cuotasVencidas.length} cuota{cuotasVencidas.length > 1 ? 's' : ''} vencida{cuotasVencidas.length > 1 ? 's' : ''} por un total de {formatARS(cuotasVencidas.reduce((sum, c) => sum + c.monto_esperado, 0))}
          </AlertDescription>
        </Alert>
      )}

      {cuotasPendientes.length > 0 && totalDeuda === 0 && (
        <Alert className="bg-yellow-500/10 border-yellow-500/30 text-yellow-700">
          <Clock className="h-4 w-4 text-yellow-500" />
          <AlertDescription>
            Tenés {cuotasPendientes.length} cuota{cuotasPendientes.length > 1 ? 's' : ''} pendiente{cuotasPendientes.length > 1 ? 's' : ''} de pago
          </AlertDescription>
        </Alert>
      )}

      {cuotasImpagas >= 3 && (
        <Alert className="bg-red-500/10 border-red-500/30 text-red-700">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <AlertDescription>
            Registrás {cuotasImpagas} cuotas impagas. El estatuto prevé notificación fehaciente y un plazo de regularización antes de cualquier decisión sobre cesantía.
          </AlertDescription>
        </Alert>
      )}

      {cuotasVencidas.length === 0 && cuotasPendientes.length === 0 && (
        <Alert className="bg-green-500/10 border-green-500/30 text-green-700">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <AlertDescription>
            ¡Estás al día con tus cuotas! No tenés pagos pendientes.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Wallet}
          label="Deuda total"
          value={formatARS(totalDeuda)}
          color={totalDeuda > 0 ? 'text-red-600' : 'text-green-600'}
        />
        <StatCard
          icon={CheckCircle}
          label="Pagadas"
          value={summary.pagadas}
          color="text-green-600"
        />
        <StatCard
          icon={Clock}
          label="Pendientes"
          value={summary.pendientes}
          color="text-yellow-600"
        />
        <StatCard
          icon={AlertCircle}
          label="Vencidas"
          value={summary.vencidas}
          color="text-red-600"
        />
      </div>

      {/* Main Content */}
      <Tabs defaultValue="pendientes" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto bg-muted border border-border p-1">
          <TabsTrigger
            value="pendientes"
            className="shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <AlertCircle className="w-4 h-4 mr-2" />
            Pendientes
          </TabsTrigger>
          <TabsTrigger
            value="historial"
            className="shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <FileText className="w-4 h-4 mr-2" />
            Historial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pendientes" className="mt-4 space-y-4">
          {cuotasVencidas.length === 0 && cuotasPendientes.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="p-12 text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No tenés cuotas pendientes</h3>
                <p className="text-muted-foreground">
                  Estás al día con tus pagos
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Vencidas Section */}
              {cuotasVencidas.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-red-600 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Cuotas vencidas
                  </h3>
                  {cuotasVencidas.map((cuota) => (
                    <CuotaCard
                      key={cuota.id}
                      cuota={cuota}
                      onClick={() => {
                        setSelectedCuota(cuota)
                        setShowDetalle(true)
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Pendientes Section */}
              {cuotasPendientes.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-yellow-600 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Cuotas pendientes
                  </h3>
                  {cuotasPendientes.map((cuota) => (
                    <CuotaCard
                      key={cuota.id}
                      cuota={cuota}
                      onClick={() => {
                        setSelectedCuota(cuota)
                        setShowDetalle(true)
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="historial" className="mt-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground text-base">Historial de pagos</CardTitle>
            </CardHeader>
            <CardContent>
              {cuotasPagadas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay pagos registrados
                </div>
              ) : (
                <div className="space-y-3">
                  {cuotasPagadas
                    .sort((a, b) => new Date(b.fecha_pago || '').getTime() - new Date(a.fecha_pago || '').getTime())
                    .map((cuota) => (
                      <div
                        key={cuota.id}
                        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 rounded-lg bg-muted border border-border"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2 rounded-full bg-green-500/10">
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          </div>
                          <div>
                            <p className="text-foreground font-medium">
                              {formatPeriodo(cuota.periodo)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Pagada el {cuota.fecha_pago && formatDate(cuota.fecha_pago)}
                            </p>
                          </div>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-green-600 font-medium">
                            {formatARS(cuota.monto_pagado)}
                          </p>
                          <Badge className="bg-green-500/20 text-green-700 border-0">
                            Pagada
                          </Badge>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detalle Modal */}
      <Dialog open={showDetalle} onOpenChange={setShowDetalle}>
        <DialogContent>
          {selectedCuota && (
            <>
              <DialogHeader>
                <DialogTitle>Detalle de cuota</DialogTitle>
                <DialogDescription>
                  {formatPeriodo(selectedCuota.periodo)}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted">
                  <span className="text-muted-foreground">Monto esperado</span>
                  <span className="text-foreground font-medium">{formatARS(selectedCuota.monto_esperado)}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted">
                  <span className="text-muted-foreground">Monto pagado</span>
                  <span className={`font-medium ${selectedCuota.monto_pagado >= selectedCuota.monto_esperado ? 'text-green-600' : 'text-foreground'}`}>
                    {formatARS(selectedCuota.monto_pagado)}
                  </span>
                </div>
                {selectedCuota.monto_pagado < selectedCuota.monto_esperado && (
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted">
                    <span className="text-muted-foreground">Restante</span>
                    <span className="text-red-500 font-medium">
                      {formatARS(selectedCuota.monto_esperado - selectedCuota.monto_pagado)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted">
                  <span className="text-muted-foreground">Estado</span>
                  <Badge className={`${ESTADO_CUOTA_COLORS[selectedCuota.estado].bg} ${ESTADO_CUOTA_COLORS[selectedCuota.estado].text} border-0 capitalize`}>
                    {selectedCuota.estado}
                  </Badge>
                </div>
                {selectedCuota.fecha_pago && (
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted">
                    <span className="text-muted-foreground">Fecha de pago</span>
                    <span className="text-foreground">{formatDate(selectedCuota.fecha_pago)}</span>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  onClick={() => setShowDetalle(false)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  Cerrar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CuotaCard({ cuota, onClick }: { cuota: Cuota; onClick: () => void }) {
  const estadoColors = ESTADO_CUOTA_COLORS[cuota.estado]
  const progress = Math.min(100, (cuota.monto_pagado / cuota.monto_esperado) * 100)
  const remaining = cuota.monto_esperado - cuota.monto_pagado

  return (
    <Card
      className="bg-card border-border hover:border-primary/40 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${cuota.estado === 'vencida' ? 'bg-red-500/10' : 'bg-yellow-500/10'}`}>
              {cuota.estado === 'vencida' ? (
                <AlertCircle className="w-5 h-5 text-red-500" />
              ) : (
                <Clock className="w-5 h-5 text-yellow-500" />
              )}
            </div>
            <div>
              <p className="text-foreground font-medium">{formatPeriodo(cuota.periodo)}</p>
              <p className="text-sm text-muted-foreground">
                {cuota.estado === 'parcial' ? 'Pago parcial' : 'Pago pendiente'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-foreground font-medium">{formatARS(cuota.monto_esperado)}</p>
            <Badge className={`${estadoColors.bg} ${estadoColors.text} border-0 capitalize text-xs`}>
              {cuota.estado}
            </Badge>
          </div>
        </div>
        <Progress value={progress} className="h-2 bg-primary/20 mb-2" />
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            Pagado: {formatARS(cuota.monto_pagado)}
          </span>
          {remaining > 0 && (
            <span className="text-red-500">
              Restante: {formatARS(remaining)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
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
  value: string | number
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
            <p className={`text-lg font-semibold ${color}`}>{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
