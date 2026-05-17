# Bitrix24 Dashboards Paperclip Agents

This directory stores the versioned instruction bundle deployed to the Paperclip company `Bitrix24 Dashboards`.

## Remote Company

- Company: `d3d17397-0250-40f8-a9d6-507b14f38538`
- Goal: `Operate Bitrix24 dashboard modules`
- Project: `Dashboard Comment Intake`

## Agent Mapping

- `dashboard-triage-agent` -> `08448820-d3c4-4176-b5bb-f83cef1830b1` (`Dashboard Engineering Manager`)
- `frontend-dashboard-engineer` -> `13aa65fa-ee69-4862-a7f2-83be79b6f73d`
- `backend-reporting-engineer` -> `08858c91-af96-4470-9253-c6b89cbf8a5c`
- `pre-merge-reviewer` -> `a18581ef-7247-4236-a9c9-caae998478c0`
- `dashboard-intake-agent` -> `78f363d2-d859-4994-b684-e9fc2e75d676` (`Dashboard Intake Service`, heartbeat disabled)

Paperclip injects each agent's `AGENTS.md` through `instructionsFilePath`. The companion files `TOOLS.md`, `SOUL.md`, and `HEARTBEAT.md` are copied into each remote instruction directory and are referenced from `AGENTS.md`.

## Current Runtime Notes

- Skills are installed in the company managed Codex home and registered as desired runtime skills on every agent.
- MCP config is installed in the shared and company Codex homes for Context7 and Playwright.
- Git read access to the dashboard repository is verified. Write/PR/merge access requires a GitHub credential on the VPS.
- The manager/reviewer use `gpt-5.5` with `xhigh` reasoning; implementation agents use `gpt-5.5` with `high` reasoning.
