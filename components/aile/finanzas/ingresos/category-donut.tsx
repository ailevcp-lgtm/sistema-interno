"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip } from "recharts"
import type { CategorySummaryRow } from "@/lib/types"

const COLORS_INGRESO = ["#7c3aed", "#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe", "#ede9fe", "#5b21b6"] // Purple scale
const COLORS_EGRESO = ["#ef4444", "#f87171", "#fca5a5", "#fecaca", "#fee2e2", "#fef2f2", "#991b1b"] // Red scale

interface Props {
  data: CategorySummaryRow[]
  tipo: "ingreso" | "egreso"
}

export function CategoryDonutChart({ data, tipo }: Props) {
  const colors = tipo === "ingreso" ? COLORS_INGRESO : COLORS_EGRESO
  const label = tipo === "ingreso" ? "Ingresos" : "Egresos"

  if (data.length === 0) {
    return (
      <Card className="border border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold text-foreground italic">Distribución - {label}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
            No hay datos para los filtros seleccionados
          </div>
        </CardContent>
      </Card>
    )
  }

  const chartData = data.map((d, i) => ({
    name: d.categoria,
    value: d.porcentaje,
    color: colors[i % colors.length],
  }))

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold text-foreground italic">Distribución - {label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 h-[250px]">
          <div className="h-full aspect-square shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <ReTooltip
                  formatter={(value: number) => `${value.toFixed(1)}%`}
                  contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-2 min-w-0 flex-1 overflow-y-auto max-h-[240px] pr-2 custom-scrollbar">
            {chartData.map((cat) => (
              <div key={cat.name} className="flex items-center justify-between gap-2 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="text-muted-foreground truncate" title={cat.name}>{cat.name}</span>
                </div>
                <span className="font-semibold text-foreground shrink-0">{cat.value.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
