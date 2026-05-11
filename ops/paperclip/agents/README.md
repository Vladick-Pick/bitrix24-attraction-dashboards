# Bitrix24 Dashboards Paperclip Agents

This directory stores the versioned instruction bundle deployed to the Paperclip company `Bitrix24 Dashboards`.

The live company is the runtime source of truth. This repo is the reviewable recovery artifact: every runtime instruction change should be made here first, then copied to the managed instruction directory on the Paperclip VPS.

## Remote Company

- Company: `d3d17397-0250-40f8-a9d6-507b14f38538`
- Issue prefix: `BIT`
- Goal: `Operate Bitrix24 dashboard modules`
- Project: `Attraction Dashboard`
- Workflow lane: `Dashboard Comment Intake`
- Primary workspace: `https://github.com/Vladick-Pick/bitrix24-attraction-dashboards.git`, default ref `main`

## Active Runtime Agents

- `dashboard-engineering-manager` -> `08448820-d3c4-4176-b5bb-f83cef1830b1`
- `frontend-dashboard-engineer` -> `13aa65fa-ee69-4862-a7f2-83be79b6f73d`
- `backend-reporting-engineer` -> `08858c91-af96-4470-9253-c6b89cbf8a5c`
- `pre-merge-reviewer` -> `a18581ef-7247-4236-a9c9-caae998478c0`
- `dashboard-intake-service` -> `78f363d2-d859-4994-b684-e9fc2e75d676`

Current model policy:

- manager/reviewer: `gpt-5.5`, `xhigh`
- frontend/backend: `gpt-5.5`, `high`
- intake service: `gpt-5.5`, `low`, heartbeat disabled

All worker heartbeats are configured to run hourly with on-demand wake enabled, one concurrent run per agent. Live status must still be checked in Paperclip because adapter errors, credential gaps, or subscription limits can pause execution.

## Role Topology

V1 intentionally starts with a compact team. Do not add agents just because a role can be named. Split a role into a dedicated agent only when it has distinct context, quality criteria, recurring deliverables, and enough task volume to justify the operational cost.

- `Dashboard Intake Service` is not a worker. It is the dashboard backend identity for issue creation.
- `Dashboard Engineering Manager` owns product intake, triage, planning, orchestration, final readiness, and agent-ops governance until those lanes have enough volume to split out.
- `Frontend Dashboard Engineer` owns dashboard UI, comment UX, notification surfaces, module admin UI, and visual verification.
- `Backend Reporting Engineer` owns API, SQLite, auth/RBAC, reporting contracts, Paperclip integration, retries, and status sync.
- `Pre-Merge Reviewer` owns fresh verification, code review, security/privacy review, and release-readiness review.

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

## Current Runtime Notes

- Skills are installed in the company managed Codex home and registered as desired runtime skills on every agent.
- MCP config is installed in the shared and company Codex homes for Context7 and Playwright.
- Git read access to the dashboard repository is verified. Write/PR/merge access requires a GitHub credential on the VPS. Without that credential, agents stop at patch/evidence handoff and mark the issue blocked instead of claiming PR/merge/deploy completion.
- The normal workflow never uses SSH/root access. Server work belongs to an explicit release/devops task with human approval and redacted output.
