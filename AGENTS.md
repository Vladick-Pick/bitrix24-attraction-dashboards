# AGENTS.md

## Project
This repository contains Bitrix24 attraction dashboards: local API, SQLite-backed reporting, and web/prototype dashboards.

## Working Rules
- Do not work directly on `main` except for emergency repository maintenance.
- Use branches named `codex/<task-name>` for implementation work.
- Keep each branch tied to a backlog item or GitHub issue.
- Keep git hygiene as a priority: before starting a new task, close stale work, merge verified completed branches, delete obsolete local/remote branches, and start fresh work from updated `main`.
- Always work from the latest visible project state. Before cleanup, branch switches, merges, rebases, stash use, or new task setup, preserve all user and agent changes in a named branch and commit unless the user explicitly asks for a different storage method.
- Never leave important work only in stash. If unrelated WIP blocks cleanup or implementation, move it to a clearly named backup branch/commit and report that branch before continuing.
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
- For production-requested fixes, do not stop at an unmerged branch or PR. After local verification, push the `codex/*` branch, open the PR, wait for green GitHub checks, merge to `main`, wait for the GitHub Actions `Deploy Production` workflow, then verify production.

## Proven Git, Deploy, And Server Practices
- Treat GitHub Actions as the production path: implement locally, run focused checks, commit, push a `codex/*` branch, open a PR, wait for CI, merge, then wait for `Deploy Production`.
- When a user asks to fix comments/issues found in the deployed app, assume the expected handoff is a deployed production fix through `main` unless they explicitly say to stop before merge/deploy.
- After a deployed-app comment is actually fixed and verified in production, archive that production comment through `/api/proto-comments`/SQLite so resolved comments do not remain open.
- After a production deploy, verify the actual VPS state, not only GitHub: check `/opt/bitrix24-reporting/app` commit, container status, health endpoint, and the specific API behavior changed by the PR.
- Keep production verification explicit and repeatable. Good smoke checks include `curl https://dashboardpriv.claricont.com/api/health`, unauthenticated protected endpoint returning `401`, authenticated endpoint behavior with session cookie and CSRF, and direct API port not reachable externally.
- Never print or paste production passwords, session cookies, Bitrix webhooks, raw tokens, or raw payloads. If a server-side password file exists, read it inside the remote command and only print non-secret status such as `login: ok`.
- For authenticated production API checks, use the existing admin account, read the password from `/root/bitrix24-reporting-admin-password.txt` on the VPS, keep cookies in memory or a temporary file, and remove any smoke-test records after verification.
- Before touching production data, identify the mounted SQLite path and make a backup when the operation can mutate business data. The production database is expected under `/opt/bitrix24-reporting/data/bitrix24-reporting.db` on the host and `/app/data/bitrix24-reporting.db` in the app container.
- Do not copy local SQLite over production unless the user explicitly approves that destructive replacement. Prefer fixing the sync/import logic and preserving the production DB.
- For Docker checks, prefer `docker ps`, `docker compose ps`, `docker logs --tail`, `docker exec`, and app-local Node scripts from `/app/apps/api` so workspace dependencies resolve correctly.
- When querying SQLite inside the container, run from `/app/apps/api` because package resolution for `better-sqlite3` is local to the API workspace.
- Keep the app container non-root. Verify with `docker inspect -f '{{.Config.User}}' bitrix24-reporting-app-1` and `docker exec bitrix24-reporting-app-1 id`.
- Keep reverse proxy ownership clear: public traffic goes through Caddy/nginx on `443`; the Node app should remain bound to localhost or the internal Docker network.
- For data correctness incidents, compare local and production counts with the same SQL/query semantics before changing code or importing data. Always pin the exact date range, funnel/category, manager whitelist, and stage rules used for the comparison.
- For prototype comments, production comments are stored server-side in SQLite through `/api/proto-comments`; do not rely on `.codex/proto-comments/comments.json` for production. Each comment should retain block anchor metadata: block id, block label, block selector, element selector, and relative coordinates inside the block.
