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

Session currency before editing or handoff:

```bash
pnpm session:preflight
```

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

## Approved Production Operations

Normal agents do not receive raw SSH as the production path. Use the narrow GitHub Actions operation surface when a task needs production sync/backfill and exact post-operation proof.

Current approved workflow:

```text
.github/workflows/production-sync-verify.yml
```

Current approved script:

```text
scripts/production-sync-verify.sh
```

The workflow requires the protected GitHub `production` environment and existing deploy secrets. It validates inputs, SSHes through the GitHub runner, creates a production DB backup, triggers the app sync endpoint through authenticated HTTP, checks health, and emits sanitized JSON only.

Supported modules:

- `attraction`: exact deal IDs, category 10 stage ID, Bitrix `UF_CRM_*` field ID, and exact attraction snapshot rows.
- `leadgen`: category `28`, frozen workload range `2026-05-11T00:00:00.000Z..2026-05-17T23:59:59.999Z`, separate DB env path proof, leadgen manager whitelist count, leadgen snapshot scope counts, and activities/calls workload report shapes.

Run shape:

```bash
gh workflow run production-sync-verify.yml \
  -f paperclip_issue=BIT-73 \
  -f module=attraction \
  -f deal_ids=156080,156184,156194,156306 \
  -f stage_id=C10:UC_EA3R76 \
  -f field_id=UF_CRM_1776949411825
gh run watch
gh run view --log
```

```bash
gh workflow run production-sync-verify.yml \
  -f paperclip_issue=BIT-84 \
  -f module=leadgen \
  -f category_id=28 \
  -f range_from=2026-05-11T00:00:00.000Z \
  -f range_to=2026-05-17T23:59:59.999Z \
  -f expected_commit=<deployed-fix-commit>
gh run watch
gh run view --log
```

Required evidence to attach to Paperclip:

- workflow run URL or run ID;
- deployed commit check;
- backup path;
- sanitized sync summary;
- exact attraction deal rows with IDs, category/stage, `hasReason`, and `refusalReasonValue`, or leadgen category/whitelist snapshot counts plus workload report shapes;
- health check.

If `gh workflow run` is unavailable, the production environment requires approval you cannot obtain, required secrets are missing, or the workflow does not cover the operation, mark the task `blocked`. Do not replace it with manual SSH, arbitrary remote scripts, copied SQLite files, or personal credentials.

## Bitrix Read-Only Proof Tools

For CRM data-shape or report-semantics issues, first use Context7 for current Bitrix REST docs, then gather proof through narrow read-only methods. Output must contain only deal IDs, stage IDs, field IDs, booleans, enum labels, and counts. Do not select deal titles, contacts, phones, emails, raw free-text values, webhook URLs, or tokens.

The backend runtime has a dedicated read-only proof credential exposed only as secret-backed environment bindings:

- `BITRIX24_READONLY_PORTAL_HOST`;
- `BITRIX24_READONLY_WEBHOOK_USER_ID`;
- `BITRIX24_READONLY_WEBHOOK_TOKEN`.

Use the approved sanitized helper before writing a one-off Bitrix script:

```bash
node ops/paperclip/tools/bitrix-readonly-proof.mjs userfields --keywords "причина,отказ,возврат,лидген,неквал"
node ops/paperclip/tools/bitrix-readonly-proof.mjs deal-probe --deal-ids "156080,156184,156194,156306" --fields "UF_CRM_1776949411825"
node ops/paperclip/tools/bitrix-readonly-proof.mjs status --entity-id "DEAL_STAGE_10"
```

If the checkout does not contain `ops/paperclip/tools/bitrix-readonly-proof.mjs`, use the mirrored copy under:

```text
/home/paperclip/.paperclip/instances/default/companies/d3d17397-0250-40f8-a9d6-507b14f38538/repo-docs/ops/paperclip/tools/bitrix-readonly-proof.mjs
```

If the helper or read-only env bindings are unavailable, mark the issue `blocked`; do not fall back to speculative mocks.

Context7 usage is mandatory and must be specific:

- check the current Bitrix REST docs for each method you plan to use;
- name the methods in evidence: `crm.deal.fields`, `crm.deal.userfield.list`, `crm.status.list`, `crm.deal.list`, `crm.item.list`, `crm.stagehistory.list`, or `batch`;
- record the relevant request-shape facts: read-only status, narrow `filter`, narrow `select`, pagination, enum/list handling, and batch limits when used;
- if Context7 is unavailable or the docs do not cover the required method, mark the task `blocked` instead of guessing.

Allowed direct Bitrix REST methods for manual proof are limited to:

- `crm.deal.fields`;
- `crm.deal.userfield.list`;
- `crm.status.list`;
- `crm.deal.list` with narrow `select` and `filter`;
- `crm.item.list` with narrow `select` and `filter`;
- `crm.stagehistory.list`;
- `batch` containing only the read-only methods above.

For field discovery:

- search existing repo docs/audits first;
- use `crm.deal.userfield.list` with `LANG: 'ru'` and label keywords from the user/screenshot;
- ask the user for a Bitrix screenshot when the UI label cannot be identified from metadata;
- query exact deal IDs with candidate fields before implementing.

## Restrictions

- Do not print secrets, Paperclip tokens, Bitrix webhooks, session cookies, or raw payloads.
- Do not copy local SQLite over production.
- Do not mutate production data without explicit approval and backup.
- Do not add direct Bitrix reads to page rendering.
- Do not rely on client-side checks for module access.
