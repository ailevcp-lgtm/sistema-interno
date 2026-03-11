"use client"

import { useMemo } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useSocios, useCuotas } from "@/hooks/useSocios"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, AlertCircle, CheckCircle2, Wallet, CalendarClock, History } from "lucide-react"
import { formatDate, formatPeriodo, formatARS } from "@/lib/utils"
import { ESTADO_CUOTA_INLINE } from "@/lib/constants"
import type { Socio } from "@/lib/types"

export default function MiCuentaPage() {
    const { user } = useAuth()
    const { socios, loading: loadingSocios } = useSocios()

    const userData = useMemo<Socio | null>(() => (
        socios.find((s) => s.email === user?.email || s.usuario_id === user?.id) || null
    ), [socios, user?.email, user?.id])

    const { cuotas, loading: loadingCuotas } = useCuotas(userData?.id)

    if ((user && loadingSocios) || (userData && loadingCuotas)) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!userData) {
        return (
            <div className="max-w-4xl mx-auto p-6">
                <Card className="border-border">
                    <CardContent className="p-8 text-center text-muted-foreground">
                        No tienes una cuenta de socio asociada. Contacta a un administrador.
                    </CardContent>
                </Card>
            </div>
        )
    }

    const pendientes = cuotas.filter(c => c.estado === 'pendiente' || c.estado === 'vencida' || c.estado === 'parcial')
    const pagadas = cuotas.filter(c => c.estado === 'pagada')

    const totalDeuda = pendientes.reduce((acc, curr) => acc + (curr.monto_esperado - curr.monto_pagado), 0)

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-semibold">Mi Cuenta</h1>
                    <p className="text-muted-foreground">Estado de deuda y pagos</p>
                </div>
                {totalDeuda === 0 ? (
                    <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 border-0 px-4 py-1.5 text-sm">
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Al día
                    </Badge>
                ) : (
                    <Badge variant="secondary" className="bg-red-100 text-red-700 hover:bg-red-100 border-0 px-4 py-1.5 text-sm">
                        <AlertCircle className="w-4 h-4 mr-2" />
                        Deuda pendiente: {formatARS(totalDeuda)}
                    </Badge>
                )}
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                <Card className="border-border md:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CalendarClock className="w-5 h-5 text-primary" />
                            Cuotas Pendientes
                        </CardTitle>
                        <CardDescription>Pagos que requieren tu atención</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {pendientes.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3 opacity-50" />
                                <p>¡Excelente! No tienes cuotas pendientes.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {pendientes.map((cuota) => {
                                    const estado = ESTADO_CUOTA_INLINE[cuota.estado] || {}
                                    const pendiente = cuota.monto_esperado - cuota.monto_pagado
                                    return (
                                        <div key={cuota.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/40 border border-border">
                                            <div className="space-y-1">
                                                <p className="font-medium text-lg">{formatPeriodo(cuota.periodo)}</p>
                                                <div className="flex gap-2">
                                                    <Badge
                                                        variant="outline"
                                                        className="border-0 font-normal"
                                                        style={{ backgroundColor: estado.bg, color: estado.text }}
                                                    >
                                                        {estado.label}
                                                    </Badge>
                                                    {cuota.estado === 'parcial' && (
                                                        <span className="text-xs text-muted-foreground self-center">
                                                            Pagado: {formatARS(cuota.monto_pagado)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-xl">{formatARS(pendiente)}</p>
                                                <Button size="sm" className="mt-2 h-8" variant="outline">
                                                    Informar pago
                                                </Button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <Card className="border-border bg-primary/5">
                        <CardContent className="p-6">
                            <h3 className="font-medium text-muted-foreground mb-2 flex items-center gap-2">
                                <Wallet className="w-4 h-4" /> Total Abonado
                            </h3>
                            <p className="text-3xl font-bold text-primary">
                                {formatARS(pagadas.reduce((acc, curr) => acc + curr.monto_pagado, 0) + pendientes.reduce((acc, curr) => acc + curr.monto_pagado, 0))}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                En {pagadas.length + pendientes.filter(p => p.monto_pagado > 0).length} pagos registrados
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-border">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <History className="w-4 h-4 text-muted-foreground" />
                                Historial reciente
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {pagadas.slice(0, 5).map(cuota => (
                                <div key={cuota.id} className="flex justify-between items-center text-sm border-b border-border pb-2 last:border-0 last:pb-0">
                                    <div>
                                        <p className="font-medium">{formatPeriodo(cuota.periodo)}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {cuota.fecha_pago ? formatDate(cuota.fecha_pago) : 'Fecha desconocida'}
                                        </p>
                                    </div>
                                    <span className="font-medium text-green-600">
                                        {formatARS(cuota.monto_pagado)}
                                    </span>
                                </div>
                            ))}
                            {pagadas.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-2">Sin historial</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
