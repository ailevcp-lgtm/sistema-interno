"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatARS, formatDate } from "@/lib/utils"
import { ArrowUpDown, ArrowUpRight, ArrowDownRight } from "lucide-react"
import type { TransactionRow } from "@/lib/types"

interface Props {
  data: TransactionRow[]
  label: string
}

type SortKey = "fecha" | "monto" | "categoria"

export function TransactionDetailTable({ data, label }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("fecha")
  const [sortAsc, setSortAsc] = useState(false)

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(key === "categoria") }
  }

  const sorted = [...data].sort((a, b) => {
    let cmp = 0
    if (sortKey === "fecha") cmp = a.fecha.localeCompare(b.fecha)
    else if (sortKey === "monto") cmp = a.monto - b.monto
    else cmp = a.categoria.localeCompare(b.categoria)
    return sortAsc ? cmp : -cmp
  })

  if (data.length === 0) {
    return (
      <Card className="border border-border shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">Detalle - {label}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
            No hay datos para los filtros seleccionados
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold text-foreground italic">Detalle - {label}</CardTitle>
          <Badge variant="secondary" className="font-mono">{data.length} movimientos</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Desktop */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {([
                  { key: "fecha" as SortKey, label: "Fecha", align: "text-left" },
                  { key: "categoria" as SortKey, label: "Categoría", align: "text-left" },
                  { key: "monto" as SortKey, label: "Monto", align: "text-right" },
                ]).map((h) => (
                  <th
                    key={h.key}
                    className={`${h.align} text-xs text-foreground font-semibold p-3 cursor-pointer hover:bg-muted/50 transition-colors select-none`}
                    onClick={() => toggleSort(h.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {h.label}
                      <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
                    </span>
                  </th>
                ))}
                <th className="text-left text-xs text-foreground font-semibold p-3">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => (
                <tr key={row.id} className={`border-b border-border/50 hover:bg-muted/50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                  <td className="p-3 text-sm text-muted-foreground font-medium">{formatDate(row.fecha)}</td>
                  <td className="p-3 text-sm text-foreground font-medium">{row.categoria}</td>
                  <td
                    className="p-3 text-sm font-mono text-right font-bold"
                    style={{ color: row.tipo === "ingreso" ? "#059669" : "#dc2626" }}
                  >
                    {row.tipo === "ingreso" ? "+" : "-"}{formatARS(row.monto)}
                  </td>
                  <td className="p-3 text-sm text-muted-foreground max-w-[300px] truncate" title={row.descripcion}>{row.descripcion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <div className="flex flex-col gap-2 p-3 lg:hidden bg-muted/10">
          {sorted.map((row) => (
            <div key={row.id} className="flex items-center justify-between p-3 rounded-lg bg-white border border-border shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: row.tipo === "ingreso" ? "#ecfdf5" : "#fef2f2" }}
                >
                  {row.tipo === "ingreso" ? (
                    <ArrowUpRight className="w-4 h-4" style={{ color: "#059669" }} />
                  ) : (
                    <ArrowDownRight className="w-4 h-4" style={{ color: "#dc2626" }} />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{row.descripcion}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(row.fecha)} - {row.categoria}</p>
                </div>
              </div>
              <span
                className="text-sm font-mono font-bold shrink-0 ml-2"
                style={{ color: row.tipo === "ingreso" ? "#059669" : "#dc2626" }}
              >
                {row.tipo === "ingreso" ? "+" : "-"}{formatARS(row.monto)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
