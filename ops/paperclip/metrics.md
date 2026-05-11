# Agent Team Metrics

Track these metrics for the `Bitrix24 Dashboards` Paperclip team.

## Delivery

- comment-to-issue latency;
- issue-to-plan latency;
- issue-to-PR latency;
- issue-to-done latency;
- number of child issues per parent;
- reopened issue rate.

## Quality

- verifier verdict: pass/fail/retry/blocked;
- review findings by severity;
- regression count after merge;
- test coverage added for risky changes;
- screenshot/browser verification for UI changes;
- production smoke pass/fail for deploy tasks.

## Safety

- Paperclip payload PII violations;
- secret/token logging incidents;
- RBAC/module access findings;
- direct server/SSH usage outside approved release/devops tasks;
- unapproved destructive operation attempts.

## Process

- proof artifact completeness;
- tasks without frozen spec;
- tasks with stale or missing module ontology;
- human rescue count;
- repeated blockers by category;
- unused skills/MCP servers;
- agent heartbeat runs with no useful action.

## Growth Signals

Split out or change the team when metrics show recurring pressure:

- the manager spends most runs only routing/recovering;
- review repeatedly catches the same class of issue;
- backend/reporting work blocks frontend work often;
- deploy tasks become frequent enough to need a release/devops owner;
- new modules add business context that current agents confuse with attraction.
