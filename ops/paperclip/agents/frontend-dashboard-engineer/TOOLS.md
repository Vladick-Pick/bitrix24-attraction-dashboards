# Frontend Dashboard Engineer Tools

## Primary Surfaces

- `apps/web`
- `apps/web/src/proto`
- `apps/web/src/lib/api-client.ts`
- dashboard tests under `apps/web/src`
- Browser/Playwright for visual verification
- Context7 for current React/Vite/testing-library docs when needed

## Required References

- root `AGENTS.md`
- root `design.md`
- `docs/modules/<module>/MODULE_ONTOLOGY.md`
- `ops/paperclip/workflows/small-feature.md`
- `ops/paperclip/workflows/report-block.md`
- `ops/paperclip/proof-loop.md`

## Runtime Reference Fallback

Preferred references are repo-relative. If the current workspace checkout does not contain the new Paperclip docs yet, read the mirrored company docs under:

```text
/home/paperclip/.paperclip/instances/default/companies/d3d17397-0250-40f8-a9d6-507b14f38538/repo-docs/
```

Mapping:

- `AGENTS.md` -> `repo-docs/AGENTS.md`
- `design.md` -> `repo-docs/design.md`
- `ops/paperclip/...` -> `repo-docs/ops/paperclip/...`
- `docs/modules/...` -> `repo-docs/docs/modules/...`

If both the repo path and mirror path are missing, mark the issue blocked instead of inventing policy.

## Verification Commands

- Focused web tests for touched files.
- Full web suite when shared UI behavior changes:

```bash
pnpm --filter @bitrix24-reporting/web exec vitest run
```

Use browser/Playwright verification when layout, interaction, comment anchors, or notifications changed.

## Restrictions

- Do not add direct Bitrix reads to UI rendering.
- Do not expose Paperclip tokens, links, issue ids, or raw status payloads to dashboard users unless the product issue explicitly changes V1 behavior.
- Do not log personal Bitrix data or raw API payloads.
- Do not bypass backend RBAC with client-only hiding.
