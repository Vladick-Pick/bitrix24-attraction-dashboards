# Backend Reporting Engineer Tools

## Primary Surfaces

- `apps/api/src/server`
- `apps/api/src/domain`
- `apps/api/src/config`
- API tests
- SQLite repository and migrations
- Paperclip API client code
- Context7 for current library/framework/API docs when needed

## Required References

- root `AGENTS.md`
- `docs/modules/<module>/MODULE_ONTOLOGY.md`
- `ops/paperclip/workflows/comment-to-issue.md`
- `ops/paperclip/workflows/bugfix.md`
- `ops/paperclip/proof-loop.md`

## Runtime Reference Fallback

Preferred references are repo-relative. If the current workspace checkout does not contain the new Paperclip docs yet, read the mirrored company docs under:

```text
/home/paperclip/.paperclip/instances/default/companies/d3d17397-0250-40f8-a9d6-507b14f38538/repo-docs/
```

Mapping:

- `AGENTS.md` -> `repo-docs/AGENTS.md`
- `ops/paperclip/...` -> `repo-docs/ops/paperclip/...`
- `docs/modules/...` -> `repo-docs/docs/modules/...`

If both the repo path and mirror path are missing, mark the issue blocked instead of inventing policy.

## Verification Commands

Focused API tests:

```bash
pnpm --filter @bitrix24-reporting/api test -- --runInBand <test files>
```

Full API suite when auth, migrations, RBAC, status mapping, or shared repository behavior changes:

```bash
pnpm --filter @bitrix24-reporting/api test -- --runInBand
```

## Production Runtime Checks

For approved release/incident tasks that touch sync, reporting storage, or database env, verify non-secret runtime state without printing credentials:

```bash
docker compose -p bitrix24-reporting exec -T app node -e "console.log(JSON.stringify({
  platform: process.env.PLATFORM_DATABASE_URL ?? process.env.DATABASE_URL,
  attraction: process.env.ATTRACTION_DATABASE_URL,
  leadgen: process.env.LEADGEN_DATABASE_URL,
  leadgenManagers: (process.env.BITRIX24_LEADGEN_MANAGER_IDS ?? '').split(',').filter(Boolean).length
}))"
```

Expected production paths:

- platform: `file:/app/data/bitrix24-reporting.db`
- attraction: `file:/app/data/bitrix24-attraction.db`
- leadgen: `file:/app/data/bitrix24-leadgen.db`
- leadgen manager count: greater than `0` for useful leadgen sync

## Restrictions

- Do not print secrets, Paperclip tokens, Bitrix webhooks, session cookies, or raw payloads.
- Do not copy local SQLite over production.
- Do not mutate production data without explicit approval and backup.
- Do not add direct Bitrix reads to page rendering.
- Do not rely on client-side checks for module access.
