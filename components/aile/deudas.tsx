"use client"

import { Search, SlidersHorizontal, CheckCircle2, Clock, AlertCircle, Upload, Download } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCuotas } from "@/hooks/useSocios"
import { formatARS, formatDate, formatPeriodo } from "@/lib/utils"
import type { EstadoCuota } from "@/lib/types"
import { DebtStatistics } from "@/components/aile/debt-statistics"

const statusConfig: Record<string, { color: string; bg: string; icon: typeof CheckCircle2 }> = {
  pagada: { color: "#059669", bg: "#ecfdf5", icon: CheckCircle2 },
  pendiente: { color: "#b45309", bg: "#fef3c7", icon: Clock },
  parcial: { color: "#b45309", bg: "#fef3c7", icon: Clock },
  vencida: { color: "#dc2626", bg: "#fef2f2", icon: AlertCircle },
}

const estadoLabels: Record<EstadoCuota, string> = {
  pagada: "Pagada",
  pendiente: "Pendiente",
  parcial: "Parcial",
  vencida: "Vencida",
}

export function DeudasPage() {

  const { cuotas, summary, loading, setSearch, filters, allSocios, allCuotas } = useCuotas()

  if (loading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse opacity-50">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-lg" />
          ))}
        </div>
        <div className="h-64 bg-muted rounded-lg" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-foreground">Deudas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Estado de cuenta y cuotas de socios</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportCSV()} disabled={cuotas.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
          <Button className="font-medium" style={{ backgroundColor: "#6314a7", color: "#fff" }}>
            <Upload className="w-4 h-4 mr-2" strokeWidth={2} />
            Registrar pago
          </Button>
        </div>
      </div>

      <Tabs defaultValue="list" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="list">Listado de Cuotas</TabsTrigger>
          <TabsTrigger value="stats">Estadísticas</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-6 mt-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card className="border border-border shadow-none">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#059669" }} />
                  <span className="text-xs text-muted-foreground font-medium">Al día</span>
                </div>
                <p className="text-xl lg:text-2xl font-bold text-foreground">{summary.pagadas}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{formatARS(summary.totalRecaudado)}</p>
              </CardContent>
            </Card>
            <Card className="border border-border shadow-none">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#b45309" }} />
                  <span className="text-xs text-muted-foreground font-medium">Pendientes</span>
                </div>
                <p className="text-xl lg:text-2xl font-bold text-foreground">{summary.pendientes}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{formatARS(summary.totalPendiente)}</p>
              </CardContent>
            </Card>
            <Card className="border border-border shadow-none">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#dc2626" }} />
                  <span className="text-xs text-muted-foreground font-medium">Vencidas</span>
                </div>
                <p className="text-xl lg:text-2xl font-bold text-foreground">{summary.vencidas}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{formatARS(summary.totalVencido)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progreso de cobranza</span>
              <span>{summary.porcentajeCobranza}%</span>
            </div>
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${summary.porcentajeCobranza}%` }}
              />
            </div>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por socio..."
                value={filters.search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-4 rounded-lg text-sm bg-card text-foreground placeholder:text-muted-foreground border border-border focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <Button variant="outline" className="gap-2 bg-transparent">
              <SlidersHorizontal className="w-4 h-4" strokeWidth={1.8} />
              Filtros
            </Button>
          </div>

          {cuotas.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No hay cuotas registradas
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <Card className="border border-border shadow-none hidden lg:block">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left text-xs text-muted-foreground font-medium p-4">Socio</th>
                          <th className="text-left text-xs text-muted-foreground font-medium p-4">Cuota</th>
                          <th className="text-left text-xs text-muted-foreground font-medium p-4">Monto</th>
                          <th className="text-left text-xs text-muted-foreground font-medium p-4">Estado</th>
                          <th className="text-left text-xs text-muted-foreground font-medium p-4">Fecha de pago</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cuotas.map((cuota) => {
                          const status = statusConfig[cuota.estado] || statusConfig.pendiente
                          return (
                            <tr key={cuota.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                              <td className="p-4 text-sm text-foreground font-medium">
                                {cuota.socio ? `${cuota.socio.nombre} ${cuota.socio.apellido}` : "-"}
                              </td>
                              <td className="p-4 text-sm text-muted-foreground">Cuota {formatPeriodo(cuota.periodo)}</td>
                              <td className="p-4 text-sm text-foreground font-mono">{formatARS(cuota.monto_esperado)}</td>
                              <td className="p-4">
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] border-0 gap-1 font-medium"
                                  style={{ backgroundColor: status.bg, color: status.color }}
                                >
                                  <status.icon className="w-3 h-3" />
                                  {estadoLabels[cuota.estado]}
                                </Badge>
                              </td>
                              <td className="p-4 text-sm text-muted-foreground">
                                {cuota.fecha_pago ? formatDate(cuota.fecha_pago) : "-"}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Mobile Cards */}
              <div className="flex flex-col gap-2 lg:hidden">
                {cuotas.map((cuota) => {
                  const status = statusConfig[cuota.estado] || statusConfig.pendiente
                  return (
                    <Card key={cuota.id} className="border border-border shadow-none">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-foreground font-medium">
                              {cuota.socio ? `${cuota.socio.nombre} ${cuota.socio.apellido}` : "-"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">Cuota {formatPeriodo(cuota.periodo)}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-sm font-mono text-foreground">{formatARS(cuota.monto_esperado)}</span>
                            <Badge
                              variant="secondary"
                              className="text-[10px] border-0 gap-1 font-medium"
                              style={{ backgroundColor: status.bg, color: status.color }}
                            >
                              <status.icon className="w-3 h-3" />
                              {estadoLabels[cuota.estado]}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="stats" className="mt-6">
          <DebtStatistics socios={allSocios || []} cuotas={allCuotas || []} />
        </TabsContent>
      </Tabs>

    </div>
  )
}
