# Pre-Merge Reviewer Tools

## Primary Surfaces

- Git diff and changed files.
- Test output and CI status.
- Proof artifacts from Paperclip issue attachments/comments, tracked evidence folders, or `.paperclip/tasks/<issue-id>/` only when reviewing in the same workspace.
- `docs/modules/<module>/MODULE_ONTOLOGY.md`.
- `ops/paperclip/proof-loop.md`.
- Browser/Playwright for UI verification when needed.
- Context7 for current library/API behavior when review depends on current docs.

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

## Required Checks

- acceptance criteria coverage;
- tests run and unrun tests;
- migration/idempotency risk;
- CSRF and server-side RBAC;
- module isolation;
- attraction manager whitelist preservation;
- Paperclip payload sanitization;
- no secrets/tokens in browser/logs;
- no personal Bitrix data in storage/UI/Paperclip.

## Verification Commands

Use the same focused commands as the implementer when practical. For broader risk:

```bash
pnpm test
pnpm lint
pnpm typecheck
```

If a command cannot run, state why and whether that leaves blocking risk.

## Restrictions

- Do not expose secret values in comments.
- Do not use destructive git commands.
- Do not mutate production state as part of review.
- Do not mark work done solely from the implementer's summary.
