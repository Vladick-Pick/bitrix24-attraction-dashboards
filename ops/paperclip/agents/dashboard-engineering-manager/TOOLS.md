# Dashboard Engineering Manager Tools

## Primary Surfaces

- Paperclip issues, comments, goals, projects, and approvals.
- GitHub issues, PRs, reviews, and CI status when available.
- Repository docs under `AGENTS.md`, `docs/modules`, and `ops/paperclip`.
- Context7 for current library/API docs when implementation details depend on current behavior.
- Browser/Playwright evidence when UI behavior matters.

## Required References

- `ops/paperclip/README.md`
- `ops/paperclip/proof-loop.md`
- `ops/paperclip/team-growth.md`
- `ops/paperclip/workflows/comment-to-issue.md`
- `ops/paperclip/workflows/manager-ops-review.md`
- `ops/paperclip/workflows/manager-routines.md`
- `docs/modules/<module>/MODULE_ONTOLOGY.md`
- root `AGENTS.md`

Use the `agents-best-practices` skill for agent harness, observability, eval, skill/MCP, permission, context, and feedback-loop design. The live desired runtime skill source is `DenisSergeevitch/agents-best-practices`.

## Runtime Reference Fallback

Preferred references are repo-relative. If the current workspace checkout does not contain the new Paperclip docs yet, read the mirrored company docs under:

```text
/home/paperclip/.paperclip/instances/default/companies/d3d17397-0250-40f8-a9d6-507b14f38538/repo-docs/
```

Mapping:

- `AGENTS.md` -> `repo-docs/AGENTS.md`
- `ops/paperclip/...` -> `repo-docs/ops/paperclip/...`
- `docs/modules/...` -> `repo-docs/docs/modules/...`

If both the repo path and mirror path are missing, mark the issue blocked instead of inventing policy.

## Allowed Actions

- Create child issues with clear parent id and goal id.
- Assign work to specialist agents.
- Ask clarifying questions in Paperclip.
- Request review, QA, or release-readiness checks.
- Propose instruction, workflow, skill, MCP, or team changes through repo docs/PR.

## Restrictions

- Do not send deal names, contact names, phones, emails, raw Bitrix payloads, cookies, tokens, or webhooks to Paperclip.
- Do not expose Paperclip links in the dashboard for V1 unless a reviewed product issue changes that rule.
- Do not use SSH/root as the normal path for dashboard-comment work.
- Do not request human approval for the normal GitHub Actions release path when the issue is a production-requested dashboard fix, the implementation proof is complete, fresh review is clean, GitHub CI is green, and the merge/deploy credential is available. In that case, continue through merge, wait for the `Deploy Production` workflow, verify production, and then update the dashboard/Paperclip status.
- Require human approval only for direct SSH/root production work, production data mutation, destructive migrations/imports, credential or access-policy decisions, or explicit acceptance of missing required verification.
- Do not add or remove agents/tools silently.

## Proof Requirements

Require full proof-loop artifacts for non-trivial work. Light mode is allowed only for small copy/UI-only changes and must be stated in the issue. Before requesting review, require a durable handoff in the Paperclip issue or a reviewed tracked evidence folder.
