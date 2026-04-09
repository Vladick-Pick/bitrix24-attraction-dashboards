import { ComposedChart, Area, Bar, CartesianGrid, XAxis, YAxis } from 'recharts'

import type { TimelineBucket, TimelineGranularity } from '@/lib/dashboard-types'
import { formatAmount, formatInteger } from '@/lib/formatters'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

interface SalesTimelineCardProps {
  granularity: TimelineGranularity
  onGranularityChange: (value: TimelineGranularity) => void
  timeline: TimelineBucket[]
}

const chartConfig = {
  salesAmount: {
    label: 'Sales value',
    color: 'var(--chart-1)',
  },
  salesCount: {
    label: 'Closed deals',
    color: 'var(--chart-3)',
  },
} satisfies ChartConfig

export function SalesTimelineCard({
  granularity,
  onGranularityChange,
  timeline,
}: SalesTimelineCardProps) {
  const totalAmount = timeline.reduce((sum, item) => sum + item.salesAmount, 0)
  const totalCount = timeline.reduce((sum, item) => sum + item.salesCount, 0)

  return (
    <Card className="min-h-[28rem]">
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-2">
            <CardTitle>Sales timeline</CardTitle>
            <CardDescription>
              Close-rate momentum for the current local reporting cut.
            </CardDescription>
          </div>

          <Tabs
            value={granularity}
            onValueChange={(value) => onGranularityChange(value as TimelineGranularity)}
          >
            <TabsList>
              <TabsTrigger value="daily">Daily</TabsTrigger>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
            </TabsList>
            <TabsContent value={granularity} className="hidden" />
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="flex h-full flex-col gap-6">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-[1.5rem] border border-border/70 bg-muted/40 p-4">
            <div className="eyebrow">Window value</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
              {formatAmount(totalAmount)}
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-border/70 bg-muted/40 p-4">
            <div className="eyebrow">Won deals</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
              {formatInteger(totalCount)}
            </div>
          </div>
        </div>

        <ChartContainer config={chartConfig} className="h-[22rem] w-full">
          <ComposedChart accessibilityLayer data={timeline}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              yAxisId="amount"
              axisLine={false}
              tickLine={false}
              tickFormatter={(value: number) => formatAmount(value)}
            />
            <YAxis
              yAxisId="count"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tickFormatter={(value: number) => formatInteger(value)}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  formatter={(value, key) => (
                    <div className="flex min-w-40 items-center justify-between gap-6">
                      <span className="text-muted-foreground">
                        {key === 'salesCount' ? 'Closed deals' : 'Sales value'}
                      </span>
                      <span className="font-medium text-foreground">
                        {key === 'salesCount'
                          ? formatInteger(Number(value))
                          : formatAmount(Number(value))}
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Area
              yAxisId="amount"
              type="monotone"
              dataKey="salesAmount"
              fill="var(--color-salesAmount)"
              fillOpacity={0.18}
              stroke="var(--color-salesAmount)"
              strokeWidth={2.5}
            />
            <Bar
              yAxisId="count"
              dataKey="salesCount"
              fill="var(--color-salesCount)"
              radius={[8, 8, 0, 0]}
              maxBarSize={24}
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
