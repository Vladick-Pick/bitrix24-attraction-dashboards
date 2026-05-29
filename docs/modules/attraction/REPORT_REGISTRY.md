# Attraction Report Registry

## ontology-hub

- Module: `attraction`.
- Registry contract: [attraction-ontology.json](./ontology/registry/attraction-ontology.json).
- Validation: `pnpm ontology:validate`.
- Source hierarchy: Bitrix shows the factual process configuration; regulations
  and sheets are evidence; ontology registry records the canonical
  interpretation; drift is classified by the governance role/unit.
- Update registry and this report registry when Bitrix stages, enum reasons,
  fields, SLA rules, report logic, or the conversion event catalog changes.
- Review drift before deploy.
- Do not add the separate Лидген УС contour to this registry or dashboard scene.

Stable dashboard anchors used by ontology report bindings:

- `attraction-funnel-flow`
- `attraction-acquisition-outcomes`
- `attraction-conversion-events`
- `attraction-activities-sla`
- `attraction-revenue-velocity`
- `attraction-ontology-drift`

## activities-calls

### Message metrics research

- Current research note: [MESSAGE_METRICS_RESEARCH.md](./MESSAGE_METRICS_RESEARCH.md).
- Bitrix-only implementation can count non-system Open Lines messages through
  `imopenlines.session.history.get` without persisting message text.
- Exact `sent` / `received` split is not confirmed from Bitrix-only data because
  external Wazzup/OLChat messages may be recorded as `imconnector` messages even
  when sent outside Bitrix.

### Stage/loss-reason table

- Module: `attraction`.
- Backend contract: `buildAcquisitionOutcomesReport` aggregates cached `deal_snapshots` rows whose `stage_semantic_id` is lost (`F`) and whose resolved lost date is inside the requested range.
- Data scope: only attraction category deals inside the attraction manager whitelist are persisted and reported.
- Stage labels: resolved from cached deal stage catalog entries for attraction category stages.
- Reason labels: read from cached `deal_snapshots.refusal_reason_value`; empty values render as `Причина не указана`.

Reason dictionary semantics:

- `Корзина` attraction loss rows resolve through the attraction basket/lost reason list in `UF_CRM_1772109151192`, with legacy fallback to `UF_CRM_1647422744` when the destination-specific field is empty.
- `Возврат` attraction loss rows resolve through the attraction return reason list in `UF_CRM_1776949411825` (`Причина отказа (Привлечение Возврат в Лидген)`), with legacy fallback to `UF_CRM_1647422744` when the destination-specific field is empty.
- The attraction report must not read leadgen category `28`, leadgen reason dictionaries, or the leadgen manager whitelist to resolve this table.

Privacy and module boundaries:

- The report must not expose deal names, contact names, phones, emails, raw Bitrix payloads, cookies, tokens, or webhooks.
- Dashboard rendering reads cached API/SQLite data only and must not perform direct Bitrix reads.
- Leadgen dashboard/report behavior is outside this attraction report contract unless a separate reviewed issue expands scope.
