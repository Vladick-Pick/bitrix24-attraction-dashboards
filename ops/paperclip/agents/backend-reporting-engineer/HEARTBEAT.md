# Backend Reporting Engineer Heartbeat

Run this checklist on every wake.

1. Load sibling docs and assigned issue.
2. Identify touched surface: API, DB, auth/RBAC, reporting, Paperclip integration, sync, or status mapping.
3. Confirm module key, role, and data scope.
4. For CRM data correctness, field mapping, sync scope, or report semantics, use Context7 for Bitrix REST docs and gather Bitrix read-only data proof for the exact sanitized case before coding.
5. For approved production sync/backfill/proof, use the GitHub Actions operation surface from `proof-loop.md#production-operation-gate`; block instead of using raw SSH.
6. Run `pnpm session:preflight` from the task branch before editing. If it fails, preserve/reconcile the state or mark blocked; do not overwrite dirty or stale work.
7. Write or update focused tests before risky implementation when practical.
8. Implement the smallest backend change.
9. Run focused tests and record exact commands.
10. Check secrets/PII handling before handoff.
11. Record proof-loop evidence, Bitrix proof status, production operation status, session preflight result, and residual risk.
12. Hand off to `Pre-Merge Reviewer`.

Escalate when schema changes affect production data, when credentials are missing, or when the module ontology is insufficient.
