import { HugeiconsIcon } from '@hugeicons/react'
import { AiSearch02Icon, SourceCodeCircleIcon } from '@hugeicons/core-free-icons'

import type { SourceBreakdownEntry } from '@/lib/dashboard-types'
import { formatAmount, formatInteger } from '@/lib/formatters'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface SourceBreakdownCardProps {
  rows: SourceBreakdownEntry[]
  query: string
}

export function SourceBreakdownCard({
  rows,
  query,
}: SourceBreakdownCardProps) {
  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-2">
            <CardTitle>Source breakdown</CardTitle>
            <CardDescription>
              Revenue and pipeline pressure by source and UTM family.
            </CardDescription>
          </div>
          <Badge variant="outline">
            <HugeiconsIcon data-icon="inline-start" icon={SourceCodeCircleIcon} strokeWidth={1.8} />
            {rows.length} visible rows
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <Alert>
            <HugeiconsIcon icon={AiSearch02Icon} strokeWidth={1.8} />
            <AlertTitle>No sources match this filter</AlertTitle>
            <AlertDescription>
              Nothing matched <strong>{query}</strong>. Try a broader term or clear the
              source focus field.
            </AlertDescription>
          </Alert>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">New deals</TableHead>
                <TableHead className="text-right">New leads</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.sourceKey}>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-foreground">{row.sourceLabel}</span>
                      <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {row.sourceKey}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{formatInteger(row.salesCount)}</TableCell>
                  <TableCell className="text-right">{formatAmount(row.salesAmount)}</TableCell>
                  <TableCell className="text-right">{formatInteger(row.newDealsCount)}</TableCell>
                  <TableCell className="text-right">{formatInteger(row.newLeadsCount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
