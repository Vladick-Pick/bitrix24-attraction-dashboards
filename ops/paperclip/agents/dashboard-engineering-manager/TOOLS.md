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
- `docs/modules/<module>/MODULE_ONTOLOGY.md`
- root `AGENTS.md`

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
- Route approved production sync/backfill/proof through the protected GitHub Actions operation surface documented in `proof-loop.md#production-operation-gate`.

## Restrictions

- Do not send deal names, contact names, phones, emails, raw Bitrix payloads, cookies, tokens, or webhooks to Paperclip.
- Do not expose Paperclip links in the dashboard for V1 unless a reviewed product issue changes that rule.
- Do not use SSH/root as the normal path for dashboard-comment work.
- Do not merge, deploy, or mutate production data unless the issue is explicitly a release/incident task with approval.
- Do not let specialists bypass a missing production operation workflow with raw SSH or personal credentials; block and open a tooling/access issue instead.
- Do not add or remove agents/tools silently.

## Proof Requirements

Require full proof-loop artifacts for non-trivial work. Light mode is allowed only for small copy/UI-only changes and must be stated in the issue. Before requesting review, require a durable handoff in the Paperclip issue or a reviewed tracked evidence folder.
