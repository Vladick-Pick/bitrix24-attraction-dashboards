# Coverage-Aware Refresh Design

## Goal

Make the existing `Обновить данные` button reliably refresh all dashboard data without requiring the user to understand sync modes or coverage warnings.

## Recommended Approach

Keep a single refresh action in the web UI. The button continues to call `POST /api/sync`; the backend is responsible for loading recent Bitrix changes and repairing any missing report coverage in the same run.

The sync planner already checks `sync_coverage` before fetching data. The change should make coverage repair unconditional for the configured attraction scope when coverage is missing, even when local snapshot rows and delta cursors already exist. This preserves fast delta syncs when coverage is complete and avoids a blunt full re-sync on every click.

## Data Flow

1. The user clicks `Обновить данные`.
2. Web calls `apiClient.triggerSync()` as it does today.
3. API runs `performManualSync()`.
4. Sync checks required coverage streams for all operational reports.
5. If coverage is missing, sync fetches the missing historical slice for that stream and writes `sync_coverage` only after snapshot persistence succeeds.
6. The UI refreshes meta/report data and the warning disappears when required coverage is confirmed.

## Required Coverage

The refresh must cover:

- activity history providers used by manager action reports: `CRM_TODO`, `CRM_TASKS_TASK`, `VOXIMPLANT_CALL`, `CRM_MEETING`;
- deal custom fields used by reporting;
- meeting date field when configured;
- call statistics for call-based reports;
- conversion event visits when the Bitrix smart-process client supports them.

## Error Handling

Keep the current sync failure behavior: one active sync at a time, progress events in SSE mode, and no coverage marker if dependent writes fail. If Bitrix denies access to a stream, the UI should still show the existing warning rather than silently treating missing data as zero.

## Testing

Add targeted API sync coverage tests first:

- a delta sync with existing activity/deal snapshots but missing activity coverage must backfill all required activity providers and write coverage rows;
- existing behavior for successful delta sync and conversion event coverage must stay green.

