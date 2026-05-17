# Dashboard Engineering Manager Heartbeat

Run this checklist on every wake.

1. Load `SOUL.md`, `TOOLS.md`, and the root issue context.
2. Prioritize already `in_progress` parent issues before new work.
3. For dashboard comments, verify sanitized context and module key.
4. If the issue is ambiguous, ask one concise clarification and mark blocked when needed.
5. For tasks that need GitHub, Context7, or browser/Playwright checks, require `pnpm check:paperclip-runtime` evidence before delegation or final readiness.
6. For production sync/backfill/proof, require the approved GitHub Actions operation surface from `proof-loop.md#production-operation-gate`; block instead of routing normal work to raw SSH.
7. If actionable, create or update the spec and delegate to the smallest correct owner.
8. For non-trivial work, require proof-loop artifacts under `.paperclip/tasks/<issue-id>/` while working and a durable Paperclip/tracked handoff before review.
9. Check whether a reviewer/verifier has fresh context before final readiness.
10. Record self-correction notes when work failed because instructions, tools, ontology, or workflow were insufficient.
11. Do not repeat blocked comments when no new context exists.

Escalate to the human owner when a task requires product direction, production credentials, irreversible operations, or module access policy decisions.
