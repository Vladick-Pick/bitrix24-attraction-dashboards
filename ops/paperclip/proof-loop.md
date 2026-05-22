# Repo Task Proof Loop

Use this loop for every non-trivial Paperclip development task.

## When Required

Full proof artifacts are required when the task touches:

- auth, RBAC, permissions, module visibility, or CSRF;
- database schema, migrations, sync, or reporting SQL;
- CRM field semantics, Bitrix-derived report data, stage/reason mapping, or data-correctness claims;
- Paperclip API integration, retries, issue status mapping, or secrets;
- production deployment, server checks, or GitHub Actions;
- cross-module behavior or shared dashboard components;
- any task that spans more than one agent.

Small copy/UI-only tasks may use light mode, but the assignee must say why full mode is unnecessary.

## Artifact Location

Use this path for task artifacts:

```text
.paperclip/tasks/<paperclip-issue-id>/
```

Do not commit runtime task folders by default. Commit them only when the issue explicitly asks for durable evidence in the repository.

Full mode requires a durable handoff before review. The assignee must either:

- post or attach sanitized `spec.md`, `evidence.md`, `evidence.json`, `verdict.json`, and `problems.md` content to the Paperclip issue; or
- create a reviewed, tracked evidence folder for the issue when the task explicitly requires evidence in git.

Fresh verification must not rely only on a local ignored `.paperclip/tasks` folder from another workspace.

If a required environment capability is unavailable, the task is `blocked`, not `ready`. Missing GitHub push/PR access, missing browser/Playwright runtime, missing Context7/current-doc access for dependency-sensitive work, or missing production/deploy access must be recorded in `problems.md` and `verdict.json.unrunChecks`. A manager may explicitly accept the residual risk, but an assignee must not claim "ready" while the user-visible verification path is unavailable.

## Session Freshness Gate

Before coding, delegation handoff, review-ready status, PR creation, merge, deploy, or any proof claim that depends on repository state, run:

```bash
pnpm session:preflight
```

Record the command and result in `evidence.md`/`evidence.json`. This gate proves the agent is on a task branch, the worktree is clean, `origin/main` was fetched, and the branch is not behind the latest visible base. If it fails, the issue is `blocked` until existing user or agent work is preserved in a named branch/commit and the branch is reconciled without losing changes.

`--allow-dirty` is allowed only when continuing the same active issue after reading `git diff` and confirming the dirty files belong to that issue. `--no-fetch` is allowed only in an intentionally offline runtime with the limitation recorded in the handoff.

## Runtime Capability Gate

Before assigning, reviewing, or marking ready any task that needs GitHub, browser/Playwright, or Context7/current documentation, run:

```bash
pnpm check:paperclip-runtime
```

Record the command and result in `evidence.md`/`evidence.json`. If the command fails, the issue is `blocked` until the missing capability is fixed or the manager explicitly accepts the reduced path in the issue. Agents must not replace a missing browser check with a generic code inspection when the user reported a visible UI defect.

## Production Operation Gate

Production data mutation must go through a repo-approved operation surface, not direct agent SSH or one-off shell scripts.

For sync/backfill/verification tasks, the current approved surface is the GitHub Actions workflow:

```text
.github/workflows/production-sync-verify.yml
```

That workflow runs `scripts/production-sync-verify.sh` on the VPS using GitHub protected environment secrets, creates a production DB backup, triggers the approved sync endpoint, and prints only sanitized proof. It is intentionally narrow:

- `MODULE=attraction`: numeric deal IDs, one expected category 10 stage ID, and one expected Bitrix field ID.
- `MODULE=leadgen`: category `28`, frozen workload range `2026-05-11T00:00:00.000Z..2026-05-17T23:59:59.999Z`, distinct production DB env paths, non-empty `BITRIX24_LEADGEN_MANAGER_IDS`, and aggregate activities/calls workload report shapes.

Use it for approved production operations such as:

```bash
gh workflow run production-sync-verify.yml \
  -f paperclip_issue=BIT-73 \
  -f module=attraction \
  -f deal_ids=156080,156184,156194,156306 \
  -f stage_id=C10:UC_EA3R76 \
  -f field_id=UF_CRM_1776949411825
```

```bash
gh workflow run production-sync-verify.yml \
  -f paperclip_issue=BIT-84 \
  -f module=leadgen \
  -f category_id=28 \
  -f range_from=2026-05-11T00:00:00.000Z \
  -f range_to=2026-05-17T23:59:59.999Z \
  -f expected_commit=<deployed-fix-commit>
```

Required operation evidence:

- Paperclip issue ID that approved the production operation;
- workflow run URL or run ID;
- deployed commit check result;
- backup path printed by the operation;
- sanitized sync summary;
- exact post-sync snapshot proof for requested attraction IDs, or sanitized leadgen category/whitelist snapshot counts plus workload report shapes;
- health check result;
- no secrets, cookies, webhook URLs, raw payloads, names, phones, emails, or broad production logs.

