import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Calendar03Icon, RefreshIcon } from '@hugeicons/core-free-icons'

import type { PeriodDays, ReportPreset } from '@/lib/dashboard-types'
import { PERIOD_OPTIONS } from '@/lib/dashboard-types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldTitle,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

const COMPARISON_OPTIONS = [
  { value: 'prev-7', label: '-7д' },
  { value: 'prev-30', label: '-30д' },
  { value: 'prev-90', label: '-90д' },
  { value: 'prev-180', label: '-180д' },
  { value: 'yoy', label: 'Год к году' },
] as const

export type ComparisonWindow = (typeof COMPARISON_OPTIONS)[number]['value']

function formatCompactDate(value: string) {
  if (!value) {
    return 'Date not set'
  }

  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
  }).format(parsed)
}

function summarizeComparison(values: ComparisonWindow[]) {
  if (values.length === 0) {
    return 'Без сравнения'
  }

  return values
    .map((value) => COMPARISON_OPTIONS.find((option) => option.value === value)?.label)
    .filter(Boolean)
    .join(', ')
}

interface ReportFiltersProps {
  activePreset: ReportPreset
  connectionMode: 'live' | 'preview'
  customFrom: string
  customTo: string
  defaultPeriodDays: number
  isCustomRangeValid: boolean
  isRefreshing: boolean
  lastStampLabel: string
  lastSyncLabel: string
  onApplyCustomRange: () => void
  onCustomFromChange: (next: string) => void
  onCustomToChange: (next: string) => void
  onPresetChange: (next: ReportPreset | PeriodDays) => void
  onRefresh: () => void
  comparisonWindows: ComparisonWindow[]
  syncModeLabel: string
  wonStagesLabel: string
  onComparisonWindowsChange: (next: ComparisonWindow[]) => void
}

