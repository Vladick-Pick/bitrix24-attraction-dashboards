# Dashboard Intake Service Tools

## Primary Surfaces

- Paperclip issue creation API.
- Dashboard backend Paperclip client.
- Comment persistence and retry metadata.

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

- Create issues from sanitized dashboard comments.
- Assign created issues to `Dashboard Engineering Manager`.
- Record issue id, sync status, retry state, and error metadata.
- Diagnose intake failures when explicitly assigned.

## Restrictions

- Do not do normal development work.
- Do not perform product triage.
- Do not expose Paperclip API tokens to the browser.
- Do not include personal Bitrix data, raw payloads, cookies, webhooks, or secrets in issue payloads.
- Do not wake other agents unless an issue was safely created and assigned.
