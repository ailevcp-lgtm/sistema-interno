"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatARS } from "@/lib/utils"
import type { CategorySummaryRow } from "@/lib/types"

interface Props {
  data: CategorySummaryRow[]
  label: string
}

export function CategorySummaryTable({ data, label }: Props) {
  if (data.length === 0) {
    return (
      <Card className="border border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold text-foreground italic">Resumen por categoría - {label}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
            No hay datos para los filtros seleccionados
          </div>
        </CardContent>
      </Card>
    )
  }

  const total = data.reduce((sum, d) => sum + d.total, 0)

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold text-foreground italic">Resumen por categoría - {label}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto max-h-[250px] custom-scrollbar">
          <table className="w-full">
            <thead className="sticky top-0 bg-background z-10">
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left text-xs text-foreground font-semibold p-3">Categoría</th>
                <th className="text-right text-xs text-foreground font-semibold p-3">Total</th>
                <th className="text-right text-xs text-foreground font-semibold p-3">%</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={row.categoriaId} className={`border-b border-border/50 hover:bg-muted/50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                  <td className="p-3 text-sm text-foreground font-medium">{row.categoria}</td>
                  <td className="p-3 text-sm font-mono text-right font-medium">{formatARS(row.total)}</td>
                  <td className="p-3 text-sm font-mono text-right text-muted-foreground">{row.porcentaje.toFixed(1)}%</td>
                </tr>
              ))}
              <tr className="bg-muted/20 font-bold sticky bottom-0">
                <td className="p-3 text-sm text-foreground">Total</td>
                <td className="p-3 text-sm font-mono text-right text-primary">{formatARS(total)}</td>
                <td className="p-3 text-sm font-mono text-right">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
