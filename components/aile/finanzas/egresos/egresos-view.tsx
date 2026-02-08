"use client"

import { Card, CardContent } from "@/components/ui/card"
import { ArrowDownRight } from "lucide-react"
import { formatARS } from "@/lib/utils"
import { CategorySummaryTable } from "../ingresos/category-summary"
import { CategoryDonutChart } from "../ingresos/category-donut"
import { EventComparisonChart } from "../ingresos/event-comparison"
import { TransactionDetailTable } from "../ingresos/transaction-detail"
import type { CategorySummaryRow, EventSummary, TransactionRow } from "@/lib/types"

interface Props {
  total: number
  categorySummary: CategorySummaryRow[]
  eventComparison: EventSummary[]
  transactionDetail: TransactionRow[]
}

export function EgresosView({ total, categorySummary, eventComparison, transactionDetail }: Props) {
  return (
    <div className="flex flex-col gap-4">
      {/* KPI */}
      <Card className="border border-border shadow-none">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Egresos</p>
              <p className="text-2xl font-bold mt-1" style={{ color: "#dc2626" }}>{formatARS(total)}</p>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#fef2f2" }}>
              <ArrowDownRight className="w-[18px] h-[18px]" style={{ color: "#dc2626" }} strokeWidth={1.8} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <CategorySummaryTable data={categorySummary} label="Egresos" />
        <CategoryDonutChart data={categorySummary} tipo="egreso" />
      </div>

      <EventComparisonChart data={eventComparison} tipo="egreso" />

      <TransactionDetailTable data={transactionDetail} label="Egresos" />
    </div>
  )
}
