import { useMemo, useState } from 'react'

import type {
  ConversionEventTypeSettingsData,
  ConversionEventTypeSettingsInput,
  DealPricingRuleInput,
  DealPricingSettings,
  ManagerWhitelistSettingsData,
  ManagerWhitelistSettingsInput,
} from '@/lib/dashboard-types'
import { formatAmount, formatInteger } from '@/lib/formatters'

type ModuleSettingsPanelProps = {
  canEdit: boolean
  pricingSettings?: DealPricingSettings | undefined
  conversionEventTypeSettings?: ConversionEventTypeSettingsData | undefined
  managerWhitelistSettings?: ManagerWhitelistSettingsData | undefined
  pricingSettingsLoading?: boolean
  pricingSettingsSaving?: boolean
  pricingSettingsSaveError?: string | null
  conversionEventTypeSettingsLoading?: boolean
  conversionEventTypeSettingsSaving?: boolean
  conversionEventTypeSettingsSaveError?: string | null
  managerWhitelistSettingsLoading?: boolean
  managerWhitelistSettingsSaving?: boolean
  managerWhitelistSettingsSaveError?: string | null
  managerWhitelistSettingsNotice?: string | null
  onPricingSettingsSave?: (rows: DealPricingRuleInput[]) => Promise<void>
  onConversionEventTypeSettingsSave?: (
    input: ConversionEventTypeSettingsInput,
  ) => Promise<void>
  onManagerWhitelistSettingsSave?: (
    input: ManagerWhitelistSettingsInput,
  ) => Promise<void>
}

function getEnabledWhitelistManagerIds(
  managerWhitelistSettings: ManagerWhitelistSettingsData | undefined,
) {
  return (managerWhitelistSettings?.settings ?? [])
    .filter((setting) => setting.enabled)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((setting) => setting.managerId)
}

function buildManagerWhitelistRows(
  managerWhitelistSettings: ManagerWhitelistSettingsData | undefined,
) {
  const settings = managerWhitelistSettings?.settings ?? []
  const options = managerWhitelistSettings?.options ?? []
  const settingById = new Map(settings.map((setting) => [setting.managerId, setting]))
  const optionById = new Map(options.map((option) => [option.id, option]))
  const ids = new Set([...options.map((option) => option.id), ...settings.map((setting) => setting.managerId)])

  return Array.from(ids)
    .map((id, index) => {
      const setting = settingById.get(id)
      const option = optionById.get(id)

      return {
        id,
        name: option?.name ?? setting?.managerName ?? id,
        sortOrder: setting?.sortOrder ?? index * 10,
      }
    })
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
}