export function ReportFilters({
  activePreset,
  connectionMode,
  customFrom,
  customTo,
  defaultPeriodDays,
  isCustomRangeValid,
  isRefreshing,
  lastStampLabel,
  lastSyncLabel,
  onApplyCustomRange,
  onCustomFromChange,
  onCustomToChange,
  onPresetChange,
  onRefresh,
  comparisonWindows,
  syncModeLabel,
  wonStagesLabel,
  onComparisonWindowsChange,
}: ReportFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const windowSummary =
    activePreset === 'custom'
      ? `${formatCompactDate(customFrom)} - ${formatCompactDate(customTo)}`
      : `${activePreset} дней`

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className="desk-card">
        <CardHeader className="gap-5">
          <div className="desk-header">
            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="secondary">Bitrix24 local reporting deck</Badge>
                <Badge variant={connectionMode === 'live' ? 'default' : 'outline'}>
                  {connectionMode === 'live' ? 'Live local API' : 'Preview mode'}
                </Badge>
              </div>

              <div className="flex flex-col gap-2">
                <h1 className="operations-title">Операционный стол Привлечения</h1>
                <CardDescription className="max-w-3xl text-sm leading-6">
                  Продажи смотрим по закрытым сделкам, а контекст по каждой сделке
                  раскрывается прямо в отчете.
                </CardDescription>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={onRefresh}
                disabled={isRefreshing}
              >
                <HugeiconsIcon
                  data-icon="inline-start"
                  icon={RefreshIcon}
                  strokeWidth={1.8}
                  className={isRefreshing ? 'animate-spin' : undefined}
                />
                {isRefreshing ? 'Refreshing' : 'Refresh'}
              </Button>

              <CollapsibleTrigger asChild>
                <Button size="sm" variant="secondary">
                  {isExpanded ? 'Свернуть фильтры' : 'Развернуть фильтры'}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>

          <div className="desk-summary-grid">
            <div className="desk-summary-card">
              <span className="desk-summary-label">Отчет</span>
              <strong className="desk-summary-value">Продажи</strong>
              <span className="desk-summary-meta">Выигранные сделки по менеджерам</span>
            </div>

            <div className="desk-summary-card">
              <span className="desk-summary-label">Основной диапазон</span>
              <strong className="desk-summary-value">{windowSummary}</strong>
              <span className="desk-summary-meta">
                Default: {defaultPeriodDays} days
              </span>
            </div>

            <div className="desk-summary-card">
              <span className="desk-summary-label">Сравнение</span>
              <strong className="desk-summary-value">
                {summarizeComparison(comparisonWindows)}
              </strong>
              <span className="desk-summary-meta">До 5 сравнительных окон</span>
            </div>

            <div className="desk-summary-card">
              <span className="desk-summary-label">Синк</span>
              <strong className="desk-summary-value">{lastSyncLabel}</strong>
              <span className="desk-summary-meta">
                {syncModeLabel} · {lastStampLabel}
              </span>
            </div>

            <div className="desk-summary-card">
              <span className="desk-summary-label">Won stages</span>
              <strong className="desk-summary-value">{wonStagesLabel}</strong>
              <span className="desk-summary-meta">Источник закрытых продаж</span>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent className="data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0">
          <CardContent className="border-t border-border/70 pt-6">
            <FieldGroup className="gap-5">
              <Field className="min-w-0">
                <FieldContent>
                  <FieldTitle className="eyebrow">
                    <HugeiconsIcon
                      icon={Calendar03Icon}
                      strokeWidth={1.9}
                      className="size-4 text-primary"
                    />
                    Reporting window
                  </FieldTitle>
                  <FieldDescription>
                    Период закрытия продаж. Когорта считается от месяца создания
                    каждой сделки.
                  </FieldDescription>
                </FieldContent>
                <ToggleGroup
                  type="single"
                  value={String(activePreset)}
                  onValueChange={(value) => {
                    if (!value) {
                      return
                    }

                    if (value === 'custom') {
                      onPresetChange('custom')
                      return
                    }

                    onPresetChange(Number(value) as PeriodDays)
                  }}
                  spacing={1}
                  size="sm"
                  variant="outline"
                  aria-label="Select report period"
                  className="flex-wrap"
                >
                  {PERIOD_OPTIONS.map((option) => (
                    <ToggleGroupItem key={option} value={String(option)}>
                      {option}d
                    </ToggleGroupItem>
                  ))}
                  <ToggleGroupItem value="custom">Custom</ToggleGroupItem>
                </ToggleGroup>
              </Field>

              {activePreset === 'custom' ? (
                <div className="grid gap-4 xl:grid-cols-[1fr_1fr_auto]">
                  <Field className="min-w-0">
                    <FieldContent>
                      <FieldTitle>From date</FieldTitle>
                      <FieldDescription>Start of the report window.</FieldDescription>
                    </FieldContent>
                    <Input
                      type="date"
                      value={customFrom}
                      onChange={(event) => onCustomFromChange(event.target.value)}
                      aria-label="From date"
                    />
                  </Field>

                  <Field className="min-w-0">
                    <FieldContent>
                      <FieldTitle>To date</FieldTitle>
                      <FieldDescription>End of the report window.</FieldDescription>
                    </FieldContent>
                    <Input
                      type="date"
                      value={customTo}
                      onChange={(event) => onCustomToChange(event.target.value)}
                      aria-label="To date"
                    />
                  </Field>

                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      className="w-full xl:w-auto"
                      onClick={onApplyCustomRange}
                      disabled={!isCustomRangeValid}
                    >
                      Apply range
                    </Button>
                  </div>
                </div>
              ) : null}

              <Field className="min-w-0">
                <FieldContent>
                  <FieldTitle className="eyebrow">Диапазоны сравнения</FieldTitle>
                  <FieldDescription>
                    Пока KPI остаются сверху; сравнительные окна сохраняем для
                    следующего прохода по KPI.
                  </FieldDescription>
                </FieldContent>
                <ToggleGroup
                  type="multiple"
                  value={comparisonWindows}
                  onValueChange={(value) => {
                    if (value.length <= 5) {
                      onComparisonWindowsChange(value as ComparisonWindow[])
                    }
                  }}
                  spacing={1}
                  size="sm"
                  variant="outline"
                  aria-label="Select comparison windows"
                  className="flex-wrap"
                >
                  {COMPARISON_OPTIONS.map((option) => (
                    <ToggleGroupItem key={option.value} value={option.value}>
                      {option.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </Field>
            </FieldGroup>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
