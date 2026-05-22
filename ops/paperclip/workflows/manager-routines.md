# Workflow: Dashboard Manager Routines

Owner: `Dashboard Engineering Manager`.

This file defines Paperclip `Routines`: scheduled recurring work definitions
that create concrete auditable issues. Routines are not heartbeats.

All user-facing routine reports, proposals, approval requests, and summaries
must be written in Russian. The team may think, inspect traces, and use internal
technical notes in English, but the board-facing output is Russian.

## Mechanism Boundary

Heartbeat:

- lives in `agents/dashboard-engineering-manager/HEARTBEAT.md`;
- runs every hour through `runtimeConfig.heartbeat.intervalSec`;
- is a short wake checklist for queue, runtime, dashboard sync, active issue
  progress, capability, decision, and ready/done gates;
- should not perform broad weekly reports or process redesign.

Routine:

- lives in the Paperclip `Routines` product surface;
- has a schedule such as weekly;
- creates a normal Paperclip issue;
- has its own title, description, owner, priority, evidence, and final report;
- should be visible in the `Routines` UI and in `Recent Runs`.

Routine project scope:

- manager quality/tooling/improvement routines are company-level and must not
  be attached to `Attraction Dashboard`, `Leadgen Dashboard`, or any future
  module-specific Paperclip project;
- live routine `projectId` should be empty/null for these manager routines;
- if a routine is truly module-specific, its title, description, and project
  must say so explicitly.

Approval:

- changes to team instructions, MCP servers, skills, runtime config, workflow
  policy, or team topology require board approval before being applied;
- the proposal issue stays `in_review` or `blocked` until the board decides;
- approved changes are applied through separate implementation issues.

## Full Manager Work Calendar

| When | Mechanism | What the manager does | Output |
| --- | --- | --- | --- |
| Every hour | Heartbeat | Short operational control: queue, runtime health, dashboard sync, active work, tool capability, product decisions, ready/done gate. | Status changes, routing, blockers, child issues, concise comments. |
| On event | Heartbeat wake | Reacts to assignment, mention, approval result, failed run, or manual wake. | Handles the triggering issue first, then returns to assigned work. |
| Before `ready`/`done` | Gate inside active issue | Verifies proof, user-facing report, reviewer verdict, CI/deploy/smoke when required. | Approves transition, returns for rework, or blocks with exact missing proof. |
| Weekly Monday 09:00 | Paperclip Routine, company-level/no project | Diagnoses team quality and recurring failure patterns. | Weekly team-quality issue and Russian diagnostic report. |
| Weekly Monday 10:00 | Paperclip Routine, company-level/no project | Audits whether required tools and runtime capabilities work. | Weekly capability issue with pass/fail/blocked states. |
| Weekly Monday 11:00 | Paperclip Routine, company-level/no project | Converts findings into a board-approval proposal for team improvements. | Russian improvement proposal awaiting board decision. |
| After board approval | Normal implementation issues | Applies approved instruction/tool/skill/MCP/test/runtime changes. | Implemented changes, live runtime verification, change summary. |
| After serious incident | Normal issue or manually triggered routine run | Reviews duplicates, false-ready, broken deploy, lost dashboard thread, privacy/tool failure. | Root cause, consequence fix, cause fix, follow-up issues. |

## Hourly Heartbeat Scope

The hourly heartbeat is not a report-writing job. It is the manager's short
control loop.

Every hour, the manager reads `HEARTBEAT.md`, then uses
`manager-ops-review.md` to check:

1. Queue health: open issues, owners, duplicates, stale `in_progress`, resolved
   blockers that were not moved forward.
2. Runtime health: agent statuses, failed/cancelled/`needs_followup` runs,
   long-running runs, intentional pauses, service errors.
3. Dashboard sync: comment issue links, notification read/archive state, saved
   user rework comments, Paperclip status propagation.
4. Active issue progress: parent/child alignment, blockers, owner handoffs,
   stale review, wrong status.
5. Capability gate: GitHub, Playwright/browser, Context7, deploy visibility,
   production smoke path, and `pnpm check:paperclip-runtime` evidence when
   relevant.
6. Decision gate: product ambiguity, report semantics, filters, module access,
   calculations, timeline placement, and whether the board/user must choose.
7. Ready/done reflection: whether the issue has proof for the actual user case
   and a short Russian user-facing report.

