# Production Pipeline Design

## Goal

Keep `dashboardpriv.claricont.com` aligned with the latest reviewed `main` commit without manual file copying.

## Recommended Approach

Use GitHub as the source of truth, GitHub Actions for CI and deployment orchestration, and the VPS as a runtime host that pulls exact commits from GitHub. This keeps development reversible: every production version maps to a commit, and rollback is a `git reset` plus Docker Compose restart.

## Architecture

- CI workflow runs `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- Deploy workflow runs the same verification before touching production.
- GitHub Actions connects to the VPS with a dedicated SSH key stored as a repository secret.
- The VPS fetches the repository with a separate read-only GitHub deploy key.
- The app runs through Docker Compose on `127.0.0.1:8787`; existing Caddy remains the only public entrypoint.

## Operational Rules

- Work on `codex/<task>` branches.
- Merge only passing work into `main`.
- Deploy only from `main` or an explicit manual workflow run.
- Keep `.env.production`, SQLite, backups, and generated admin passwords out of git.
- Do not edit production files directly except emergency rollback or secret rotation.

## Verification

Each deploy checks:

- HTTPS health endpoint returns `200`.
- Dashboard API returns `401` before login.
- App container does not run as root.
- Docker Compose publishes the app on localhost.
