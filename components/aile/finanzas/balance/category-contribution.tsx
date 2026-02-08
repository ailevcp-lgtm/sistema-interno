"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, Tooltip as ReTooltip } from "recharts"
import { ChartContainer } from "@/components/ui/chart"
import { formatARS } from "@/lib/utils"
import type { CategoryContribution } from "@/lib/types"

interface Props {
  data: CategoryContribution[]
}

export function CategoryContributionChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <Card className="border border-border shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">Aporte por categoría</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
            No hay datos para los filtros seleccionados
          </div>
        </CardContent>
      </Card>
    )
  }

  const chartData = data.map((d) => ({
    name: d.categoria,
    balance: d.balance,
  }))

  return (
    <Card className="border border-border shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold text-foreground italic">Aporte por categoría</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{ balance: { label: "Balance", color: "#7c3aed" } }}
          className="h-[350px] w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
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
                width={100}
                interval={0}
              />
              <ReTooltip
                formatter={(value: number) => [formatARS(value), "Balance"]}
                contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                cursor={{ fill: "#f3f4f6" }}
              />
              <Bar dataKey="balance" radius={[0, 4, 4, 0]} maxBarSize={32}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.balance >= 0 ? "#7c3aed" : "#9ca3af"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
