"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatARS } from "@/lib/utils"
import { ArrowUpDown } from "lucide-react"
import type { MonthlyDetail } from "@/lib/types"

interface Props {
  data: MonthlyDetail[]
}

type SortKey = "mes" | "ingresos" | "egresos" | "saldo" | "acumulado"

export function MonthlyDetailTable({ data }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("mes")
  const [sortAsc, setSortAsc] = useState(true)

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(key === "mes") }
  }

  const sorted = [...data].sort((a, b) => {
    let cmp = 0
    if (sortKey === "mes") cmp = a.periodo.localeCompare(b.periodo)
    else cmp = a[sortKey] - b[sortKey]
    return sortAsc ? cmp : -cmp
  })

  if (data.length === 0) {
    return (
      <Card className="border border-border shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">Detalle por mes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
            No hay datos para los filtros seleccionados
          </div>
        </CardContent>
      </Card>
    )
  }

  const headers: { key: SortKey; label: string; align: string }[] = [
    { key: "mes", label: "Mes", align: "text-left" },
    { key: "ingresos", label: "Ingresos", align: "text-right" },
    { key: "egresos", label: "Egresos", align: "text-right" },
    { key: "saldo", label: "Saldo", align: "text-right" },
    { key: "acumulado", label: "Acumulado", align: "text-right" },
  ]

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold text-foreground italic">Detalle por mes</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {headers.map((h) => (
                  <th
                    key={h.key}
                    className={`${h.align} text-xs text-foreground font-semibold p-3 cursor-pointer hover:bg-muted/50 transition-colors select-none whitespace-nowrap`}
                    onClick={() => toggleSort(h.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {h.label}
                      <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => (
                <tr key={row.periodo} className={`border-b border-border/50 hover:bg-[#7c3aed]/5 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                  <td className="p-3 text-sm text-foreground font-semibold bg-[#7c3aed]/10 text-[#5b21b6]">{row.mes}</td>
                  <td className="p-3 text-sm font-mono text-right font-medium">
                    {formatARS(row.ingresos)}
                  </td>
                  <td className="p-3 text-sm font-mono text-right font-medium text-muted-foreground">
                    {formatARS(row.egresos)}
                  </td>
                  <td
                    className="p-3 text-sm font-mono text-right font-bold"
                    style={{ color: row.saldo >= 0 ? "#059669" : "#dc2626" }}
                  >
                    {formatARS(row.saldo)}
                  </td>
                  <td
                    className="p-3 text-sm font-mono text-right font-bold"
                    style={{ color: "#7c3aed" }}
                  >
                    {formatARS(row.acumulado)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
