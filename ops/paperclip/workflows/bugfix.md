# Workflow: Bugfix

Owner: `Dashboard Engineering Manager`

```mermaid
flowchart TD
  A["Bug report"] --> B["Reproduce or identify missing evidence"]
  B --> C{"Reproduced?"}
  C -->|no| D["Ask for clarification or add diagnostic task"]
  C -->|yes| E["Write failing test or reproduction note"]
  E --> F["Minimal fix"]
  F --> G["Run focused checks"]
  G --> H["Fresh verification"]
  H -->|fail| F
  H -->|pass| I["Review, PR, and close/archive source comment"]
```

## Rules

- Use systematic debugging before changing code.
- Do not broaden scope unless the reproduction proves the bug is shared.
- For production comments, archive the source dashboard comment only after the fix is deployed and verified in production.
- If the bug is data correctness related, pin date range, funnel/category, manager whitelist, stage rules, and SQL/query semantics before changing code.
