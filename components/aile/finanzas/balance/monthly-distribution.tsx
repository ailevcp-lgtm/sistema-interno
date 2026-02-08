"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  Tooltip as ReTooltip,
} from "recharts"
import { ChartContainer } from "@/components/ui/chart"
import { formatARS } from "@/lib/utils"
import type { MonthlyDetail } from "@/lib/types"

interface Props {
  data: MonthlyDetail[]
}

export function MonthlyDistributionChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <Card className="border border-border shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">Distribución mensual del capital</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
            No hay datos para los filtros seleccionados
          </div>
        </CardContent>
      </Card>
    )
  }

  const MESES_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

  const chartData = data.map((d) => ({
    name: `${MESES_SHORT[d.mesNum - 1]}`, // Just month name for cleaner look
    ingresos: d.ingresos,
    egresos: d.egresos,
    saldo: d.saldo,
    acumulado: d.acumulado,
  }))

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold text-foreground italic">Distribución mensual del capital</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{
            ingresos: { label: "Ingresos", color: "#7c3aed" }, // Violet-600
            egresos: { label: "Egresos", color: "#9ca3af" }, // Gray-400
            saldo: { label: "Saldo", color: "#059669" },
            acumulado: { label: "Acumulado", color: "#4c1d95" }, // Violet-900 or Dark Purple
          }}
          className="h-[350px] w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={false} tickLine={false} dy={10} />
              <YAxis
                yAxisId="left"
                tick={{ fill: "#6b7280", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => {
                  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
                  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}k`
                  return `$${v}`
                }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: "#6b7280", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => {
                  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
                  return `$${v}`
                }}
              />
              <ReTooltip
                formatter={(value: number, name: string) => [formatARS(value), name.charAt(0).toUpperCase() + name.slice(1)]}
                contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                cursor={{ fill: "#f3f4f6" }}
              />
              <Legend iconType="circle" wrapperStyle={{ paddingTop: "20px" }} />

              <Bar yAxisId="left" dataKey="ingresos" name="Ingresos" fill="#7c3aed" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar yAxisId="left" dataKey="egresos" name="Egresos" fill="#9ca3af" radius={[4, 4, 0, 0]} maxBarSize={40} />

              {/* Acumulado as Line on right axis */}
              <Line yAxisId="right" type="monotone" dataKey="acumulado" name="Acumulado" stroke="#4c1d95" strokeWidth={3} dot={{ fill: "#4c1d95", r: 4 }} />

            </ComposedChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
