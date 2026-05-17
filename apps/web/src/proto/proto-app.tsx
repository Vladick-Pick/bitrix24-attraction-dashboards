import '@/proto/proto.css'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { Notification03Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { apiClient } from '@/lib/api-client'
import type {
  DashboardQuery,
  DealPricingRuleInput,
  LastSyncSummary,
  LeadgenFunnelReport,
  MetaResponse,
  SalesPlanQuarterDraftRow,
  SnapshotStats,
  SyncChangeSummary,
  SyncDealChangeBreakdown,
  SyncProgressEvent,
  SyncSummary,
} from '@/lib/dashboard-types'
import { cn } from '@/lib/utils'
import {
  createDefaultFilters,
  managerOptions,
  scenes,
  sourceOptions,
} from '@/proto/scenes'
import {
  buildDashboardQueryFromProtoFilters,
  mapActivitiesCallsSceneData,
  mapCohortSceneData,
  mapTocFlowSceneData,
} from '@/proto/live-reporting'
import type {
  CompareRange,
  AuthUser,
  CommentNotification,
  ModuleRole,
  ModuleUser,
  PaperclipCommentStatus,
  PaperclipReadyReport,
  PaperclipThreadEntry,
  PickerOption,
  PlatformAccess,
  PlatformMembershipInput,
  PlatformUser,
  ProtoComment,
  ProtoCommentAnchor,
  ProtoCommentContext,
  ProtoFilterState,
  ProtoKpi,
  ProtoRuntimeData,
} from '@/proto/types'
import { useProtoComments } from '@/proto/use-proto-comments'

type CustomDashboardQuery = Extract<DashboardQuery, { preset: 'custom' }>

type ProtoAppProps = {
  currentUser?: AuthUser | null
}

type ProtoRoute = 'dashboard' | 'account'

const notificationLabels: Record<CommentNotification['status'], string> = {
  queued: 'В очереди',
  sent: 'Отправлено',
  in_work: 'В работе',
  needs_input: 'Нужен ответ',
  done: 'На проверку',
  failed: 'Ошибка',
}

const notificationClasses: Record<CommentNotification['status'], string> = {
  queued: 'badge-neutral',
  sent: 'badge-green',
  in_work: 'badge-green',
  needs_input: 'badge-neutral',
  done: 'badge-green',
  failed: 'badge-neutral',
}

const notificationSyncLabels: Record<CommentNotification['paperclipSyncStatus'], string> = {
  queued: 'Ожидает отправки',
  syncing: 'Синхронизация',
  sent: 'Синхронизировано',
  failed: 'Ошибка отправки',
}

const commentNotificationReadStorageKey = 'bitrix24-dashboard.comment-notifications.read.v1'

function getCommentNotificationReadKey(notification: CommentNotification) {
  return [
    notification.id,
    notification.updatedAt,
    notification.status,
    notification.paperclipSyncStatus,
    notification.paperclipError ?? '',
    notification.paperclipReadyReport?.createdAt ?? '',
    notification.paperclipThread?.at(-1)?.updatedAt ?? '',
  ].join('|')
}

function readStoredCommentNotificationKeys() {
  if (typeof window === 'undefined') {
    return new Set<string>()
  }

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(commentNotificationReadStorageKey) ?? '[]',
    ) as unknown
    if (!Array.isArray(parsed)) {
      return new Set<string>()
    }

    return new Set(parsed.filter((item): item is string => typeof item === 'string'))
  } catch {
    return new Set<string>()
  }
}

function writeStoredCommentNotificationKeys(keys: Set<string>) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(
      commentNotificationReadStorageKey,
      JSON.stringify(Array.from(keys)),
    )
  } catch {
    // localStorage may be unavailable in restricted browser modes.
  }
}

function formatUnreadNotificationCount(count: number) {
  const mod10 = count % 10
  const mod100 = count % 100
  const word = mod10 === 1 && mod100 !== 11 ? 'новое' : 'новых'
  return `${count} ${word}`
}

function formatDevelopmentTeamError(value: string) {
  return value.replace(/paperclip/gi, 'команда разработки')
}

function formatReadyReportBody(value: string) {
  return value
    .split('\n')
    .map((line) => line.replace(/^#{1,6}\s+/, '').trimEnd())
    .join('\n')
    .trim()
}

function extractMarkdownSection(value: string, heading: string) {
  const lines = value.split('\n')
  const startIndex = lines.findIndex(
    (line) => line.replace(/^#{1,6}\s+/, '').trim() === heading,
  )
  if (startIndex < 0) {
    return ''
  }

  const sectionLines: string[] = []
  for (const line of lines.slice(startIndex + 1)) {
    if (/^#{1,6}\s+/.test(line) && sectionLines.some((item) => item.trim().length > 0)) {
      break
    }
    sectionLines.push(line)
  }

  return sectionLines.join('\n').trim()
}

function formatThreadEntryBody(entry: PaperclipThreadEntry) {
  const body =
    entry.kind === 'dashboard_rework'
      ? extractMarkdownSection(entry.body, 'Пользовательский комментарий') || entry.body
      : entry.body

  return formatReadyReportBody(body)
}

function getThreadEntryLabel(kind: PaperclipThreadEntry['kind']) {
  switch (kind) {
    case 'dashboard_rework':
      return 'Возврат на доработку'
    case 'development_report':
      return 'Команда разработки'
    case 'board_note':
      return 'Решение пользователя'
    default:
      return 'Системная запись'
  }
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString('ru-RU', { hour12: false })
}

function DevelopmentReadyReport({
  report,
  status,
}: {
  report: PaperclipReadyReport | null | undefined
  status: PaperclipCommentStatus | undefined
}) {
  const reportBody = report?.body.trim() ?? ''

  if (reportBody.length === 0 && status !== 'done') {
    return null
  }

  if (reportBody.length === 0) {
    return (
      <section className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
        <div className="text-xs font-bold uppercase tracking-[0.14em] text-amber-800">
          Отчёт команды разработки не найден
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-800">
          Задача отмечена как готовая к проверке, но команда не приложила мини-отчёт в треде.
          Можно вернуть на доработку и попросить указать, что сделано, причину, новое поведение
          и проверки.
        </p>
      </section>
    )
  }

  const reportCreatedAt = report?.createdAt ?? ''

  return (
    <section className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">
          Отчёт команды разработки
        </div>
        <time className="text-xs font-semibold text-emerald-900/70">
          {formatDateTime(reportCreatedAt)}
        </time>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">
        {formatReadyReportBody(reportBody)}
      </p>
    </section>
  )
}

function DevelopmentThreadHistory({
  thread,
}: {
  thread: PaperclipThreadEntry[] | null | undefined
}) {
  const entries = thread?.filter((entry) => entry.body.trim().length > 0) ?? []

  if (entries.length === 0) {
    return null
  }

  return (
    <section className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
          История команды разработки
        </div>
        <span className="badge-chip badge-neutral">{entries.length}</span>
      </div>
      <div className="mt-3 grid max-h-96 gap-3 overflow-y-auto overscroll-contain pr-1">
        {entries.map((entry) => (
          <article
            key={entry.id}
            className={cn(
              'rounded-xl border px-3 py-3',
              entry.kind === 'dashboard_rework'
                ? 'border-blue-200 bg-blue-50/60'
                : 'border-slate-200 bg-slate-50/70',
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
                {getThreadEntryLabel(entry.kind)}
              </span>
              <time className="text-xs font-semibold text-slate-500">
                {formatDateTime(entry.createdAt)}
              </time>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">
              {formatThreadEntryBody(entry)}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}

function getUserDisplayName(user: AuthUser | null | undefined) {
  if (!user) {
    return ''
  }

  const fullName = [user.firstName, user.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ')

  return fullName || user.login
}

function getUserInitials(user: AuthUser | null | undefined) {
  const displayName = getUserDisplayName(user)
  if (!displayName) {
    return 'ЛК'
  }

  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return initials || 'ЛК'
}

function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes = new Uint32Array(14)

  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * alphabet.length)
    }
  }

  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('')
}

function readProtoRoute(): ProtoRoute {
  if (typeof window === 'undefined') {
    return 'dashboard'
  }

  return window.location.pathname === '/account' ? 'account' : 'dashboard'
}

function writeProtoRoute(route: ProtoRoute) {
  if (typeof window === 'undefined') {
    return
  }

  const nextPath = route === 'account' ? '/account' : '/'
  if (window.location.pathname !== nextPath) {
    window.history.pushState({}, '', nextPath)
  }
}

function formatCount(value: number) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(value))
}

function formatSyncMode(value: 'full' | 'delta' | undefined) {
  return value === 'full' ? 'full' : 'delta'
}

function resolveDealBreakdown(
  changes: Pick<SyncChangeSummary, 'deals'> & {
    dealBreakdown?: Partial<SyncDealChangeBreakdown>
  },
) {
  const breakdown = changes.dealBreakdown ?? {}
  return {
    total: breakdown.total ?? changes.deals,
    created: breakdown.created ?? 0,
    updated: breakdown.updated ?? changes.deals,
    closed: breakdown.closed ?? 0,
    reopened: breakdown.reopened ?? 0,
    unchanged: breakdown.unchanged ?? 0,
  }
}

function formatDealBreakdown(
  changes: Pick<SyncChangeSummary, 'deals'> & {
    dealBreakdown?: Partial<SyncDealChangeBreakdown>
  },
) {
  const breakdown = resolveDealBreakdown(changes)
  const parts = [
    `новых ${formatCount(breakdown.created)}`,
    `обновлено ${formatCount(breakdown.updated)}`,
    `закрыто ${formatCount(breakdown.closed)}`,
    `переоткрыто ${formatCount(breakdown.reopened)}`,
    `без изменений ${formatCount(breakdown.unchanged)}`,
  ]
  return parts.join(' · ')
}

function resolveSyncHealthWarning(meta: Pick<MetaResponse, 'syncHealth'>) {
  return (
    meta.syncHealth?.warnings[0] ??
    (meta.syncHealth?.blocking
      ? meta.syncHealth.issues[0]?.message ?? 'Локальный snapshot не подтвержден sync coverage.'
      : null)
  )
}

function formatSyncError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === 'SYNC_ALREADY_RUNNING') {
      return 'Синхронизация уже идет. Дождитесь завершения текущего запуска.'
    }

    if (error.message === 'UNAUTHORIZED') {
      return 'Нет доступа к запуску синхронизации. Проверьте API token.'
    }

    if (error.message.startsWith('SYNC_FAILED: ')) {
      return `Не удалось синхронизировать данные: ${error.message.slice('SYNC_FAILED: '.length)}`
    }
  }

  return 'Не удалось синхронизировать данные'
}

function formatShortDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function omitSalesPlan(runtimeData: ProtoRuntimeData): ProtoRuntimeData {
  const next = { ...runtimeData }
  delete next.salesPlan
  delete next.salesPlanMonth
  delete next.salesPlanMonthDashboard
  return next
}

function omitSalesPlanQuarter(runtimeData: ProtoRuntimeData): ProtoRuntimeData {
  const next = { ...runtimeData }
  delete next.salesPlanQuarter
  delete next.salesPlanQuarterDashboard
  return next
}

function resolveSalesPlanQuarter(filters: ProtoFilterState) {
  const [yearPart, monthPart] = filters.rangeEnd.split('-')
  const year = Number(yearPart)
  const month = Number(monthPart)
  const quarter = Math.floor((month - 1) / 3) + 1

  return {
    year: Number.isInteger(year) ? year : new Date().getFullYear(),
    quarter: quarter >= 1 && quarter <= 4 ? quarter : 1,
  }
}

function parseFilterYearMonth(value: string) {
  const [yearPart, monthPart] = value.split('-')
  const year = Number(yearPart)
  const month = Number(monthPart)

  if (
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    month >= 1 &&
    month <= 12
  ) {
    return { year, month }
  }

  const fallback = new Date()
  return { year: fallback.getFullYear(), month: fallback.getMonth() + 1 }
}

function formatDateInputParts(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function resolveMonthDateRange(filters: ProtoFilterState) {
  const { year, month } = parseFilterYearMonth(filters.rangeEnd)
  const lastDay = new Date(year, month, 0).getDate()

  return {
    rangeStart: formatDateInputParts(year, month, 1),
    rangeEnd: formatDateInputParts(year, month, lastDay),
  }
}

function resolveQuarterDateRange(input: { year: number; quarter: number }) {
  const firstMonth = (input.quarter - 1) * 3 + 1
  const lastMonth = firstMonth + 2
  const lastDay = new Date(input.year, lastMonth, 0).getDate()

  return {
    rangeStart: formatDateInputParts(input.year, firstMonth, 1),
    rangeEnd: formatDateInputParts(input.year, lastMonth, lastDay),
  }
}

function buildDashboardQueryForDateRange(
  filters: ProtoFilterState,
  range: Pick<ProtoFilterState, 'rangeStart' | 'rangeEnd'>,
): CustomDashboardQuery {
  return buildDashboardQueryFromProtoFilters({
    ...filters,
    ...range,
    compareRanges: [],
  }) as CustomDashboardQuery
}

function summarizeSelection(
  selected: string[],
  options: PickerOption[],
  fallback: string,
) {
  if (selected.length === 0) {
    return fallback
  }

  const labels = options
    .filter((option) => selected.includes(option.id))
    .map((option) => option.label)

  return labels.length <= 2 ? labels.join(', ') : `${labels.length} выбрано`
}

function formatRangeLabel(start: string, end: string) {
  return `${formatShortDate(start)}..${formatShortDate(end)}`
}

function summarizeCompareRanges(ranges: CompareRange[]) {
  if (ranges.length === 0) {
    return 'не задано'
  }

  const firstRange = ranges[0]

  if (ranges.length === 1 && firstRange) {
    return formatRangeLabel(firstRange.start, firstRange.end)
  }

  return `${ranges.length} периода`
}

const attractionManagerOrder = new Map(
  managerOptions.map((option, index) => [option.id, index]),
)
const hiddenActivityKpiLabels = new Set(['Перенесён дедлайн'])

function getVisibleSceneKpis(sceneId: string, kpis: ProtoKpi[]) {
  if (sceneId !== 'activities-calls') {
    return kpis
  }

  return kpis.filter((metric) => !hiddenActivityKpiLabels.has(metric.label))
}

function normalizeManagerPickerOptions(
  entries: Array<{ id: string; name: string }>,
): PickerOption[] {
  return entries
    .filter((entry) => attractionManagerOrder.has(entry.id))
    .map((entry) => ({
      id: entry.id,
      label: entry.name,
      meta: 'Менеджер',
    }))
    .sort((left, right) => {
      const leftOrder = attractionManagerOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER
      const rightOrder = attractionManagerOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER

      return leftOrder - rightOrder
    })
}

function shiftDateInputValue(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`)
  date.setDate(date.getDate() + days)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function createCompareRange(filters: ProtoFilterState): CompareRange {
  const anchorRange = filters.compareRanges.at(-1)
  const start = anchorRange?.start ?? filters.rangeStart
  const end = anchorRange?.end ?? filters.rangeEnd

  return {
    id: crypto.randomUUID(),
    start: shiftDateInputValue(start, -7),
    end: shiftDateInputValue(end, -7),
  }
}

function cloneFilters(filters: ProtoFilterState): ProtoFilterState {
  return {
    ...filters,
    compareRanges: filters.compareRanges.map((range) => ({ ...range })),
    managers: [...filters.managers],
    sources: [...filters.sources],
  }
}

function shouldIgnoreCommentTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false
  }

  return Boolean(
    target.closest(
      'button, input, textarea, select, label, [role="dialog"], [data-slot="command"], [data-slot="command-item"], [data-slot="popover-content"], [data-no-comment="true"]',
    ),
  )
}

const commentBlockSelector = [
  '[data-comment-block-id]',
  '.panel',
  'section',
  'article',
  'table',
  '[role="region"]',
  '[aria-label]',
].join(',')

function cleanCommentLabel(value: string | null | undefined, fallback: string) {
  const normalized = (value ?? '').replace(/\s+/g, ' ').trim()
  return (normalized || fallback).slice(0, 180)
}

function nthOfType(element: Element) {
  const tagName = element.tagName.toLowerCase()
  let index = 1
  let sibling = element.previousElementSibling

  while (sibling) {
    if (sibling.tagName.toLowerCase() === tagName) {
      index += 1
    }
    sibling = sibling.previousElementSibling
  }

  return `${tagName}:nth-of-type(${index})`
}

function selectorSegment(element: Element) {
  const blockId = element.getAttribute('data-comment-block-id')
  if (blockId) {
    return `[data-comment-block-id="${blockId.replace(/"/g, '\\"')}"]`
  }

  if (element.id) {
    return `#${element.id.replace(/"/g, '\\"')}`
  }

  return nthOfType(element)
}

