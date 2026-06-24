# Plan 010: Display Meeting Slots 1-3 In Dashboard Deal Cards

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/008-capture-deal-meeting-slots.md, plans/009-count-meeting-slots-in-reports-and-economics.md
- **Category**: UI correctness
- **Status**: DONE

## Objective

Make the dashboard visibly consume the new meeting model: the meeting analytics
report must show which meeting/type was counted, and deal cards must display
chips/events for `Встреча 2` and `Встреча 3`.

## Implementation Loop

1. Add failing web API normalization tests for `meetingSlots`.
2. Normalize slots in `apps/web/src/lib/api-client.ts` and web types.
3. Render compact meeting slot attributes/chips in deal cards:
   - `Встреча`: `18 апр · Очная · Офис К1`;
   - `Встреча 2`: `20 апр · Zoom`;
   - `Встреча 3`: `25 апр · Офис К2`.
4. Render linked event name/status in timeline details when API provides it.
5. Make timeline fallback slot-aware and prevent duplicate meeting chips.
6. Tune meeting workload table labels and type chips so counts are clearly per
   meeting.
7. Run web tests, browser smoke, diff review, and fix review findings.

## Verification

- `pnpm --filter @bitrix24-reporting/web exec vitest run src/lib/api-client.test.ts src/proto/proto-app.test.tsx`
- `pnpm --filter @bitrix24-reporting/web typecheck`
- browser smoke on local app

## Done Criteria

- Local dashboard opens successfully.
- Meeting analytics report shows what kind of meeting was counted.
- Deal lifecycle cards show chips/events for `Встреча 2` and `Встреча 3`.
- Timeline has no duplicate meeting badges.
- UI does not overflow on normal desktop/mobile widths.

## Execution Notes

- Implemented on branch `codex/multi-meeting-slots`.
- Web API normalization preserves meeting slot metadata on timeline meeting
  events and workload meeting buckets.
- Deal timeline chips label numbered slots, e.g. `Встреча 2 14 мар · Zoom`.
- The meetings report labels typed buckets with slot context, e.g.
  `Встреча 2 · Zoom`.
- Focused checks run:
  - `pnpm --filter @bitrix24-reporting/web exec vitest run src/lib/api-client.test.ts`
  - `pnpm --filter @bitrix24-reporting/web exec vitest run src/proto/proto-app.test.tsx -t "renders live sales by manager|renders meetings and SLA blocks"`
  - `pnpm --filter @bitrix24-reporting/web typecheck`