Heartbeat good state:

- no active issue is silently stuck;
- blocked work names the exact unblocker;
- duplicates point to one canonical issue;
- missing tools block affected work instead of allowing `ready`;
- the manager does not ask the board to approve normal deploy work that is
  already allowed by policy;
- no weekly/broad audit is done unless it is already an assigned issue.

Heartbeat bad state:

- the manager posts "all clear" noise without action;
- broad weekly review is attempted inside the heartbeat;
- issues become `ready` without proof or product decision;
- dashboard comments and Paperclip statuses drift silently;
- failed runs are ignored until the user notices.

## Weekly Routine 1: Team Quality Review

Live routine title:

```text
Еженедельный отчет по качеству команды
```

Schedule: Monday 09:00 `Europe/Istanbul`.

Assignee: `Dashboard Engineering Manager`.

Purpose: diagnose how the team worked during the previous week. This routine
does not change instructions, tools, skills, MCP servers, or runtime config.

The manager checks:

1. Completed issues: last 5-10 completed issues, especially dashboard-comment
   fixes and production-requested work.
2. Returned/reopened issues: what the user rejected, why, and whether the
   comment thread and report history stayed intact.
3. Failed runs: failed, cancelled, timed out, or `needs_followup` runs tied to
   active work.
4. Proof quality: `spec.md`, `evidence.md`, `evidence.json`, `verdict.json`,
   `problems.md`, screenshots, browser checks, API checks, production smoke.
5. Trace/tool quality: whether each agent used the right tool, handled errors,
   avoided unsupported inference, and kept risky actions policy-bound.
6. False-ready cases: any issue that said ready/done without proof, review,
   deploy, production smoke, or user-readable report.
7. Product decision misses: places where the agent guessed instead of asking
   the board/user to choose.
8. Dashboard sync defects: lost comments, duplicate issue creation, unread
   notification stuck, archive mismatch, rework comment delivery failure.
9. Report quality: whether the final dashboard/user report was short, Russian,
   understandable to a non-developer, and separated technical audit details.
10. Repeated failure classes:

```text
missing_context
weak_spec
ontology_gap
wrong_agent
missing_tool
tool_access_broken
proof_gap
false_ready
bad_user_report
dashboard_sync_gap
deploy_release_gap
product_decision_missing
privacy_or_secret_risk
duplicate_or_noise
context_compaction_loss
cost_or_latency_pressure
```

Expected output:

```md
## Еженедельный отчет по качеству команды

- Что за неделю стало лучше / хуже:
- Какие задачи были возвращены или переоткрыты:
- Какие повторяющиеся причины сбоев найдены:
- Где не хватило proof, контекста, инструмента или решения пользователя:
- Что обязательно учесть в proposal на улучшения:

## Технически

- Issues/runs:
- Failure classes:
- Proof gaps:
- Dashboard sync gaps:
- Metrics to watch:
```

Good result:

- concrete incidents are named by issue/run id;
- no secrets, cookies, tokens, raw Bitrix payloads, contact names, phones, or
  emails are included;
- the report diagnoses problems but does not silently mutate the team.

Bad result:

- report says "be more careful";
- report lists internal tool noise without conclusion;
- report proposes changes but does not move them to approval;
- report hides missing proof or unrun checks.

## Weekly Routine 2: Runtime Capability Audit

Live routine title:

```text
Еженедельный аудит инструментов команды
```

Schedule: Monday 10:00 `Europe/Istanbul`.

Assignee: `Dashboard Engineering Manager`.

Purpose: verify that the team can actually perform the checks it is expected to
perform.

The manager checks:

1. GitHub path: repo read, branch push, PR creation, CI visibility, merge path
   when policy allows it.
2. Browser path: Playwright/browser can render the dashboard and capture
   screenshots for UI defects.
3. Context7 path: current docs are available for dependency-sensitive work.
4. Deploy path: GitHub Actions deploy visibility and production smoke route are
   available when production fixes are expected.
5. Paperclip mutation path: issue status, comments, child issues, routines, and
   runs can be read and updated by the right actor.
6. Dashboard sync path: comments, notifications, archive, and rework comment
   retry behavior can be verified.
7. Skills/MCP path: required skills and MCP configs are installed and usable,
   especially `agents-best-practices`, GitHub, Playwright/browser, and Context7.

Expected output:

