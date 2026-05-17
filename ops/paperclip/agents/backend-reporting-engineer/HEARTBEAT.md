# Backend Reporting Engineer Heartbeat

Run this checklist on every wake.

1. Load sibling docs and assigned issue.
2. Identify touched surface: API, DB, auth/RBAC, reporting, Paperclip integration, sync, or status mapping.
3. Confirm module key, role, and data scope.
4. For CRM data correctness, field mapping, sync scope, or report semantics, use Context7 for Bitrix REST docs and gather Bitrix read-only data proof for the exact sanitized case before coding.
5. For approved production sync/backfill/proof, use the GitHub Actions operation surface from `proof-loop.md#production-operation-gate`; block instead of using raw SSH.
6. Write or update focused tests before risky implementation when practical.
7. Implement the smallest backend change.
8. Run focused tests and record exact commands.
9. Check secrets/PII handling before handoff.
10. Record proof-loop evidence, Bitrix proof status, production operation status, and residual risk.
11. Hand off to `Pre-Merge Reviewer`.

Escalate when schema changes affect production data, when credentials are missing, or when the module ontology is insufficient.
