"use client"

import { EventBalanceChart } from "./event-balance-chart"
import { EventSummaryTable } from "./event-summary-table"
import type { EventSummary } from "@/lib/types"

interface Props {
  data: EventSummary[]
}

export function EventosView({ data }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <EventBalanceChart data={data} />
      <EventSummaryTable data={data} />
    </div>
  )
}
