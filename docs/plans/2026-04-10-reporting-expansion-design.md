# Reporting Expansion Design

**Goal:** Expand the reporting backend so the new analytics screens can rely on stable, filterable, named manager data and a cohort report without depending on mock-only payloads.

**Scope:**
- Add manager names to report payloads.
- Add `managerIds` and `sourceKeys` filters to sales, activities, calls, and cohort reports.
- Add a cohort report for created month vs closed month plus conversion.
- Keep deadline-reschedule counting intentionally disabled for now.

**Design:**
- Persist a local `manager_directory` table keyed by Bitrix user ID. Sync fills it from the union of `assignedById`, `responsibleId`, and `portalUserId` observed in synced entities.
- Keep report builders pure. Apply shared deal-level filters before invoking the builders, and decorate manager rows with names after aggregation.
- Extend `/api/meta` with available filter catalogs for managers and sources so the UI can build filter controls from real data.
- Add `/api/reports/cohort-conversion` with rows grouped by deal creation month, closure month buckets, total closed deals, won deals, and conversion.
- Treat `sourceKeys` consistently across reports as `SOURCE_ID`, falling back to `UTM_SOURCE`, then `UNATTRIBUTED`.

**Non-goals:**
- No historical reconstruction of deadline moves.
- No UI redesign here; only contracts/API readiness for the design agent.
