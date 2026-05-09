# Workflow: Module Onboarding

Owner: human/Codex for major architecture; Paperclip assists with bounded setup tasks.

```mermaid
flowchart TD
  A["New module intent"] --> B["Write MODULE_ONTOLOGY.md"]
  B --> C["Define RBAC and module memberships"]
  C --> D["Define data contract and privacy boundary"]
  D --> E["Create Paperclip project/goal"]
  E --> F["Add dashboard UX context"]
  F --> G["Enable comment-to-issue workflow"]
  G --> H["Run smoke tests and access checks"]
```

## Required Artifacts

- `docs/modules/<module>/MODULE_ONTOLOGY.md`
- data contract and source system notes;
- module role/access matrix;
- dashboard UX/design context;
- Paperclip project and goal ids;
- triage owner id;
- test plan.

## Rule

Do not copy the attraction UI blindly. Modules can diverge when their business workflow requires different screens, density, metrics, controls, or roles.
