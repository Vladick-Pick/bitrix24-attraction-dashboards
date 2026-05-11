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

## Restrictions

- Do not print secrets, Paperclip tokens, Bitrix webhooks, session cookies, or raw payloads.
- Do not copy local SQLite over production.
- Do not mutate production data without explicit approval and backup.
- Do not add direct Bitrix reads to page rendering.
- Do not rely on client-side checks for module access.
