# Bitrix24 Dashboards Paperclip Agents

This directory stores the versioned instruction bundle deployed to the Paperclip company `Bitrix24 Dashboards`.

The live company is the runtime source of truth. This repo is the reviewable recovery artifact: every runtime instruction change should be made here first, then copied to the managed instruction directory on the Paperclip VPS.

## Remote Company

- Company: `d3d17397-0250-40f8-a9d6-507b14f38538`
- Issue prefix: `BIT`
- Goal: `Operate Bitrix24 dashboard modules`
- GitHub source: one repository, `Vladick-Pick/bitrix24-attraction-dashboards`
- Module project: `attraction` -> `Attraction Dashboard` (`c72f6e08-5483-4e15-8f7d-d33a2c8df4cf`)
- Module project: `leadgen` -> `Leadgen Dashboard` (`84f6b163-c73a-4e19-8837-a545e9d11ee6`)
- Workflow lane: `Dashboard Comment Intake`
- Primary workspace: `https://github.com/Vladick-Pick/bitrix24-attraction-dashboards.git`, default ref `main`

## Active Runtime Agents

- `dashboard-engineering-manager` -> `08448820-d3c4-4176-b5bb-f83cef1830b1`
- `frontend-dashboard-engineer` -> `13aa65fa-ee69-4862-a7f2-83be79b6f73d`
- `backend-reporting-engineer` -> `08858c91-af96-4470-9253-c6b89cbf8a5c`
- `pre-merge-reviewer` -> `a18581ef-7247-4236-a9c9-caae998478c0`
- `dashboard-intake-service` -> `78f363d2-d859-4994-b684-e9fc2e75d676`

Legacy draft aliases from the first dashboard-comments worktree are preserved under `_legacy/` for audit only:

- `dashboard-triage-agent` -> current `dashboard-engineering-manager`
- `dashboard-intake-agent` -> current `dashboard-intake-service`

Current model policy:

- manager/reviewer: `gpt-5.5`, `xhigh`
- frontend/backend: `gpt-5.5`, `high`
- intake service: `gpt-5.5`, `low`, heartbeat disabled

All worker heartbeats are configured to run hourly with on-demand wake enabled, one concurrent run per agent. Live status must still be checked in Paperclip because adapter errors, credential gaps, or subscription limits can pause execution.

The manager heartbeat is a single hourly wake checklist. Paperclip `Routines` are separate recurring issue definitions, not heartbeat steps; weekly and batch quality work must be represented as visible routine-created issues.

The `Dashboard Engineering Manager` desired runtime skills include `DenisSergeevitch/agents-best-practices` for agent harness, observability, eval, skill/MCP, permission, context, and feedback-loop design.

Expected manager routines are company-level, not module-project tasks. Their
live `projectId` must stay empty so they review the whole dashboard team across
`attraction`, `leadgen`, and future modules:

- `Еженедельный отчет по качеству команды`: Monday 09:00 `Europe/Istanbul`, assigned to `Dashboard Engineering Manager`.
- `Еженедельный аудит инструментов команды`: Monday 10:00 `Europe/Istanbul`, assigned to `Dashboard Engineering Manager`.
- `Еженедельное предложение улучшений команды`: Monday 11:00 `Europe/Istanbul`, assigned to `Dashboard Engineering Manager`; requires board approval before any team/process/tool/runtime change is applied.

## Role Topology

V1 intentionally starts with a compact team. Do not add agents just because a role can be named. Split a role into a dedicated agent only when it has distinct context, quality criteria, recurring deliverables, and enough task volume to justify the operational cost.

- `Dashboard Intake Service` is not a worker. It is the dashboard backend identity for issue creation.
- `Dashboard Engineering Manager` owns product intake, triage, planning, orchestration, final readiness, and agent-ops governance until those lanes have enough volume to split out.
- `Frontend Dashboard Engineer` owns dashboard UI, comment UX, notification surfaces, module admin UI, and visual verification.
- `Backend Reporting Engineer` owns API, SQLite, auth/RBAC, reporting contracts, Paperclip integration, retries, and status sync.
- `Pre-Merge Reviewer` owns fresh verification, code review, security/privacy review, and release-readiness review.

