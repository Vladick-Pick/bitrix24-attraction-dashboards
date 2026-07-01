import type {
  OntologyConcept,
  OntologyDriftItem,
  OntologyReportBinding,
  OntologySourceRef,
  OntologySourceDocumentResponse,
  OntologyStatus,
  OntologyTransition,
} from '@/lib/dashboard-types'
import { apiClient } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import type { SceneComponentProps } from '@/proto/types'
import { useEffect, useRef, useState } from 'react'
import type { MouseEvent, ReactNode, RefObject } from 'react'

const statusLabels: Record<OntologyStatus, string> = {
  confirmed: 'Подтверждено',
  'needs-sync': 'Нужна сверка',
  draft: 'Черновик',
  deprecated: 'Устарело',
  unclassified: 'Не классифицировано',
}

const statusClasses: Record<OntologyStatus, string> = {
  confirmed: 'badge-green',
  'needs-sync': 'badge-amber',
  draft: 'badge-neutral',
  deprecated: 'badge-red',
  unclassified: 'badge-neutral',
}

const conceptTypeLabels: Record<OntologyConcept['type'], string> = {
  stage: 'Этап',
  transition: 'Переход',
  outcome: 'Исход',
  delivery_quality: 'Качество поставки',
  format: 'Формат',
  source: 'Источник',
}

const sourceKindLabels: Record<OntologySourceRef['kind'], string> = {
  bitrix: 'Bitrix',
  dashboard: 'Дашборд',
  decision: 'Решение',
  'google-doc': 'Регламент',
  'google-sheet': 'Таблица',
  markdown: 'Документ',
}

const sourceCanonicalityLabels: Record<OntologySourceRef['canonicality'], string> = {
  canonical: 'Канон',
  decision: 'Решение',
  implementation: 'Реализация',
  supporting: 'Evidence',
}

const canonicalityOrder: OntologySourceRef['canonicality'][] = [
  'canonical',
  'decision',
  'implementation',
  'supporting',
]

const reportSceneLabels: Record<string, string> = {
  'activities-calls': 'Отчет активности',
  cohorts: 'Когортный отчет',
  'funnel-flow': 'Движение по воронке',
  ontology: 'Онтология',
  'revenue-velocity': 'Денежная скорость',
  sales: 'Отчет по продажам',
  'sales-plan': 'План продаж',
  settings: 'Настройки',
}

const driftSeverityClasses: Record<OntologyDriftItem['severity'], string> = {
  info: 'border-slate-200 bg-slate-50 text-slate-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  blocking: 'border-rose-200 bg-rose-50 text-rose-900',
}

const driftSeverityBadges: Record<OntologyDriftItem['severity'], string> = {
  info: 'badge-neutral',
  warning: 'badge-amber',
  blocking: 'badge-red',
}

function getStatusLabel(status: OntologyStatus) {
  return statusLabels[status] ?? statusLabels.unclassified
}

function getStatusClass(status: OntologyStatus) {
  return statusClasses[status] ?? statusClasses.unclassified
}

function findConceptLabel(concepts: OntologyConcept[], conceptId: string) {
  return concepts.find((concept) => concept.id === conceptId)?.label ?? conceptId
}

function resolveReportBindings(
  concept: OntologyConcept,
  reportBindings: OntologyReportBinding[],
) {
  return concept.reportBindingIds
    .map((bindingId) => reportBindings.find((binding) => binding.id === bindingId))
    .filter((binding): binding is OntologyReportBinding => Boolean(binding))
}

function getReportSceneLabel(sceneId: string) {
  return reportSceneLabels[sceneId] ?? sceneId
}

function formatBitrixBinding(concept: OntologyConcept) {
  const bitrix = concept.bitrix
  if (!bitrix) {
    return 'Без привязки к Bitrix'
  }

  const parts: string[] = []
  if (bitrix.categoryId) {
    parts.push(`Категория ${bitrix.categoryId}`)
  }
  if (bitrix.stageId) {
    parts.push(bitrix.stageId)
  }
  if (bitrix.fieldCode) {
    parts.push(bitrix.fieldCode)
  }
  if (bitrix.enumValue) {
    parts.push(bitrix.enumValue)
  }

  return parts.length > 0 ? parts.join(' · ') : 'Без привязки к Bitrix'
}

