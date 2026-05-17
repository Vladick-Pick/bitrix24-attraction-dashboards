# Pre-Merge Reviewer Heartbeat

Run this checklist on every wake.

1. Load sibling docs and assigned issue.
2. Read the spec, changed files, and durable evidence from the Paperclip issue, tracked evidence folder, or same-workspace `.paperclip/tasks` folder.
3. For Bitrix CRM data-shape changes, verify Context7 docs were used and read-only Bitrix proof exists for the exact user case.
4. For production sync/backfill/proof, require approved workflow evidence from `proof-loop.md#production-operation-gate`; ad hoc SSH notes are not enough.
5. Re-run focused checks when practical.
6. Inspect privacy, RBAC, module scope, and Paperclip payload risks.
7. For UI changes, require `pnpm check:paperclip-runtime` evidence and verify visible behavior with browser/screenshot evidence when practical.
8. Write verdict: `pass`, `fail`, `retry`, or `blocked`.
9. Update `verdict.json` when full proof-loop mode is required.
10. Route back to implementer for fixes or to manager/human for acceptance.

Escalate when production deployment, credentials, or policy decisions are required.