function buildElementSelector(element: Element, root: Element) {
  const segments: string[] = []
  let current: Element | null = element

  while (current && current !== root) {
    segments.unshift(selectorSegment(current))
    current = current.parentElement
  }

  return segments.join(' > ') || selectorSegment(root)
}

function resolveElementLabel(element: Element) {
  const heading = element.querySelector('h1,h2,h3,[role="heading"]')
  return cleanCommentLabel(
    element.getAttribute('data-comment-block-label') ??
      element.getAttribute('aria-label') ??
      heading?.textContent ??
      element.textContent,
    element.tagName.toLowerCase(),
  )
}

function resolveCommentAnchor(
  target: EventTarget | null,
  shell: HTMLElement,
  clientX: number,
  clientY: number,
): ProtoCommentAnchor {
  const targetElement = target instanceof Element ? target : shell
  const blockElement =
    targetElement.closest(commentBlockSelector) instanceof HTMLElement
      ? (targetElement.closest(commentBlockSelector) as HTMLElement)
      : shell
  const rect = blockElement.getBoundingClientRect()
  const relativeX =
    rect.width === 0 ? 0 : Number(((clientX - rect.left) / rect.width).toFixed(4))
  const relativeY =
    rect.height === 0 ? 0 : Number(((clientY - rect.top) / rect.height).toFixed(4))
  const blockSelector = buildElementSelector(blockElement, shell)

  return {
    blockId: blockElement.getAttribute('data-comment-block-id') ?? blockSelector,
    blockLabel: resolveElementLabel(blockElement),
    blockSelector,
    blockRole: blockElement.getAttribute('role') ?? blockElement.tagName.toLowerCase(),
    elementSelector: buildElementSelector(targetElement, shell),
    elementLabel: resolveElementLabel(targetElement),
    relativeX: Math.min(1, Math.max(0, relativeX)),
    relativeY: Math.min(1, Math.max(0, relativeY)),
  }
}