function getModelStatus(drift: OntologyDriftItem[]) {
  if (drift.some((item) => item.severity === 'blocking')) {
    return { label: 'Блокирующий drift', badge: 'badge-red' }
  }
  if (drift.some((item) => item.severity === 'warning')) {
    return { label: 'Нужна сверка', badge: 'badge-amber' }
  }
  return { label: 'Согласовано', badge: 'badge-green' }
}

function summarizeDrift(drift: OntologyDriftItem[]) {
  if (drift.length === 0) {
    return 'Расхождений не найдено'
  }

  const counts = { blocking: 0, warning: 0, info: 0 }
  for (const item of drift) {
    counts[item.severity] += 1
  }

  const parts: string[] = []
  if (counts.blocking > 0) {
    parts.push(`${counts.blocking} блокир.`)
  }
  if (counts.warning > 0) {
    parts.push(`${counts.warning} warning`)
  }
  if (counts.info > 0) {
    parts.push(`${counts.info} info`)
  }

  return `${parts.join(' · ')} к сверке`
}

function findReportTarget(href: string) {
  if (!href.startsWith('#') || typeof document === 'undefined') {
    return null
  }

  const blockId = href.slice(1)
  return (
    document.getElementById(blockId) ??
    Array.from(document.querySelectorAll('[data-comment-block-id]')).find(
      (element) => element.getAttribute('data-comment-block-id') === blockId,
    ) ??
    null
  )
}

