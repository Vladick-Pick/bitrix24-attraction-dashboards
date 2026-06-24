# Plan 009: Count Meeting Slots In Reports, Timelines, And Economics

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: plans/008-capture-deal-meeting-slots.md
- **Category**: correctness
- **Status**: DONE

## Objective

Use one canonical meeting-event model for reports, lifecycle cards, workload
analytics, and economics. Slots 2/3 must count as additional full meetings, with
deduplication against CRM meeting activities.

## Implementation Loop

1. Add failing tests for canonical meeting events:
   - three dated slots -> three meetings;
   - matching CRM activity -> one deduped meeting;
   - CRM activity on another day -> additional meeting;
   - undated slot -> attribute only, not countable event.
2. Implement a shared meeting normalizer, e.g.
   `apps/api/src/domain/deal-meetings.ts`.
3. Replace ad hoc meeting totals in operational reports with canonical events.
4. Update lifecycle timeline generation:
   - `Встреча`, `Встреча 2`, `Встреча 3`;
   - include type/place/calendar labels;
   - include linked event name and participation status when available;
   - do not render raw `Дело создано` / `Дело закрыто` items individually.
5. Update meeting workload report so type/business-club counts increment per
   meeting, not per deal.
6. Update deal economics to charge meeting work only through explicit existing
   price rules and never double-charge deduped records.
7. Run focused tests, typecheck, diff review, and fix review findings.

## Verification

- `pnpm --filter @bitrix24-reporting/api exec vitest run test/reporting.test.ts test/deal-lifecycle-card.test.ts test/unit-economics.test.ts test/service.test.ts`
- `pnpm --filter @bitrix24-reporting/api typecheck`

## Done Criteria

- Row summary, expanded card, lifecycle card, and economics agree on meeting
  totals for the same deal.
- Meeting workload analytics shows which meeting type it was.
- Duplicate CRM meeting activities do not inflate counts or costs.
- In-process deals show incurred meeting costs where existing rules apply.

## Execution Notes

- Implemented on branch `codex/multi-meeting-slots`.
- Workload report counts dated meeting slots independently and exposes slot
  metadata in `meetingBusinessClubBreakdown`.
- Deal detail fallback events render `Встреча`, `Встреча 2`, `Встреча 3` and
  dedupe same-day CRM meeting activities against explicit slots.
- Focused checks run:
  - `pnpm --filter @bitrix24-reporting/api exec vitest run test/sync.test.ts test/sqlite.test.ts test/activities-workload.test.ts test/deal-lifecycle-card.test.ts`
  - `pnpm --filter @bitrix24-reporting/api exec vitest run test/manager-action-outcome.test.ts`
  - `pnpm --filter @bitrix24-reporting/api typecheck`
