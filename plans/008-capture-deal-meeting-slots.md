# Plan 008: Capture Deal Meeting Slots 1-3 In Sync And Storage

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: -
- **Category**: data correctness
- **Status**: DONE

## Objective

Persist all Bitrix deal meeting blocks as one canonical model. `Встреча 2` and
`Встреча 3` are real additional meetings, not replacements for `Встреча`.

## Bitrix Field Inventory

| Slot | Meaning | Field |
|---|---|---|
| 1 | date | `UF_CRM_1669784197394` |
| 1 | type | `UF_CRM_1669784114991` |
| 1 | place | `UF_CRM_1669784273591` |
| 1 | calendar | `UF_CRM_1677669882` |
| 2 | date | `UF_CRM_MEET2_DT` |
| 2 | type | `UF_CRM_DEAL_MEET2_KIND` |
| 2 | place | `UF_CRM_DEAL_MEET2_PLACE` |
| 2 | calendar | `UF_CRM_DEAL_MEET2_CAL` |
| 2 | event id | `UF_CRM_DEAL_MEET2_EVENT` |
| 3 | date | `UF_CRM_MEET3_DT` |
| 3 | type | `UF_CRM_DEAL_MEET3_KIND` |
| 3 | place | `UF_CRM_DEAL_MEET3_PLACE` |
| 3 | calendar | `UF_CRM_DEAL_MEET3_CAL` |
| 3 | event id | `UF_CRM_DEAL_MEET3_EVENT` |

## Implementation Loop

1. Add failing contract/sync/storage tests for `meetingSlots`.
2. Add `DealMeetingSlot` and `meetingSlots?: DealMeetingSlot[]` while keeping
   legacy `meetingTypeValue` and `meetingDateValue` as slot-1 mirrors.
3. Centralize the field mapping in sync and add all fields to the allowed custom
   field list.
4. Resolve enum and iblock-element values to labels when possible; never show
   raw field ids as labels.
5. Persist slots in SQLite, preferably in `deal_meeting_slots`, and hydrate deal
   snapshots without N+1 reads.
6. Make meeting date change tracking slot-aware.
7. Run focused tests, typecheck, diff review, and fix review findings.

## Verification

- `pnpm --filter @bitrix24-reporting/contracts typecheck`
- `pnpm --filter @bitrix24-reporting/api exec vitest run test/sync.test.ts test/sqlite.test.ts`
- `pnpm --filter @bitrix24-reporting/api typecheck`

## Done Criteria

- Sync selects all three meeting slot blocks.
- SQLite stores and reads all filled slots independently.
- Slot 1 still fills legacy fields.
- Slot 2/3 date changes do not corrupt slot 1 history.
- No dashboard page reads Bitrix directly for meetings.
