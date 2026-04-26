# Web Runtime

The web app has one supported runtime interface: `ProtoApp`.

`apps/web/src/App.tsx` must import and render `@/proto/proto-app`. Do not add
alternate dashboard shells, hidden prototype entrypoints, or demo-data fallbacks
under `apps/web/src/features`. Historical plans that referenced `DashboardShell`
are archived under `docs/archive/superseded-plans`.

Live report data must continue to flow through the local API and SQLite snapshot.
The browser must not read Bitrix directly.
