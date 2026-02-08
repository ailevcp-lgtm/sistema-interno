"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as ReTooltip } from "recharts"
import { ChartContainer } from "@/components/ui/chart"
import { formatARS } from "@/lib/utils"
import type { EventSummary } from "@/lib/types"

interface Props {
  data: EventSummary[]
  tipo: "ingreso" | "egreso"
}

export function EventComparisonChart({ data, tipo }: Props) {
  const label = tipo === "ingreso" ? "Ingresos" : "Egresos"
  const color = tipo === "ingreso" ? "#7c3aed" : "#ef4444" // Violet-600 or Red-500

  if (data.length === 0) {
    return (
      <Card className="border border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold text-foreground italic">Por evento - {label}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
            No hay datos de eventos para los filtros seleccionados
          </div>
        </CardContent>
      </Card>
    )
  }

  const chartData = data.map((d) => ({
    name: d.evento,
    total: tipo === "ingreso" ? d.ingresos : d.egresos,
  }))

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold text-foreground italic">Por evento - {label}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{ total: { label, color } }}
          className="h-[250px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: "#6b7280", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => {
                  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
                  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}k`
                  return `$${v}`
                }}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: "#6b7280", fontSize: 11, fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
                width={120}
                interval={0}
              />
              <ReTooltip
                formatter={(value: number) => [formatARS(value), label]}
                contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                cursor={{ fill: "#f3f4f6" }}
              />
              <Bar dataKey="total" fill={color} radius={[0, 4, 4, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
