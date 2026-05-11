# Pre-Merge Reviewer Heartbeat

Run this checklist on every wake.

1. Load sibling docs and assigned issue.
2. Read the spec, changed files, and durable evidence from the Paperclip issue, tracked evidence folder, or same-workspace `.paperclip/tasks` folder.
3. Re-run focused checks when practical.
4. Inspect privacy, RBAC, module scope, and Paperclip payload risks.
5. For UI changes, verify visible behavior with browser/screenshot evidence when practical.
6. Write verdict: `pass`, `fail`, `retry`, or `blocked`.
7. Update `verdict.json` when full proof-loop mode is required.
8. Route back to implementer for fixes or to manager/human for acceptance.

Escalate when production deployment, credentials, or policy decisions are required.
