import { HugeiconsIcon } from '@hugeicons/react'
import {
  AiSearch02Icon,
  Calendar03Icon,
  RefreshIcon,
} from '@hugeicons/core-free-icons'

import type { PeriodDays } from '@/lib/dashboard-types'
import { PERIOD_OPTIONS } from '@/lib/dashboard-types'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldTitle,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

interface ReportFiltersProps {
  isRefreshing: boolean
  onRefresh: () => void
  periodDays: PeriodDays
  onPeriodChange: (next: PeriodDays) => void
  sourceQuery: string
  onSourceQueryChange: (next: string) => void
}

export function ReportFilters({
  isRefreshing,
  onRefresh,
  periodDays,
  onPeriodChange,
  sourceQuery,
  onSourceQueryChange,
}: ReportFiltersProps) {
  return (
    <FieldGroup className="rounded-[2rem] border border-border/70 bg-card/80 p-5 shadow-[0_24px_60px_-48px_rgba(31,38,47,0.45)] backdrop-blur">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <Field orientation="responsive" className="min-w-0">
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
              Switch the local dashboard slice without changing backend storage.
            </FieldDescription>
          </FieldContent>
          <ToggleGroup
            type="single"
            value={String(periodDays)}
            onValueChange={(value) => {
              if (!value) {
                return
              }

              onPeriodChange(Number(value) as PeriodDays)
            }}
            spacing={1}
            variant="outline"
            aria-label="Select report period"
          >
            {PERIOD_OPTIONS.map((option) => (
              <ToggleGroupItem key={option} value={String(option)}>
                {option}d
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>

        <Field orientation="responsive" className="min-w-0 lg:max-w-md">
          <FieldContent>
            <FieldTitle className="eyebrow">
              <HugeiconsIcon
                icon={AiSearch02Icon}
                strokeWidth={1.9}
                className="size-4 text-primary"
              />
              Source focus
            </FieldTitle>
            <FieldDescription>
              Client-side filter for the attribution table only.
            </FieldDescription>
          </FieldContent>
          <Input
            value={sourceQuery}
            onChange={(event) => onSourceQueryChange(event.target.value)}
            placeholder="Search paid search, webinar, partner..."
            aria-label="Search sources"
          />
        </Field>

        <Button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="w-full lg:w-auto"
        >
          <HugeiconsIcon
            data-icon="inline-start"
            icon={RefreshIcon}
            strokeWidth={1.8}
            className={isRefreshing ? 'animate-spin' : undefined}
          />
          {isRefreshing ? 'Refreshing snapshot' : 'Refresh snapshot'}
        </Button>
      </div>
    </FieldGroup>
  )
}