If the workflow is missing, GitHub workflow permission is missing, the production environment blocks the run, or the approved operation does not cover the required mutation, the task is `blocked`. Agents must not work around that by requesting raw SSH, copying databases, running arbitrary remote scripts, or using personal credentials. Direct SSH is break-glass only for an explicitly assigned release/incident task with owner approval and redacted output.

## Full Mode Artifacts

- `spec.md`: frozen task spec, acceptance criteria, module context, constraints, and non-goals.
- `evidence.md`: human-readable work summary, files changed, verification run, and residual risk.
- `evidence.json`: machine-readable commands, status, artifacts, changed files, screenshots, PR/check links.
- `verdict.json`: fresh verifier result: `pass`, `fail`, `retry`, or `blocked`, with blocking findings.
- `problems.md`: process defects, unclear instructions, missing tools, flaky checks, or data gaps found during work.

For user-reported regressions, `spec.md` and `evidence.md` must include the sanitized real scenario that was checked. Capture identifiers such as deal id, screen, filter/date range, stage names, expected label, and the observed failure. Do not include names, phones, emails, tokens, raw Bitrix payloads, cookies, or secrets.

If the user-visible result depends on a design/product decision, the assignee must pause and ask the board/owner with a concrete recommendation or choice set. Examples: whether an out-of-timeline meeting date should attach to a semantic stage, render a warning, or be hidden. The decision and owner response must be included in the final handoff.

Every final handoff must start with a short `Для пользователя` section in Russian that a non-developer can understand. Keep it concise: what changed, why it was wrong before, how it works now, and whether anything remains at risk. Put technical details, test commands, file names, PR links, and trace/tool evidence only after that under `Технически` or in the machine-readable artifacts.

## Bitrix Read-Only Data Proof Gate

For any data-correctness issue involving Bitrix CRM fields, stages, custom fields, manager scope, local snapshot coverage, sync behavior, or report semantics, the assignee must gather a read-only Bitrix proof before implementation is considered ready.

Required sources:

- current Bitrix REST documentation through Context7;
- local SQLite snapshot for the exact module database and dashboard filter/range;
- Bitrix REST read-only calls through the backend runtime's secret-backed read-only env bindings and `ops/paperclip/tools/bitrix-readonly-proof.mjs`, or an equivalent repo-approved proof tool.

### Context7 Bitrix REST Check

Before any Bitrix REST proof call or implementation spec, use Context7 to check the current Bitrix REST documentation for the exact methods under consideration. The proof must not say only "checked docs"; it must name the methods and the relevant request-shape facts used for the task.

Required Context7 coverage:

- `crm.deal.fields` and/or `crm.deal.userfield.list` for CRM field metadata, custom field names, enum/list values, and labels;
- `crm.status.list` for stage/category/status semantics when stage IDs affect the report;
- `crm.deal.list` or `crm.item.list` for read-only exact-deal probes, narrow `filter`, narrow `select`, pagination, and returned field behavior;
- `crm.stagehistory.list` when the report depends on stage transition timing;
- `batch` only when the proof needs several read-only calls and the current docs confirm the limits/shape.

Record the Context7 result in `evidence.md`/`evidence.json` as sanitized conclusions: method names checked, why each method is read-only for this task, required `filter`/`select` shape, pagination/batch constraints, and any uncertainty. Do not paste long documentation excerpts. If Context7 is unavailable or does not cover the needed method, the task is `blocked` unless the manager explicitly accepts a documented fallback source.

Allowed proof methods:

- `crm.deal.fields` to confirm field IDs, types, enum item counts, and CRM-link fields;
- `crm.deal.userfield.list` to find unknown custom fields by Russian UI labels, `FIELD_NAME`, type, section, and list labels;
- `crm.status.list` to confirm stage IDs, names, categories, and semantics;
- `crm.deal.list` or `crm.item.list` with narrow `select` and `filter`;
- `crm.stagehistory.list` when the report depends on stage transition time;
- `batch` only for the same read-only methods, up to the documented command limit.

Forbidden proof behavior:

- no direct browser/dashboard Bitrix calls;
- no mutating Bitrix methods;
- no deal names, contact names, phones, emails, cookies, webhooks, raw tokens, or raw Bitrix payloads in Paperclip comments;
- no `select: ["*"]`, `UF_*`, `TITLE`, contact fields, phone/email fields, comments, addresses, or raw personal fields;
- no mocked test fixture as the only evidence for a production data-shape claim.

The approved helper intentionally supports only sanitized modes:

```bash
node ops/paperclip/tools/bitrix-readonly-proof.mjs userfields --keywords "причина,отказ,возврат,лидген,неквал"
node ops/paperclip/tools/bitrix-readonly-proof.mjs deal-probe --deal-ids "156080,156184,156194,156306" --fields "UF_CRM_1776949411825"
node ops/paperclip/tools/bitrix-readonly-proof.mjs status --entity-id "DEAL_STAGE_10"
```