Every issue must name its module. `leadgen` work is isolated to leadgen-owned UI, reports, docs, tests, and category `28` data scope unless a reviewed issue is explicitly shared/platform.

## Production Runtime Contract

The production dashboard runtime uses separate SQLite files for platform state and each business module:

- Platform/auth/comments: `/opt/bitrix24-reporting/data/bitrix24-reporting.db` on the host, `file:/app/data/bitrix24-reporting.db` in the container.
- Attraction sync/reporting: `/opt/bitrix24-reporting/data/bitrix24-attraction.db` on the host, `file:/app/data/bitrix24-attraction.db` in the container.
- Leadgen sync/reporting: `/opt/bitrix24-reporting/data/bitrix24-leadgen.db` on the host, `file:/app/data/bitrix24-leadgen.db` in the container.

Module sync is isolated by contract. The legacy `POST /api/sync` endpoint is attraction-only. Module-aware work must use `POST /api/modules/:moduleId/sync`, and dashboard refresh controls must refresh only the active module. A task that changes sync, reporting repositories, database configuration, Docker env, or production smoke checks must state how platform, attraction, and leadgen storage remain distinct.

Leadgen production sync requires `BITRIX24_LEADGEN_MANAGER_IDS` to be configured. An empty leadgen manager whitelist is a safe empty scope, not permission to fall back to attraction managers. Release and verification tasks must check the configured leadgen manager count before claiming leadgen sync/reporting is ready.

Future split-out roles:

- `Agent Operations Manager`: split out when the team has repeated process defects, stale skills/MCP config, or more than five Paperclip tasks per week.
- `Release / DevOps Agent`: split out when Paperclip regularly handles deploys, production incidents, or server-side smoke checks.
- `Data / Reporting Engineer`: split out when modules need frequent SQL/reporting changes independent from backend platform work.

## Instruction Contract

Every active agent has exactly these sibling files:

- `AGENTS.md`: role, ownership, outputs, handoffs, done policy
- `TOOLS.md`: allowed tools, MCP expectations, secrets policy, banned paths
- `SOUL.md`: operating principles and quality bar
- `HEARTBEAT.md`: wake checklist, proof requirements, escalation logic

Paperclip injects each agent's `AGENTS.md` through `instructionsFilePath`. The companion files are copied into the same managed directory and loaded by the agent before substantive work.

## Dashboard Comment Contract

Dashboard comments are review-state records owned by the dashboard/board user. Paperclip agents work the linked issue thread; they must not archive production dashboard comments automatically after implementation, review, deploy, or proof. Archive a dashboard comment only when the board explicitly asks to archive that exact comment.

Dashboard rework feedback must stay on the original linked Paperclip issue as a board-originated rework comment. Do not create a new Paperclip issue for rework on an existing dashboard comment, and do not treat rework intake as final readiness.

The dashboard-ready marker `source: dashboard-system / development-ready-report` is a final readiness signal only. It is not an acknowledgment, triage note, blocker note, delegation note, progress update, or child-issue routing comment. A valid dashboard-ready report must include both the marker and the heading `## Готово к проверке`.

Use the dashboard-ready marker only after the corrected work is implemented, freshly reviewed, deployed or production-verified when required, and genuinely ready for board review. If the parent issue is blocked by subtasks, awaiting implementation, awaiting review, or awaiting a product choice, keep it out of dashboard-ready state and do not include the marker.

## Current Runtime Notes

- Skills are installed in the company managed Codex home and registered as desired runtime skills on every agent.
- MCP config is installed in the shared and company Codex homes for Context7 and Playwright.
- Before repository work is delegated, implemented, reviewed, marked ready, pushed, merged, or deployed, agents must run `pnpm session:preflight` from the task branch and record the result. A failing preflight blocks the issue until dirty work, stale refs, branch mismatch, or missing base state is preserved and reconciled without discarding changes.
- Runtime capability drift must be checked with `pnpm check:paperclip-runtime` before GitHub, Context7, or browser-dependent tasks are marked ready.
- Git read access to the dashboard repository is verified. Write/PR/merge access requires a GitHub credential on the VPS. Without that credential, agents stop at patch/evidence handoff and mark the issue blocked instead of claiming PR/merge/deploy completion.
- The normal workflow never uses SSH/root access. Server work belongs to an explicit release/devops task with human approval and redacted output.
