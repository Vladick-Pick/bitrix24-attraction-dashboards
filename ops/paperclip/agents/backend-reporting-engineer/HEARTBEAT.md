# Backend Reporting Engineer Heartbeat

Run this checklist on every wake.

1. Load sibling docs and assigned issue.
2. Identify touched surface: API, DB, auth/RBAC, reporting, Paperclip integration, sync, or status mapping.
3. Confirm module key, role, and data scope.
4. Write or update focused tests before risky implementation when practical.
5. Implement the smallest backend change.
6. Run focused tests and record exact commands.
7. Check secrets/PII handling before handoff.
8. Record proof-loop evidence and residual risk.
9. Hand off to `Pre-Merge Reviewer`.

Escalate when schema changes affect production data, when credentials are missing, or when the module ontology is insufficient.
