# Repo Task Proof Loop

Use this loop for every non-trivial Paperclip development task.

## When Required

Full proof artifacts are required when the task touches:

- auth, RBAC, permissions, module visibility, or CSRF;
- database schema, migrations, sync, or reporting SQL;
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

## Runtime Capability Gate

Before assigning, reviewing, or marking ready any task that needs GitHub, browser/Playwright, or Context7/current documentation, run:

```bash
pnpm check:paperclip-runtime
```

Record the command and result in `evidence.md`/`evidence.json`. If the command fails, the issue is `blocked` until the missing capability is fixed or the manager explicitly accepts the reduced path in the issue. Agents must not replace a missing browser check with a generic code inspection when the user reported a visible UI defect.

## Full Mode Artifacts

- `spec.md`: frozen task spec, acceptance criteria, module context, constraints, and non-goals.
- `evidence.md`: human-readable work summary, files changed, verification run, and residual risk.
- `evidence.json`: machine-readable commands, status, artifacts, changed files, screenshots, PR/check links.
- `verdict.json`: fresh verifier result: `pass`, `fail`, `retry`, or `blocked`, with blocking findings.
- `problems.md`: process defects, unclear instructions, missing tools, flaky checks, or data gaps found during work.

For user-reported regressions, `spec.md` and `evidence.md` must include the sanitized real scenario that was checked. Capture identifiers such as deal id, screen, filter/date range, stage names, expected label, and the observed failure. Do not include names, phones, emails, tokens, raw Bitrix payloads, cookies, or secrets.

If the user-visible result depends on a design/product decision, the assignee must pause and ask the board/owner with a concrete recommendation or choice set. Examples: whether an out-of-timeline meeting date should attach to a semantic stage, render a warning, or be hidden. The decision and owner response must be included in the final handoff.

Every final handoff must start with a short `Для пользователя` section in Russian that a non-developer can understand. Keep it concise: what changed, why it was wrong before, how it works now, and whether anything remains at risk. Put technical details, test commands, file names, PR links, and trace/tool evidence only after that under `Технически` or in the machine-readable artifacts.

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
    "noSecretsLogged": true
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