function handleReportBindingClick(
  event: MouseEvent<HTMLAnchorElement>,
  binding: OntologyReportBinding,
  onSceneNavigate?: ((sceneId: string, blockId?: string) => void) | undefined,
) {
  const target = findReportTarget(binding.href)
  if (!target) {
    if (onSceneNavigate) {
      event.preventDefault()
      onSceneNavigate(binding.sceneId, binding.blockId)
    }
    return
  }

  event.preventDefault()
  window.history.pushState(null, '', `/${binding.href}`)
  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function isReadableLocalSource(source: OntologySourceRef) {
  return (
    source.href.startsWith('docs/modules/attraction/') &&
    source.href.endsWith('.md')
  )
}

function parseMarkdownTableRow(line: string) {
  const trimmed = line.trim()
  if (!trimmed.startsWith('|') || !trimmed.includes('|')) {
    return null
  }

  const cells = trimmed
    .replace(/^\|/u, '')
    .replace(/\|$/u, '')
    .split('|')
    .map((cell) => cell.trim())

  return cells.length > 1 ? cells : null
}

function isMarkdownTableDelimiter(cells: string[]) {
  return cells.every((cell) => /^:?-{3,}:?$/u.test(cell.replace(/\s/gu, '')))
}

function renderMarkdownTable(
  headers: string[],
  rows: string[][],
  key: string,
) {
  return (
    <div key={key} className="my-3 overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-600">
          <tr>
            {headers.map((header, index) => (
              <th
                key={`${key}-header-${index}`}
                className="border-b border-slate-200 px-3 py-2 align-top"
                scope="col"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
          {rows.map((row, rowIndex) => (
            <tr key={`${key}-row-${rowIndex}`}>
              {headers.map((_, cellIndex) => (
                <td
                  key={`${key}-row-${rowIndex}-cell-${cellIndex}`}
                  className="px-3 py-2 align-top leading-6"
                >
                  {row[cellIndex] ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function renderMarkdownLine(line: string, index: number) {
  if (line.startsWith('### ')) {
    return (
      <h4 key={index} className="mt-4 text-sm font-bold text-slate-900">
        {line.slice(4)}
      </h4>
    )
  }

  if (line.startsWith('## ')) {
    return (
      <h3 key={index} className="mt-5 text-base font-bold text-slate-900">
        {line.slice(3)}
      </h3>
    )
  }

  if (line.startsWith('# ')) {
    return (
      <h2 key={index} className="text-lg font-bold text-slate-900">
        {line.slice(2)}
      </h2>
    )
  }

  if (line.startsWith('- ')) {
    return (
      <p key={index} className="pl-4 text-sm leading-6 text-slate-700">
        - {line.slice(2)}
      </p>
    )
  }

  if (!line.trim()) {
    return <div key={index} className="h-2" />
  }

  return (
    <p key={index} className="text-sm leading-6 text-slate-700">
      {line}
    </p>
  )
}

function renderMarkdownContent(content: string) {
  const lines = content.split(/\r?\n/)
  const nodes: Array<ReturnType<typeof renderMarkdownLine>> = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    const nextLine = lines[index + 1]
    const headerCells = parseMarkdownTableRow(line)
    const delimiterCells =
      nextLine !== undefined ? parseMarkdownTableRow(nextLine) : null

    if (
      headerCells &&
      delimiterCells &&
      headerCells.length === delimiterCells.length &&
      isMarkdownTableDelimiter(delimiterCells)
    ) {
      const rows: string[][] = []
      let rowIndex = index + 2

      while (rowIndex < lines.length) {
        const rowLine = lines[rowIndex]
        const rowCells =
          rowLine !== undefined ? parseMarkdownTableRow(rowLine) : null
        if (!rowCells) {
          break
        }

        rows.push(rowCells)
        rowIndex += 1
      }

      nodes.push(renderMarkdownTable(headerCells, rows, `table-${index}`))
      index = rowIndex - 1
    } else {
      nodes.push(renderMarkdownLine(line, index))
    }
  }

  return nodes
}

function SectionHeader({
  eyebrow,
  title,
  description,
  trailing,
}: {
  eyebrow: string
  title: string
  description: string
  trailing?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="subtle-label">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-bold text-slate-900">{title}</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  )
}

function NotEqualsList({ values }: { values: string[] }) {
  if (values.length === 0) {
    return null
  }

  return (
    <div className="om-not-list">
      {values.map((value) => (
        <span key={value} className="om-not-chip">
          <span aria-hidden className="om-not-glyph">
            ≠
          </span>
          {value}
        </span>
      ))}
    </div>
  )
}

function ConceptNode({
  concept,
  index,
  selected,
  linked,
  variant,
  onSelect,
}: {
  concept: OntologyConcept
  index?: number
  selected: boolean
  linked: boolean
  variant: 'stage' | 'branch' | 'exit'
  onSelect: (conceptId: string) => void
}) {
  const showMarker = variant === 'stage'

  return (
    <button
      aria-pressed={selected}
      className={cn(
        'om-node',
        `om-node-${variant}`,
        selected && 'is-selected',
        linked && !selected && 'is-linked',
      )}
      data-status={concept.status}
      onClick={() => onSelect(concept.id)}
      type="button"
    >
      {showMarker ? (
        <span aria-hidden className="om-node-marker">
          <span className="om-node-dot" />
        </span>
      ) : null}
      <span className="om-node-card">
        <span className="om-node-top">
          {typeof index === 'number' ? (
            <span className="om-node-index">{String(index).padStart(2, '0')}</span>
          ) : null}
          <span className="om-node-label">{concept.label}</span>
          {concept.status !== 'confirmed' ? (
            <span className={cn('badge-chip', getStatusClass(concept.status), 'om-node-flag')}>
              {getStatusLabel(concept.status)}
            </span>
          ) : null}
        </span>
        <span className="om-node-meta">
          {concept.bitrix?.stageId ? (
            <span className="om-mono">{concept.bitrix.stageId}</span>
          ) : (
            <span className="om-muted">{conceptTypeLabels[concept.type]}</span>
          )}
        </span>
      </span>
    </button>
  )
}

function ProcessMap({
  concepts,
  conceptById,
  transitions,
  selectedId,
  linkedIds,
  onSelect,
}: {
  concepts: OntologyConcept[]
  conceptById: Map<string, OntologyConcept>
  transitions: OntologyTransition[]
  selectedId: string | null
  linkedIds: Set<string>
  onSelect: (conceptId: string) => void
}) {
  const stages = concepts.filter((concept) => concept.type === 'stage')
  const outcomes = concepts.filter((concept) => concept.type === 'outcome')

  const stageOutcomeTargets = new Set(
    transitions
      .filter(
        (transition) =>
          conceptById.get(transition.fromConceptId)?.type === 'stage' &&
          conceptById.get(transition.toConceptId)?.type === 'outcome',
      )
      .map((transition) => transition.toConceptId),
  )

  const exitOutcomes = outcomes.filter((outcome) => !stageOutcomeTargets.has(outcome.id))

  return (
    <div className="om-canvas" data-testid="ontology-process-map">
      <div className="om-canvas-head">
        <p className="subtle-label">Линия процесса</p>
        <span className="om-canvas-count">{stages.length} этапов</span>
      </div>

      <ol className="om-spine">
        {stages.map((stage, index) => {
          const branches = transitions
            .filter(
              (transition) =>
                transition.fromConceptId === stage.id &&
                conceptById.get(transition.toConceptId)?.type === 'outcome',
            )
            .map((transition) => conceptById.get(transition.toConceptId))
            .filter((outcome): outcome is OntologyConcept => Boolean(outcome))

          return (
            <li className="om-stage" key={stage.id}>
              <ConceptNode
                concept={stage}
                index={index + 1}
                linked={linkedIds.has(stage.id)}
                onSelect={onSelect}
                selected={selectedId === stage.id}
                variant="stage"
              />
              {branches.length > 0 ? (
                <div className="om-branches">
                  {branches.map((outcome) => (
                    <div className="om-branch" key={outcome.id}>
                      <ConceptNode
                        concept={outcome}
                        linked={linkedIds.has(outcome.id)}
                        onSelect={onSelect}
                        selected={selectedId === outcome.id}
                        variant="branch"
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </li>
          )
        })}
      </ol>

      {exitOutcomes.length > 0 ? (
        <div className="om-exits">
          <p className="subtle-label om-exits-label">Прочие выходы из процесса</p>
          <div className="om-exits-grid">
            {exitOutcomes.map((outcome) => (
              <ConceptNode
                concept={outcome}
                key={outcome.id}
                linked={linkedIds.has(outcome.id)}
                onSelect={onSelect}
                selected={selectedId === outcome.id}
                variant="exit"
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="om-legend">
        <span className="om-legend-item">
          <span className="om-legend-dot" data-status="confirmed" /> подтверждено
        </span>
        <span className="om-legend-item">
          <span className="om-legend-dot" data-status="needs-sync" /> нужна сверка
        </span>
        <span className="om-legend-item">
          <span className="om-legend-line" /> подтвержденный переход
        </span>
      </div>
    </div>
  )
}

function ConceptInspector({
  concept,
  concepts,
  stages,
  sources,
  transitions,
  reportBindings,
  onOpenSource,
  onSceneNavigate,
}: {
  concept: OntologyConcept | null
  concepts: OntologyConcept[]
  stages: OntologyConcept[]
  sources: OntologySourceRef[]
  transitions: OntologyTransition[]
  reportBindings: OntologyReportBinding[]
  onOpenSource: (source: OntologySourceRef) => void
  onSceneNavigate?: ((sceneId: string, blockId?: string) => void) | undefined
}) {
  if (!concept) {
    return (
      <aside className="om-inspector" data-testid="ontology-inspector">
        <p className="om-inspector-empty">
          Выберите концепт на карте, чтобы открыть карточку модели.
        </p>
      </aside>
    )
  }

  const outgoing = transitions.filter((transition) => transition.fromConceptId === concept.id)
  const incoming = transitions.filter((transition) => transition.toConceptId === concept.id)
  const conceptSources = concept.sourceIds
    .map((sourceId) => sources.find((source) => source.id === sourceId))
    .filter((source): source is OntologySourceRef => Boolean(source))
  const conceptReports = resolveReportBindings(concept, reportBindings)
  const stageIndex = stages.findIndex((stage) => stage.id === concept.id)

  return (
    <aside className="om-inspector" data-testid="ontology-inspector">
      <div className="om-inspector-head">
        <div>
          <p className="subtle-label">{conceptTypeLabels[concept.type]} · карточка модели</p>
          <h3 className="om-inspector-title">{concept.label}</h3>
        </div>
        <span className={cn('badge-chip', getStatusClass(concept.status))}>
          {getStatusLabel(concept.status)}
        </span>
      </div>

      <dl className="om-facts">
        <div className="om-fact">
          <dt>Тип</dt>
          <dd>{conceptTypeLabels[concept.type]}</dd>
        </div>
        {stageIndex >= 0 ? (
          <div className="om-fact">
            <dt>Позиция</dt>
            <dd>
              Этап {stageIndex + 1} из {stages.length}
            </dd>
          </div>
        ) : null}
        <div className="om-fact om-fact-wide">
          <dt>Bitrix</dt>
          <dd className="om-mono">{formatBitrixBinding(concept)}</dd>
        </div>
      </dl>

      <div className="om-inspector-def">
        <p className="subtle-label">Определение</p>
        <p className="om-inspector-def-text">{concept.definition}</p>
      </div>

      {concept.not.length > 0 ? (
        <div className="om-inspector-block">
          <p className="subtle-label">Не равно</p>
          <NotEqualsList values={concept.not} />
        </div>
      ) : null}

      {outgoing.length > 0 || incoming.length > 0 ? (
        <div className="om-inspector-block">
          <p className="subtle-label">Переходы</p>
          <ul className="om-trans-list">
            {outgoing.map((transition) => (
              <li className="om-trans" key={`out-${transition.id}`}>
                <span className="om-trans-flow">
                  <span className="om-strong">{concept.label}</span>
                  <span aria-hidden className="om-arrow">
                    →
                  </span>
                  <span>{findConceptLabel(concepts, transition.toConceptId)}</span>
                </span>
                {transition.trigger ? (
                  <span className="om-trans-trigger">{transition.trigger}</span>
                ) : null}
              </li>
            ))}
            {incoming.map((transition) => (
              <li className="om-trans" key={`in-${transition.id}`}>
                <span className="om-trans-flow">
                  <span>{findConceptLabel(concepts, transition.fromConceptId)}</span>
                  <span aria-hidden className="om-arrow">
                    →
                  </span>
                  <span className="om-strong">{concept.label}</span>
                </span>
                {transition.trigger ? (
                  <span className="om-trans-trigger">{transition.trigger}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {conceptSources.length > 0 ? (
        <div className="om-inspector-block">
          <p className="subtle-label">Evidence</p>
          <div className="om-evidence-list">
            {conceptSources.map((source) =>
              isReadableLocalSource(source) ? (
                <button
                  className="om-evidence"
                  key={source.id}
                  onClick={() => onOpenSource(source)}
                  type="button"
                >
                  <span className="om-evidence-kind">
                    {sourceCanonicalityLabels[source.canonicality]}
                  </span>
                  <span className="om-evidence-label">{source.label}</span>
                </button>
              ) : (
                <a
                  className="om-evidence"
                  href={source.href}
                  key={source.id}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span className="om-evidence-kind">
                    {sourceCanonicalityLabels[source.canonicality]}
                  </span>
                  <span className="om-evidence-label">{source.label}</span>
                </a>
              ),
            )}
          </div>
        </div>
      ) : null}

      {conceptReports.length > 0 ? (
        <div className="om-inspector-block">
          <p className="subtle-label">Где в отчетах</p>
          <div className="om-report-chips">
            {conceptReports.map((report) => (
              <a
                className="om-chip"
                href={report.href}
                key={report.id}
                onClick={(event) => handleReportBindingClick(event, report, onSceneNavigate)}
              >
                {report.label}
              </a>
            ))}
          </div>
        </div>
      ) : null}

      {concept.status !== 'confirmed' ? (
        <p className="om-inspector-warn">
          Концепт помечен как требующий сверки. Уточните трактовку в источниках до использования в
          отчетах.
        </p>
      ) : null}
    </aside>
  )
}

function SourceCardContent({ source }: { source: OntologySourceRef }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="badge-chip badge-neutral">{sourceKindLabels[source.kind]}</span>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[0.68rem] font-bold text-slate-600">
          {sourceCanonicalityLabels[source.canonicality]}
        </span>
      </div>
      <p className="mt-3 text-sm font-bold leading-5 text-slate-900">{source.label}</p>
      <p className="mt-2 break-all text-xs leading-5 text-slate-500">{source.href}</p>
    </>
  )
}

function SourceLink({
  source,
  onOpenSource,
}: {
  source: OntologySourceRef
  onOpenSource: (source: OntologySourceRef) => void
}) {
  const className =
    'rounded-xl border border-slate-200 bg-white/80 p-4 text-left shadow-sm transition hover:border-slate-300 hover:bg-white focus-visible:outline-none focus-visible:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-400'

  if (isReadableLocalSource(source)) {
    return (
      <button className={className} type="button" onClick={() => onOpenSource(source)}>
        <SourceCardContent source={source} />
      </button>
    )
  }

  return (
    <a className={className} href={source.href} rel="noreferrer" target="_blank">
      <SourceCardContent source={source} />
    </a>
  )
}

function SourceDocumentReader({
  readerRef,
  state,
}: {
  readerRef?: RefObject<HTMLDivElement | null>
  state:
    | {
        status: 'loading'
        source: OntologySourceRef
      }
    | {
        status: 'ready'
        document: OntologySourceDocumentResponse
      }
    | {
        status: 'error'
        source: OntologySourceRef
        message: string
      }
    | null
}) {
  if (!state) {
    return null
  }

  const source = state.status === 'ready' ? state.document.source : state.source

  return (
    <div
      className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4"
      data-testid="ontology-source-document-reader"
      ref={readerRef}
      tabIndex={-1}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="subtle-label">Просмотр документа</p>
          <h3 className="mt-1 text-base font-bold text-slate-900">{source.label}</h3>
          <p className="mt-1 break-all text-xs text-slate-500">{source.href}</p>
        </div>
        <span className="badge-chip badge-neutral">{sourceKindLabels[source.kind]}</span>
      </div>

      {state.status === 'loading' ? (
        <p className="mt-4 text-sm font-semibold text-slate-600">Загружаю документ...</p>
      ) : null}

      {state.status === 'error' ? (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">
          {state.message}
        </p>
      ) : null}

      {state.status === 'ready' ? (
        <article className="mt-4 max-h-[560px] overflow-auto rounded-lg border border-slate-200 bg-white p-4">
          <div className="grid gap-1">{renderMarkdownContent(state.document.content)}</div>
        </article>
      ) : null}
    </div>
  )
}

function TrustTile({
  label,
  value,
  badge,
  children,
}: {
  label: string
  value?: string
  badge?: { text: string; className: string }
  children?: ReactNode
}) {
  return (
    <div className="metric om-trust-tile">
      <p className="subtle-label">{label}</p>
      {badge ? (
        <span className={cn('badge-chip', badge.className, 'om-trust-badge')}>{badge.text}</span>
      ) : null}
      {value ? <p className="om-trust-value">{value}</p> : null}
      {children}
    </div>
  )
}

export function OntologyHubScene({ runtimeData, onSceneNavigate }: SceneComponentProps) {
  const ontology = runtimeData?.attractionOntology
  const sourceDocumentReaderRef = useRef<HTMLDivElement | null>(null)
  const sourceDocumentRequestIdRef = useRef(0)
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null)
  const [sourceDocumentState, setSourceDocumentState] = useState<
    | {
        status: 'loading'
        source: OntologySourceRef
      }
    | {
        status: 'ready'
        document: OntologySourceDocumentResponse
      }
    | {
        status: 'error'
        source: OntologySourceRef
        message: string
      }
    | null
  >(null)

  useEffect(() => {
    if (!sourceDocumentState) {
      return
    }

    sourceDocumentReaderRef.current?.scrollIntoView?.({
      behavior: 'smooth',
      block: 'start',
    })
    sourceDocumentReaderRef.current?.focus?.({ preventScroll: true })
  }, [sourceDocumentState])

  async function openSourceDocument(source: OntologySourceRef) {
    const requestId = sourceDocumentRequestIdRef.current + 1
    sourceDocumentRequestIdRef.current = requestId
    setSourceDocumentState({ status: 'loading', source })

    try {
      const document = await apiClient.getAttractionOntologySourceDocument(source.id)
      if (sourceDocumentRequestIdRef.current !== requestId) {
        return
      }

      setSourceDocumentState({
        status: 'ready',
        document,
      })
    } catch {
      if (sourceDocumentRequestIdRef.current !== requestId) {
        return
      }

      setSourceDocumentState({
        status: 'error',
        source,
        message: 'Не удалось открыть локальный документ.',
      })
    }
  }

  if (!ontology) {
    return (
      <section
        className="panel p-5"
        data-comment-block-id="attraction-ontology-overview"
        data-comment-block-label="Онтология: обзор"
        id="attraction-ontology-overview"
      >
        <SectionHeader
          description="Данные онтологии еще загружаются или недоступны для текущего модуля."
          eyebrow="Онтология"
          title="Нет данных онтологии"
        />
      </section>
    )
  }

  const concepts = ontology.concepts
  const conceptById = new Map(concepts.map((concept) => [concept.id, concept]))
  const stageConcepts = concepts.filter((concept) => concept.type === 'stage')
  const outcomeConcepts = concepts.filter((concept) => concept.type === 'outcome')
  const transitions = ontology.transitions
  const drift = ontology.drift
  const sources = ontology.sources
  const reportBindings = ontology.reportBindings

  const confirmedConcepts = concepts.filter((concept) => concept.status === 'confirmed').length
  const needsSyncConcepts = concepts.filter(
    (concept) => concept.status === 'needs-sync',
  ).length
  const confirmedTransitions = transitions.filter(
    (transition) => transition.status === 'confirmed',
  ).length
  const modelStatus = getModelStatus(drift)

  const defaultConceptId = stageConcepts[0]?.id ?? concepts[0]?.id ?? null
  const selectedId = selectedConceptId ?? defaultConceptId
  const selectedConcept = selectedId ? conceptById.get(selectedId) ?? null : null

  const linkedIds = new Set<string>()
  if (selectedId) {
    for (const transition of transitions) {
      if (transition.fromConceptId === selectedId) {
        linkedIds.add(transition.toConceptId)
      }
      if (transition.toConceptId === selectedId) {
        linkedIds.add(transition.fromConceptId)
      }
    }
  }

  const groupedSources = canonicalityOrder
    .map((canonicality) => ({
      canonicality,
      items: sources.filter((source) => source.canonicality === canonicality),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <div className="grid gap-6">
      <section
        className="panel p-5"
        data-comment-block-id="attraction-ontology-overview"
        data-comment-block-label="Онтология: обзор"
        id="attraction-ontology-overview"
      >
        <SectionHeader
          description="Живая модель Привлечения: процесс, исходы, evidence и расхождения с Bitrix в одном рабочем месте."
          eyebrow="Онтология Привлечения"
          title={ontology.title}
          trailing={
            <span className={cn('badge-chip', modelStatus.badge)}>{modelStatus.label}</span>
          }
        />
        <div className="om-trust-grid">
          <TrustTile
            badge={{ text: modelStatus.label, className: modelStatus.badge }}
            label="Статус модели"
          >
            <p className="om-trust-meta">{summarizeDrift(drift)}</p>
          </TrustTile>
          <TrustTile label="Концепты" value={`${confirmedConcepts} / ${concepts.length}`}>
            <p className="om-trust-meta">
              подтверждено · {needsSyncConcepts} на сверке · {stageConcepts.length} этапов
            </p>
          </TrustTile>
          <TrustTile label="Переходы" value={String(transitions.length)}>
            <p className="om-trust-meta">{confirmedTransitions} подтверждено</p>
          </TrustTile>
          <TrustTile label="Сверка и решение" value={ontology.lastReviewedAt}>
            <p className="om-trust-owner">{ontology.governance.decisionRole}</p>
            <p className="om-trust-meta">{ontology.governance.decisionUnit}</p>
          </TrustTile>
        </div>
      </section>

      <section
        className="panel p-5"
        data-comment-block-id="attraction-ontology-process-map"
        data-comment-block-label="Онтология: карта процесса"
        id="attraction-ontology-process-map"
      >
        <SectionHeader
          description="Этапы и подтвержденные переходы как связная линия процесса. Выберите узел, чтобы открыть его карточку справа."
          eyebrow="Процесс"
          title="Карта процесса и инспектор"
        />
        <div className="om-workbench">
          <ProcessMap
            conceptById={conceptById}
            concepts={concepts}
            linkedIds={linkedIds}
            onSelect={setSelectedConceptId}
            selectedId={selectedId}
            transitions={transitions}
          />
          <ConceptInspector
            concept={selectedConcept}
            concepts={concepts}
            onOpenSource={openSourceDocument}
            onSceneNavigate={onSceneNavigate}
            reportBindings={reportBindings}
            sources={sources}
            stages={stageConcepts}
            transitions={transitions}
          />
        </div>
      </section>

      <section
        className="panel p-5"
        data-comment-block-id="attraction-ontology-outcomes"
        data-comment-block-label="Онтология: исходы"
        data-testid="ontology-outcomes"
        id="attraction-ontology-outcomes"
      >
        <SectionHeader
          description="Проигрыши, возвраты и успешные окончания, которые должны одинаково читаться в регламентах, Bitrix и отчетах. Клик выделяет концепт в инспекторе."
          eyebrow="Исходы"
          title="Реестр исходов"
        />
        <div className="om-ledger">
          {outcomeConcepts.map((outcome) => (
            <button
              aria-pressed={selectedId === outcome.id}
              className={cn('om-ledger-row', selectedId === outcome.id && 'is-selected')}
              key={outcome.id}
              onClick={() => setSelectedConceptId(outcome.id)}
              type="button"
            >
              <div className="om-ledger-main">
                <div className="om-ledger-head">
                  <span className="om-ledger-name">{outcome.label}</span>
                  <span className={cn('badge-chip', getStatusClass(outcome.status))}>
                    {getStatusLabel(outcome.status)}
                  </span>
                </div>
                <p className="om-ledger-def">{outcome.definition}</p>
                <NotEqualsList values={outcome.not} />
              </div>
              <div className="om-ledger-side">
                <span className="om-mono">{formatBitrixBinding(outcome)}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section
        className="panel p-5"
        data-comment-block-id="attraction-ontology-sources"
        data-comment-block-label="Онтология: источники"
        data-testid="ontology-sources"
        id="attraction-ontology-sources"
      >
        <SectionHeader
          description="Регламенты, таблицы, markdown-документы и Bitrix metadata, на которых держится текущая трактовка. Локальные документы открываются прямо здесь."
          eyebrow="Источники"
          title="Evidence и канон"
        />
        <SourceDocumentReader
          readerRef={sourceDocumentReaderRef}
          state={sourceDocumentState}
        />
        <div className="om-evidence-groups">
          {groupedSources.map((group) => (
            <div className="om-evidence-group" key={group.canonicality}>
              <p className="subtle-label om-evidence-group-label">
                {sourceCanonicalityLabels[group.canonicality]}
                <span className="om-count">{group.items.length}</span>
              </p>
              <div className="om-source-grid">
                {group.items.map((source) => (
                  <SourceLink
                    key={source.id}
                    onOpenSource={openSourceDocument}
                    source={source}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section
        className="panel p-5"
        data-comment-block-id="attraction-ontology-report-links"
        data-comment-block-label="Онтология: связи с отчетами"
        data-testid="ontology-report-links"
        id="attraction-ontology-report-links"
      >
        <SectionHeader
          description="Каждая связь указывает, в каком отчете пользователь увидит метрику или блок, завязанный на концепт."
          eyebrow="Отчеты"
          title="Связанные блоки дашборда"
        />
        <div className="om-reportlinks">
          {reportBindings.map((binding) => (
            <a
              className="om-reportlink"
              href={binding.href}
              key={binding.id}
              onClick={(event) => handleReportBindingClick(event, binding, onSceneNavigate)}
            >
              <span className="om-reportlink-main">
                <span className="badge-chip badge-neutral">
                  {getReportSceneLabel(binding.sceneId)}
                </span>
                <span className="om-reportlink-label">{binding.label}</span>
              </span>
              <span className="om-mono om-muted">{binding.blockId}</span>
            </a>
          ))}
        </div>
      </section>

      <section
        className="panel p-5"
        data-comment-block-id="attraction-ontology-drift"
        data-comment-block-label="Онтология: drift"
        id="attraction-ontology-drift"
      >
        <SectionHeader
          description="Список расхождений между текущей Bitrix-настройкой, registry и отчетными связями."
          eyebrow="Drift"
          title="Расхождения к сверке"
          trailing={
            drift.length > 0 ? (
              <span className="om-drift-summary">{summarizeDrift(drift)}</span>
            ) : null
          }
        />
        {drift.length === 0 ? (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
            Расхождений не найдено. Текущий stage catalog покрыт онтологией Привлечения.
          </div>
        ) : (
          <ul className="om-drift-list">
            {drift.map((item) => (
              <li
                className={cn('om-drift-row', driftSeverityClasses[item.severity])}
                key={`${item.kind}:${item.label}:${item.message}`}
              >
                <div className="om-drift-head">
                  <span className={cn('badge-chip', driftSeverityBadges[item.severity])}>
                    {item.severity}
                  </span>
                  <span className="om-drift-label">{item.label}</span>
                  <span className="om-drift-kind">{item.kind}</span>
                </div>
                <p className="om-drift-message">{item.message}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
