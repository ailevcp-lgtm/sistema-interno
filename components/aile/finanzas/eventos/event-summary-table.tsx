"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatARS } from "@/lib/utils"
import type { EventSummary } from "@/lib/types"

interface Props {
  data: EventSummary[]
}

export function EventSummaryTable({ data }: Props) {
  if (data.length === 0) {
    return (
      <Card className="border border-border shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">Resumen por evento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
            No hay datos de eventos para los filtros seleccionados
          </div>
        </CardContent>
      </Card>
    )
  }

  const totals = data.reduce(
    (acc, d) => ({ ingresos: acc.ingresos + d.ingresos, egresos: acc.egresos + d.egresos, saldo: acc.saldo + d.saldo }),
    { ingresos: 0, egresos: 0, saldo: 0 }
  )

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold text-foreground italic">Resumen por evento</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left text-xs text-foreground font-semibold p-3">Evento</th>
                <th className="text-right text-xs text-foreground font-semibold p-3">Ingresos</th>
                <th className="text-right text-xs text-foreground font-semibold p-3">Egresos</th>
                <th className="text-right text-xs text-foreground font-semibold p-3">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={row.eventoId} className={`border-b border-border/50 hover:bg-muted/50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                  <td className="p-3 text-sm text-foreground font-medium">{row.evento}</td>
                  <td className="p-3 text-sm font-mono text-right text-muted-foreground">
                    {formatARS(row.ingresos)}
                  </td>
                  <td className="p-3 text-sm font-mono text-right text-muted-foreground">
                    {formatARS(row.egresos)}
                  </td>
                  <td
                    className="p-3 text-sm font-mono text-right font-bold"
                    style={{ color: row.saldo >= 0 ? "#059669" : "#dc2626" }}
                  >
                    {row.saldo >= 0 ? "+" : ""}{formatARS(row.saldo)}
                  </td>
                </tr>
              ))}
              <tr className="bg-muted/20 font-bold">
                <td className="p-3 text-sm text-foreground">Total</td>
                <td className="p-3 text-sm font-mono text-right" style={{ color: "#059669" }}>
                  {formatARS(totals.ingresos)}
                </td>
                <td className="p-3 text-sm font-mono text-right" style={{ color: "#dc2626" }}>
                  {formatARS(totals.egresos)}
                </td>
                <td
                  className="p-3 text-sm font-mono text-right font-bold"
                  style={{ color: totals.saldo >= 0 ? "#059669" : "#dc2626" }}
                >
                  {totals.saldo >= 0 ? "+" : ""}{formatARS(totals.saldo)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
