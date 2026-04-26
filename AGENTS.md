# AGENTS.md

## Project
This repository contains Bitrix24 attraction dashboards: local API, SQLite-backed reporting, and web/prototype dashboards.

## Working Rules
- Do not work directly on `main` except for emergency repository maintenance.
- Use branches named `codex/<task-name>` for implementation work.
- Keep each branch tied to a backlog item or GitHub issue.
- Prefer small, reviewable changes over broad mixed commits.
- Do not commit local runtime state, raw Codex comments, SQLite databases, secrets, or Bitrix snapshots.
- Convert prototype comments from `.codex/proto-comments/comments.json` into GitHub issues or `docs/backlog.md` items before implementation.
- Use the Context7 MCP server frequently when library/framework/API documentation may affect implementation details or when current docs are needed.

## Backlog And Issues
- GitHub Issues are the source of truth once the remote repository is connected.
- `docs/backlog.md` mirrors the current product backlog and is useful for local planning.
- Every issue should include: problem, expected behavior, acceptance criteria, data dependencies, and verification plan.
- Use labels by area: `area:sales`, `area:activities`, `area:cohorts`, `area:funnel`, `area:infra`.
- Use labels by kind: `type:feature`, `type:bug`, `type:performance`, `type:data`, `needs:clarification`.
- Use priority labels: `priority:p0`, `priority:p1`, `priority:p2`.

## Role Routing
- Architecture, decomposition, system boundaries: `architect`.
- Fast read-only codebase lookup: `scout`.
- Frontend UI/UX implementation: `frontend`.
- Backend/API/database work: `backend`.
- Bug investigation and minimal fixes: `debugger`.
- Test authoring and coverage: `tester`.
- Security review: `security`.
- Refactors without behavior changes: `refactorer`.
- Pre-merge review: `reviewer`.
- Infra and CI/CD: `devops`.
- Generic implementation tasks: `worker_high`, `worker_xhigh`, or `worker_mini`.

If a named preset is unavailable in the current runtime, emulate it with the closest built-in agent while preserving the preset's intent.

## Reporting Rules
- All business dashboards must stay scoped to the agreed attraction manager whitelist unless an issue explicitly changes that rule.
- Reports should use the local API and SQLite snapshot. Do not add direct Bitrix reads to page rendering.
- Bitrix sync is a separate operation; dashboard screens should read cached local data.
- Heavy reports should be loaded lazily by active screen or background prefetch, not block the initial UI render.
- Never fetch or store deal names or contact personal data for reporting. Use deal/contact IDs only; if upstream Bitrix responses include names, phones, emails, or other personal fields, ignore or redact them before persistence and UI output.

## Verification
- API targeted tests: `pnpm --filter @bitrix24-reporting/api test -- --runInBand <test files>`.
- API full suite: `pnpm --filter @bitrix24-reporting/api test -- --runInBand`.
- Web full suite: `pnpm --filter @bitrix24-reporting/web exec vitest run`.
- Workspace checks before PR when feasible: `pnpm test`, `pnpm lint`, `pnpm typecheck`.
- If a command cannot be run, state exactly why in the PR or final handoff.

## Git Flow
- Start from updated `main`.
- Create a task branch: `git switch -c codex/<task-name>`.
- Commit with a focused message that references the issue when available.
- Push the branch and open a draft PR for non-trivial work.
- Merge only after tests are green and review comments are resolved or explicitly deferred.