function MultiSelectField({
  label,
  placeholder,
  emptyLabel,
  options,
  selected,
  onToggle,
}: {
  label: string
  placeholder: string
  emptyLabel: string
  options: PickerOption[]
  selected: string[]
  onToggle: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const summary = summarizeSelection(selected, options, emptyLabel)

  return (
    <div className="space-y-1.5">
      <label className="subtle-label">{label}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className="field flex items-center justify-between text-left" aria-label={label}>
            <span className="truncate">{summary}</span>
            <span className="text-slate-400">{open ? '−' : '+'}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={8}
          className="proto-select-popover w-[var(--radix-popover-trigger-width)] rounded-xl p-2"
        >
          <Command className="proto-select-command">
            <CommandInput placeholder={placeholder} />
            <CommandList className="proto-select-list">
              <CommandEmpty>Ничего не найдено</CommandEmpty>
              <CommandGroup heading={label}>
                {options.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={`${option.label} ${option.meta}`}
                    data-checked={selected.includes(option.id)}
                    className="cursor-pointer"
                    onSelect={() => onToggle(option.id)}
                  >
                    <div className="flex min-w-0 flex-col">
                      <strong className="truncate text-sm">{option.label}</strong>
                      <span className="truncate text-xs text-slate-500">{option.meta}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

type PaperclipNotificationsProps = {
  notifications: CommentNotification[]
  summary: Array<[CommentNotification['status'], number]>
  unreadCount: number
  unreadKeys: ReadonlySet<string>
  onRead: () => void
}

function PaperclipNotifications({
  notifications,
  summary,
  unreadCount,
  unreadKeys,
  onRead,
}: PaperclipNotificationsProps) {
  const [open, setOpen] = useState(false)
  const totalCount = notifications.length
  const unreadLabel = unreadCount > 99 ? '99+' : String(unreadCount)
  const buttonLabel =
    unreadCount > 0
      ? `Уведомления команды разработки: ${formatUnreadNotificationCount(unreadCount)}, ${totalCount} активных задач`
      : totalCount === 0
      ? 'Уведомления команды разработки: нет активных задач'
      : `Уведомления команды разработки: нет новых, ${totalCount} активных задач`

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen && unreadCount > 0) {
      onRead()
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="btn btn-ghost relative h-12 w-12 rounded-2xl p-0 text-slate-800"
          aria-label={buttonLabel}
        >
          <HugeiconsIcon
            icon={Notification03Icon}
            size={28}
            strokeWidth={2.2}
            aria-hidden="true"
          />
          {unreadCount > 0 ? (
            <span
              className="absolute -right-1 -top-1 grid min-h-6 min-w-6 place-items-center rounded-full bg-slate-900 px-1.5 text-[0.7rem] font-bold leading-none text-white ring-2 ring-white"
              aria-hidden="true"
            >
              {unreadLabel}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(24rem,calc(100vw-2rem))] rounded-2xl p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="subtle-label">Команда разработки</div>
            <h2 className="mt-1 text-base font-bold text-slate-900">Уведомления</h2>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {unreadCount > 0 ? (
              <span className="badge-chip badge-green">новые · {unreadCount}</span>
            ) : null}
            <span className="badge-chip badge-neutral">{totalCount}</span>
          </div>
        </div>

        {summary.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {summary.map(([notificationStatus, count]) => (
              <span
                key={notificationStatus}
                className={cn('badge-chip', notificationClasses[notificationStatus])}
              >
                {notificationLabels[notificationStatus]} · {count}
              </span>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-600">
            Нет активных задач команды разработки.
          </div>
        )}

        {notifications.length > 0 ? (
          <div className="grid max-h-[24rem] gap-2 overflow-auto pr-1">
            {notifications.map((notification) => {
              const unread = unreadKeys.has(getCommentNotificationReadKey(notification))

              return (
                <article
                  key={notification.id}
                  className={cn(
                    'rounded-xl border px-3 py-3',
                    unread
                      ? 'border-slate-300 bg-slate-50'
                      : 'border-slate-200 bg-white',
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-2">
                      <span className={cn('badge-chip', notificationClasses[notification.status])}>
                        {notificationLabels[notification.status]}
                      </span>
                      {unread ? <span className="badge-chip badge-green">Новое</span> : null}
                    </div>
                    <time className="text-xs font-semibold text-slate-500">
                      {formatDateTime(notification.updatedAt)}
                    </time>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {notification.text}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>{notificationSyncLabels[notification.paperclipSyncStatus]}</span>
                    {notification.paperclipIssueIdentifier ? (
                      <span>{notification.paperclipIssueIdentifier}</span>
                    ) : null}
                  </div>
                  {notification.paperclipError ? (
                    <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700">
                      {formatDevelopmentTeamError(notification.paperclipError)}
                    </p>
                  ) : null}
                  <DevelopmentReadyReport
                    report={notification.paperclipReadyReport}
                    status={notification.status}
                  />
                </article>
              )
            })}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

type LeadgenReportId = 'sales' | 'activity'

const leadgenReportTabs: Array<{ id: LeadgenReportId; label: string }> = [
  { id: 'sales', label: 'Отчет по продажам' },
  { id: 'activity', label: 'Отчет активности' },
]

function LeadgenDashboard({
  report,
  status,
  error,
}: {
  report: LeadgenFunnelReport | null
  status: 'idle' | 'loading' | 'error'
  error: string | null
}) {
  const topStages = report?.stageRows ?? []
  const topSources = report?.sourceRows ?? []
  const topUtm = report?.utmRows ?? []
  const topManagers = report?.managerRows ?? []
  const topReasons = report?.reasonRows ?? []
  const [activeReportId, setActiveReportId] = useState<LeadgenReportId>('sales')
  const isSalesReport = activeReportId === 'sales'
  const emptyValue = status === 'loading' ? '...' : '0'
  const salesMetrics = [
    {
      label: 'Всего сделок',
      value: report ? formatCount(report.totalDeals) : emptyValue,
      hint: 'в Лидген УС',
    },
    {
      label: 'Создано',
      value: report ? formatCount(report.createdDeals) : emptyValue,
      hint: 'за период',
    },
    {
      label: 'Активные',
      value: report ? formatCount(report.activeDeals) : emptyValue,
      hint: 'в работе',
    },
    {
      label: 'Закрытые',
      value: report ? formatCount(report.closedDeals) : emptyValue,
      hint: 'закрытые сделки',
    },
  ]
  const activityMetrics = [
    {
      label: 'Активные',
      value: report ? formatCount(report.activeDeals) : emptyValue,
      hint: 'сейчас в работе',
    },
    {
      label: 'Ответственные',
      value: report ? formatCount(topManagers.length) : emptyValue,
      hint: 'менеджеры с данными',
    },
    {
      label: 'Источники',
      value: report ? formatCount(topSources.length) : emptyValue,
      hint: 'каналы в выборке',
    },
    {
      label: 'UTM',
      value: report ? formatCount(topUtm.length) : emptyValue,
      hint: 'кампании в выборке',
    },
  ]
  const activeMetrics = isSalesReport ? salesMetrics : activityMetrics

  return (
    <div className="grid gap-6">
      <section
        className="panel sticky top-3 z-20 flex flex-wrap gap-2 p-3"
        data-no-comment="true"
        aria-label="Отчеты лидогенерации"
      >
        {leadgenReportTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={cn('tab-chip', activeReportId === tab.id && 'tab-chip-active')}
            aria-pressed={activeReportId === tab.id}
            onClick={() => setActiveReportId(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </section>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      <section
        className="grid gap-4 md:grid-cols-4"
        data-comment-block-id={`leadgen-${activeReportId}-kpi`}
        data-comment-block-label={
          isSalesReport
            ? 'Лидогенерация: KPI отчета продаж'
            : 'Лидогенерация: KPI отчета активности'
        }
      >
        {activeMetrics.map((metric) => (
          <div key={metric.label} className="metric p-4">
            <p className="subtle-label">{metric.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{metric.value}</p>
            <p className="mt-1 text-sm text-slate-500">{metric.hint}</p>
          </div>
        ))}
      </section>

      {report?.warnings.length ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
          {report.warnings.join(' ')}
        </div>
      ) : null}

      <section className={cn('grid gap-6', isSalesReport ? '' : 'lg:grid-cols-2')}>
        {isSalesReport ? (
          <div
            className="panel p-5"
            data-comment-block-id="leadgen-stage-distribution"
            data-comment-block-label="Лидогенерация: стадии"
          >
          <div className="subtle-label">Распределение по стадиям</div>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Стадия</th>
                  <th className="py-2 pr-4">Создано</th>
                  <th className="py-2 pr-4">Активные</th>
                  <th className="py-2 pr-4">Закрытые</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topStages.map((row) => (
                  <tr key={row.stageId}>
                    <td className="py-2 pr-4 font-semibold text-slate-900">
                      {row.stageName}
                    </td>
                    <td className="py-2 pr-4">{formatCount(row.createdDeals)}</td>
                    <td className="py-2 pr-4">{formatCount(row.activeDeals)}</td>
                    <td className="py-2 pr-4">{formatCount(row.closedDeals)}</td>
                  </tr>
                ))}
                {topStages.length === 0 ? (
                  <tr>
                    <td className="py-4 text-slate-500" colSpan={4}>
                      Нет сделок в выбранном периоде.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          </div>
        ) : null}

        {!isSalesReport ? (
          <div
            className="panel p-5"
            data-comment-block-id="leadgen-manager-distribution"
            data-comment-block-label="Лидогенерация: менеджеры"
          >
          <div className="subtle-label">Менеджеры</div>
          <div className="mt-3 grid gap-2">
            {topManagers.map((row) => (
              <div
                key={row.managerId}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <span className="min-w-0 truncate font-semibold text-slate-900">
                  {row.managerName}
                </span>
                <span className="badge-chip badge-neutral">{formatCount(row.dealCount)}</span>
              </div>
            ))}
            {topManagers.length === 0 ? (
              <p className="text-sm text-slate-500">Нет данных за период.</p>
            ) : null}
          </div>
          </div>
        ) : null}
      </section>

      <section className={cn('grid gap-6', isSalesReport ? '' : 'lg:grid-cols-2')}>
        {!isSalesReport ? (
          <div
            className="panel p-5"
            data-comment-block-id="leadgen-source-distribution"
            data-comment-block-label="Лидогенерация: источники"
          >
          <div className="subtle-label">Источники и UTM</div>
          <div className="mt-3 grid gap-2">
            {topSources.map((row) => (
              <div
                key={row.sourceKey}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
              >
                <span className="font-semibold text-slate-900">{row.sourceLabel}</span>
                <span className="badge-chip badge-neutral">{formatCount(row.dealCount)}</span>
              </div>
            ))}
            {topSources.length === 0 ? (
              <p className="text-sm text-slate-500">Нет данных за период.</p>
            ) : null}
            {topUtm.length > 0 ? (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  UTM
                </div>
                <div className="grid gap-2">
                  {topUtm.map((row, index) => {
                    const label =
                      [row.utmSource, row.utmMedium, row.utmCampaign]
                        .filter(Boolean)
                        .join(' / ') || 'Без UTM'

                    return (
                      <div
                        key={`${label}-${index}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                      >
                        <span className="min-w-0 truncate font-semibold text-slate-900">
                          {label}
                        </span>
                        <span className="badge-chip badge-neutral">
                          {formatCount(row.dealCount)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </div>
          </div>
        ) : null}

        {isSalesReport ? (
          <div
            className="panel p-5"
            data-comment-block-id="leadgen-reasons"
            data-comment-block-label="Лидогенерация: причины возврата и корзины"
          >
          <div className="subtle-label">Причины возврата / корзины</div>
          <div className="mt-3 grid gap-2">
            {topReasons.map((row) => (
              <div
                key={row.reasonKey}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
              >
                <span className="font-semibold text-slate-900">{row.reasonLabel}</span>
                <span className="badge-chip badge-neutral">{formatCount(row.dealCount)}</span>
              </div>
            ))}
            {topReasons.length === 0 ? (
              <p className="text-sm text-slate-500">Нет данных за период.</p>
            ) : null}
          </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}

export function ProtoApp({ currentUser }: ProtoAppProps = {}) {
  const [route, setRoute] = useState<ProtoRoute>(() => readProtoRoute())
  const [activeSceneId, setActiveSceneId] = useState(scenes[0]?.id ?? 'sales')
  const [commentMode, setCommentMode] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [accountUser, setAccountUser] = useState<AuthUser | null>(currentUser ?? null)
  const [activeModuleId, setActiveModuleId] = useState(
    currentUser?.modules[0]?.id ?? 'attraction',
  )
  const [accountStatus, setAccountStatus] = useState<'idle' | 'saving' | 'error'>('idle')
  const [accountMessage, setAccountMessage] = useState<string | null>(null)
  const [profileDraft, setProfileDraft] = useState({
    firstName: currentUser?.firstName ?? '',
    lastName: currentUser?.lastName ?? '',
  })
  const [passwordDraft, setPasswordDraft] = useState({
    currentPassword: '',
    newPassword: '',
  })
  const [filters, setFilters] = useState<ProtoFilterState>(() => createDefaultFilters())
  const [appliedFilters, setAppliedFilters] = useState<ProtoFilterState>(() => createDefaultFilters())
  const [salesPlanQuarter, setSalesPlanQuarter] = useState(() =>
    resolveSalesPlanQuarter(createDefaultFilters()),
  )
  const [lastFiltersApply, setLastFiltersApply] = useState(
    new Date('2026-04-10T11:42:00.000Z').toISOString(),
  )
  const [runtimeData, setRuntimeData] = useState<ProtoRuntimeData>({
    managerOptions,
    sourceOptions,
    operationalStatus: 'idle',
    operationalError: null,
  })
  const [leadgenReport, setLeadgenReport] = useState<LeadgenFunnelReport | null>(null)
  const [leadgenReportStatus, setLeadgenReportStatus] = useState<'idle' | 'loading' | 'error'>(
    'idle',
  )
  const [leadgenReportError, setLeadgenReportError] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing'>('idle')
  const [syncProgress, setSyncProgress] = useState<SyncProgressEvent | null>(null)
  const [syncSummary, setSyncSummary] = useState<SyncSummary | null>(null)
  const [salesPlanLoading, setSalesPlanLoading] = useState(false)
  const [salesPlanSaving, setSalesPlanSaving] = useState(false)
  const [salesPlanSaveError, setSalesPlanSaveError] = useState<string | null>(null)
  const [pricingSettingsLoading, setPricingSettingsLoading] = useState(false)
  const [pricingSettingsSaving, setPricingSettingsSaving] = useState(false)
  const [pricingSettingsSaveError, setPricingSettingsSaveError] = useState<string | null>(null)
  const [commentNotifications, setCommentNotifications] = useState<CommentNotification[]>([])
  const [readCommentNotificationKeys, setReadCommentNotificationKeys] = useState<Set<string>>(
    () => readStoredCommentNotificationKeys(),
  )
  const [moduleUsers, setModuleUsers] = useState<ModuleUser[]>([])
  const [moduleUsersStatus, setModuleUsersStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [moduleUsersError, setModuleUsersError] = useState<string | null>(null)
  const [platformAccess, setPlatformAccess] = useState<PlatformAccess | null>(null)
  const [platformAccessStatus, setPlatformAccessStatus] = useState<
    'idle' | 'loading' | 'saving' | 'error'
  >('idle')
  const [platformAccessError, setPlatformAccessError] = useState<string | null>(null)
  const [newModuleUser, setNewModuleUser] = useState({
    firstName: '',
    lastName: '',
    login: '',
    password: '',
    role: 'employee' as ModuleRole,
  })
  const [createdCredentials, setCreatedCredentials] = useState<string | null>(null)
  const [snapshotStats, setSnapshotStats] = useState<SnapshotStats | null>(null)
  const [lastSync, setLastSync] = useState<LastSyncSummary | null>(null)
  const [syncWarning, setSyncWarning] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [draftComment, setDraftComment] = useState<{
    id: string | null
    x: number
    y: number
    text: string
    anchor: ProtoCommentAnchor
    paperclipStatus?: ProtoComment['paperclipStatus']
    paperclipReadyReport?: ProtoComment['paperclipReadyReport']
    paperclipThread?: ProtoComment['paperclipThread']
  } | null>(null)
  const [reworkText, setReworkText] = useState('')
  const [commentSavePending, setCommentSavePending] = useState(false)
  const [commentReworkPending, setCommentReworkPending] = useState(false)

  const shellRef = useRef<HTMLDivElement>(null)
  const runtimeRequestRef = useRef(0)
  const commentSaveInFlightRef = useRef(false)
  const commentReworkInFlightRef = useRef(false)
  const {
    comments,
    updatedAt,
    status,
    error,
    upsertComment,
    archiveComment,
    retryComment,
    reworkComment,
  } = useProtoComments(activeModuleId)

  useEffect(() => {
    function handlePopState() {
      setRoute(readProtoRoute())
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    setAccountUser(currentUser ?? null)
    setProfileDraft({
      firstName: currentUser?.firstName ?? '',
      lastName: currentUser?.lastName ?? '',
    })
  }, [currentUser])

  const availableModules = useMemo(() => accountUser?.modules ?? [], [accountUser])
  const activeModule = useMemo(
    () =>
      availableModules.find((module) => module.id === activeModuleId) ??
      availableModules.find((module) => module.id === 'attraction') ??
      availableModules[0] ??
      null,
    [activeModuleId, availableModules],
  )
  const activeModuleSlug = activeModule?.slug ?? activeModule?.id ?? activeModuleId
  const isLeadgenModule = activeModuleSlug === 'leadgen'
  const activeCommentSceneId = isLeadgenModule ? 'leadgen-funnel' : activeSceneId
  const leadgenSnapshotMeta = leadgenReport
    ? `${formatCount(leadgenReport.managerRows.length)} менеджеров · ${formatCount(
        leadgenReport.stageRows.length,
      )} стадий · ${formatCount(leadgenReport.sourceRows.length)} источников`
    : null

  useEffect(() => {
    if (availableModules.length === 0) {
      return
    }

    if (!availableModules.some((module) => module.id === activeModuleId)) {
      setActiveModuleId(
        availableModules.find((module) => module.id === 'attraction')?.id ??
          availableModules[0]!.id,
      )
    }
  }, [activeModuleId, availableModules])

  const canArchiveComments =
    activeModule?.permissions.includes('comments:archive') === true
  const canManageModuleUsers =
    activeModule?.permissions.includes('module-users:manage') === true
  const platformModules = platformAccess?.modules ?? []
  const platformUsers = platformAccess?.users ?? []

  const switchModule = useCallback((moduleId: string) => {
    setActiveModuleId(moduleId)
    setCommentsOpen(false)
    setCommentMode(false)
    setDraftComment(null)
  }, [])

  const ModuleSwitcher = useMemo(
    () =>
      availableModules.length > 1 ? (
        <div className="flex flex-wrap gap-1 rounded-full border border-slate-200 bg-white/80 p-1 shadow-sm">
          {availableModules.map((module) => (
            <button
              key={module.id}
              type="button"
              className={cn(
                'tab-chip',
                module.id === activeModule?.id && 'tab-chip-active',
              )}
              aria-pressed={module.id === activeModule?.id}
              onClick={() => switchModule(module.id)}
            >
              {module.name}
            </button>
          ))}
        </div>
      ) : null,
    [activeModule?.id, availableModules, switchModule],
  )

  const activeScene = useMemo(
    () => scenes.find((scene) => scene.id === activeSceneId) ?? scenes[0]!,
    [activeSceneId],
  )
  const activeSceneKpis = useMemo(() => {
    if (runtimeData.operationalStatus !== 'ready' && activeScene.id !== 'sales') {
      return []
    }

    if (activeScene.id === 'activities-calls' && runtimeData.activitiesCalls) {
      return runtimeData.activitiesCalls.kpis
    }

    if (activeScene.id === 'cohorts' && runtimeData.cohorts) {
      return runtimeData.cohorts.kpis
    }

    if (activeScene.id === 'funnel-flow' && runtimeData.tocFlow) {
      return runtimeData.tocFlow.kpis
    }

    return activeScene.kpis
  }, [
    activeScene,
    runtimeData.activitiesCalls,
    runtimeData.cohorts,
    runtimeData.operationalStatus,
    runtimeData.tocFlow,
  ])
  const visibleSceneKpis = useMemo(
    () => getVisibleSceneKpis(activeScene.id, activeSceneKpis),
    [activeScene.id, activeSceneKpis],
  )
  const sceneComments = useMemo(
    () =>
      comments.filter(
        (comment) =>
          comment.sceneId === activeCommentSceneId &&
          (comment.status ?? 'open') === 'open',
      ),
    [activeCommentSceneId, comments],
  )
  const notificationSummary = useMemo(() => {
    const counts = new Map<CommentNotification['status'], number>()
    for (const notification of commentNotifications) {
      counts.set(notification.status, (counts.get(notification.status) ?? 0) + 1)
    }

    return Array.from(counts.entries())
  }, [commentNotifications])
  const unreadCommentNotificationKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const notification of commentNotifications) {
      const key = getCommentNotificationReadKey(notification)
      if (!readCommentNotificationKeys.has(key)) {
        keys.add(key)
      }
    }

    return keys
  }, [commentNotifications, readCommentNotificationKeys])
  const ActiveSceneComponent = activeScene.component
  const availableManagerOptions =
    runtimeData.managerOptions.length > 0 ? runtimeData.managerOptions : managerOptions
  const availableSourceOptions =
    runtimeData.sourceOptions.length > 0 ? runtimeData.sourceOptions : sourceOptions

  function navigateToAccount() {
    writeProtoRoute('account')
    setRoute('account')
    setCommentsOpen(false)
    setCommentMode(false)
    setDraftComment(null)
  }

  function navigateToDashboard() {
    writeProtoRoute('dashboard')
    setRoute('dashboard')
  }

  const refreshCommentNotifications = useCallback(async () => {
    try {
      const response = await apiClient.getCommentNotifications(activeModuleId)
      setCommentNotifications(response.notifications)
    } catch {
      setCommentNotifications([])
    }
  }, [activeModuleId])

  const markCommentNotificationsRead = useCallback(() => {
    if (commentNotifications.length === 0) {
      return
    }

    setReadCommentNotificationKeys((current) => {
      const next = new Set(current)
      let changed = false
      for (const notification of commentNotifications) {
        const key = getCommentNotificationReadKey(notification)
        if (!next.has(key)) {
          next.add(key)
          changed = true
        }
      }
      if (changed) {
        writeStoredCommentNotificationKeys(next)
      }

      return changed ? next : current
    })
  }, [commentNotifications])

  const refreshModuleUsers = useCallback(async () => {
    if (!canManageModuleUsers) {
      setModuleUsers([])
      return
    }

    setModuleUsersStatus('loading')
    setModuleUsersError(null)

    try {
      const response = await apiClient.getModuleUsers(activeModuleId)
      setModuleUsers(response.users)
      setModuleUsersStatus('idle')
    } catch (loadError) {
      setModuleUsersStatus('error')
      setModuleUsersError(
        loadError instanceof Error
          ? loadError.message
          : 'Не удалось загрузить пользователей модуля',
      )
    }
  }, [activeModuleId, canManageModuleUsers])

  const refreshPlatformAccess = useCallback(async () => {
    if (!accountUser?.isSuperAdmin) {
      setPlatformAccess(null)
      setPlatformAccessStatus('idle')
      setPlatformAccessError(null)
      return
    }

    setPlatformAccessStatus('loading')
    setPlatformAccessError(null)

    try {
      const response = await apiClient.getPlatformAccess()
      setPlatformAccess(response)
      setPlatformAccessStatus('idle')
    } catch (loadError) {
      setPlatformAccessStatus('error')
      setPlatformAccessError(
        loadError instanceof Error
          ? loadError.message
          : 'Не удалось загрузить доступы платформы',
      )
    }
  }, [accountUser?.isSuperAdmin])

  useEffect(() => {
    let cancelled = false

    async function loadRuntimeData() {
      const requestId = runtimeRequestRef.current + 1
      runtimeRequestRef.current = requestId

      setRuntimeData((current) => ({
        ...current,
        operationalStatus: 'loading',
        operationalError: null,
      }))

      try {
        const query = buildDashboardQueryFromProtoFilters(appliedFilters)
        if (isLeadgenModule) {
          setLeadgenReportStatus('loading')
          setLeadgenReportError(null)
          setPricingSettingsLoading(false)

          const report = await apiClient.getLeadgenFunnelReport(activeModuleId, query)
          if (cancelled || runtimeRequestRef.current !== requestId) {
            return
          }

          setLeadgenReport(report)
          setLeadgenReportStatus('idle')
          setRuntimeData((current) => ({
            ...current,
            managerOptions: report.managerRows.map((row) => ({
              id: row.managerId,
              label: row.managerName,
              meta: 'Менеджер',
            })),
            sourceOptions: report.sourceRows.map((row) => ({
              id: row.sourceKey,
              label: row.sourceLabel,
              meta: 'Источник',
            })),
            operationalStatus: 'ready',
            operationalError: null,
          }))
          setSnapshotStats(null)
          setLastSync(null)
          setSyncWarning(null)
          return
        }

        setLeadgenReport(null)
        setLeadgenReportStatus('idle')
        setLeadgenReportError(null)
        setPricingSettingsLoading(true)
        const [meta, pricingSettings] = await Promise.all([
          apiClient.getMeta(),
          apiClient.getPricingSettings(),
        ])
        if (cancelled || runtimeRequestRef.current !== requestId) {
          return
        }
        setPricingSettingsLoading(false)

        const managerPickerOptions = normalizeManagerPickerOptions(meta.managerCatalog)
        const sourcePickerOptions = meta.sourceCatalog.map((entry) => ({
          id: entry.key,
          label: entry.label,
          meta: 'Источник',
        }))
        setSnapshotStats(meta.snapshotStats)
        setLastSync(meta.lastSync)
        setSyncWarning(resolveSyncHealthWarning(meta))

        const monthQuery = buildDashboardQueryForDateRange(
          appliedFilters,
          resolveMonthDateRange(appliedFilters),
        )
        const quarterQuery = buildDashboardQueryForDateRange(
          appliedFilters,
          resolveQuarterDateRange(salesPlanQuarter),
        )
        const [
          dashboard,
          monthDashboard,
          quarterDashboard,
          activities,
          calls,
          acquisitionOutcomes,
          targetGroupConversion,
          managerActionOutcomes,
          conversionEvents,
          cohort,
          toc,
        ] = await Promise.all([
          apiClient.getDashboard(query),
          apiClient.getDashboard(monthQuery),
          apiClient.getDashboard(quarterQuery),
          apiClient.getActivitiesWorkloadReport(query),
          apiClient.getCallsWorkloadReport(query),
          apiClient.getAcquisitionOutcomesReport(query),
          apiClient.getTargetGroupConversionReport(query),
          apiClient.getManagerActionOutcomeReport(query),
          apiClient.getConversionEventsReport(query),
          apiClient.getCohortConversionReport(query),
          apiClient.getTocFlowReport(query),
        ])

        if (cancelled || runtimeRequestRef.current !== requestId) {
          return
        }

        const managerBreakdownIds =
          appliedFilters.managers.length > 0
            ? appliedFilters.managers
            : activities.managerRows
                .filter((row) => row.dealCount > 0)
                .sort((left, right) => right.dealCount - left.dealCount)
                .map((row) => row.managerId)
                .slice(0, 5)
        const sourceBreakdownKeys =
          appliedFilters.sources.length > 0
            ? appliedFilters.sources
            : meta.sourceCatalog.map((entry) => entry.key)
        const tocManagerBreakdownIds =
          appliedFilters.managers.length > 0
            ? appliedFilters.managers
            : (managerPickerOptions.length > 0 ? managerPickerOptions : managerOptions).map(
                (option) => option.id,
              )

        const [managerBreakdowns, sourceBreakdowns, tocManagerBreakdowns] = await Promise.all([
          Promise.all(
            managerBreakdownIds.map(async (managerId) => {
              const report = await apiClient.getCohortConversionReport({
                ...query,
                managerIds: [managerId],
                compareRanges: [],
              })

              return {
                key: managerId,
                label:
                  meta.managerCatalog.find((entry) => entry.id === managerId)?.name ??
                  managerId,
                report,
              }
            }),
          ),
          Promise.all(
            sourceBreakdownKeys.map(async (sourceKey) => {
              const report = await apiClient.getCohortConversionReport({
                ...query,
                sourceKeys: [sourceKey],
                compareRanges: [],
              })

              return {
                key: sourceKey,
                label:
                  meta.sourceCatalog.find((entry) => entry.key === sourceKey)?.label ??
                  sourceKey,
                report,
              }
            }),
          ),
          Promise.all(
            tocManagerBreakdownIds.map(async (managerId) => {
              const report = await apiClient.getTocFlowReport({
                ...query,
                managerIds: [managerId],
                compareRanges: query.compareRanges ?? [],
              })
              const label =
                managerPickerOptions.find((entry) => entry.id === managerId)?.label ??
                meta.managerCatalog.find((entry) => entry.id === managerId)?.name ??
                managerId

              return {
                key: managerId,
                label,
                report,
              }
            }),
          ),
        ])

        if (cancelled || runtimeRequestRef.current !== requestId) {
          return
        }

        setRuntimeData((current) => ({
          managerOptions: managerPickerOptions,
          sourceOptions: sourcePickerOptions,
          ...(current.salesPlan ? { salesPlan: current.salesPlan } : {}),
          ...(current.salesPlanMonth ? { salesPlanMonth: current.salesPlanMonth } : {}),
          ...(current.salesPlanQuarter ? { salesPlanQuarter: current.salesPlanQuarter } : {}),
          pricingSettings,
          salesDashboard: dashboard,
          salesPlanMonthDashboard: monthDashboard,
          salesPlanQuarterDashboard: quarterDashboard,
          activitiesWorkload: activities,
          callsWorkload: calls,
          activitiesCalls: mapActivitiesCallsSceneData({ activities, calls }),
          acquisitionOutcomes,
          targetGroupConversion,
          managerActionOutcomes,
          conversionEvents,
          ...(current.revenueVelocity ? { revenueVelocity: current.revenueVelocity } : {}),
          cohorts: mapCohortSceneData({
            report: cohort,
            managerBreakdowns,
            sourceBreakdowns,
          }),
          tocFlow: mapTocFlowSceneData({ report: toc, managerBreakdowns: tocManagerBreakdowns }),
          operationalStatus: 'ready',
          operationalError: null,
        }))
      } catch (error) {
        if (cancelled || runtimeRequestRef.current !== requestId) {
          return
        }

        setRuntimeData((current) => ({
          ...current,
          operationalStatus: 'error',
          operationalError:
            error instanceof Error ? error.message : 'Не удалось загрузить live-данные',
        }))
        if (isLeadgenModule) {
          setLeadgenReportStatus('error')
          setLeadgenReportError(
            error instanceof Error ? error.message : 'Не удалось загрузить отчет leadgen',
          )
        }
        setPricingSettingsLoading(false)
      }
    }

    void loadRuntimeData()

    return () => {
      cancelled = true
    }
  }, [activeModuleId, appliedFilters, isLeadgenModule, salesPlanQuarter])

  useEffect(() => {
    void refreshCommentNotifications()
  }, [refreshCommentNotifications])

  useEffect(() => {
    void refreshModuleUsers()
  }, [refreshModuleUsers])

  useEffect(() => {
    void refreshPlatformAccess()
  }, [refreshPlatformAccess])

  useEffect(() => {
    let cancelled = false

    async function loadEffectiveSalesPlan() {
      if (isLeadgenModule) {
        setRuntimeData((current) => omitSalesPlan(current))
        return
      }

      const query = buildDashboardQueryFromProtoFilters(appliedFilters)
      if (query.preset !== 'custom') {
        return
      }

      setRuntimeData((current) => omitSalesPlan(current))

      try {
        const monthQuery = buildDashboardQueryForDateRange(
          appliedFilters,
          resolveMonthDateRange(appliedFilters),
        )
        const [salesPlan, salesPlanMonth] = await Promise.all([
          apiClient.getEffectiveSalesPlan({
            from: query.from,
            to: query.to,
          }),
          apiClient.getEffectiveSalesPlan({
            from: monthQuery.from,
            to: monthQuery.to,
          }),
        ])
        if (cancelled) {
          return
        }

        setRuntimeData((current) => ({
          ...current,
          salesPlan,
          salesPlanMonth,
        }))
      } catch {
        if (cancelled) {
          return
        }

        setRuntimeData((current) => omitSalesPlan(current))
      }
    }

    void loadEffectiveSalesPlan()

    return () => {
      cancelled = true
    }
  }, [appliedFilters, isLeadgenModule])

  useEffect(() => {
    let cancelled = false

    async function loadSalesPlanQuarter() {
      if (isLeadgenModule) {
        setSalesPlanLoading(false)
        setRuntimeData((current) => omitSalesPlanQuarter(current))
        return
      }

      setSalesPlanLoading(true)
      setRuntimeData((current) => omitSalesPlanQuarter(current))

      try {
        const salesPlanQuarterData = await apiClient.getSalesPlanQuarter(salesPlanQuarter)
        if (cancelled) {
          return
        }

        setRuntimeData((current) => ({
          ...current,
          salesPlanQuarter: salesPlanQuarterData,
        }))
      } catch {
        if (cancelled) {
          return
        }

        setRuntimeData((current) => omitSalesPlanQuarter(current))
      } finally {
        if (!cancelled) {
          setSalesPlanLoading(false)
        }
      }
    }

    void loadSalesPlanQuarter()

    return () => {
      cancelled = true
    }
  }, [isLeadgenModule, salesPlanQuarter])

  async function refreshSyncMeta() {
    const meta = await apiClient.getMeta()
    setSnapshotStats(meta.snapshotStats)
    setLastSync(meta.lastSync)
    setSyncWarning(resolveSyncHealthWarning(meta))
  }

  async function handleRefreshData() {
    if (syncStatus === 'syncing') {
      return
    }

    setSyncStatus('syncing')
    setSyncError(null)
    setSyncProgress({
      syncRunId: null,
      phase: 'inspect_snapshot',
      progress: 3,
      message: 'Запускаем синхронизацию',
    })
    setRuntimeData((current) => ({
      ...current,
      operationalError: null,
    }))

    try {
      const summary = await apiClient.triggerSync(activeModuleId, (event) => {
        setSyncProgress(event)
        if (event.snapshotBefore) {
          setSnapshotStats(event.snapshotBefore)
        }
      })
      setSyncSummary(summary)
      setSnapshotStats(summary.snapshotAfter)
      setLastSync({
        finishedAt: summary.finishedAt,
        leadsSynced: summary.leadsSynced,
        dealsSynced: summary.dealsSynced,
        mode: summary.mode,
        dealBreakdown: resolveDealBreakdown(summary.changes),
      })
      setSyncProgress({
        syncRunId: summary.syncRunId,
        phase: 'complete',
        progress: 100,
        message: 'Синхронизация завершена',
        snapshotBefore: summary.snapshotBefore,
        snapshotAfter: summary.snapshotAfter,
        changes: summary.changes,
        mode: summary.mode,
        modifiedAfter: summary.modifiedAfter,
        finishedAt: summary.finishedAt,
        diagnostics: summary.diagnostics,
      })
      setAppliedFilters((current) => cloneFilters(current))
    } catch (error) {
      setSyncError(formatSyncError(error))
      setRuntimeData((current) => ({
        ...current,
        operationalError: null,
      }))
    } finally {
      if (!isLeadgenModule) {
        await refreshSyncMeta().catch(() => undefined)
      }
      setSyncStatus('idle')
    }
  }

  async function handleSaveSalesPlan(rows: SalesPlanQuarterDraftRow[]) {
    if (salesPlanLoading) {
      return
    }

    setSalesPlanSaving(true)
    setSalesPlanSaveError(null)

    try {
      const saved = await apiClient.saveSalesPlanQuarter({
        year: salesPlanQuarter.year,
        quarter: salesPlanQuarter.quarter,
        rows,
      })
      setRuntimeData((current) => ({
        ...current,
        salesPlanQuarter: saved,
      }))
    } catch (error) {
      setSalesPlanSaveError(
        error instanceof Error ? error.message : 'Не удалось сохранить план продаж',
      )
    } finally {
      setSalesPlanSaving(false)
    }
  }

  async function handleSavePricingSettings(rows: DealPricingRuleInput[]) {
    if (pricingSettingsLoading) {
      return
    }

    setPricingSettingsSaving(true)
    setPricingSettingsSaveError(null)

    try {
      const saved = await apiClient.savePricingSettings({ rules: rows })
      setRuntimeData((current) => ({
        ...current,
        pricingSettings: saved,
      }))
      setAppliedFilters((current) => cloneFilters(current))
    } catch (error) {
      setPricingSettingsSaveError(
        error instanceof Error ? error.message : 'Не удалось сохранить цены',
      )
    } finally {
      setPricingSettingsSaving(false)
    }
  }

  function patchFilters(next: Partial<ProtoFilterState>) {
    setFilters((current) => ({ ...current, ...next }))
  }

  function toggleFilterValue(key: 'managers' | 'sources', value: string) {
    setFilters((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key].filter((item) => item !== value)
        : [...current[key], value],
    }))
  }

  function addCompareRange() {
    setFilters((current) => {
      if (current.compareRanges.length >= 5) {
        return current
      }

      return {
        ...current,
        compareRanges: [...current.compareRanges, createCompareRange(current)],
      }
    })
  }

  function updateCompareRange(id: string, patch: Partial<CompareRange>) {
    setFilters((current) => ({
      ...current,
      compareRanges: current.compareRanges.map((range) =>
        range.id === id ? { ...range, ...patch } : range,
      ),
    }))
  }

  function removeCompareRange(id: string) {
    setFilters((current) => ({
      ...current,
      compareRanges: current.compareRanges.filter((range) => range.id !== id),
    }))
  }

  function openNewComment(x: number, y: number, anchor: ProtoCommentAnchor) {
    setDraftComment({ id: null, x, y, text: '', anchor })
    setReworkText('')
    setCommentsOpen(true)
  }

  function openExistingComment(comment: ProtoComment) {
    setDraftComment({
      id: comment.id,
      x: comment.x,
      y: comment.y,
      text: comment.text,
      anchor:
        comment.anchor ??
        ({
          blockId: 'legacy-comment',
          blockLabel: 'Комментарий без привязки',
          blockSelector: 'legacy-comment',
          blockRole: null,
          elementSelector: 'legacy-comment',
          elementLabel: '',
          relativeX: comment.x,
          relativeY: comment.y,
        } satisfies ProtoCommentAnchor),
      paperclipStatus: comment.paperclipStatus,
      paperclipReadyReport: comment.paperclipReadyReport,
      paperclipThread: comment.paperclipThread,
    })
    setReworkText('')
    setCommentsOpen(true)
  }

  function handleShellClick(event: MouseEvent<HTMLDivElement>) {
    if (!commentMode || !shellRef.current || shouldIgnoreCommentTarget(event.target)) {
      return
    }

    const rect = shellRef.current.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) {
      return
    }

    openNewComment(
      Number(((event.clientX - rect.left) / rect.width).toFixed(4)),
      Number(((event.clientY - rect.top) / rect.height).toFixed(4)),
      resolveCommentAnchor(event.target, shellRef.current, event.clientX, event.clientY),
    )
  }

  async function handleSaveComment() {
    if (!draftComment || commentSaveInFlightRef.current) {
      return
    }

    const text = draftComment.text.trim()
    if (!text) {
      return
    }

    commentSaveInFlightRef.current = true
    setCommentSavePending(true)

    try {
      const now = new Date().toISOString()
      const context: ProtoCommentContext = {
        filters: appliedFilters,
      }
      await upsertComment({
        id: draftComment.id ?? crypto.randomUUID(),
        sceneId: activeCommentSceneId,
        x: draftComment.x,
        y: draftComment.y,
        text,
        anchor: draftComment.anchor,
        createdAt:
          comments.find((item) => item.id === draftComment.id)?.createdAt ?? now,
        updatedAt: now,
        status: 'open',
        archivedAt: null,
        context,
      })
      await refreshCommentNotifications()
      setDraftComment(null)
      setCommentsOpen(false)
    } finally {
      commentSaveInFlightRef.current = false
      setCommentSavePending(false)
    }
  }

  function closeCommentDraft() {
    setDraftComment(null)
    setReworkText('')
    setCommentsOpen(false)
  }

  async function handleArchiveComment(commentId: string) {
    await archiveComment(commentId)
    await refreshCommentNotifications()
    setDraftComment(null)
    setCommentsOpen(false)
  }

  async function handleRetryComment(commentId: string) {
    await retryComment(commentId)
    await refreshCommentNotifications()
  }

  async function handleReworkComment(commentId: string) {
    if (commentReworkInFlightRef.current) {
      return
    }

    const text = reworkText.trim()
    if (!text) {
      return
    }

    commentReworkInFlightRef.current = true
    setCommentReworkPending(true)

    try {
      const reworked = await reworkComment(commentId, text)
      if (!reworked) {
        return
      }

      await refreshCommentNotifications()
      setReworkText('')
      setDraftComment(null)
      setCommentsOpen(false)
    } finally {
      commentReworkInFlightRef.current = false
      setCommentReworkPending(false)
    }
  }

  async function handleSaveProfile() {
    setAccountStatus('saving')
    setAccountMessage(null)

    try {
      const response = await apiClient.updateCurrentUser({
        firstName: profileDraft.firstName.trim() || null,
        lastName: profileDraft.lastName.trim() || null,
      })
      setAccountUser(response.user)
      setAccountStatus('idle')
      setAccountMessage('Профиль обновлен.')
    } catch (profileError) {
      setAccountStatus('error')
      setAccountMessage(
        profileError instanceof Error ? profileError.message : 'Не удалось сохранить профиль.',
      )
    }
  }

  async function handleChangePassword() {
    if (passwordDraft.newPassword.length < 8) {
      setAccountStatus('error')
      setAccountMessage('Новый пароль должен быть не короче 8 символов.')
      return
    }

    setAccountStatus('saving')
    setAccountMessage(null)

    try {
      await apiClient.changeCurrentPassword(passwordDraft)
      setPasswordDraft({
        currentPassword: '',
        newPassword: '',
      })
      setAccountStatus('idle')
      setAccountMessage('Пароль обновлен.')
    } catch (passwordError) {
      setAccountStatus('error')
      setAccountMessage(
        passwordError instanceof Error ? passwordError.message : 'Не удалось сменить пароль.',
      )
    }
  }

  function handleGeneratePassword() {
    setNewModuleUser((current) => ({
      ...current,
      password: generateTemporaryPassword(),
    }))
  }

  async function handleCopyCredentials() {
    if (!createdCredentials) {
      return
    }

    try {
      await navigator.clipboard?.writeText(createdCredentials)
      setModuleUsersError(null)
    } catch {
      setModuleUsersError('Не удалось скопировать доступы автоматически.')
    }
  }

  async function handleCreateModuleUser() {
    const login = newModuleUser.login.trim()
    const password = newModuleUser.password
    if (!login || password.length < 8) {
      setModuleUsersError('Логин и пароль от 8 символов обязательны.')
      return
    }

    setModuleUsersStatus('loading')
    setModuleUsersError(null)

    try {
      await apiClient.createModuleUser(
        {
          login,
          firstName: newModuleUser.firstName.trim() || null,
          lastName: newModuleUser.lastName.trim() || null,
          password,
          role: newModuleUser.role,
        },
        activeModuleId,
      )
      setCreatedCredentials(`Логин: ${login}\nПароль: ${password}`)
      setNewModuleUser({
        firstName: '',
        lastName: '',
        login: '',
        password: '',
        role: 'employee',
      })
      await refreshModuleUsers()
    } catch (createError) {
      setModuleUsersStatus('error')
      setModuleUsersError(
        createError instanceof Error
          ? createError.message
          : 'Не удалось создать пользователя',
      )
    }
  }

  async function handleUpdateModuleUser(
    user: ModuleUser,
    patch: {
      firstName?: string | null
      lastName?: string | null
      password?: string
      role?: ModuleRole
      disabled?: boolean
      membershipStatus?: 'active' | 'disabled'
    },
  ) {
    setModuleUsersStatus('loading')
    setModuleUsersError(null)

    try {
      const response = await apiClient.updateModuleUser(user.id, patch, activeModuleId)
      setModuleUsers((current) =>
        current.map((item) => (item.id === user.id ? response.user : item)),
      )
      setModuleUsersStatus('idle')
    } catch (updateError) {
      setModuleUsersStatus('error')
      setModuleUsersError(
        updateError instanceof Error
          ? updateError.message
          : 'Не удалось обновить пользователя',
      )
    }
  }

  async function handleDeleteModuleUser(user: ModuleUser) {
    setModuleUsersStatus('loading')
    setModuleUsersError(null)

    try {
      const response = await apiClient.deleteModuleUser(user.id, activeModuleId)
      setModuleUsers((current) =>
        current.map((item) => (item.id === user.id ? response.user : item)),
      )
      setModuleUsersStatus('idle')
    } catch (deleteError) {
      setModuleUsersStatus('error')
      setModuleUsersError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Не удалось удалить пользователя',
      )
    }
  }

  function getActivePlatformMembership(user: PlatformUser, moduleId: string) {
    return user.memberships.find(
      (membership) =>
        membership.moduleId === moduleId && membership.membershipStatus === 'active',
    )
  }

  function buildPlatformMemberships(
    user: PlatformUser,
    moduleId: string,
    role: ModuleRole | null,
  ): PlatformMembershipInput[] {
    const byModule = new Map<string, PlatformMembershipInput>()
    for (const membership of user.memberships) {
      if (membership.membershipStatus !== 'active') {
        continue
      }
      byModule.set(membership.moduleId, {
        moduleId: membership.moduleId,
        role: membership.moduleRole,
        status: 'active',
      })
    }

    if (role) {
      byModule.set(moduleId, {
        moduleId,
        role,
        status: 'active',
      })
    } else {
      byModule.delete(moduleId)
    }

    const modules = platformAccess?.modules ?? []
    return modules
      .map((module) => byModule.get(module.id))
      .filter((membership): membership is PlatformMembershipInput => Boolean(membership))
  }

  async function savePlatformUserMemberships(
    userId: number,
    memberships: PlatformMembershipInput[],
  ) {
    setPlatformAccessStatus('saving')
    setPlatformAccessError(null)

    try {
      const response = await apiClient.updatePlatformUserMemberships(userId, memberships)
      setPlatformAccess((current) =>
        current
          ? {
              ...current,
              users: current.users.map((item) =>
                item.id === userId ? response.user : item,
              ),
            }
          : current,
      )
      setPlatformAccessStatus('idle')
    } catch (saveError) {
      setPlatformAccessStatus('error')
      setPlatformAccessError(
        saveError instanceof Error
          ? saveError.message
          : 'Не удалось обновить доступы платформы',
      )
    }
  }

  async function handleTogglePlatformMembership(
    user: PlatformUser,
    moduleId: string,
    enabled: boolean,
  ) {
    const currentMembership = getActivePlatformMembership(user, moduleId)
    const role = enabled ? currentMembership?.moduleRole ?? 'employee' : null
    await savePlatformUserMemberships(user.id, buildPlatformMemberships(user, moduleId, role))
  }

  async function handleChangePlatformRole(
    user: PlatformUser,
    moduleId: string,
    role: ModuleRole,
  ) {
    await savePlatformUserMemberships(user.id, buildPlatformMemberships(user, moduleId, role))
  }

  if (route === 'account') {
    return (
      <main className="px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto flex w-full max-w-[1420px] flex-col gap-6">
          <header className="panel p-4 md:p-5" data-no-comment="true">
            <div className="grid gap-4 lg:grid-cols-[minmax(280px,1fr)_auto] lg:items-center">
              <div>
                <p className="subtle-label">
                  Модуль «{activeModule?.name ?? 'Привлечение'}»
                </p>
                <h1 className="mt-1 text-3xl font-bold text-slate-900">
                  Личный кабинет
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  {accountUser ? getUserDisplayName(accountUser) : 'Пользователь не определен'}
                </p>
              </div>
              <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                {ModuleSwitcher}
                <button type="button" className="btn btn-ghost" onClick={navigateToDashboard}>
                  К дашборду
                </button>
              </div>
            </div>
          </header>

          {accountMessage ? (
            <div
              className={cn(
                'rounded-xl border px-3 py-2 text-sm font-semibold',
                accountStatus === 'error'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700',
              )}
              role={accountStatus === 'error' ? 'alert' : 'status'}
            >
              {accountMessage}
            </div>
          ) : null}

          <section className="panel grid gap-4 p-5">
            <div>
              <div className="subtle-label">Профиль</div>
              <h2 className="mt-1 text-xl font-bold text-slate-900">Имя и вход</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="subtle-label">Имя</span>
                <input
                  className="field"
                  value={profileDraft.firstName}
                  onChange={(event) =>
                    setProfileDraft((current) => ({
                      ...current,
                      firstName: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="space-y-1.5">
                <span className="subtle-label">Фамилия</span>
                <input
                  className="field"
                  value={profileDraft.lastName}
                  onChange={(event) =>
                    setProfileDraft((current) => ({
                      ...current,
                      lastName: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="subtle-label">Логин для входа</div>
              <div className="mt-1 font-semibold text-slate-900">
                {accountUser?.login ?? 'Нет активной сессии'}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary w-fit"
              onClick={() => void handleSaveProfile()}
              disabled={accountStatus === 'saving' || !accountUser}
            >
              Сохранить профиль
            </button>
          </section>

          <section className="panel grid gap-4 p-5">
            <div>
              <div className="subtle-label">Пароль</div>
              <h2 className="mt-1 text-xl font-bold text-slate-900">Смена пароля</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                className="field"
                type="password"
                placeholder="текущий пароль"
                value={passwordDraft.currentPassword}
                onChange={(event) =>
                  setPasswordDraft((current) => ({
                    ...current,
                    currentPassword: event.target.value,
                  }))
                }
              />
              <input
                className="field"
                type="password"
                placeholder="новый пароль"
                value={passwordDraft.newPassword}
                onChange={(event) =>
                  setPasswordDraft((current) => ({
                    ...current,
                    newPassword: event.target.value,
                  }))
                }
              />
            </div>
            <button
              type="button"
              className="btn btn-ghost w-fit"
              onClick={() => void handleChangePassword()}
              disabled={accountStatus === 'saving' || !passwordDraft.currentPassword}
            >
              Сменить пароль
            </button>
          </section>

          <section className="panel grid gap-4 p-5">
            <div>
              <div className="subtle-label">Модуль</div>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                {activeModule?.name ?? 'Привлечение'}
              </h2>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div className="subtle-label">Роль</div>
                <div className="mt-1 font-semibold text-slate-900">
                  {activeModule?.role === 'leader' ? 'Лидер модуля' : 'Сотрудник'}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div className="subtle-label">Slug</div>
                <div className="mt-1 font-semibold text-slate-900">
                  {activeModule?.slug ?? activeModuleId}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div className="subtle-label">Права</div>
                <div className="mt-1 font-semibold text-slate-900">
                  {activeModule?.permissions.length ?? 0}
                </div>
              </div>
            </div>
          </section>

          <section className="panel grid gap-4 p-5">
            <div>
              <div className="subtle-label">Настройки модуля</div>
              <h2 className="mt-1 text-xl font-bold text-slate-900">Рабочие правила</h2>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              {[
                ['Менеджеры', 'Преднастройки фильтров'],
                ['Контракты', 'Стоимость и тарифы'],
                ['Воронки', 'Источник расчета'],
              ].map(([title, label]) => (
                <div
                  key={title}
                  className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3"
                >
                  <div className="subtle-label">{title}</div>
                  <div className="mt-1 font-semibold text-slate-900">{label}</div>
                  <span className="badge-chip badge-neutral mt-3">Запланировано</span>
                </div>
              ))}
            </div>
          </section>

          {accountUser?.isSuperAdmin ? (
            <section className="panel grid gap-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="subtle-label">Супер-админ</div>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">
                    Доступы платформы
                  </h2>
                </div>
                <span className="badge-chip badge-neutral">{platformAccessStatus}</span>
              </div>
              {platformAccessError ? (
                <p className="text-sm font-semibold text-red-600">
                  {platformAccessError}
                </p>
              ) : null}
              {platformModules.length === 0 || platformUsers.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {platformAccessStatus === 'loading'
                    ? 'Загрузка доступов.'
                    : 'Нет пользователей или модулей для настройки.'}
                </p>
              ) : (
                <div className="grid gap-2">
                  {platformUsers.map((user) => (
                    <div
                      key={user.id}
                      className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 xl:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.8fr)]"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-slate-900">
                          {user.login}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {user.isSuperAdmin
                            ? 'Суперадмин'
                            : user.disabled
                              ? 'Отключен'
                              : 'Пользователь'}
                        </div>
                      </div>
                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {platformModules.map((module) => {
                          const membership = getActivePlatformMembership(user, module.id)
                          const locked = user.isSuperAdmin
                          const checked = locked || Boolean(membership)
                          const disabled =
                            locked ||
                            user.disabled ||
                            platformAccessStatus === 'loading' ||
                            platformAccessStatus === 'saving'

                          return (
                            <div
                              key={module.id}
                              className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3"
                            >
                              <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={disabled}
                                  aria-label={`${user.login}: доступ к модулю ${module.name}`}
                                  onChange={(event) =>
                                    void handleTogglePlatformMembership(
                                      user,
                                      module.id,
                                      event.target.checked,
                                    )
                                  }
                                />
                                <span className="min-w-0 truncate">{module.name}</span>
                              </label>
                              <select
                                className="field"
                                value={locked ? 'leader' : membership?.moduleRole ?? 'employee'}
                                disabled={disabled || !membership}
                                aria-label={`${user.login}: роль в модуле ${module.name}`}
                                onChange={(event) =>
                                  void handleChangePlatformRole(
                                    user,
                                    module.id,
                                    event.target.value as ModuleRole,
                                  )
                                }
                              >
                                <option value="employee">Сотрудник</option>
                                <option value="leader">Лидер</option>
                              </select>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {canManageModuleUsers ? (
            <section className="panel grid gap-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="subtle-label">Команда</div>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">
                    Пользователи модуля
                  </h2>
                </div>
                <span className="badge-chip badge-neutral">{moduleUsersStatus}</span>
              </div>
              {moduleUsersError ? (
                <p className="text-sm font-semibold text-red-600">{moduleUsersError}</p>
              ) : null}

              <div className="grid gap-2 md:grid-cols-2">
                <input
                  className="field"
                  placeholder="имя"
                  value={newModuleUser.firstName}
                  onChange={(event) =>
                    setNewModuleUser((current) => ({
                      ...current,
                      firstName: event.target.value,
                    }))
                  }
                />
                <input
                  className="field"
                  placeholder="фамилия"
                  value={newModuleUser.lastName}
                  onChange={(event) =>
                    setNewModuleUser((current) => ({
                      ...current,
                      lastName: event.target.value,
                    }))
                  }
                />
                <input
                  className="field"
                  type="email"
                  placeholder="логин email"
                  value={newModuleUser.login}
                  onChange={(event) =>
                    setNewModuleUser((current) => ({
                      ...current,
                      login: event.target.value,
                    }))
                  }
                />
                <div className="flex gap-2">
                  <input
                    className="field"
                    type="text"
                    placeholder="пароль"
                    value={newModuleUser.password}
                    onChange={(event) =>
                      setNewModuleUser((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                  />
                  <button type="button" className="btn btn-ghost px-3" onClick={handleGeneratePassword}>
                    Сгенерировать
                  </button>
                </div>
                <select
                  className="field"
                  value={newModuleUser.role}
                  onChange={(event) =>
                    setNewModuleUser((current) => ({
                      ...current,
                      role: event.target.value as ModuleRole,
                    }))
                  }
                >
                  <option value="employee">Сотрудник</option>
                  <option value="leader">Лидер</option>
                </select>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void handleCreateModuleUser()}
                  disabled={moduleUsersStatus === 'loading'}
                >
                  Создать сотрудника
                </button>
              </div>

              {createdCredentials ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <div className="subtle-label text-emerald-800">Новые доступы</div>
                  <pre className="mt-2 whitespace-pre-wrap text-sm font-semibold text-emerald-950">
                    {createdCredentials}
                  </pre>
                  <button
                    type="button"
                    className="btn btn-ghost mt-3"
                    onClick={() => void handleCopyCredentials()}
                  >
                    Скопировать логин и пароль
                  </button>
                </div>
              ) : null}

              <div className="grid gap-2">
                {moduleUsers.map((user) => (
                  <div
                    key={user.id}
                    className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 xl:grid-cols-[1.2fr_1fr_1fr_9rem_auto_auto]"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-slate-900">
                        {user.login}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {user.disabled || user.membershipStatus === 'disabled'
                          ? 'Удален'
                          : 'Активен'}
                      </div>
                    </div>
                    <input
                      className="field"
                      placeholder="имя"
                      value={user.firstName ?? ''}
                      onChange={(event) =>
                        setModuleUsers((current) =>
                          current.map((item) =>
                            item.id === user.id
                              ? { ...item, firstName: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                    <input
                      className="field"
                      placeholder="фамилия"
                      value={user.lastName ?? ''}
                      onChange={(event) =>
                        setModuleUsers((current) =>
                          current.map((item) =>
                            item.id === user.id
                              ? { ...item, lastName: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                    <select
                      className="field"
                      value={user.moduleRole}
                      onChange={(event) =>
                        setModuleUsers((current) =>
                          current.map((item) =>
                            item.id === user.id
                              ? { ...item, moduleRole: event.target.value as ModuleRole }
                              : item,
                          ),
                        )
                      }
                    >
                      <option value="employee">Сотрудник</option>
                      <option value="leader">Лидер</option>
                    </select>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() =>
                        void handleUpdateModuleUser(user, {
                          firstName: user.firstName?.trim() || null,
                          lastName: user.lastName?.trim() || null,
                          role: user.moduleRole,
                        })
                      }
                    >
                      Обновить
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => void handleDeleteModuleUser(user)}
                      disabled={user.disabled || user.membershipStatus === 'disabled'}
                    >
                      Удалить
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </main>
    )
  }

  return (
    <main className="px-4 py-6 md:px-8 md:py-8">
      <div
        ref={shellRef}
        className={cn('relative mx-auto flex w-full max-w-[1420px] flex-col gap-6', {
          'cursor-crosshair': commentMode,
        })}
        onClick={handleShellClick}
        role="presentation"
      >
        <header className="panel p-4 md:p-5" data-no-comment="true">
          <div className="grid gap-4 lg:grid-cols-[minmax(280px,1fr)_auto] lg:items-center">
            <div>
              <p className="subtle-label">
                Модуль «{activeModule?.name ?? 'Привлечение'}»
              </p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900">
                {isLeadgenModule ? 'Лидогенерация' : 'PDCA-дашборд метрик'}
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                {isLeadgenModule
                  ? 'Лидген УС: стадии, источники, UTM и менеджеры.'
                  : 'Контур по продажам, делам, звонкам и когортам на базе локального Bitrix24 snapshot.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
              {ModuleSwitcher}
              <PaperclipNotifications
                notifications={commentNotifications}
                summary={notificationSummary}
                unreadCount={unreadCommentNotificationKeys.size}
                unreadKeys={unreadCommentNotificationKeys}
                onRead={markCommentNotificationsRead}
              />
              {accountUser ? (
                <button
                  type="button"
                  className="btn btn-ghost gap-2"
                  onClick={navigateToAccount}
                  aria-label="Личный кабинет"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white">
                    {getUserInitials(accountUser)}
                  </span>
                  <span>Личный кабинет</span>
                </button>
              ) : null}
              <span className="badge-chip badge-neutral">Desktop only</span>
              <span className="badge-chip badge-green">
                {activeScene.id === 'sales'
                  ? runtimeData.salesDashboard
                    ? 'Sales report live'
                    : 'Sales loading'
                  : runtimeData.operationalStatus === 'loading'
                    ? 'Загрузка live'
                    : runtimeData.operationalStatus === 'error'
                      ? 'Ошибка live'
                      : 'Live API'}
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-3">
            <button
              className="btn btn-ghost"
              onClick={() => void handleRefreshData()}
              disabled={syncStatus === 'syncing'}
              aria-busy={syncStatus === 'syncing'}
            >
              {syncStatus === 'syncing' ? 'Синхронизация...' : 'Обновить данные'}
            </button>
            <button className="btn btn-ghost" onClick={() => setCommentsOpen((current) => !current)}>
              Комментарии
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setCommentMode((current) => !current)
                setDraftComment(null)
              }}
            >
              {commentMode ? 'Выйти из comment mode' : 'Comment mode'}
            </button>
          </div>

          <div className="sync-strip mt-3" aria-live="polite">
            <div className="sync-strip-grid">
              <div>
                <div className="sync-strip-label">Snapshot</div>
                <div className="sync-strip-value">
                  {isLeadgenModule
                    ? leadgenReportStatus === 'loading'
                      ? 'Загрузка'
                      : leadgenReport
                        ? `${formatCount(leadgenReport.totalDeals)} сделок`
                        : 'Нет данных'
                    : snapshotStats
                    ? `${formatCount(snapshotStats.deals)} сделок`
                    : 'Нет данных'}
                </div>
                {isLeadgenModule ? (
                  leadgenSnapshotMeta ? (
                    <div className="sync-strip-meta">{leadgenSnapshotMeta}</div>
                  ) : null
                ) : snapshotStats ? (
                  <div className="sync-strip-meta">
                    {formatCount(snapshotStats.activities)} активностей ·{' '}
                    {formatCount(snapshotStats.calls)} звонков ·{' '}
                    {formatCount(snapshotStats.stageHistory)} стадий
                  </div>
                ) : null}
              </div>
              <div>
                <div className="sync-strip-label">
                  {isLeadgenModule ? 'Импорт лидгена' : 'Последний sync'}
                </div>
                <div className="sync-strip-value">
                  {isLeadgenModule
                    ? leadgenReport
                      ? 'Локальный snapshot'
                      : 'Еще не было'
                    : lastSync
                      ? formatDateTime(lastSync.finishedAt)
                      : 'Еще не было'}
                </div>
                <div className="sync-strip-meta">
                  {isLeadgenModule
                    ? 'Лидген УС · whitelist · с 01.01.2026'
                    : lastSync
                    ? `${formatSyncMode(lastSync.mode)} · ${formatDealBreakdown({
                        deals: lastSync.dealsSynced,
                        dealBreakdown: lastSync.dealBreakdown,
                      })}`
                    : 'Локальный snapshot ожидает первого успешного запуска'}
                </div>
              </div>
              <div>
                <div className="sync-strip-label">Текущий запуск</div>
                <div className="sync-strip-value">
                  {syncProgress?.message ??
                    (syncSummary
                      ? `${formatCount(syncSummary.changes.deals)} строк сделок из Bitrix за sync`
                      : 'Готов к запуску')}
                </div>
                <div className="sync-strip-meta">
                  {syncSummary
                    ? `${formatDealBreakdown(syncSummary.changes)} · ${formatCount(
                        syncSummary.changes.activities,
                      )} активностей · ${formatCount(
                        syncSummary.changes.calls,
                      )} звонков`
                    : 'Фазы: справочники, сделки, активности, звонки, SQLite'}
                </div>
              </div>
            </div>
            <div
              className="sync-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={syncProgress?.progress ?? 0}
            >
              <div
                className="sync-progress-fill"
                style={{ width: `${syncProgress?.progress ?? 0}%` }}
              />
            </div>
            {syncWarning ? (
              <div className="sync-notice sync-notice-warning">{syncWarning}</div>
            ) : null}
            {syncError ? (
              <div className="sync-notice sync-notice-error" role="alert">
                {syncError}
              </div>
            ) : null}
          </div>
        </header>

        <section
          className="panel p-5"
          data-comment-block-id="filters-panel"
          data-comment-block-label="Фильтры периода и среза"
        >
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
                Фильтры периода и среза
              </h3>
              <div className="text-sm font-semibold text-slate-700">
                Применено: {formatDateTime(lastFiltersApply)}
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-[minmax(0,330px)_minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-end">
              <div className="space-y-1.5">
                <label className="subtle-label">Основной диапазон</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={filters.rangeStart}
                    onChange={(event) => patchFilters({ rangeStart: event.target.value })}
                    className="field"
                  />
                  <input
                    type="date"
                    value={filters.rangeEnd}
                    onChange={(event) => patchFilters({ rangeEnd: event.target.value })}
                    className="field"
                  />
                </div>
              </div>
              <MultiSelectField
                label="Менеджеры"
                placeholder="Поиск менеджера"
                emptyLabel="Все менеджеры"
                options={availableManagerOptions}
                selected={filters.managers}
                onToggle={(value) => toggleFilterValue('managers', value)}
              />
              <MultiSelectField
                label="Источники"
                placeholder="Поиск источника"
                emptyLabel="Все источники"
                options={availableSourceOptions}
                selected={filters.sources}
                onToggle={(value) => toggleFilterValue('sources', value)}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-ghost h-[42px] whitespace-nowrap px-4"
                  onClick={addCompareRange}
                  disabled={filters.compareRanges.length >= 5}
                >
                  + Сравнение
                </button>
                <button
                  type="button"
                  className="btn btn-primary h-[42px] whitespace-nowrap px-5"
                  onClick={() => {
                    const nextFilters = cloneFilters(filters)
                    setAppliedFilters(nextFilters)
                    setSalesPlanQuarter(resolveSalesPlanQuarter(nextFilters))
                    setLastFiltersApply(new Date().toISOString())
                  }}
                >
                  Применить фильтры
                </button>
              </div>
            </div>

            {filters.compareRanges.length > 0 ? (
              <div className="mt-3 max-w-[980px] rounded-xl border border-slate-200 bg-white p-3 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="subtle-label">Периоды сравнения</div>
                    <div className="mt-1 text-sm text-slate-600">
                      До 5 окон сравнения, каждое можно удалить отдельно.
                    </div>
                  </div>
                  <span className="badge-chip badge-neutral">{filters.compareRanges.length}/5</span>
                </div>

                <div className="grid gap-3">
                  {filters.compareRanges.map((range, index) => (
                    <div
                      key={range.id}
                      className="grid max-w-[760px] gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 xl:grid-cols-[92px_170px_170px_120px]"
                    >
                      <div className="flex items-center text-sm font-semibold text-slate-700">
                        Период {index + 1}
                      </div>
                      <input
                        type="date"
                        value={range.start}
                        onChange={(event) => updateCompareRange(range.id, { start: event.target.value })}
                        className="field"
                      />
                      <input
                        type="date"
                        value={range.end}
                        onChange={(event) => updateCompareRange(range.id, { end: event.target.value })}
                        className="field"
                      />
                      <button
                        type="button"
                        className="btn btn-ghost h-[42px] whitespace-nowrap px-3"
                        onClick={() => removeCompareRange(range.id)}
                      >
                        Удалить
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <p className="mt-3 text-sm text-slate-500">
              Основной: {formatRangeLabel(filters.rangeStart, filters.rangeEnd)} | Сравнение:{' '}
              {summarizeCompareRanges(filters.compareRanges)} | Менеджеры:{' '}
              {summarizeSelection(filters.managers, availableManagerOptions, 'все')} | Источники:{' '}
              {summarizeSelection(filters.sources, availableSourceOptions, 'все')}
            </p>
          </div>
        </section>

        {isLeadgenModule ? (
          <LeadgenDashboard
            report={leadgenReport}
            status={leadgenReportStatus}
            error={leadgenReportError}
          />
        ) : (
          <>
            <section className="panel sticky top-3 z-20 flex flex-wrap gap-2 p-3" data-no-comment="true">
              {scenes.map((scene) => (
                <button
                  key={scene.id}
                  onClick={() => setActiveSceneId(scene.id)}
                  className={cn('tab-chip', {
                    'tab-chip-active': activeScene.id === scene.id,
                  })}
                >
                  {scene.label}
                </button>
              ))}
            </section>

            {activeScene.id !== 'sales' && visibleSceneKpis.length > 0 ? (
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {visibleSceneKpis.map((metric) => (
                  <div key={metric.label} className="metric p-4">
                    <p className="subtle-label">{metric.label}</p>
                    <div className="mt-1 flex items-start justify-between gap-3">
                      <p className="text-xl font-bold text-slate-800">{metric.value}</p>
                      {metric.delta ? (
                        <span
                          className={cn(
                            'rounded-full px-2 py-1 text-[0.68rem] font-bold',
                            metric.deltaTone === 'negative' && 'bg-rose-50 text-rose-700',
                            metric.deltaTone === 'positive' && 'bg-emerald-50 text-emerald-700',
                            (!metric.deltaTone || metric.deltaTone === 'neutral') &&
                              'bg-slate-100 text-slate-600',
                          )}
                        >
                          {metric.delta}
                        </span>
                      ) : null}
                    </div>
                    {metric.note ? <p className="text-xs text-slate-500">{metric.note}</p> : null}
                    {metric.compare ? (
                      <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600">
                        {metric.compare}
                      </p>
                    ) : null}
                  </div>
                ))}
              </section>
            ) : null}

            {runtimeData.operationalError ? (
              <div
                role="alert"
                className="panel border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
              >
                {runtimeData.operationalError}
              </div>
            ) : null}

            <ActiveSceneComponent
              commentMode={commentMode}
              filters={appliedFilters}
              runtimeData={runtimeData}
              salesPlanQuarter={salesPlanQuarter}
              salesPlanLoading={salesPlanLoading}
              salesPlanSaving={salesPlanSaving}
              salesPlanSaveError={salesPlanSaveError}
              onSalesPlanQuarterChange={setSalesPlanQuarter}
              onSalesPlanSave={handleSaveSalesPlan}
              pricingSettings={runtimeData.pricingSettings}
              pricingSettingsLoading={pricingSettingsLoading}
              pricingSettingsSaving={pricingSettingsSaving}
              pricingSettingsSaveError={pricingSettingsSaveError}
              onPricingSettingsSave={handleSavePricingSettings}
            />
          </>
        )}

        <aside
          className={cn(
            'panel fixed top-4 right-4 bottom-4 z-40 flex w-full max-w-xl flex-col gap-4 overflow-hidden p-5 transition-transform duration-200',
            commentsOpen ? 'translate-x-0' : 'translate-x-[calc(100%+1rem)]',
          )}
          data-no-comment="true"
        >
          <div className="flex shrink-0 items-start justify-between gap-3">
            <div>
              <div className="subtle-label">Комментарии модуля</div>
              <h2 className="mt-1 text-xl font-bold text-slate-900">{sceneComments.length} заметок</h2>
              <p className="mt-1 text-sm text-slate-500">
                {updatedAt
                  ? `Последнее сохранение: ${formatDateTime(updatedAt)}`
                  : 'Заметок пока нет'}
              </p>
            </div>
            <span className="badge-chip badge-neutral">{status}</span>
          </div>

          {error ? <p className="shrink-0 text-sm text-red-600">{error}</p> : null}

          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1"
            data-comment-panel-body="true"
          >
            <div className="flex flex-col gap-4">
              <div className="panel w-full p-4">
                <div className="subtle-label">
                  {draftComment?.id ? 'Редактирование' : 'Новая заметка'}
                </div>
                {draftComment?.anchor ? (
                  <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    Блок: <span className="font-semibold text-slate-800">{draftComment.anchor.blockLabel}</span>
                  </div>
                ) : null}
                <div className="mt-3">
                  <Textarea
                    value={draftComment?.text ?? ''}
                    onChange={(event) =>
                      setDraftComment((current) =>
                        current ? { ...current, text: event.target.value } : current,
                      )
                    }
                    placeholder="Комментарий к точке интерфейса..."
                    disabled={!draftComment || commentSavePending}
                    className="max-h-48 overflow-y-auto overscroll-contain"
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="btn btn-primary"
                    onClick={() => void handleSaveComment()}
                    disabled={
                      !draftComment ||
                      draftComment.text.trim().length === 0 ||
                      commentSavePending
                    }
                    aria-busy={commentSavePending}
                  >
                    {commentSavePending ? 'Сохраняем...' : 'Сохранить'}
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={closeCommentDraft}
                    disabled={!draftComment || commentSavePending || commentReworkPending}
                  >
                    Отмена
                  </button>
                  {draftComment?.id && canArchiveComments ? (
                    <button
                      className="btn btn-ghost"
                      onClick={() => void handleArchiveComment(draftComment.id!)}
                      disabled={commentSavePending || commentReworkPending}
                    >
                      В архив
                    </button>
                  ) : null}
                  {draftComment?.id &&
                  comments.find((comment) => comment.id === draftComment.id)
                    ?.paperclipSyncStatus === 'failed' ? (
                    <button
                      className="btn btn-ghost"
                      onClick={() => void handleRetryComment(draftComment.id!)}
                      disabled={commentSavePending || commentReworkPending}
                    >
                      Повторить
                    </button>
                  ) : null}
                </div>
                <DevelopmentReadyReport
                  report={draftComment?.paperclipReadyReport}
                  status={draftComment?.paperclipStatus}
                />
                <DevelopmentThreadHistory thread={draftComment?.paperclipThread} />
                {draftComment?.id &&
                canArchiveComments &&
                comments.find((comment) => comment.id === draftComment.id)?.paperclipIssueId ? (
                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <div className="subtle-label">Вернуть команде разработки</div>
                    <div className="mt-2">
                      <Textarea
                        value={reworkText}
                        onChange={(event) => setReworkText(event.target.value)}
                        placeholder="Комментарий к доработке..."
                        disabled={commentReworkPending}
                        className="min-h-40 max-h-64 overflow-y-auto overscroll-contain"
                      />
                    </div>
                    <div
                      className="sticky bottom-0 z-10 -mx-1 mt-3 flex bg-white/95 px-1 py-2 backdrop-blur"
                      data-rework-actions="true"
                    >
                      <button
                        className="btn btn-dark w-full sm:w-auto"
                        onClick={() => void handleReworkComment(draftComment.id!)}
                        disabled={reworkText.trim().length === 0 || commentReworkPending}
                        aria-busy={commentReworkPending}
                      >
                        {commentReworkPending ? 'Отправляем...' : 'На доработку'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col gap-2">
                {sceneComments.length === 0 ? (
                  <div className="panel p-4 text-sm text-slate-500">
                    Включи `Comment mode` и кликни в любом месте страницы.
                  </div>
                ) : (
                  sceneComments.map((comment, index) => (
                    <button
                      key={comment.id}
                      type="button"
                      className={cn('panel grid grid-cols-[2rem_minmax(0,1fr)] gap-3 p-3 text-left', {
                        'border-blue-300': draftComment?.id === comment.id,
                      })}
                      onClick={() => openExistingComment(comment)}
                    >
                      <div className="grid aspect-square place-items-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-900">{comment.text}</div>
                        {comment.anchor ? (
                          <div className="mt-1 truncate text-xs text-slate-500">
                            Блок: {comment.anchor.blockLabel}
                          </div>
                        ) : null}
                        <div className="mt-1 text-xs text-slate-500">{formatDateTime(comment.updatedAt)}</div>
                        {comment.paperclipStatus ? (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span
                              className={cn(
                                'badge-chip',
                                notificationClasses[comment.paperclipStatus],
                              )}
                            >
                              {notificationLabels[comment.paperclipStatus]}
                            </span>
                            {comment.paperclipSyncStatus === 'failed' ? (
                              <span className="text-xs text-red-600">
                                {comment.paperclipError
                                  ? formatDevelopmentTeamError(comment.paperclipError)
                                  : 'Команда разработки недоступна'}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

        </aside>

        {sceneComments.map((comment, index) => (
          <button
            key={comment.id}
            type="button"
            className={cn(
              'absolute z-30 inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-xs font-bold text-white shadow-lg',
              draftComment?.id === comment.id && 'bg-blue-600',
            )}
            style={{
              left: `${comment.x * 100}%`,
              top: `${comment.y * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
            onClick={(event) => {
              event.stopPropagation()
              openExistingComment(comment)
            }}
            aria-label={`Комментарий ${index + 1}`}
          >
            {index + 1}
          </button>
        ))}

        {draftComment && draftComment.id === null ? (
          <div
            className="absolute z-30 h-6 w-6 rounded-full border-2 border-dashed border-blue-500"
            style={{
              left: `${draftComment.x * 100}%`,
              top: `${draftComment.y * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        ) : null}
      </div>
    </main>
  )
}

export default ProtoApp
