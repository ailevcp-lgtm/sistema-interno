"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Wallet, Landmark, Smartphone, RefreshCw, AlertCircle } from "lucide-react"
import type { CuentaConSaldo } from "@/hooks/useTesoreria"
import { cn } from "@/lib/utils"

interface CuentasListProps {
    cuentas: CuentaConSaldo[]
    loading: boolean
    onArqueo: (cuenta: CuentaConSaldo) => void
}

const getIcon = (tipo: string) => {
    switch (tipo) {
        case "efectivo": return <Wallet className="w-5 h-5 text-emerald-500" />
        case "banco": return <Landmark className="w-5 h-5 text-blue-500" />
        case "digital": return <Smartphone className="w-5 h-5 text-purple-500" />
        default: return <Wallet className="w-5 h-5" />
    }
}

const getLabel = (tipo: string) => {
    switch (tipo) {
        case "efectivo": return "Efectivo"
        case "banco": return "Cuenta Bancaria"
        case "digital": return "Billetera Virtual"
        default: return tipo
    }
}

export function CuentasList({ cuentas, loading, onArqueo }: CuentasListProps) {
    if (loading) {
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />
                ))}
            </div>
        )
    }

    if (cuentas.length === 0) {
        return (
            <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                    <AlertCircle className="w-10 h-10 text-muted-foreground mb-4 opacity-50" />
                    <p className="text-lg font-medium text-muted-foreground">No hay cuentas activas</p>
                    <p className="text-sm text-muted-foreground/80 max-w-sm mt-1">
                        Configura las cuentas en la sección de ajustes para empezar a gestionar la tesorería.
                    </p>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {cuentas.map((cuenta) => (
                <Card key={cuenta.id} className="overflow-hidden hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            {getLabel(cuenta.tipo)}
                        </CardTitle>
                        {getIcon(cuenta.tipo)}
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col gap-1">
                            <span className="text-xl font-bold truncate" title={cuenta.nombre}>
                                {cuenta.nombre}
                            </span>
                            <div className="text-2xl font-bold font-mono text-[#6314a7] mt-2">
                                {new Intl.NumberFormat("es-AR", {
                                    style: "currency",
                                    currency: "ARS",
                                }).format(cuenta.saldo)}
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t flex justify-end">
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2 text-xs"
                                onClick={() => onArqueo(cuenta)}
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                Realizar Arqueo
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
