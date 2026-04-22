import { useMemo, useRef, useState } from 'react'
import type { MouseEvent } from 'react'

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
import { cn } from '@/lib/utils'
import {
  defaultFilters,
  managerOptions,
  scenes,
  sourceOptions,
} from '@/proto/scenes'
import type {
  CompareRange,
  PickerOption,
  ProtoComment,
  ProtoFilterState,
} from '@/proto/types'
import { useProtoComments } from '@/proto/use-proto-comments'

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString('ru-RU', { hour12: false })
}

function formatShortDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
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

function createCompareRange(): CompareRange {
  return {
    id: crypto.randomUUID(),
    start: '2026-02-01',
    end: '2026-02-28',
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

export default function App() {
  const [activeSceneId, setActiveSceneId] = useState(scenes[0]?.id ?? 'sales')
  const [commentMode, setCommentMode] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [filters, setFilters] = useState<ProtoFilterState>(defaultFilters)
  const [lastFiltersApply, setLastFiltersApply] = useState(
    new Date('2026-04-10T11:42:00.000Z').toISOString(),
  )
  const [draftComment, setDraftComment] = useState<{
    id: string | null
    x: number
    y: number
    text: string
  } | null>(null)

  const shellRef = useRef<HTMLDivElement>(null)
  const {
    comments,
    updatedAt,
    status,
    error,
    upsertComment,
    removeComment,
    archiveComment,
  } = useProtoComments()

  const activeScene = useMemo(
    () => scenes.find((scene) => scene.id === activeSceneId) ?? scenes[0]!,
    [activeSceneId],
  )
  const sceneComments = useMemo(
    () =>
      comments.filter(
        (comment) =>
          comment.sceneId === activeScene.id &&
          (comment.status ?? 'open') === 'open',
      ),
    [activeScene.id, comments],
  )
  const ActiveSceneComponent = activeScene.component

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
        compareRanges: [...current.compareRanges, createCompareRange()],
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

  function openNewComment(x: number, y: number) {
    setDraftComment({ id: null, x, y, text: '' })
    setCommentsOpen(true)
  }

  function openExistingComment(comment: ProtoComment) {
    setDraftComment({
      id: comment.id,
      x: comment.x,
      y: comment.y,
      text: comment.text,
    })
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
    )
  }

  async function handleSaveComment() {
    if (!draftComment) {
      return
    }

    const text = draftComment.text.trim()
    if (!text) {
      return
    }

    const now = new Date().toISOString()
    await upsertComment({
      id: draftComment.id ?? crypto.randomUUID(),
      sceneId: activeScene.id,
      x: draftComment.x,
      y: draftComment.y,
      text,
      createdAt:
        comments.find((item) => item.id === draftComment.id)?.createdAt ?? now,
      updatedAt: now,
      status: 'open',
      archivedAt: null,
    })
    setDraftComment(null)
    setCommentsOpen(false)
  }

  function closeCommentDraft() {
    setDraftComment(null)
    setCommentsOpen(false)
  }

  async function handleRemoveComment(commentId: string) {
    await removeComment(commentId)
    setDraftComment(null)
    setCommentsOpen(false)
  }

  async function handleArchiveComment(commentId: string) {
    await archiveComment(commentId)
    setDraftComment(null)
    setCommentsOpen(false)
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
              <p className="subtle-label">Модуль «Привлечение»</p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900">PDCA-дашборд метрик</h1>
              <p className="mt-1 text-sm text-slate-600">
                Контур по продажам, делам, звонкам и когортам на базе дизайна из лидогенерации.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
              <span className="badge-chip badge-neutral">Desktop only</span>
              <span className="badge-chip badge-green">Локальный mock</span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-3">
            <button className="btn btn-ghost" onClick={() => setLastFiltersApply(new Date().toISOString())}>
              Обновить mock
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
        </header>

        <section className="panel p-5" data-no-comment="true">
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
                options={managerOptions}
                selected={filters.managers}
                onToggle={(value) => toggleFilterValue('managers', value)}
              />
              <MultiSelectField
                label="Источники"
                placeholder="Поиск источника"
                emptyLabel="Все источники"
                options={sourceOptions}
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
                  onClick={() => setLastFiltersApply(new Date().toISOString())}
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
              {summarizeSelection(filters.managers, managerOptions, 'все')} | Источники:{' '}
              {summarizeSelection(filters.sources, sourceOptions, 'все')}
            </p>
          </div>
        </section>

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

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {activeScene.kpis.map((metric) => (
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

        <ActiveSceneComponent commentMode={commentMode} filters={filters} />

        <aside
          className={cn(
            'panel fixed top-4 right-4 bottom-4 z-40 flex w-full max-w-xl flex-col gap-4 p-5 transition-transform duration-200',
            commentsOpen ? 'translate-x-0' : 'translate-x-[calc(100%+1rem)]',
          )}
          data-no-comment="true"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="subtle-label">Локальные комментарии</div>
              <h2 className="mt-1 text-xl font-bold text-slate-900">{sceneComments.length} заметок</h2>
              <p className="mt-1 text-sm text-slate-500">
                {updatedAt
                  ? `Последнее сохранение: ${formatDateTime(updatedAt)}`
                  : '.codex/proto-comments/comments.json'}
              </p>
            </div>
            <span className="badge-chip badge-neutral">{status}</span>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="panel w-full p-4">
            <div className="subtle-label">
              {draftComment?.id ? 'Редактирование' : 'Новая заметка'}
            </div>
            <div className="mt-3">
              <Textarea
                value={draftComment?.text ?? ''}
                onChange={(event) =>
                  setDraftComment((current) =>
                    current ? { ...current, text: event.target.value } : current,
                  )
                }
                placeholder="Комментарий к точке интерфейса..."
                disabled={!draftComment}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="btn btn-primary"
                onClick={() => void handleSaveComment()}
                disabled={!draftComment || draftComment.text.trim().length === 0}
              >
                Сохранить
              </button>
              <button
                className="btn btn-ghost"
                onClick={closeCommentDraft}
                disabled={!draftComment}
              >
                Отмена
              </button>
              {draftComment?.id ? (
                <button
                  className="btn btn-ghost"
                  onClick={() => void handleArchiveComment(draftComment.id!)}
                >
                  В архив
                </button>
              ) : null}
              {draftComment?.id ? (
                <button
                  className="btn btn-ghost"
                  onClick={() => void handleRemoveComment(draftComment.id!)}
                >
                  Удалить
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-2 overflow-auto">
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
                    <div className="mt-1 text-xs text-slate-500">{formatDateTime(comment.updatedAt)}</div>
                  </div>
                </button>
              ))
            )}
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
