"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowDownCircle, ArrowUpCircle, CalendarClock, Loader2, Search } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { formatARS } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { runWithRecovery } from "@/lib/async-recovery"
import { useResumeRefresh } from "@/hooks/useResumeRefresh"
import { getFinancialReferenceData } from "@/lib/finance-source"

type MovementFilter = "todos" | "ingreso" | "egreso"

interface RawMovementRow {
  id: string
  tipo: "ingreso" | "egreso"
  monto: number
  fecha: string
  descripcion: string
  created_at: string
  categoria_id: string | null
  evento_id: string | null
  cuenta_id: string | null
}

interface MovementRow {
  id: string
  tipo: "ingreso" | "egreso"
  monto: number
  fecha: string
  descripcion: string
  created_at: string
  categoriaNombre: string
  eventoNombre: string | null
  cuentaNombre: string | null
}

function formatDateGroupLabel(date: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`))
}

export function MovimientosChronology() {
  const [loading, setLoading] = useState(true)
  const [movements, setMovements] = useState<MovementRow[]>([])
  const [filter, setFilter] = useState<MovementFilter>("todos")
  const [searchTerm, setSearchTerm] = useState("")

  const fetchMovements = useCallback(async () => {
    setLoading(true)

    try {
      const [result, referenceData] = await Promise.all([
        runWithRecovery(
          () =>
            supabase
              .from("movimientos")
              .select(
                "id, tipo, monto, fecha, descripcion, created_at, categoria_id, evento_id, cuenta_id"
              )
              .eq("anulado", false)
              .order("fecha", { ascending: false })
              .order("created_at", { ascending: false })
              .limit(120),
          { label: "movimientos chronology list", timeoutMs: 8_000, retries: 1 }
        ),
        runWithRecovery(
          () => getFinancialReferenceData(),
          { label: "movimientos chronology references", timeoutMs: 6_000, retries: 1 }
        ),
      ])

      if (result.error) {
        throw result.error
      }

      const categoriasById = new Map(
        referenceData.categorias.map((categoria) => [categoria.id, categoria.nombre])
      )
      const eventosById = new Map(
        referenceData.eventos.map((evento) => [evento.id, evento.nombre])
      )
      const cuentasById = new Map(
        referenceData.cuentas.map((cuenta) => [cuenta.id, cuenta.nombre])
      )

      const normalized = ((result.data || []) as RawMovementRow[]).map((row) => {
        return {
          id: row.id,
          tipo: row.tipo,
          monto: Number(row.monto),
          fecha: row.fecha,
          descripcion: row.descripcion || "Sin descripción",
          created_at: row.created_at,
          categoriaNombre: (row.categoria_id && categoriasById.get(row.categoria_id)) || "Sin categoría",
          eventoNombre: row.evento_id ? eventosById.get(row.evento_id) || null : null,
          cuentaNombre: row.cuenta_id ? cuentasById.get(row.cuenta_id) || null : null,
        }
      })

      setMovements(normalized)
    } catch (error) {
      console.error("Error loading chronological movements:", error)
      setMovements([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchMovements()
  }, [fetchMovements])
  useResumeRefresh(() => {
    void fetchMovements()
  }, { throttleMs: 5_000 })

  const filteredMovements = useMemo(() => {
    const search = searchTerm.trim().toLowerCase()

    return movements.filter((movement) => {
      const typeMatch = filter === "todos" || movement.tipo === filter
      if (!typeMatch) return false
      if (!search) return true

      return (
        movement.descripcion.toLowerCase().includes(search) ||
        movement.categoriaNombre.toLowerCase().includes(search) ||
        (movement.eventoNombre || "").toLowerCase().includes(search) ||
        (movement.cuentaNombre || "").toLowerCase().includes(search)
      )
    })
  }, [movements, filter, searchTerm])

  const totals = useMemo(() => {
    let ingresos = 0
    let egresos = 0

    filteredMovements.forEach((movement) => {
      if (movement.tipo === "ingreso") ingresos += movement.monto
      else egresos += movement.monto
    })

    return {
      ingresos,
      egresos,
      balance: ingresos - egresos,
    }
  }, [filteredMovements])

  const groupedMovements = useMemo(() => {
    const groups = new Map<string, MovementRow[]>()

    filteredMovements.forEach((movement) => {
      const current = groups.get(movement.fecha) || []
      current.push(movement)
      groups.set(movement.fecha, current)
    })

    return Array.from(groups.entries()).map(([fecha, entries]) => ({
      fecha,
      entries,
    }))
  }, [filteredMovements])

  return (
    <div className="flex flex-col gap-6">
      <Card className="overflow-hidden border-primary/20">
        <CardContent className="p-0">
          <div className="bg-gradient-to-r from-[#6314a7] via-[#7f2cbf] to-[#e50051] px-6 py-5 text-white">
            <h1 className="text-xl lg:text-2xl font-bold tracking-tight">Movimientos de AILE</h1>
            <p className="text-sm text-white/85 mt-1">
              Últimos ingresos y gastos ordenados cronológicamente
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-card">
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3">
              <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Ingresos</p>
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{formatARS(totals.ingresos)}</p>
            </div>
            <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-3">
              <p className="text-xs uppercase tracking-wide text-rose-700 dark:text-rose-400">Egresos</p>
              <p className="text-lg font-bold text-rose-700 dark:text-rose-400">{formatARS(totals.egresos)}</p>
            </div>
            <div className="rounded-xl border border-primary/25 bg-primary/10 p-3">
              <p className="text-xs uppercase tracking-wide text-primary">Balance</p>
              <p className="text-lg font-bold text-primary">{formatARS(totals.balance)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-primary" />
            Cronología de movimientos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={filter === "todos" ? "default" : "outline"}
                onClick={() => setFilter("todos")}
              >
                Todos
              </Button>
              <Button
                type="button"
                size="sm"
                variant={filter === "ingreso" ? "default" : "outline"}
                onClick={() => setFilter("ingreso")}
                className={cn(filter === "ingreso" ? "bg-emerald-600 hover:bg-emerald-700" : "")}
              >
                Ingresos
              </Button>
              <Button
                type="button"
                size="sm"
                variant={filter === "egreso" ? "default" : "outline"}
                onClick={() => setFilter("egreso")}
                className={cn(filter === "egreso" ? "bg-rose-600 hover:bg-rose-700" : "")}
              >
                Egresos
              </Button>
            </div>
            <div className="relative w-full lg:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por descripción, categoría, evento..."
                className="pl-9"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="py-10 flex items-center justify-center text-muted-foreground gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Cargando movimientos...
            </div>
          ) : groupedMovements.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              No hay movimientos para los filtros seleccionados.
            </div>
          ) : (
            <div className="space-y-5">
              {groupedMovements.map((group) => (
                <div key={group.fecha} className="space-y-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                    {formatDateGroupLabel(group.fecha)}
                  </p>
                  <div className="space-y-2">
                    {group.entries.map((movement) => (
                      <div
                        key={movement.id}
                        className={cn(
                          "rounded-xl border p-3 md:p-4 transition-colors",
                          movement.tipo === "ingreso"
                            ? "border-emerald-500/20 bg-emerald-500/[0.04]"
                            : "border-rose-500/20 bg-rose-500/[0.04]"
                        )}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              {movement.tipo === "ingreso" ? (
                                <ArrowUpCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                              ) : (
                                <ArrowDownCircle className="w-4 h-4 text-rose-600 shrink-0" />
                              )}
                              <p className="font-medium text-sm md:text-base truncate">{movement.descripcion}</p>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Badge variant="outline" className="font-normal">
                                {movement.categoriaNombre}
                              </Badge>
                              {movement.eventoNombre ? (
                                <Badge variant="secondary" className="font-normal">
                                  Evento: {movement.eventoNombre}
                                </Badge>
                              ) : null}
                              {movement.cuentaNombre ? (
                                <Badge variant="secondary" className="font-normal">
                                  Cuenta: {movement.cuentaNombre}
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                          <p
                            className={cn(
                              "font-bold text-sm md:text-base whitespace-nowrap",
                              movement.tipo === "ingreso" ? "text-emerald-600" : "text-rose-600"
                            )}
                          >
                            {movement.tipo === "ingreso" ? "+" : "-"} {formatARS(movement.monto)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
