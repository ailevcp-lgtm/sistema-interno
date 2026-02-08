"use client"

import { useState } from "react"
import { useTesoreria, type CuentaConSaldo } from "@/hooks/useTesoreria"
import { CuentasList } from "@/components/aile/tesoreria/cuentas-list"
import { ArqueoModal } from "@/components/aile/tesoreria/arqueo-modal"
import { NuevaTransaccionModal } from "@/components/aile/tesoreria/nueva-transaccion-modal"
import { Button } from "@/components/ui/button"
import { ArrowDownCircle, ArrowUpCircle, Download, FileText, Search } from "lucide-react"
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

export default function TesoreriaPage() {
    const { cuentas, movimientos, loading, refreshData } = useTesoreria()

    // Modals state
    const [showArqueo, setShowArqueo] = useState(false)
    const [selectedCuenta, setSelectedCuenta] = useState<CuentaConSaldo | null>(null)

    const [showNuevaTransaccion, setShowNuevaTransaccion] = useState(false)
    const [transaccionType, setTransaccionType] = useState<"ingreso" | "egreso">("ingreso")

    // Filter state
    const [searchTerm, setSearchTerm] = useState("")

    const handleArqueo = (cuenta: CuentaConSaldo) => {
        setSelectedCuenta(cuenta)
        setShowArqueo(true)
    }

    const handleNuevaTransaccion = (tipo: "ingreso" | "egreso") => {
        setTransaccionType(tipo)
        setShowNuevaTransaccion(true)
    }

    const filteredMovimientos = movimientos.filter(m =>
        m.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.categoria?.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.cuenta?.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.evento?.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[#6314a7]">Tesorería</h1>
                    <p className="text-muted-foreground">Gestión de cajas, bancos y movimientos diarios</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => handleNuevaTransaccion("ingreso")} className="bg-emerald-600 hover:bg-emerald-700">
                        <ArrowUpCircle className="w-4 h-4 mr-2" />
                        Nuevo Ingreso
                    </Button>
                    <Button onClick={() => handleNuevaTransaccion("egreso")} variant="destructive">
                        <ArrowDownCircle className="w-4 h-4 mr-2" />
                        Nuevo Egreso
                    </Button>
                </div>
            </div>

            <CuentasList
                cuentas={cuentas}
                loading={loading}
                onArqueo={handleArqueo}
            />

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Movimientos Recientes</CardTitle>
                    <div className="relative w-64">
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
                    <Table>
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
                                        <TableCell className="max-w-[200px] truncate" title={m.descripcion}>
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
                                            "text-right font-bold",
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
                </CardContent>
            </Card>

            {/* Modals */}
            <ArqueoModal
                cuenta={selectedCuenta}
                isOpen={showArqueo}
                onClose={() => setShowArqueo(false)}
                onSuccess={refreshData}
            />

            <NuevaTransaccionModal
                isOpen={showNuevaTransaccion}
                onClose={() => setShowNuevaTransaccion(false)}
                onSuccess={refreshData}
                initialType={transaccionType}
            />
        </div>
    )
}

// Utility for conditional classes (if not already imported)
function cn(...classes: (string | undefined | null | false)[]) {
    return classes.filter(Boolean).join(" ")
}
