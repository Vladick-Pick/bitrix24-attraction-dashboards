# Workflow: Release And Production Verification

Owner: `Pre-Merge Reviewer` until a dedicated `Release / DevOps Agent` exists.

```mermaid
flowchart TD
  A["PR ready"] --> B["Confirm GitHub write/merge credential"]
  B --> C{"Credential available?"}
  C -->|no| X["Blocked: credential required"]
  C -->|yes| D["CI green or risk accepted"]
  D --> E["Merge via approved GitHub path"]
  E --> F["Wait for Deploy Production workflow"]
  F --> G["Verify VPS state"]
  G --> H["Run production smoke checks"]
  H --> I{"Smoke passes?"}
  I -->|yes| J["Mark release verified"]
  I -->|no| K["Incident/self-correction task"]
```

## Server Rules

- GitHub Actions is the normal production path.
- For production-requested dashboard fixes, a green implementation proof, clean fresh review, available GitHub merge credential, and green CI are enough to proceed through the normal merge/deploy/production-verification path. Do not create a board approval only to ask whether to merge and deploy.
- If GitHub write/merge credentials are unavailable, mark the release task blocked and do not claim merge/deploy completion.
- SSH/root is not part of normal dashboard-comment implementation work.
- Server access is allowed only for explicit release/devops or incident tasks.
- Human approval is required for direct server work, production data mutation, destructive operations, credentials/access-policy decisions, or accepting missing required verification.
- Never print production passwords, session cookies, webhooks, raw tokens, or raw payloads.

## Smoke Checks

- public health endpoint;
- unauthenticated protected endpoint returns `401`;
- authenticated flow with server-side password file only, redacted output;
- direct API port not externally reachable;
- container user is non-root when relevant;
- changed API/UI behavior works in production.
