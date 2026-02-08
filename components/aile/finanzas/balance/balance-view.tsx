"use client"

import { KpiCards } from "./kpi-cards"
import { CategoryContributionChart } from "./category-contribution"
import { MonthlyDetailTable } from "./monthly-detail-table"
import { MonthlyDistributionChart } from "./monthly-distribution"
import type { FinanceSummary, CategoryContribution, MonthlyDetail } from "@/lib/types"

interface Props {
  summary: FinanceSummary
  categoryContribution: CategoryContribution[]
  monthlyDetail: MonthlyDetail[]
}

export function BalanceView({ summary, categoryContribution, monthlyDetail }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <KpiCards summary={summary} />

      <div className="grid lg:grid-cols-2 gap-4">
        <CategoryContributionChart data={categoryContribution} />
        <MonthlyDetailTable data={monthlyDetail} />
      </div>

      <MonthlyDistributionChart data={monthlyDetail} />
    </div>
  )
}
