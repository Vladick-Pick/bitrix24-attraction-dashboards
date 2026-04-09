import { HugeiconsIcon } from '@hugeicons/react'
import {
  AnalyticsUpIcon,
  ChartHistogramIcon,
  CursorMagicSelection02Icon,
  SaleTag02Icon,
} from '@hugeicons/core-free-icons'

import type { DashboardData } from '@/lib/dashboard-types'
import { formatAmount, formatInteger, formatPercent } from '@/lib/formatters'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface KpiGridProps {
  dashboard: DashboardData
}

const KPI_ITEMS = [
  {
    key: 'salesCount',
    label: 'Closed sales',
    hint: 'Deals that reached your won-stage mapping.',
    icon: SaleTag02Icon,
    format: formatInteger,
  },
  {
    key: 'salesAmount',
    label: 'Sales value',
    hint: 'Rendered without FX normalization inside the shell.',
    icon: AnalyticsUpIcon,
    format: formatAmount,
  },
  {
    key: 'newDealsCount',
    label: 'New deals',
    hint: 'Fresh inflow in the selected period window.',
    icon: CursorMagicSelection02Icon,
    format: formatInteger,
  },
  {
    key: 'conversionRate',
    label: 'Deal conversion',
    hint: 'Won deals divided by new deals in the same period.',
    icon: ChartHistogramIcon,
    format: (value: number) => `${formatPercent(value)}%`,
  },
] as const

export function KpiGrid({ dashboard }: KpiGridProps) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {KPI_ITEMS.map((item) => (
        <Card key={item.key} className="metric-card">
          <CardHeader className="gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="metric-icon">
                <HugeiconsIcon icon={item.icon} strokeWidth={1.8} />
              </div>
              <div className="eyebrow text-right">KPI</div>
            </div>
            <div className="flex flex-col gap-2">
              <CardTitle>{item.label}</CardTitle>
              <CardDescription>{item.hint}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex items-end justify-between gap-4">
            <div className="spotlight-number">
              {item.format(dashboard.salesOverview[item.key])}
            </div>
            <div className="metric-caption">
              {item.key === 'conversionRate'
                ? `${dashboard.salesOverview.salesCount} won / ${dashboard.salesOverview.newDealsCount} new`
                : 'Local snapshot'}
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  )
}