It reads `BITRIX24_READONLY_PORTAL_HOST`, `BITRIX24_READONLY_WEBHOOK_USER_ID`, and `BITRIX24_READONLY_WEBHOOK_TOKEN` from Paperclip secret-backed runtime env. If those bindings are missing, the issue is `blocked`, not implementation-ready.

### New Bitrix Data Discovery Process

Use this process whenever the user asks for data that is missing, newly requested, or not already covered by the local snapshot contract.

1. Freeze the user case: module, screen/report, filters/date range, exact deal IDs if present, expected visible data, and observed missing data.
2. Use Context7 to load current Bitrix REST documentation before choosing methods or request shape.
3. Inspect the existing code and docs for known field IDs, report dimensions, stage IDs, and previous Bitrix field audits.
4. If the known fields do not explain the case, search Bitrix custom-field metadata with `crm.deal.userfield.list` by labels and keywords from the UI/user text. For Russian Bitrix labels, search terms such as `причина`, `отказ`, `возврат`, `корзина`, `неквал`, `лидген`, and the exact label from screenshots.
5. If the field label is still ambiguous, ask the user for a Bitrix screenshot of the relevant card block before implementing. Do not guess from similar field names.
6. Query the exact affected deal IDs with `crm.deal.list` and a narrow `select` containing only `ID`, category/stage fields, and the candidate custom fields. Confirm which field is populated and map enum IDs to labels through field metadata.
7. Compare against the local SQLite snapshot/API response for the same IDs or filter range.
8. Only then write tests and implementation. Tests must encode the confirmed Bitrix field and the real-case shape, not a speculative field.

If any step cannot be performed, the task is `blocked` or `needs input`, not ready.

### Example: Missing Loss Reasons

If a user says "4 deals have no loss reason":

- identify the exact 4 deal IDs from the local snapshot/API and dashboard filter;
- prove whether Bitrix has a reason for those exact IDs;
- if the known fields are empty, inspect `crm.deal.userfield.list` or ask for a screenshot of the Bitrix card block;
- record the discovered field name and label, for example `UF_CRM_1776949411825` / `Причина отказа (Привлечение Возврат в Лидген)`;
- verify enum IDs and labels for those exact 4 deals;
- after implementation and sync/backfill, verify the same 4 local snapshot rows/API details now contain the expected reason labels.

The required evidence must include sanitized aggregates only:

- exact module, database file, screen/report, filters, and date range;
- exact Bitrix methods used;
- selected field IDs and stage IDs;
- row counts and boolean field-presence counts;
- local snapshot counts for the same range;
- conclusion: whether the implementation hypothesis is confirmed, disproven, or blocked by missing source data.

If the assignee cannot access Bitrix REST or the production/local snapshot needed for the issue, mark the task `blocked`. A manager may explicitly accept reduced evidence, but the assignee and reviewer must not call the task ready.

## Loop

1. Freeze the spec before coding.
2. Implement the smallest change that satisfies the spec.
3. Record evidence while working.
4. Ask for fresh verification by a different agent/context.
5. Apply minimal fixes only for verified problems.
6. Re-run fresh verification.
7. Move to review/release only after the verdict is clean or explicitly accepted with risk.

## Evidence JSON Shape

```json
{
  "issue": "BIT-123",
  "module": "attraction",
  "mode": "full",
  "changedFiles": [],
  "commands": [
    {
      "command": "pnpm --filter @bitrix24-reporting/api test -- --runInBand",
      "status": "pass",
      "notes": ""
    }
  ],
  "artifacts": [],
  "privacyChecks": {
    "noPiiInPaperclipPayload": true,
    "noSecretsLogged": true,
    "bitrixProofRedacted": true
  },
  "sessionPreflight": {
    "required": true,
    "status": "pass",
    "command": "pnpm session:preflight",
    "base": "origin/main",
    "branch": "codex/BIT-123-example",
    "notes": ""
  },
  "bitrixDataProof": {
    "required": false,
    "status": "not_required",
    "methods": [],
    "filters": {},
    "fieldIds": [],
    "stageIds": [],
    "localSnapshotCounts": {},
    "bitrixCounts": {},
    "conclusion": ""
  },
  "productionOperation": {
    "required": false,
    "status": "not_required",
    "workflow": "",
    "runUrl": "",
    "approvedByIssue": "",
    "backupCreated": false,
    "sanitizedPostSyncProof": {},
    "conclusion": ""
  },
  "review": {
    "verifier": "",
    "verdict": "pending"
  }
}
```

## Verdict JSON Shape

```json
{
  "issue": "BIT-123",
  "verdict": "pass",
  "verifiedBy": "",
  "checkedAt": "",
  "blockingFindings": [],
  "residualRisks": [],
  "unrunChecks": []
}
```
