"use client"

import { Suspense, useMemo } from "react"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useFinanzas } from "@/hooks/useFinanzas"
import { useFinanceFilters } from "@/hooks/useFinanceFilters"
import { FinanceFilters } from "./filters/finance-filters"
import { BalanceView } from "./balance/balance-view"
import { IngresosView } from "./ingresos/ingresos-view"
import { EgresosView } from "./egresos/egresos-view"
import { EventosView } from "./eventos/eventos-view"

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse opacity-50">
      <div className="h-8 w-48 bg-muted rounded" />
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-9 w-32 bg-muted rounded" />
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-muted rounded-lg" />
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="h-72 bg-muted rounded-lg" />
        <div className="h-72 bg-muted rounded-lg" />
      </div>
      <div className="h-64 bg-muted rounded-lg" />
    </div>
  )
}

function FinanzasDashboardInner() {
  const {
    filters,
    activeTab,
    setAnio,
    setCategoriaId,
    setEventoId,
    setTab,
    clearFilters,
    hasActiveFilters,
  } = useFinanceFilters()

  const {
    categorias,
    eventos,
    availableYears,
    loading,
    summary,
    monthlyDetail,
    categoryContribution,
    eventSummary,
    getCategorySummary,
    getTransactionDetail,
    getEventComparison,
  } = useFinanzas(filters)

  const ingresosSummary = useMemo(() => getCategorySummary("ingreso"), [getCategorySummary])
  const egresosSummary = useMemo(() => getCategorySummary("egreso"), [getCategorySummary])
  const ingresosDetail = useMemo(() => getTransactionDetail("ingreso"), [getTransactionDetail])
  const egresosDetail = useMemo(() => getTransactionDetail("egreso"), [getTransactionDetail])
  const ingresosEvents = useMemo(() => getEventComparison("ingreso"), [getEventComparison])
  const egresosEvents = useMemo(() => getEventComparison("egreso"), [getEventComparison])

  if (loading) return <DashboardSkeleton />

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-foreground">Tesorería AILE</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Panel financiero</p>
        </div>
        <Button variant="outline" className="gap-2 bg-transparent w-fit">
          <Download className="w-4 h-4" strokeWidth={1.8} />
          Exportar
        </Button>
      </div>

      {/* Filters */}
      <FinanceFilters
        availableYears={availableYears}
        categorias={categorias}
        eventos={eventos}
        anio={filters.anio}
        categoriaId={filters.categoriaId}
        eventoId={filters.eventoId}
        hasActiveFilters={hasActiveFilters}
        onAnioChange={setAnio}
        onCategoriaChange={setCategoriaId}
        onEventoChange={setEventoId}
        onClear={clearFilters}
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setTab}>
        <TabsList className="bg-muted/50 h-9">
          <TabsTrigger value="balance" className="text-xs data-[state=active]:bg-background">Balance</TabsTrigger>
          <TabsTrigger value="ingresos" className="text-xs data-[state=active]:bg-background">Ingresos</TabsTrigger>
          <TabsTrigger value="egresos" className="text-xs data-[state=active]:bg-background">Egresos</TabsTrigger>
          <TabsTrigger value="eventos" className="text-xs data-[state=active]:bg-background">Eventos</TabsTrigger>
        </TabsList>

        <TabsContent value="balance" className="mt-4">
          <BalanceView
            summary={summary}
            categoryContribution={categoryContribution}
            monthlyDetail={monthlyDetail}
          />
        </TabsContent>

        <TabsContent value="ingresos" className="mt-4">
          <IngresosView
            total={summary.ingresos}
            categorySummary={ingresosSummary}
            eventComparison={ingresosEvents}
            transactionDetail={ingresosDetail}
          />
        </TabsContent>

        <TabsContent value="egresos" className="mt-4">
          <EgresosView
            total={summary.egresos}
            categorySummary={egresosSummary}
            eventComparison={egresosEvents}
            transactionDetail={egresosDetail}
          />
        </TabsContent>

        <TabsContent value="eventos" className="mt-4">
          <EventosView data={eventSummary} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export function FinanzasDashboard() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <FinanzasDashboardInner />
    </Suspense>
  )
}
