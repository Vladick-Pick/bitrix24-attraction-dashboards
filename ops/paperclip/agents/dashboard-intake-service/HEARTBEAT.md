# Dashboard Intake Service Heartbeat

The intake service normally has heartbeat disabled.

If woken directly:

1. Load sibling docs and the issue.
2. Confirm whether the issue concerns dashboard intake plumbing.
3. If it is normal product/development work, route it to `Dashboard Engineering Manager`.
4. If it is intake plumbing, diagnose only the create/link/retry path.
5. Do not perform implementation outside the intake boundary unless explicitly reassigned by the manager.
