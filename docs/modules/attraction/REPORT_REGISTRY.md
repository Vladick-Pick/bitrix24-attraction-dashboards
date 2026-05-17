# Attraction Report Registry

## activities-calls

### Stage/loss-reason table

- Module: `attraction`.
- Backend contract: `buildAcquisitionOutcomesReport` aggregates cached `deal_snapshots` rows whose `stage_semantic_id` is lost (`F`) and whose resolved lost date is inside the requested range.
- Data scope: only attraction category deals inside the attraction manager whitelist are persisted and reported.
- Stage labels: resolved from cached deal stage catalog entries for attraction category stages.
- Reason labels: read from cached `deal_snapshots.refusal_reason_value`; empty values render as `Причина не указана`.

Reason dictionary semantics:

- Regular attraction basket/lost reasons resolve through `UF_CRM_1647422744` when the attraction deal carries that field.
- Return-to-leadgen losses can reference a linked leadgen deal. During sync only, the backend may read leadgen category rows scoped by the configured leadgen category and leadgen manager whitelist to resolve linked reason fields for the attraction deal.
- Return-to-leadgen reasons resolve through `UF_CRM_1758715585`.
- Basket/lost reasons from linked leadgen rows resolve through `UF_CRM_1772109151192`.
- Linked leadgen rows are lookup-only for this report; they must not be persisted into the attraction snapshot database.

Privacy and module boundaries:

- The report must not expose deal names, contact names, phones, emails, raw Bitrix payloads, cookies, tokens, or webhooks.
- Dashboard rendering reads cached API/SQLite data only and must not perform direct Bitrix reads.
- Leadgen dashboard/report behavior is outside this attraction report contract unless a separate reviewed issue expands scope.
