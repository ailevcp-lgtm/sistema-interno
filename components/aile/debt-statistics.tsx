
"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatARS, formatPorcentaje } from "@/lib/utils"
import type { Socio, Cuota } from "@/lib/types"

interface DebtStatisticsProps {
    socios: Socio[]
    cuotas: (Cuota & { socio?: Socio })[]
}

export function DebtStatistics({ socios, cuotas }: DebtStatisticsProps) {
    const stats = useMemo(() => {
        // 1. Socios Stats
        const totalSocios = socios.length
        const activos = socios.filter(s => s.estado === 'activo').length
        const inactivos = socios.filter(s => s.estado === 'inactivo').length
        const parciales = socios.filter(s => s.estado === 'parcialmente_activo' as any).length // Adjust type if needed

        // 2. Voluntarios 2026 (Al día vs Deudores)
        // "Al día" means NO pending/vencida quotas? Or just 2026?
        // Based on "Debiendo" count (36), it likely means ANY debt.
        // Let's check each socio.
        let alDiaCount = 0
        let debiendoCount = 0

        const socioDebts = new Map<string, Cuota[]>()
        socios.forEach(s => socioDebts.set(s.id, []))
        cuotas.forEach(c => {
            if (c.estado === 'pendiente' || c.estado === 'vencida') {
                const list = socioDebts.get(c.socio_id)
                if (list) list.push(c)
            }
        })

        socios.forEach(s => {
            const debts = socioDebts.get(s.id) || []
            if (debts.length === 0) alDiaCount++
            else debiendoCount++
        })

        // 3. Socios Deudores Breakdown (2025 vs 2026)
        // Filter debts by year
        const debts2025 = cuotas.filter(c => (c.estado === 'pendiente' || c.estado === 'vencida') && c.periodo.startsWith('2025'))
        const debts2026 = cuotas.filter(c => (c.estado === 'pendiente' || c.estado === 'vencida') && c.periodo.startsWith('2026'))

        const processBreakdown = (debts: typeof cuotas) => {
            const grouped = {
                activos: { count: 0, cuotas: 0, monto: 0, socios: new Set<string>() },
                inactivos: { count: 0, cuotas: 0, monto: 0, socios: new Set<string>() },
                parciales: { count: 0, cuotas: 0, monto: 0, socios: new Set<string>() },
            }

            debts.forEach(d => {
                const socio = socios.find(s => s.id === d.socio_id)
                if (!socio) return

                let target = grouped.activos
                if (socio.estado === 'inactivo') target = grouped.inactivos
                // Assuming 'parcialmente_activo' exists or logic for it
                if (socio.rol_aile?.toLowerCase().includes('parcial') || (socio as any).estado === 'parcialmente_activo') target = grouped.parciales

                target.cuotas++
                target.monto += d.monto_esperado
                target.socios.add(d.socio_id)
            })

            return {
                activos: { ...grouped.activos, count: grouped.activos.socios.size },
                inactivos: { ...grouped.inactivos, count: grouped.inactivos.socios.size },
                parciales: { ...grouped.parciales, count: grouped.parciales.socios.size },
            }
        }

        const breakdown2025 = processBreakdown(debts2025)
        const breakdown2026 = processBreakdown(debts2026)

        return {
            socios: { total: totalSocios, activos, inactivos, parciales },
            voluntarios: { alDia: alDiaCount, debiendo: debiendoCount },
            breakdown2025,
            breakdown2026
        }
    }, [socios, cuotas])

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid gap-4 md:grid-cols-2">
                {/* Socios Condition */}
                <Card className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2 bg-muted/5">
                        <CardTitle className="text-lg font-bold text-primary">Socios</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-muted/10 border-b">
                                    <th className="text-left p-3 font-semibold text-muted-foreground">Condición</th>
                                    <th className="text-right p-3 font-semibold text-muted-foreground">Cantidad</th>
                                    <th className="text-right p-3 font-semibold text-muted-foreground">Porcentaje</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {[
                                    { label: "Activos", val: stats.socios.activos },
                                    { label: "Inactivos", val: stats.socios.inactivos },
                                    { label: "Parcialmente Activos", val: stats.socios.parciales },
                                    { label: "Total", val: stats.socios.total, bold: true },
                                ].map((row, i) => (
                                    <tr key={i} className={row.bold ? "bg-primary/5 font-medium" : "hover:bg-muted/5"}>
                                        <td className="p-3">{row.label}</td>
                                        <td className="text-right p-3">{row.val}</td>
                                        <td className="text-right p-3">{formatPorcentaje(row.val / stats.socios.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>

                {/* Payment Status */}
                <Card className="border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2 bg-muted/5">
                        <CardTitle className="text-lg font-bold text-orange-700">Voluntarios 2026</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-muted/10 border-b">
                                    <th className="text-left p-3 font-semibold text-muted-foreground">Condición</th>
                                    <th className="text-right p-3 font-semibold text-muted-foreground">Cantidad</th>
                                    <th className="text-right p-3 font-semibold text-muted-foreground">% sobre el total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {[
                                    { label: "Al día", val: stats.voluntarios.alDia, color: "text-green-600" },
                                    { label: "Debiendo", val: stats.voluntarios.debiendo, color: "text-red-600" },
                                ].map((row, i) => (
                                    <tr key={i} className="hover:bg-muted/5">
                                        <td className={`p-3 font-medium ${row.color}`}>{row.label}</td>
                                        <td className="text-right p-3">{row.val}</td>
                                        <td className="text-right p-3">{formatPorcentaje(row.val / stats.socios.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            </div>

            {/* Debt Breakdown Table */}
            <Card className="shadow-sm border border-border overflow-hidden">
                <CardHeader className="bg-muted/10 pb-4 border-b">
                    <CardTitle className="text-lg text-foreground">Detalle de Deuda</CardTitle>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-primary/90 text-primary-foreground">
                                <th className="p-3 text-left font-medium">Periodo</th>
                                <th className="p-3 text-left font-medium">Categoría</th>
                                <th className="p-3 text-center font-medium">Cantidad Socios</th>
                                <th className="p-3 text-center font-medium">Cuotas Debidas</th>
                                <th className="p-3 text-center font-medium">Promedio</th>
                                <th className="p-3 text-right font-medium">Monto Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {/* 2025 */}
                            {[
                                { label: "Activos Deudores", data: stats.breakdown2025.activos },
                                { label: "Inactivos Deudores", data: stats.breakdown2025.inactivos },
                                { label: "Parcialmente Activos", data: stats.breakdown2025.parciales },
                            ].map((row, i) => (
                                <tr key={`2025-${i}`} className={i % 2 === 0 ? "bg-white" : "bg-muted/5"}>
                                    {i === 0 && (
                                        <td rowSpan={3} className="p-3 font-bold text-gray-500 border-r bg-muted/5 align-middle">
                                            2025
                                        </td>
                                    )}
                                    <td className="p-3 text-muted-foreground">{row.label}</td>
                                    <td className="p-3 text-center">{row.data.count}</td>
                                    <td className="p-3 text-center">{row.data.cuotas}</td>
                                    <td className="p-3 text-center">
                                        {row.data.count > 0 ? (row.data.cuotas / row.data.count).toFixed(1) : "-"}
                                    </td>
                                    <td className="p-3 text-right font-mono font-medium">{formatARS(row.data.monto)}</td>
                                </tr>
                            ))}

                            <tr className="border-t-2 border-border/50"></tr>

                            {/* 2026 */}
                            {[
                                { label: "Activos Deudores", data: stats.breakdown2026.activos },
                                { label: "Inactivos Deudores", data: stats.breakdown2026.inactivos },
                                { label: "Parcialmente Activos", data: stats.breakdown2026.parciales },
                            ].map((row, i) => (
                                <tr key={`2026-${i}`} className={i % 2 === 0 ? "bg-white" : "bg-muted/5"}>
                                    {i === 0 && (
                                        <td rowSpan={3} className="p-3 font-bold text-primary border-r bg-muted/5 align-middle">
                                            2026
                                        </td>
                                    )}
                                    <td className="p-3 text-muted-foreground">{row.label}</td>
                                    <td className="p-3 text-center">{row.data.count}</td>
                                    <td className="p-3 text-center">{row.data.cuotas}</td>
                                    <td className="p-3 text-center">
                                        {row.data.count > 0 ? (row.data.cuotas / row.data.count).toFixed(1) : "-"}
                                    </td>
                                    <td className="p-3 text-right font-mono font-medium">{formatARS(row.data.monto)}</td>
                                </tr>
                            ))}

                            {/* Totals Row */}
                            <tr className="bg-primary/5 font-bold border-t-2 border-primary/20">
                                <td colSpan={3} className="p-3 text-right text-primary">Totales Generales</td>
                                <td className="p-3 text-center text-primary">
                                    {stats.breakdown2025.activos.cuotas +
                                        stats.breakdown2025.inactivos.cuotas +
                                        stats.breakdown2025.parciales.cuotas +
                                        stats.breakdown2026.activos.cuotas +
                                        stats.breakdown2026.inactivos.cuotas +
                                        stats.breakdown2026.parciales.cuotas}
                                </td>
                                <td className="p-3 text-center">-</td>
                                <td className="p-3 text-right text-primary text-lg">
                                    {formatARS(
                                        stats.breakdown2025.activos.monto +
                                        stats.breakdown2025.inactivos.monto +
                                        stats.breakdown2025.parciales.monto +
                                        stats.breakdown2026.activos.monto +
                                        stats.breakdown2026.inactivos.monto +
                                        stats.breakdown2026.parciales.monto
                                    )}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </CardContent>
            </Card>
        </div>
    )
}
