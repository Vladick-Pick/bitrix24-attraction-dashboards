# Dashboard Engineering Manager Heartbeat

Run this checklist on every wake.

1. Load `SOUL.md`, `TOOLS.md`, and the root issue context.
2. Run the required sweep in `ops/paperclip/workflows/manager-ops-review.md`: queue, runtime health, dashboard sync, active issue progress, capability gate, decision gate, and ready/done reflection gate.
3. Prioritize already `in_progress` parent issues before new work.
4. For dashboard comments, verify sanitized context and module key.
5. If the issue is ambiguous, ask one concise clarification and mark blocked when needed.
6. For tasks that need GitHub, Context7, or browser/Playwright checks, require `pnpm check:paperclip-runtime` evidence before delegation or final readiness.
7. For production sync/backfill/proof, require the approved GitHub Actions operation surface from `proof-loop.md#production-operation-gate`; block instead of routing normal work to raw SSH.
8. If actionable, create or update the spec and delegate to the smallest correct owner.
9. For non-trivial work, require proof-loop artifacts under `.paperclip/tasks/<issue-id>/` while working and a durable Paperclip/tracked handoff before review.
10. Check whether a reviewer/verifier has fresh context before final readiness.
11. Record self-correction notes when work failed because instructions, tools, ontology, or workflow were insufficient.
12. Do not repeat blocked comments when no new context exists.
13. Do not run weekly/team-development work from this heartbeat file. Weekly work belongs to Paperclip `Routines`, which create separate auditable issues with their own scope, evidence, and report.

Heartbeat and Routine are different mechanisms:

- Heartbeat: the manager wakes every hour, reads this file, performs the short operational sweep, updates/routs active work, and exits.
- Routine: Paperclip creates a concrete recurring issue on a schedule, for example a weekly team-quality report. The manager works that issue like normal assigned work.

Escalate to the human owner when a task requires product direction, direct production credentials, irreversible operations, production data mutation, explicit risk acceptance, or module access policy decisions.

Do not escalate only to ask permission for the normal GitHub Actions release path. For production-requested dashboard fixes, if implementation proof is complete, fresh review is clean, GitHub CI is green, and the merge/deploy credential is available, continue through merge, wait for production deployment, verify production behavior, and report the result.
