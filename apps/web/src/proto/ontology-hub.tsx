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
import type { SceneComponentProps } from '@/proto/types'
import { useEffect, useRef, useState } from 'react'
import type { MouseEvent, RefObject } from 'react'

const statusLabels: Record<OntologyStatus, string> = {
  confirmed: 'Подтверждено',
  'needs-sync': 'Нужна сверка',
  draft: 'Черновик',
  deprecated: 'Устарело',
  unclassified: 'Не классифицировано',
}

const statusClasses: Record<OntologyStatus, string> = {
  confirmed: 'badge-green',
  'needs-sync': 'badge-neutral',
  draft: 'badge-neutral',
  deprecated: 'badge-neutral',
  unclassified: 'badge-neutral',
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

function getStatusLabel(status: OntologyStatus) {
  return statusLabels[status] ?? statusLabels.unclassified
}

function getStatusClass(status: OntologyStatus) {
  return statusClasses[status] ?? statusClasses.unclassified
}

function findConceptLabel(concepts: OntologyConcept[], conceptId: string) {
  return concepts.find((concept) => concept.id === conceptId)?.label ?? conceptId
}

function resolveSourceLabels(concept: OntologyConcept, sources: OntologySourceRef[]) {
  return concept.sourceIds
    .map((sourceId) => sources.find((source) => source.id === sourceId)?.label)
    .filter((label): label is string => Boolean(label))
}

function resolveReportBindings(
  concept: OntologyConcept,
  reportBindings: OntologyReportBinding[],
) {
  return concept.reportBindingIds
    .map((bindingId) => reportBindings.find((binding) => binding.id === bindingId))
    .filter((binding): binding is OntologyReportBinding => Boolean(binding))
}

function sortByLabel<T extends { label: string }>(items: T[]) {
  return [...items].sort((left, right) => left.label.localeCompare(right.label, 'ru'))
}

function getReportSceneLabel(sceneId: string) {
  return reportSceneLabels[sceneId] ?? sceneId
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
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="subtle-label">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-bold text-slate-900">{title}</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
      </div>
    </div>
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
    'rounded-xl border border-slate-200 bg-white/80 p-4 text-left shadow-sm transition hover:border-slate-300 hover:bg-white'

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

function OutcomeCard({
  concept,
  sources,
  reportBindings,
  onSceneNavigate,
}: {
  concept: OntologyConcept
  sources: OntologySourceRef[]
  reportBindings: OntologyReportBinding[]
  onSceneNavigate?: ((sceneId: string, blockId?: string) => void) | undefined
}) {
  const sourceLabels = resolveSourceLabels(concept, sources)
  const relatedReports = resolveReportBindings(concept, reportBindings)

  return (
    <article className="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold text-slate-900">{concept.label}</h3>
        <span className={`badge-chip ${getStatusClass(concept.status)}`}>
          {getStatusLabel(concept.status)}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-700">{concept.definition}</p>
      {concept.not.length > 0 ? (
        <p className="mt-3 text-xs leading-5 text-slate-500">
          Не равно: {concept.not.join(', ')}
        </p>
      ) : null}
      {sourceLabels.length > 0 ? (
        <p className="mt-3 text-xs leading-5 text-slate-500">
          Источники: {sourceLabels.join(', ')}
        </p>
      ) : null}
      {relatedReports.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {relatedReports.map((report) => (
            <a
              key={report.id}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-white"
              href={report.href}
              onClick={(event) =>
                handleReportBindingClick(event, report, onSceneNavigate)
              }
            >
              {report.label}
            </a>
          ))}
        </div>
      ) : null}
    </article>
  )
}

function TransitionRow({
  transition,
  concepts,
}: {
  transition: OntologyTransition
  concepts: OntologyConcept[]
}) {
  return (
    <li className="rounded-xl border border-slate-200 bg-white/80 p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-900">
        <span>{findConceptLabel(concepts, transition.fromConceptId)}</span>
        <span className="text-slate-400">{'->'}</span>
        <span>{findConceptLabel(concepts, transition.toConceptId)}</span>
        <span className={`badge-chip ${getStatusClass(transition.status)}`}>
          {getStatusLabel(transition.status)}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{transition.definition}</p>
      {transition.trigger ? (
        <p className="mt-2 text-xs font-semibold uppercase text-slate-500">
          Основание: {transition.trigger}
        </p>
      ) : null}
    </li>
  )
}

export function OntologyHubScene({ runtimeData, onSceneNavigate }: SceneComponentProps) {
  const ontology = runtimeData?.attractionOntology
  const sourceDocumentReaderRef = useRef<HTMLDivElement | null>(null)
  const sourceDocumentRequestIdRef = useRef(0)
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

  const stageConcepts = ontology.concepts.filter((concept) => concept.type === 'stage')
  const outcomeConcepts = sortByLabel(
    ontology.concepts.filter((concept) => concept.type === 'outcome'),
  )
  const drift = ontology.drift
  const foundationSource = ontology.sources.find((source) => source.id === 'module_ontology')

  return (
    <div className="grid gap-6">
      <section
        className="panel p-5"
        data-comment-block-id="attraction-ontology-overview"
        data-comment-block-label="Онтология: обзор"
        id="attraction-ontology-overview"
      >
        <SectionHeader
          description="Единая карта смыслов Привлечения: источники, статусы, процессные расхождения и привязка к отчетам."
          eyebrow="Онтология Привлечения"
          title={ontology.title}
        />
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="sync-strip">
            <div className="sync-strip-label">Статус</div>
            <div className="sync-strip-value">
              {drift.some((item) => item.severity === 'blocking')
                ? 'Есть блокирующий drift'
                : drift.length > 0
                  ? 'Нужна сверка'
                  : 'Согласовано'}
            </div>
            <div className="sync-strip-meta">Drift items: {drift.length}</div>
          </div>
          <div className="sync-strip">
            <div className="sync-strip-label">Последняя сверка</div>
            <div className="sync-strip-value">{ontology.lastReviewedAt}</div>
            <div className="sync-strip-meta">
              <span>{ontology.governance.decisionRole}</span>
              <span> · </span>
              <span>{ontology.governance.decisionUnit}</span>
            </div>
          </div>
          <div className="sync-strip">
            <div className="sync-strip-label">Основание</div>
            <div className="sync-strip-value">{foundationSource?.label ?? 'Registry'}</div>
            <div className="sync-strip-meta">Каноническая трактовка процесса</div>
          </div>
        </div>
      </section>

      <section
        className="panel p-5"
        data-comment-block-id="attraction-ontology-process-map"
        data-comment-block-label="Онтология: карта процесса"
        id="attraction-ontology-process-map"
      >
        <SectionHeader
          description="Stage-концепты и подтвержденные переходы, которые связывают Bitrix-настройку с канонической трактовкой процесса."
          eyebrow="Процесс"
          title="Карта процесса"
        />
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {stageConcepts.map((concept) => (
            <div key={concept.id} className="rounded-xl border border-slate-200 bg-white/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900">{concept.label}</h3>
                <span className={`badge-chip ${getStatusClass(concept.status)}`}>
                  {getStatusLabel(concept.status)}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{concept.definition}</p>
              {concept.bitrix?.stageId ? (
                <p className="mt-3 text-xs font-semibold text-slate-500">
                  Bitrix: {concept.bitrix.stageId}
                </p>
              ) : null}
            </div>
          ))}
        </div>
        {ontology.transitions.length > 0 ? (
          <ul className="mt-5 grid gap-3 md:grid-cols-2">
            {ontology.transitions.map((transition) => (
              <TransitionRow
                key={transition.id}
                concepts={ontology.concepts}
                transition={transition}
              />
            ))}
          </ul>
        ) : null}
      </section>

      <section
        className="panel p-5"
        data-comment-block-id="attraction-ontology-outcomes"
        data-comment-block-label="Онтология: исходы"
        data-testid="ontology-outcomes"
        id="attraction-ontology-outcomes"
      >
        <SectionHeader
          description="Проигрыши, возвраты и успешные окончания, которые должны одинаково читаться в регламентах, Bitrix и отчетах."
          eyebrow="Исходы"
          title="Карточки исходов"
        />
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {outcomeConcepts.map((concept) => (
            <OutcomeCard
              key={concept.id}
              concept={concept}
              onSceneNavigate={onSceneNavigate}
              reportBindings={ontology.reportBindings}
              sources={ontology.sources}
            />
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
          description="Регламенты, таблицы, markdown-документы и Bitrix metadata, на которых держится текущая трактовка."
          eyebrow="Источники"
          title="Ссылки на evidence"
        />
        <SourceDocumentReader
          readerRef={sourceDocumentReaderRef}
          state={sourceDocumentState}
        />
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {ontology.sources.map((source) => (
            <SourceLink
              key={source.id}
              source={source}
              onOpenSource={openSourceDocument}
            />
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
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {ontology.reportBindings.map((binding) => (
            <a
              key={binding.id}
              className="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm hover:border-slate-300 hover:bg-white"
              href={binding.href}
              onClick={(event) =>
                handleReportBindingClick(event, binding, onSceneNavigate)
              }
            >
              <span className="badge-chip badge-neutral">{getReportSceneLabel(binding.sceneId)}</span>
              <p className="mt-3 text-sm font-bold text-slate-900">{binding.label}</p>
              <p className="mt-2 text-xs text-slate-500">{binding.blockId}</p>
              <p className="mt-1 break-all text-xs font-semibold text-slate-500">{binding.href}</p>
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
          title="Статус расхождений"
        />
        {drift.length === 0 ? (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
            Расхождений не найдено. Текущий stage catalog покрыт онтологией Привлечения.
          </div>
        ) : (
          <ul className="mt-5 grid gap-3">
            {drift.map((item) => (
              <li
                key={`${item.kind}:${item.label}:${item.message}`}
                className={`rounded-xl border p-4 ${driftSeverityClasses[item.severity]}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/70 px-2 py-1 text-[0.68rem] font-bold uppercase">
                    {item.severity}
                  </span>
                  <span className="text-sm font-bold">{item.label}</span>
                </div>
                <p className="mt-2 text-sm leading-6">{item.message}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
