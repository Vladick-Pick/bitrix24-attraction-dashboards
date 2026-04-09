import { HugeiconsIcon } from '@hugeicons/react'
import { ChartUpIcon } from '@hugeicons/core-free-icons'

import type { FunnelSnapshotEntry } from '@/lib/dashboard-types'
import { formatAmount, formatInteger } from '@/lib/formatters'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

interface FunnelSnapshotCardProps {
  funnelSnapshot: FunnelSnapshotEntry[]
}

export function FunnelSnapshotCard({
  funnelSnapshot,
}: FunnelSnapshotCardProps) {
  const rankedStages = [...funnelSnapshot].sort((left, right) => right.count - left.count)
  const maxCount = rankedStages[0]?.count ?? 1

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Funnel snapshot</CardTitle>
            <CardDescription>
              Stage density across the selected reporting window.
            </CardDescription>
          </div>
          <Badge variant="outline">
            <HugeiconsIcon data-icon="inline-start" icon={ChartUpIcon} strokeWidth={1.8} />
            {rankedStages.length} stages
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {rankedStages.map((entry, index) => (
          <div key={entry.stageId} className="flex flex-col gap-3">
            {index > 0 ? <Separator /> : null}
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <div className="font-medium text-foreground">{entry.stageName}</div>
                <div className="text-sm text-muted-foreground">
                  {formatInteger(entry.count)} deals in stage
                </div>
              </div>
              <Badge variant="secondary">{formatAmount(entry.amount)}</Badge>
            </div>
            <div className="funnel-track">
              <div
                className="funnel-fill"
                style={{
                  width: `${Math.max((entry.count / maxCount) * 100, 12)}%`,
                }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
