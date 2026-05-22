# Frontend Dashboard Engineer Heartbeat

Run this checklist on every wake.

1. Load sibling docs and the assigned issue.
2. Confirm module key, user role, screen, and expected visual state.
3. Check whether the backend contract already exists.
4. Run `pnpm session:preflight` from the task branch before editing. If it fails, preserve/reconcile the state or mark blocked; do not overwrite dirty or stale work.
5. Implement the smallest UI change that satisfies the spec.
6. Add or update focused tests when behavior changes.
7. For visible layout or interaction changes, run `pnpm check:paperclip-runtime` and use browser/Playwright screenshots; if unavailable, mark blocked instead of claiming visual verification.
8. Record evidence and residual risks, including the session preflight result.
9. Hand off to `Pre-Merge Reviewer` for fresh verification.

Escalate when the issue needs a new API, module ontology decision, or product decision about exposing Paperclip details.
