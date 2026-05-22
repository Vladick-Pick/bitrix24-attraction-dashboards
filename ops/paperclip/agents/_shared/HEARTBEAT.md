# Heartbeat Procedure

Follow this on every wake.

## Team Roster

- `Dashboard Engineering Manager` is the lead for dashboard comments, task decomposition, module routing, parent issue status, and final readiness recommendation.
- `Frontend Dashboard Engineer` owns `apps/web`, dashboard UI, comment widgets, notification UI, and browser-level verification.
- `Backend Reporting Engineer` owns `apps/api`, SQLite, auth/RBAC, report scoping, Paperclip integration, retries, and status sync.
- `Pre-merge Reviewer` owns code review, regression risk, privacy/security checks, and merge-readiness feedback.
- `Dashboard Intake Service` is a non-worker service identity for dashboard-created issues. It should not implement normal tasks and should not be assigned development work.

## New Dashboard Comment Workflow

1. Dashboard backend saves the comment locally first.
2. Dashboard backend creates a sanitized Paperclip issue through `Dashboard Intake Service`.
3. The issue is assigned to `Dashboard Engineering Manager`.
4. The manager checks out the parent issue, reads the sanitized module/block/filter/comment context, and decides whether the task is clarification, frontend, backend, review, or mixed work.
5. The manager creates child issues for implementation when needed. Each child issue must include `parentId`, `goalId`, module key, acceptance criteria, verification commands, and a specific assignee.
6. Frontend/backend agents work on their assigned child issues in repo branches and report progress back in Paperclip comments.
7. Reviewer checks code, tests, privacy, module boundaries, and deploy risk before merge.
8. The manager synthesizes implementation and review state, then keeps the parent issue status accurate so the dashboard notification can map it to `sent`, `in_work`, `needs_input`, `done`, or `failed`.

For v1, detailed clarification stays in Paperclip. The dashboard only shows top-level status notifications.

## Planning Standard

When asked to plan, or when a dashboard comment is ambiguous enough to require decomposition, the manager must write a plan before delegating implementation. A useful plan contains:

- problem statement and module scope;
- non-goals;
- affected files/systems likely to change;
- data/privacy constraints;
- child task breakdown with one owner per task;
- acceptance criteria;
- verification commands;
- rollout/deploy path;
- open questions or blockers.

1. Identify yourself with `GET /api/agents/me`.
2. If `$PAPERCLIP_APPROVAL_ID` is set, handle the approval first.
3. Load assigned issues for your company and agent, prioritizing `in_progress`, then `todo`.
4. If `$PAPERCLIP_TASK_ID` or `$PAPERCLIP_WAKE_COMMENT_ID` is set, inspect that issue/comment first.
5. Checkout the chosen issue before doing work.
6. Read the issue, comments, ancestors, project, goal, and relevant work products.
7. Read the repository `AGENTS.md` and the files in this instruction bundle.
8. Before code edits, delegation handoff, review-ready status, PR, merge, or deploy work, run `pnpm session:preflight` from the task branch and record the result. If it fails, block or preserve/reconcile the state without discarding user or agent work.
9. Do the smallest useful unit of work in the current heartbeat.
10. If delegating, create child issues with `parentId`, `goalId`, acceptance criteria, verification commands, and a specific assignee.
11. Before exiting, update the issue with what changed, verification status, and the next action.

If blocked, set status to `blocked` and comment with the blocker, owner, and exact unblock action. Never silently leave work stale.
