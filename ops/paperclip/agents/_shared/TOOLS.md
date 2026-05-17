# Tools Contract

This file is part of the instruction bundle for Bitrix24 Dashboards agents.

## Paperclip

- Use the Paperclip API for coordination only: checkout, comments, issue updates, child issues, approvals, and work products.
- Mutating Paperclip calls during a heartbeat must include `X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID`.
- Before touching code, checkout the issue. If checkout returns `409`, stop and pick a different assigned issue.
- Create child issues for delegated work. Child issues must set `parentId`, `goalId`, and the intended assignee.
- Keep clarifications in Paperclip v1. The dashboard only shows summarized comment status.

## Repository

- Work only in the repository/workspace provided by Paperclip for the issue.
- Use branch names under `codex/<paperclip-issue>-<short-task>`.
- Read repo `AGENTS.md` before editing. It is part of the active instructions.
- Prefer `rg` for searches and the repo's package scripts for verification.
- Do not commit secrets, SQLite runtime databases, raw Bitrix payloads, session cookies, local Codex files, or Paperclip runtime state.
- Open pull requests for non-trivial code changes. Do not merge unless the issue explicitly grants merge authority or the reviewer/owner approves.

## Project Engineering Playbook

- Treat GitHub Actions as the production path: implement locally, run focused checks, commit, push a `codex/*` branch, open a PR, wait for CI, review, merge only when authorized, then verify deployment when the issue requires production delivery.
- Keep business dashboards scoped to the approved module/manager whitelist unless the issue explicitly changes the rule.
- Dashboard screens must read local API/SQLite snapshots. Bitrix sync is separate; do not add direct Bitrix reads to rendering paths.
- Heavy reports should load lazily by active screen or background prefetch, not block the initial UI.
- Use the repo verification commands from `AGENTS.md`: API targeted tests, API full suite, web vitest, workspace `pnpm test`, `pnpm lint`, and `pnpm typecheck` as appropriate to the blast radius.
- For frontend work, preserve the app's operational dashboard style: compact, scan-friendly, responsive, no overlapping text, no marketing/landing-page composition.
- For backend work, preserve CSRF on mutations, auth/module membership enforcement, retry visibility, and token redaction.
- For production checks, never print passwords, cookies, Bitrix webhooks, tokens, raw payloads, or secret file contents.

## GitHub

- Use GitHub/CI as the normal delivery path: branch, focused commit, push, PR, checks, review, then merge if authorized.
- Do not force-push shared branches unless the issue explicitly says the branch is yours and no other agent is using it.
- For smoke tests of access, use disposable branches and draft PRs, then close/delete them after verification.

## MCP And Docs

- Use Context7 for current library/framework/API documentation when implementation details may depend on versions.
- Use browser or Playwright tooling for UI verification when a screen behavior changed.
- Use Paperclip skills for Paperclip coordination, not for doing the domain coding itself.

## Prohibited Paths

- No SSH/root/production-server work as part of normal dashboard comment handling.
- No direct Bitrix reads from page rendering work. Dashboard screens read local cached API data.
- No personal data in Paperclip issue descriptions: no deal/contact names, phones, emails, raw Bitrix payloads, secrets, cookies, or tokens.
