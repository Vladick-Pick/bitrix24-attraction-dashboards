# Calls And Meetings Heatmap Design

## Context

The attraction dashboard already has an `activities-calls` scene with manager summary tables. The new feature should not create a separate report page. It should add per-manager drill-down rows inside the existing manager summary and meetings tables.

## Decision

Each manager row can expand to show compact heatmaps:

- manager summary table: one segmented heatmap for outgoing calls and one segmented heatmap for tasks;
- meetings table: one heatmap for meetings;
- heatmap columns are weekdays `Пн` through `Вс`;
- heatmap rows are hours `09:00` through `21:00`, inclusive;
- cells show counts and color intensity;
- task cells split into created-task and closed-task segments;
- outgoing-call cells split into successful `>30 sec`, other outgoing, and no-answer segments.

Backend reports will attach bounded heatmap data to existing manager rows:

- `ManagerCallsWorkloadRow.callsHourlyHeatmap` with outgoing-call segments;
- `ManagerActivitiesWorkloadRow.tasksHourlyHeatmap` with created/closed task segments;
- `ManagerActivitiesWorkloadRow.createdTasksHourlyHeatmap` and `closedTasksHourlyHeatmap` remain for compatibility;
- `ManagerActivitiesWorkloadRow.meetingsHourlyHeatmap`.

## Boundaries

The feature stays read-only and uses cached SQLite/API report data. It does not add Bitrix reads, sync behavior, personal data, or raw activity payloads to the UI.

## Verification

Use TDD for:

- backend aggregation by manager, weekday, and hour;
- backend aggregation of per-cell segments;
- web API normalization;
- UI rendering of expandable rows and heatmap cells.
