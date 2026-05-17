# Workflow: Dashboard Manager Ops Review

Owner: `Dashboard Engineering Manager`.

This workflow turns the manager from a task dispatcher into the owner of the
agentic production system. The manager must inspect workflow state, runtime
health, traces, proof artifacts, and user-facing handoffs. Repeated failures
must become workflow changes, validators, tests, evals, or explicit proposals;
do not rely on "be more careful" prompt advice.

## Heartbeat Cadence

Paperclip supports one regular heartbeat interval per agent through
`runtimeConfig.heartbeat.intervalSec`. Do not design separate hourly and
two-hourly timer loops for the same agent.

For this company, the manager heartbeat cadence is hourly:

```json
{
  "heartbeat": {
    "enabled": true,
    "intervalSec": 3600,
    "wakeOnDemand": true,
    "cooldownSec": 10,
    "maxConcurrentRuns": 1
  }
}
```

The manager may still wake from events: assignment, mention, approval result,
or manual/on-demand wake.

Do not put weekly/team-development work into the heartbeat. Weekly work belongs
to Paperclip `Routines`: separate recurring definitions that materialize into
auditable execution issues. The manager then works those issues normally.

## Durable State

The manager should keep lightweight review cursors in the issue thread,
company knowledge, or a small tracked ops artifact when available. The state
must survive context compaction.

Minimum heartbeat cursors:

```text
last_ops_sweep_at
last_issue_trace_reviewed_at
last_proof_audit_issue_identifier
last_instruction_review_at
last_runtime_capability_check_at
```

If no durable cursor exists, infer the delta from recent Paperclip runs/issues
and write a concise state note before doing broad analysis.

## Every Heartbeat: Required Sweep

Keep the regular heartbeat short. Default budget: inspect deltas since the last
heartbeat, act on blockers, and avoid noisy "all clear" comments unless the
user or an issue explicitly asks for a status report.

### 1. Queue Sweep

Where to look:

- `GET /api/companies/{companyId}/issues?status=todo,in_progress,blocked,in_review`
- Paperclip UI: `/<prefix>/issues`
- Issue comments for any `blocked` or stale `in_progress` issue.

Good state:

- Every open issue has one clear owner.
- Every active issue has a next action.
- Parent issues are not waiting silently on completed children.
- Duplicate dashboard-created issues are cancelled or linked to one canonical
  issue.

Bad state:

- No assignee, wrong assignee, or a child issue with no parent.
- `in_progress` issue with no useful action across multiple heartbeats.
- `blocked` issue whose blocker is resolved but status was not updated.
- Repeated duplicate issues from dashboard save retries.

Action:

- Checkout or route actionable work.
- Reassign to the smallest correct owner.
- Mark truly blocked work `blocked` with a concrete unblocker.
- Cancel duplicates only when a canonical issue is named.

### 2. Runtime Health Sweep

Where to look:

- `GET /api/companies/{companyId}/agents`
- `GET /api/companies/{companyId}/heartbeat-runs?limit=50`
- `GET /api/heartbeat-runs/{runId}`
- `GET /api/heartbeat-runs/{runId}/events`
- `GET /api/heartbeat-runs/{runId}/log`
- Paperclip UI agent pages: `/<prefix>/agents/{agent-url-key}`

Good state:

- Worker agents are `idle` or have a current `running` heartbeat.
- Failed runs have a recorded issue, blocker, or recovery action.
- Intentional pauses are documented and not treated as incidents.
- `Dashboard Intake Service` may have heartbeat disabled; it is not a worker.

Bad state:

- Agent status `error` without a known explanation.
- Failed/cancelled runs tied to active work with no follow-up.
- Long-running heartbeat with no output or liveness explanation.
- Repeated `needs_followup` with no useful action and no issue update.

Action:

- If a runtime problem blocks active user work, create or update an incident or
  manager issue.
- If the status is intentional or harmless, record that once and do not create
  recurring noise.
- Preserve run IDs and redacted summaries; never paste secrets, cookies, raw
  tokens, or raw Bitrix payloads.

### 3. Dashboard Sync Sweep

Where to look:

- Production API, authenticated as a module leader when needed:
  - `GET /api/modules/{moduleId}/comments`
  - `GET /api/modules/{moduleId}/comment-notifications`
- Local API for development parity when production is not in scope.
- Source code for status mapping:
  - `apps/api/src/server/app.ts`
  - `apps/api/src/server/paperclip-client.ts`
  - `apps/web/src/proto/use-proto-comments.ts`

Good state:

- Open dashboard comments map to the correct Paperclip issue.
- `done` issues show a user-ready report in dashboard notifications.
- Archived comments do not keep unread notifications alive.
- Failed rework/comment submission remains visible and retryable.

