import { useState } from 'react'

import type { SalesDealRow, SalesManagerGroup } from '@/lib/dashboard-types'
import {
  formatAmount,
  formatInteger,
  formatPercent,
  formatShortDate,
} from '@/lib/formatters'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface SalesReportCardProps {
  groups: SalesManagerGroup[]
}

function formatDays(value: number) {
  return `${formatInteger(value)} д`
}

function formatHours(value: number) {
  return `${formatInteger(value)} ч`
}

function DealDetail({ deal }: { deal: SalesDealRow }) {
  return (
    <div className="mt-4 grid gap-4 border-t border-border/70 pt-4 xl:grid-cols-[0.82fr_1.18fr]">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
          <div className="text-xs font-semibold uppercase text-muted-foreground">
            Когорта {deal.cohortContext.createdMonth}
          </div>
          <div className="mt-2 text-sm text-foreground">
            <strong>{formatInteger(deal.cohortContext.cohortCreatedDeals)}</strong>{' '}
            создано в когорте
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {formatInteger(deal.cohortContext.cohortWonDeals)} выиграно ·{' '}
            {formatPercent(deal.cohortContext.cohortWonConversionRate)}%
          </div>
        </div>

        <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
          <div className="text-xs font-semibold uppercase text-muted-foreground">
            Дела и звонки
          </div>
          <div className="mt-2 text-sm text-foreground">
            <strong>{formatInteger(deal.taskSummary.created)}</strong> создано дел ·{' '}
            {formatInteger(deal.taskSummary.closed)} закрыто
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {formatInteger(deal.callSummary.incoming)} вход. ·{' '}
            {formatInteger(deal.callSummary.outgoing)} исход. ·{' '}
            {formatInteger(deal.callSummary.connectedOverThirtySeconds)} длинных
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border/70 bg-background/70">
        <div className="grid grid-cols-[minmax(0,1fr)_7rem_7rem] gap-3 border-b border-border/70 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
          <span>Этап</span>
          <span>Вход</span>
          <span className="text-right">Время</span>
        </div>
        <div className="divide-y divide-border/60">
          {deal.stageTimeline.length > 0 ? (
            deal.stageTimeline.map((stage) => (
              <div
                key={`${deal.dealId}-${stage.stageId}-${stage.enteredAt}`}
                className="grid grid-cols-[minmax(0,1fr)_7rem_7rem] gap-3 px-3 py-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{stage.stageName}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    до {formatShortDate(stage.leftAt)}
                  </div>
                </div>
                <span className="text-muted-foreground">
                  {formatShortDate(stage.enteredAt)}
                </span>
                <span className="text-right font-semibold">
                  {formatHours(stage.durationHours)}
                </span>
              </div>
            ))
          ) : (
            <div className="px-3 py-4 text-sm text-muted-foreground">
              История этапов пока не подтянута.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function SalesReportCard({ groups }: SalesReportCardProps) {
  const [expandedDeals, setExpandedDeals] = useState<Set<string>>(() => new Set())
  const totalDeals = groups.reduce((total, group) => total + group.totalWonDeals, 0)

  const toggleDeal = (dealId: string) => {
    setExpandedDeals((current) => {
      const next = new Set(current)
      if (next.has(dealId)) {
        next.delete(dealId)
      } else {
        next.add(dealId)
      }
      return next
    })
  }

  return (
    <section aria-labelledby="sales-report-title">
      <Card className="desk-card">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <CardTitle id="sales-report-title" className="operations-title text-2xl">
                Продажи по менеджерам
              </CardTitle>
              <CardDescription>
                Каждая строка - отдельная выигранная сделка с циклом, когортой,
                звонками, делами и историей этапов.
              </CardDescription>
            </div>
            <Badge variant="secondary">{formatInteger(totalDeals)} продаж</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {groups.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              В выбранном периоде нет выигранных сделок.
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.managerId} className="rounded-lg border border-border/80">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-muted/25 px-4 py-3">
                  <div>
                    <h3 className="text-base font-semibold">{group.managerName}</h3>
                    <p className="text-sm text-muted-foreground">
                      {formatInteger(group.totalWonDeals)} продаж ·{' '}
                      {formatAmount(group.totalSalesAmount)}
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-border/70">
                  {group.deals.map((deal) => {
                    const isExpanded = expandedDeals.has(deal.dealId)

                    return (
                      <article key={deal.dealId} className="px-4 py-4">
                        <div className="grid gap-4 xl:grid-cols-[minmax(12rem,1.1fr)_7rem_8rem_9rem_12rem_9rem_auto] xl:items-center">
                          <div className="min-w-0">
                            <h4 className="truncate text-base font-semibold">
                              {deal.dealTitle}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              Закрыта {formatShortDate(deal.dateClosed)} · создана{' '}
                              {formatShortDate(deal.dateCreate)}
                            </p>
                          </div>

                          <div>
                            <div className="text-xs uppercase text-muted-foreground">
                              Сумма
                            </div>
                            <div className="font-semibold">{formatAmount(deal.amount)}</div>
                          </div>

                          <div>
                            <div className="text-xs uppercase text-muted-foreground">
                              Цикл
                            </div>
                            <div className="font-semibold">
                              {formatDays(deal.cycleDays)}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs uppercase text-muted-foreground">
                              Когорта
                            </div>
                            <div className="font-semibold">
                              {deal.cohortContext.createdMonth}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatPercent(
                                deal.cohortContext.cohortWonConversionRate,
                              )}
                              % win
                            </div>
                          </div>

                          <div>
                            <div className="text-xs uppercase text-muted-foreground">
                              Звонки
                            </div>
                            <div className="font-semibold">
                              {formatInteger(deal.callSummary.total)} всего
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatInteger(deal.callSummary.successful)} успешных ·{' '}
                              {formatInteger(deal.callSummary.failed)} провал
                            </div>
                          </div>

                          <div>
                            <div className="text-xs uppercase text-muted-foreground">
                              Дела
                            </div>
                            <div className="font-semibold">
                              {formatInteger(deal.taskSummary.created)} /{' '}
                              {formatInteger(deal.taskSummary.closed)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              создано / закрыто
                            </div>
                          </div>

                          <Button
                            variant={isExpanded ? 'secondary' : 'outline'}
                            onClick={() => toggleDeal(deal.dealId)}
                          >
                            Подробнее
                          </Button>
                        </div>

                        {isExpanded ? <DealDetail deal={deal} /> : null}
                      </article>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </section>
  )
}
