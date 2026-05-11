# Workflow: Self-Improvement And Self-Correction

Owner: `Dashboard Engineering Manager` until a dedicated `Agent Operations Manager` exists.

```mermaid
flowchart TD
  A{"Trigger"} -->|failure| B["Self-correction"]
  A -->|weekly or task batch| C["Self-improvement"]
  B --> D["Update problems.md"]
  D --> E["Minimal instruction/workflow/test fix"]
  C --> F["Review metrics and repeated patterns"]
  F --> G["Prepare improvement proposal"]
  E --> H["Reviewed repo/process change"]
  G --> H
```

## Self-Correction Triggers

- failed verifier verdict;
- production smoke failure;
- reopened issue;
- privacy/RBAC finding;
- repeated misunderstanding of module ontology;
- missing proof artifacts on a required task.

## Self-Improvement Review

Check:

- proof-loop completeness;
- repeated review findings;
- stale agent instructions;
- missing or unused skills;
- missing MCP servers;
- heartbeat usefulness;
- module ontology gaps;
- agent role overload;
- cost and latency.

## Output

The output is a proposal or PR. Agents must not silently rewrite team rules or add tools/agents without review.
