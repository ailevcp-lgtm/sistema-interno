"use client"

import { useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowUpRight } from "lucide-react"
import { formatARS } from "@/lib/utils"
import { CategorySummaryTable } from "./category-summary"
import { CategoryDonutChart } from "./category-donut"
import { EventComparisonChart } from "./event-comparison"
import { TransactionDetailTable } from "./transaction-detail"
import type { CategorySummaryRow, EventSummary, TransactionRow } from "@/lib/types"

interface Props {
  total: number
  categorySummary: CategorySummaryRow[]
  eventComparison: EventSummary[]
  transactionDetail: TransactionRow[]
}

export function IngresosView({ total, categorySummary, eventComparison, transactionDetail }: Props) {
  return (
    <div className="flex flex-col gap-4">
      {/* KPI */}
      <Card className="border border-border shadow-none">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Ingresos</p>
              <p className="text-2xl font-bold mt-1" style={{ color: "#059669" }}>{formatARS(total)}</p>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#ecfdf5" }}>
              <ArrowUpRight className="w-[18px] h-[18px]" style={{ color: "#059669" }} strokeWidth={1.8} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <CategorySummaryTable data={categorySummary} label="Ingresos" />
        <CategoryDonutChart data={categorySummary} tipo="ingreso" />
      </div>

      <EventComparisonChart data={eventComparison} tipo="ingreso" />

      <TransactionDetailTable data={transactionDetail} label="Ingresos" />
    </div>
  )
}
