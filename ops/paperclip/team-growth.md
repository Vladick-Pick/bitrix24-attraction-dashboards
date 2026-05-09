# Team Growth And Self-Improvement Policy

The Paperclip team should grow by observed need, not by role imagination.

## Add Or Split An Agent When

- a role has a distinct context set that hurts other roles when mixed;
- the role has recurring deliverables with clear quality criteria;
- the role has enough weekly task volume to justify separate heartbeat cost;
- failures repeatedly trace to overloaded ownership;
- access boundaries require separation.

## Do Not Add An Agent When

- the work is rare;
- the role is only a different title for the same context;
- the existing manager can route it with a checklist;
- the new agent would need the same tools, same context, same evidence, and same done criteria as an existing one.

## Current Split-Out Thresholds

- `Agent Operations Manager`: split out after repeated process defects or more than five Paperclip tasks per week.
- `Release / DevOps Agent`: split out after repeated deploy/server tasks or any recurring production incident workflow.
- `Data / Reporting Engineer`: split out after recurring SQL/report contract work across multiple modules.
- Module-specific triage agent: split out when a module has confidential context or enough module-specific comments to justify a separate intake lane.

## Self-Correction

Self-correction is reactive. Trigger it after:

- a failed verification verdict;
- a production smoke failure;
- a privacy/RBAC finding;
- an issue reopened after "done";
- repeated misunderstanding of the same module concept.

Output:

- update `problems.md` for the issue;
- make the smallest instruction/workflow/test change that prevents recurrence;
- route risky process changes through review.

## Self-Improvement

Self-improvement is periodic. Trigger it:

- weekly while Paperclip is active;
- after every 5-10 completed tasks;
- after onboarding a new module;
- after adding/removing tools, skills, MCP servers, or agents.

The review checks:

- proof artifact completeness;
- human intervention rate;
- reopened issues;
- stale instructions;
- unused skills/MCP servers;
- missing tests or repeated flaky checks;
- recurring module ontology gaps;
- cost and heartbeat usefulness.

No agent may silently rewrite team rules. The output is a proposal, then a reviewed repo change or explicit Paperclip company update.
