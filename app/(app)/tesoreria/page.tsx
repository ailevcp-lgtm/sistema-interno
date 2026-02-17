"use client"

import { useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useTesoreria, type CuentaConSaldo } from "@/hooks/useTesoreria"
import { CuentasList } from "@/components/aile/tesoreria/cuentas-list"
import { ArqueoModal } from "@/components/aile/tesoreria/arqueo-modal"
import { NuevaTransaccionModal } from "@/components/aile/tesoreria/nueva-transaccion-modal"
import { Button } from "@/components/ui/button"
import { ArrowDownCircle, ArrowUpCircle, Search, ShieldAlert } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export default function TesoreriaPage() {
    const { hasPermission } = useAuth()
    const { cuentas, categorias, movimientos, loading, refreshData, registrarArqueo } = useTesoreria()
    const canViewTesoreria = hasPermission("tesoreria", "ver")
    const canEditTesoreria = hasPermission("tesoreria", "editar")

    // Modals state
    const [showArqueo, setShowArqueo] = useState(false)
    const [selectedCuenta, setSelectedCuenta] = useState<CuentaConSaldo | null>(null)

    const [showNuevaTransaccion, setShowNuevaTransaccion] = useState(false)
    const [transaccionType, setTransaccionType] = useState<"ingreso" | "egreso">("ingreso")

    // Filter state
    const [searchTerm, setSearchTerm] = useState("")

    const handleArqueo = (cuenta: CuentaConSaldo) => {
        if (!canEditTesoreria) return
        setSelectedCuenta(cuenta)
        setShowArqueo(true)
    }

    const handleNuevaTransaccion = (tipo: "ingreso" | "egreso") => {
        if (!canEditTesoreria) return
        setTransaccionType(tipo)
        setShowNuevaTransaccion(true)
    }

    const filteredMovimientos = movimientos.filter(m =>
        m.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.categoria?.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.cuenta?.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.evento?.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (!canViewTesoreria) {
        return (
            <div className="flex items-center justify-center py-20">
                <Card className="max-w-2xl w-full border-red-200 bg-red-50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-red-800">
                            <ShieldAlert className="w-5 h-5" />
                            Acceso restringido a Tesorería
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-red-700">
                        Este módulo está disponible solo para roles autorizados.
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[#6314a7]">Tesorería</h1>
                    <p className="text-muted-foreground">Gestión de cajas, bancos y movimientos diarios</p>
                    {!canEditTesoreria && (
                        <p className="text-xs text-muted-foreground mt-1">Vista de solo lectura</p>
                    )}
                </div>
                {canEditTesoreria && (
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <Button onClick={() => handleNuevaTransaccion("ingreso")} className="bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto">
                            <ArrowUpCircle className="w-4 h-4 mr-2" />
                            Nuevo Ingreso
                        </Button>
                        <Button onClick={() => handleNuevaTransaccion("egreso")} variant="destructive" className="w-full sm:w-auto">
                            <ArrowDownCircle className="w-4 h-4 mr-2" />
                            Nuevo Egreso
                        </Button>
                    </div>
                )}
            </div>

            <CuentasList
                cuentas={cuentas}
                loading={loading}
                onArqueo={handleArqueo}
                canArqueo={canEditTesoreria}
            />

            <Card>
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <CardTitle>Movimientos Recientes</CardTitle>
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar movimientos..."
                            className="pl-8"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table className="min-w-[760px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Descripción</TableHead>
                                    <TableHead>Categoría</TableHead>
                                    <TableHead>Cuenta</TableHead>
                                    <TableHead>Evento</TableHead>
                                    <TableHead className="text-right">Monto</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                            Cargando movimientos...
                                        </TableCell>
                                    </TableRow>
                                ) : filteredMovimientos.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                            No se encontraron movimientos recientes
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredMovimientos.map((m) => (
                                        <TableRow key={m.id}>
                                            <TableCell className="font-medium whitespace-nowrap">
                                                {new Date(m.fecha).toLocaleDateString("es-AR")}
                                            </TableCell>
                                            <TableCell className="max-w-[220px] truncate" title={m.descripcion}>
                                                {m.descripcion}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="font-normal">
                                                    {m.categoria?.nombre || "-"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {m.cuenta?.nombre}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {m.evento?.nombre || "-"}
                                            </TableCell>
                                            <TableCell className={cn(
                                                "text-right font-bold break-words",
                                                m.tipo === "ingreso" ? "text-emerald-600" : "text-red-600"
                                            )}>
                                                {m.tipo === "egreso" ? "-" : "+"}
                                                {new Intl.NumberFormat("es-AR", {
                                                    style: "currency",
                                                    currency: "ARS"
                                                }).format(Number(m.monto))}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Modals */}
            <ArqueoModal
                cuenta={selectedCuenta}
                isOpen={canEditTesoreria && showArqueo}
                onClose={() => setShowArqueo(false)}
                onSuccess={refreshData}
                registrarArqueo={registrarArqueo}
            />

            {canEditTesoreria && (
                <NuevaTransaccionModal
                    isOpen={showNuevaTransaccion}
                    onClose={() => setShowNuevaTransaccion(false)}
                    onSuccess={refreshData}
                    initialType={transaccionType}
                    cuentas={cuentas}
                    categorias={categorias}
                />
            )}
        </div>
    )
}