export function ModuleSettingsPanel({
  canEdit,
  pricingSettings,
  conversionEventTypeSettings,
  managerWhitelistSettings,
  pricingSettingsLoading = false,
  pricingSettingsSaving = false,
  pricingSettingsSaveError = null,
  conversionEventTypeSettingsLoading = false,
  conversionEventTypeSettingsSaving = false,
  conversionEventTypeSettingsSaveError = null,
  managerWhitelistSettingsLoading = false,
  managerWhitelistSettingsSaving = false,
  managerWhitelistSettingsSaveError = null,
  managerWhitelistSettingsNotice = null,
  onPricingSettingsSave,
  onConversionEventTypeSettingsSave,
  onManagerWhitelistSettingsSave,
}: ModuleSettingsPanelProps) {
  const [draftPricingEdits, setDraftPricingEdits] = useState<
    Record<string, Partial<Pick<DealPricingRuleInput, 'attractionRevenueAmount' | 'enabled'>>>
  >({})
  const draftPricingRows = useMemo(
    () =>
      (pricingSettings?.rules ?? []).map((rule) => ({
        id: rule.id,
        customerLabel: rule.customerLabel,
        tariffLabel: rule.tariffLabel,
        attractionRevenueAmount: rule.attractionRevenueAmount,
        enabled: rule.enabled,
        sortOrder: rule.sortOrder,
        ...(draftPricingEdits[rule.id] ?? {}),
      })),
    [draftPricingEdits, pricingSettings?.rules],
  )
  const totalEnabledAmount = useMemo(
    () =>
      draftPricingRows
        .filter((row) => row.enabled)
        .reduce((total, row) => total + row.attractionRevenueAmount, 0),
    [draftPricingRows],
  )

  const eventTypeOptions = useMemo(
    () => conversionEventTypeSettings?.options ?? [],
    [conversionEventTypeSettings?.options],
  )
  const selectedEventTypeIdsFromSettings = useMemo(
    () =>
      eventTypeOptions
        .filter((option) => option.selectedForPlannedInventory)
        .map((option) => option.id),
    [eventTypeOptions],
  )
  const [draftSelectedEventTypeIds, setDraftSelectedEventTypeIds] = useState<
    string[] | null
  >(null)
  const selectedEventTypeIds =
    draftSelectedEventTypeIds ?? selectedEventTypeIdsFromSettings

  const managerRows = useMemo(
    () => buildManagerWhitelistRows(managerWhitelistSettings),
    [managerWhitelistSettings],
  )
  const selectedManagerIdsFromSettings = useMemo(
    () => getEnabledWhitelistManagerIds(managerWhitelistSettings),
    [managerWhitelistSettings],
  )
  const [draftManagerIds, setDraftManagerIds] = useState<string[] | null>(null)
  const selectedManagerIds = draftManagerIds ?? selectedManagerIdsFromSettings

  function updatePricingRule(
    ruleId: string,
    patch: Partial<Pick<DealPricingRuleInput, 'attractionRevenueAmount' | 'enabled'>>,
  ) {
    if (!canEdit) {
      return
    }

    setDraftPricingEdits((current) => ({
      ...current,
      [ruleId]: {
        ...(current[ruleId] ?? {}),
        ...patch,
      },
    }))
  }

  function toggleEventType(eventTypeId: string) {
    if (!canEdit) {
      return
    }

    setDraftSelectedEventTypeIds((current) => {
      const source = current ?? selectedEventTypeIdsFromSettings

      return source.includes(eventTypeId)
        ? source.filter((id) => id !== eventTypeId)
        : [...source, eventTypeId]
    })
  }

  function toggleManager(managerId: string) {
    if (!canEdit) {
      return
    }

    setDraftManagerIds((current) => {
      const source = current ?? selectedManagerIdsFromSettings

      return source.includes(managerId)
        ? source.filter((id) => id !== managerId)
        : [...source, managerId]
    })
  }

  return (
    <section className="panel grid gap-5 p-5" aria-labelledby="module-settings-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="subtle-label">Настройки модуля</div>
          <h2 id="module-settings-title" className="mt-1 text-xl font-bold text-slate-900">
            Настройки модуля
          </h2>
        </div>
        <span className="badge-chip badge-neutral">
          {canEdit ? 'Редактирование' : 'Только просмотр'}
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white/80">
          <div className="grid min-w-[42rem] grid-cols-[minmax(10rem,1fr)_minmax(9rem,0.8fr)_10rem_7rem] gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
            <span>Заказчик</span>
            <span>Тариф</span>
            <span>Доход</span>
            <span>Активно</span>
          </div>

          {pricingSettingsLoading && draftPricingRows.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-500">Загружаю цены.</div>
          ) : draftPricingRows.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-500">Правила цен не настроены.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {draftPricingRows.map((row) => (
                <div
                  key={row.id}
                  className="grid min-w-[42rem] grid-cols-[minmax(10rem,1fr)_minmax(9rem,0.8fr)_10rem_7rem] gap-3 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-950">{row.customerLabel}</div>
                    <div className="truncate text-xs text-slate-500">{row.id}</div>
                  </div>
                  <div className="self-center font-medium text-slate-700">{row.tariffLabel}</div>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    className="field h-10"
                    value={row.attractionRevenueAmount}
                    disabled={!canEdit}
                    onChange={(event) =>
                      updatePricingRule(row.id, {
                        attractionRevenueAmount: Math.max(0, Number(event.target.value) || 0),
                      })
                    }
                    aria-label={`Цена ${row.customerLabel} ${row.tariffLabel}`}
                  />
                  <label className="flex items-center gap-2 self-center text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      disabled={!canEdit}
                      onChange={(event) => updatePricingRule(row.id, { enabled: event.target.checked })}
                    />
                    Да
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <div className="subtle-label">Правила цен</div>
          <div className="mt-2 text-2xl font-bold text-slate-950">
            {formatAmount(totalEnabledAmount)}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            {formatInteger(draftPricingRows.filter((row) => row.enabled).length)} правил
          </div>
          {pricingSettingsSaveError ? (
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {pricingSettingsSaveError}
            </div>
          ) : null}
          {canEdit ? (
            <button
              type="button"
              className="btn btn-primary mt-4 w-full"
              disabled={pricingSettingsSaving || draftPricingRows.length === 0}
              onClick={() => void onPricingSettingsSave?.(draftPricingRows)}
            >
              {pricingSettingsSaving ? 'Сохранение...' : 'Сохранить цены'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white/80 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold uppercase text-slate-500">
              Плановые мероприятия
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Типы мероприятий, которые попадают в плановый отчет даже без приглашенных.
            </p>
          </div>
          <span className="badge-chip badge-neutral">
            {formatInteger(selectedEventTypeIds.length)} выбрано
          </span>
        </div>

        {conversionEventTypeSettingsLoading && eventTypeOptions.length === 0 ? (
          <div className="mt-4 text-sm text-slate-500">Загружаю типы мероприятий.</div>
        ) : eventTypeOptions.length === 0 ? (
          <div className="mt-4 text-sm text-slate-500">Типы мероприятий пока не загружены.</div>
        ) : (
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {eventTypeOptions.map((option) => (
              <label
                key={option.id}
                className="flex min-h-12 items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selectedEventTypeIds.includes(option.id)}
                  disabled={!canEdit}
                  onChange={() => toggleEventType(option.id)}
                />
                <span className="min-w-0">
                  <span className="block font-semibold text-slate-900">{option.title}</span>
                  <span className="block truncate text-xs text-slate-500">{option.id}</span>
                </span>
              </label>
            ))}
          </div>
        )}

        {conversionEventTypeSettingsSaveError ? (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {conversionEventTypeSettingsSaveError}
          </div>
        ) : null}
        {canEdit ? (
          <button
            type="button"
            className="btn btn-primary mt-4"
            disabled={conversionEventTypeSettingsSaving}
            onClick={() =>
              void onConversionEventTypeSettingsSave?.({
                eventTypeIds: selectedEventTypeIds,
              })
            }
          >
            {conversionEventTypeSettingsSaving ? 'Сохранение...' : 'Сохранить мероприятия'}
          </button>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white/80 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold uppercase text-slate-500">
              Вайтлист менеджеров
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Эти менеджеры используются в отчетах, фильтрах и привязке сотрудников.
            </p>
          </div>
          <span className="badge-chip badge-neutral">
            {formatInteger(selectedManagerIds.length)} менеджеров
          </span>
        </div>

        {managerWhitelistSettingsLoading && managerRows.length === 0 ? (
          <div className="mt-4 text-sm text-slate-500">Загружаю менеджеров.</div>
        ) : managerRows.length === 0 ? (
          <div className="mt-4 text-sm text-slate-500">Вайтлист менеджеров пуст.</div>
        ) : (
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {managerRows.map((manager) => (
              <label
                key={manager.id}
                className="flex min-h-12 items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selectedManagerIds.includes(manager.id)}
                  disabled={!canEdit}
                  onChange={() => toggleManager(manager.id)}
                />
                <span className="min-w-0">
                  <span className="block font-semibold text-slate-900">{manager.name}</span>
                  <span className="block truncate text-xs text-slate-500">{manager.id}</span>
                </span>
              </label>
            ))}
          </div>
        )}

        {managerWhitelistSettingsNotice ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
            {managerWhitelistSettingsNotice}
          </div>
        ) : null}
        {managerWhitelistSettingsSaveError ? (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {managerWhitelistSettingsSaveError}
          </div>
        ) : null}
        {canEdit ? (
          <button
            type="button"
            className="btn btn-primary mt-4"
            disabled={managerWhitelistSettingsSaving}
            onClick={() =>
              void onManagerWhitelistSettingsSave?.({
                managerIds: managerRows
                  .filter((manager) => selectedManagerIds.includes(manager.id))
                  .map((manager) => manager.id),
              })
            }
          >
            {managerWhitelistSettingsSaving ? 'Сохранение...' : 'Сохранить менеджеров'}
          </button>
        ) : null}
      </div>
    </section>
  )
}
