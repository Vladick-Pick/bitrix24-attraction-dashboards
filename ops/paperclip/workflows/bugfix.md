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
- For user-observed UI/data bugs, include the real sanitized case in the spec and verification plan. If the user gives a deal id, screen, filters, expected visual state, or screenshot, the implementation must add either a focused fixture/test for that case or an explicit reason why it cannot.
- The proof must check the symptom the user reported, not only the code path that seemed related. For visual bugs, this means asserting or screenshot-checking the exact UI state the user expected to see.
- If the correct product behavior requires a decision, do not guess. Return the issue to the dashboard/board with a small choice set or a clear question, then wait for the owner comment before implementing that part.
- When returning work to a user for review, include a mini-report in Russian, written for a non-developer: what changed, what the root cause was, how it now behaves, and what was verified. Keep technical details in a separate internal section.
- For production comments, archive the source dashboard comment only after the fix is deployed and verified in production.
- If the bug is data correctness related, pin date range, funnel/category, manager whitelist, stage rules, and SQL/query semantics before changing code.
