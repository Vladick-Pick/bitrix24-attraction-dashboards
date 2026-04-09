import type {
  MetaResponse,
  SourceBreakdownEntry,
  TimelineBucket,
  TimelineGranularity,
} from '@/lib/dashboard-types'

import { formatShortDate } from '@/lib/formatters'

function startOfWeek(date: Date) {
  const clone = new Date(date)
  const weekday = clone.getDay()
  const offset = weekday === 0 ? 6 : weekday - 1
  clone.setDate(clone.getDate() - offset)
  clone.setHours(0, 0, 0, 0)
  return clone
}

export function aggregateTimeline(
  timeline: Array<{ date: string; salesCount: number; salesAmount: number }>,
  granularity: TimelineGranularity,
): TimelineBucket[] {
  if (granularity === 'daily') {
    return timeline.map((point) => ({
      bucket: point.date,
      label: formatShortDate(point.date),
      salesCount: point.salesCount,
      salesAmount: point.salesAmount,
    }))
  }

  const grouped = new Map<string, TimelineBucket>()

  for (const point of timeline) {
    const bucketDate = startOfWeek(new Date(point.date))
    const bucketKey = bucketDate.toISOString().slice(0, 10)
    const existing = grouped.get(bucketKey) ?? {
      bucket: bucketKey,
      label: `Week of ${formatShortDate(bucketKey)}`,
      salesCount: 0,
      salesAmount: 0,
    }

    existing.salesCount += point.salesCount
    existing.salesAmount += point.salesAmount
    grouped.set(bucketKey, existing)
  }

  return Array.from(grouped.values()).sort((left, right) =>
    left.bucket.localeCompare(right.bucket),
  )
}

export function filterSourceBreakdown(
  rows: SourceBreakdownEntry[],
  query: string,
) {
  const normalized = query.trim().toLowerCase()

  if (!normalized) {
    return rows
  }

  return rows.filter((row) =>
    `${row.sourceLabel} ${row.sourceKey}`.toLowerCase().includes(normalized),
  )
}

export function getWonStageLabels(meta: MetaResponse | null) {
  if (!meta) {
    return []
  }

  return meta.wonStageIds.map((stageId) => {
    const entry = meta.stageCatalog.find((item) => item.statusId === stageId)
    return entry?.name ?? stageId
  })
}

export function getTopSource(rows: SourceBreakdownEntry[]) {
  return [...rows].sort((left, right) => right.salesAmount - left.salesAmount)[0]
}
