"use client"

import { Wallet, ArrowUpRight, ArrowDownRight, TrendingUp } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { formatARS } from "@/lib/utils"
import type { FinanceSummary } from "@/lib/types"

interface KpiCardsProps {
  summary: FinanceSummary
}

const kpis = [
  {
    key: "balance" as const,
    label: "Balance",
    icon: Wallet,
    iconBg: "#ede5f7",
    iconColor: "#6314a7",
    format: (s: FinanceSummary) => formatARS(s.balance),
    colorFn: (s: FinanceSummary) => (s.balance >= 0 ? "#059669" : "#dc2626"),
  },
  {
    key: "ingresos" as const,
    label: "Ingresos",
    icon: ArrowUpRight,
    iconBg: "#ecfdf5",
    iconColor: "#059669",
    format: (s: FinanceSummary) => formatARS(s.ingresos),
    colorFn: () => "#059669",
  },
  {
    key: "egresos" as const,
    label: "Egresos",
    icon: ArrowDownRight,
    iconBg: "#fef2f2",
    iconColor: "#dc2626",
    format: (s: FinanceSummary) => formatARS(s.egresos),
    colorFn: () => "#dc2626",
  },
  {
    key: "ganancia" as const,
    label: "Ganancia %",
    icon: TrendingUp,
    iconBg: "#ede5f7",
    iconColor: "#6314a7",
    format: (s: FinanceSummary) => `${s.gananciaPorcentual >= 0 ? "+" : ""}${s.gananciaPorcentual.toFixed(1)}%`,
    colorFn: (s: FinanceSummary) => (s.gananciaPorcentual >= 0 ? "#059669" : "#dc2626"),
  },
]

export function KpiCards({ summary }: KpiCardsProps) {
  const cards = [
    {
      key: "balance",
      label: "Balance",
      value: summary.balance,
      format: formatARS,
      className: "bg-[#7c3aed] text-white border-none", // Violet-600
      iconClassName: "text-white bg-white/20",
      labelClassName: "text-white/80",
      valueClassName: "text-white",
    },
    {
      key: "ingresos",
      label: "Ingresos",
      value: summary.ingresos,
      format: formatARS,
      className: "bg-white border-border",
      iconClassName: "text-[#10b981] bg-[#10b981]/10", // Emerald
      labelClassName: "text-muted-foreground",
      valueClassName: "text-foreground",
    },
    {
      key: "egresos",
      label: "Egresos",
      value: summary.egresos,
      format: formatARS,
      className: "bg-white border-border",
      iconClassName: "text-[#ef4444] bg-[#ef4444]/10", // Red
      labelClassName: "text-muted-foreground",
      valueClassName: "text-foreground",
    },
    {
      key: "ganancia",
      label: "Ganancia Porcentual",
      value: summary.gananciaPorcentual,
      format: (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)} %`,
      className: "bg-white border-border",
      iconClassName: "text-foreground bg-secondary",
      labelClassName: "text-muted-foreground",
      valueClassName: "text-foreground",
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.key} className={`shadow-sm ${card.className}`}>
          <CardContent className="p-6 flex flex-col justify-between h-full min-h-[140px]">
            <div>
              <p className={`text-2xl lg:text-3xl font-bold mb-1 ${card.valueClassName}`}>
                {card.format(card.value)}
              </p>
              <p className={`text-sm font-medium ${card.labelClassName}`}>{card.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
