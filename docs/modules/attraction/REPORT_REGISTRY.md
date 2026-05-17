# Attraction Report Registry

## activities-calls

### Stage/loss-reason table

- Module: `attraction`.
- Backend contract: `buildAcquisitionOutcomesReport` aggregates cached `deal_snapshots` rows whose `stage_semantic_id` is lost (`F`) and whose resolved lost date is inside the requested range.
- Data scope: only attraction category deals inside the attraction manager whitelist are persisted and reported.
- Stage labels: resolved from cached deal stage catalog entries for attraction category stages.
- Reason labels: read from cached `deal_snapshots.refusal_reason_value`; empty values render as `Причина не указана`.

Reason dictionary semantics:

- `Корзина` attraction loss rows resolve through the attraction basket/lost reason list in `UF_CRM_1772109151192`, with legacy fallback to `UF_CRM_1647422744` when the destination-specific field is empty.
- `Возврат` attraction loss rows resolve through the attraction return reason list in `UF_CRM_1758715585`, with legacy fallback to `UF_CRM_1647422744` when the destination-specific field is empty.
- The attraction report must not read leadgen category `28`, leadgen reason dictionaries, or the leadgen manager whitelist to resolve this table.

Privacy and module boundaries:

- The report must not expose deal names, contact names, phones, emails, raw Bitrix payloads, cookies, tokens, or webhooks.
- Dashboard rendering reads cached API/SQLite data only and must not perform direct Bitrix reads.
- Leadgen dashboard/report behavior is outside this attraction report contract unless a separate reviewed issue expands scope.