Bad state:

- Paperclip issue is `done` but dashboard comment stays open with no report.
- Dashboard comment is archived but notification still appears.
- User rework comment is saved locally but not posted to the Paperclip issue.
- Sync error hides the user's comment or loses the thread history.

Action:

- For product-visible sync bugs, route to Backend Reporting Engineer.
- For UI feedback/scrolling/disabled-state bugs, route to Frontend Dashboard
  Engineer.
- For resolved production comments, archive through the authenticated dashboard
  API only after deployed behavior is verified.

### 4. Active Issue Progress Sweep

Where to look:

- Parent issue, child issues, and latest comments.
- Child issue status and blocked-by relationships.
- Recent heartbeat run summaries for assigned agents.

Good state:

- Parent issue describes the current plan and blockers.
- Child issue handoffs are specific and scoped.
- Completed children include evidence and reviewer verdicts.
- Parent status matches reality.

Bad state:

- Parent says `in_review` while child implementation is still incomplete.
- Manager asks the board for approval when the normal release path is already
  authorized by policy.
- Team claims ready while required checks are missing.

Action:

- Update the parent with a concise state transition.
- Do not ask the board to approve normal GitHub Actions merge/deploy when proof,
  review, CI, and credentials are available.
- Ask the board only for product decisions, direct server/root work, production
  data mutation, destructive operations, credential/access-policy decisions, or
  acceptance of missing verification.

### 5. Capability Gate

Where to look:

- `pnpm check:paperclip-runtime` when a task needs GitHub, Context7, browser,
  Playwright, or deploy visibility.
- GitHub/CI status for PR and merge claims.
- Browser/screenshot evidence for visible UI defects.
- Production smoke checks for deployed fixes.

Good state:

- The required tool for the user's symptom is available and used.
- Missing capability is captured in `problems.md` and the issue is `blocked`,
  not `ready`.
- Manager explicitly accepts a reduced path only when the risk is named.

Bad state:

- Browser check skipped for a visual bug without explanation.
- GitHub push/PR/deploy unavailable but the issue is still marked ready.
- Context7/current docs unavailable for dependency-sensitive work.
- Production smoke omitted after a production-requested fix.

Action:

- Block the issue with the missing capability and exact next owner/action.
- Fix team infrastructure as a separate task when the missing tool affects more
  than one issue.

### 6. Decision Gate

Where to look:

- User comment text and screenshots.
- Module ontology.
- Report semantics, timeline placement, filters, manager scope, permissions,
  financial calculations, and cross-module behavior.

Good state:

- Agent recognizes product ambiguity before implementation.
- Manager proposes one recommendation plus 2-3 concrete alternatives.
- The issue waits for board/user input instead of guessing.

Bad state:

- Agent silently chooses a semantic behavior that the user did not approve.
- Review says "ready" while a product fork remains unresolved.

Action:

- Post a board decision comment with:
  - recommended option;
  - alternatives;
  - tradeoffs and risks;
  - what will be verified after the decision.
- Keep the issue `blocked` or `in_review` until the decision is recorded.

### 7. Ready / Done Reflection Gate

Before a parent issue becomes `ready`, `in_review`, or `done`, require a short
self-review from the implementer or manager:

```text
1. What will the user see after this change?
2. Which concrete user case is closed?
3. What proves it: test, screenshot, API check, production smoke, or trace?
4. What was not checked, and why?
5. Is any product decision still open?
```

Good state:

- The real user-observed case is represented in proof.
- The user-facing report is short, Russian, and understandable by a
  non-developer.
- Technical details are below `Технически` or in proof artifacts.

Bad state:

- Report starts with PR numbers, file paths, internal tool logs, or Paperclip
  mechanics.
- Evidence proves only a nearby code path, not the user's symptom.
- Unrun checks are hidden or softened.

Action:

- Return the issue for rework if the reflection is missing or unsupported.
- Rewrite only the user-facing report when the work is correct but the report is
  not usable for the dashboard user.

## Escalation Rules

Escalate to the board/user only for:

- product decision;
- direct SSH/root production work;
- production data mutation;
- destructive migrations/imports;
- credentials or access-policy decisions;
- explicit acceptance of missing required verification;
- budget or team topology changes.

Do not escalate only to ask permission for normal GitHub Actions release work
when proof, review, CI, deploy credentials, and production smoke are available.

## Privacy And Safety

Never include in Paperclip comments, reports, or traces:

- deal names;
- contact names;
- phone numbers;
- emails;
- raw Bitrix payloads;
- cookies;
- session IDs;
- CSRF tokens;
- API tokens;
- passwords;
- webhooks.

Use IDs, aggregate counts, dates, stage metadata, redacted command summaries, and
sanitized screenshots when needed.
