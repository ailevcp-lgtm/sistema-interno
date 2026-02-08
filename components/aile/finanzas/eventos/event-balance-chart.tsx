"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as ReTooltip, Legend } from "recharts"
import { ChartContainer } from "@/components/ui/chart"
import { formatARS } from "@/lib/utils"
import type { EventSummary } from "@/lib/types"

interface Props {
  data: EventSummary[]
}

export function EventBalanceChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <Card className="border border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold text-foreground italic">Balance por evento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
            No hay datos de eventos para los filtros seleccionados
          </div>
        </CardContent>
      </Card>
    )
  }

  const chartData = data.map((d) => ({
    name: d.evento,
    ingresos: d.ingresos,
    egresos: d.egresos,
  }))

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold text-foreground italic">Balance por evento</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{
            ingresos: { label: "Ingresos", color: "#7c3aed" },
            egresos: { label: "Egresos", color: "#ef4444" },
          }}
          className="h-[350px] w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={false} tickLine={false} dy={10} />
              <YAxis
                tick={{ fill: "#6b7280", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => {
                  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
                  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}k`
                  return `$${v}`
                }}
              />
              <ReTooltip
                formatter={(value: number, name: string) => [
                  formatARS(value),
                  name === "ingresos" ? "Ingresos" : "Egresos",
                ]}
                contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                cursor={{ fill: "#f3f4f6" }}
              />
              <Legend iconType="circle" wrapperStyle={{ paddingTop: "20px" }} />
              <Bar dataKey="ingresos" fill="#7c3aed" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar dataKey="egresos" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