```md
## Еженедельный аудит инструментов команды

- GitHub: pass/fail/blocked
- Browser/Playwright: pass/fail/blocked
- Context7: pass/fail/blocked
- Deploy visibility: pass/fail/blocked
- Paperclip mutation: pass/fail/blocked
- Dashboard sync: pass/fail/blocked
- Skills/MCP: pass/fail/blocked

## Что нужно исправить

- Capability:
- Owner:
- Какие задачи это блокирует:
- Точное следующее действие:
```

Good result:

- blocked capabilities name owner and exact unblock action;
- affected work is not allowed to become `ready`;
- repeated failures feed the weekly improvement proposal.

Bad result:

- "tool seems broken" without run ids or exact failed command;
- missing capability is treated as harmless while related issues continue;
- credentials, cookies, tokens, or raw payloads appear in comments/logs.

## Weekly Routine 3: Team Improvement Proposal

Live routine title:

```text
Еженедельное предложение улучшений команды
```

Schedule: Monday 11:00 `Europe/Istanbul`.

Assignee: `Dashboard Engineering Manager`.

Purpose: convert the weekly diagnosis and capability audit into a concrete
proposal for board approval.

This routine is the place to answer:

- which instructions should change;
- which workflows should change;
- which MCP servers should be added, removed, repaired, or updated;
- which skills should be added, removed, repaired, or updated;
- which runtime capability gates should become mandatory;
- which tests, evals, or validators should be added;
- which module ontology gaps should be fixed;
- which dashboard UX guards should be added to prevent duplicate issues or lost
  comments;
- whether a role should be split, paused, merged, or left unchanged.

The proposal must not apply changes by itself. It must ask the board to approve
or reject the proposed changes.

Expected output:

```md
## Предложение улучшений команды

### Коротко
- Что предлагаем изменить:
- Почему это нужно:
- Какой эффект ожидаем:

### Основание
- Инцидент / повторяющаяся проблема:
- Где проявилось:
- Что текущий процесс не поймал:

### Что изменить после апрува
- Инструкции:
- Workflow:
- Skills:
- MCP servers:
- Tests / evals / validators:
- Runtime config:
- Team topology:

### Риски и откат
- Что может сломаться:
- Как откатить:

### Как поймем, что стало лучше
- Метрика:
- Что проверим через неделю:

### Решение борда
- Рекомендация менеджера:
- Вариант A:
- Вариант B:
- Вариант C:
```

Status rule:

- If there are proposed changes, set the proposal issue to `in_review` or
  `blocked` awaiting board decision.
- Do not close the proposal until the board approved/rejected it or explicitly
  asked to defer it.
- Do not apply any instruction, skill, MCP, runtime, tool, or team-topology
  change before approval.

## After Approval: Apply Approved Team Improvements

This is not a recurring routine. It is a normal implementation issue created
after the board approves a proposal.

The manager must decompose approved changes into concrete tasks:

- repo docs/instruction update;
- live Paperclip instruction sync;
- skill install/update/removal;
- MCP server install/update/removal;
- runtime config change;
- test/eval/validator addition;
- dashboard UX/product guard;
- verification that the relevant agents actually see the new tools/skills/docs.

Expected output:

```md
## Применены улучшения команды

- Что было одобрено:
- Что изменили:
- Где проверили live runtime:
- Какие агенты затронуты:
- Как откатить:
- Что проверить на следующей неделе:
```

Completion rule:

- Close the implementation issue only after live runtime verification.
- Then update the original proposal issue with the applied result.

## Incident Review Task

This is not a fixed weekly routine unless incidents become frequent. Create a
normal issue or manually trigger an appropriate routine when one of these
happens:

- duplicate dashboard issues were created from repeated clicking;
- user rework comment was saved but not delivered to Paperclip;
- a dashboard comment lost thread/report history;
- unread notification stayed unread after review/archive;
- deploy broke or was rolled back;
- agent reported ready without required proof;
- privacy or secret-handling risk appeared;
- a manager asked the user for a decision that policy says the team owns.

The incident review must split:

1. Consequence fix: what to repair now for the user or production state.
2. Cause fix: what to change so the same class does not recur.

Expected output:

```md
## Разбор инцидента

- Что произошло:
- Что увидел пользователь:
- Причина:
- Фикс последствий:
- Фикс причины:
- Follow-up задачи:
- Как поймем, что не повторилось:
```
