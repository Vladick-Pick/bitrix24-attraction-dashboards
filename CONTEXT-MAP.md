# Context Map

This map names the bounded contexts that matter for platform-foundation work.
Use it with module ontologies and ADRs instead of inferring ownership from the
current repository layout.

## Contexts

### attraction

- Source of truth: `docs/modules/attraction/MODULE_ONTOLOGY.md`
- Owns attraction reports, report registry, ontology, manager whitelist, sync
  policy, dashboard content, module-specific copy, and module-specific comment
  block labels.
- Uses shared/platform services for auth, RBAC, module membership, dashboard
  comments, safe local snapshot primitives, deployment/tooling, and shared UI
  primitives.

### leadgen

- Source of truth: `docs/modules/leadgen/MODULE_ONTOLOGY.md`
- Owns leadgen reports, report registry, ontology, manager whitelist, sync
  policy, dashboard content, module-specific copy, and module-specific comment
  block labels.
- Uses shared/platform services for auth, RBAC, module membership, dashboard
  comments, safe local snapshot primitives, deployment/tooling, and shared UI
  primitives.
- Must not reuse attraction-only assumptions unless a reviewed shared/platform
  issue explicitly allows that behavior.

### shared/platform

- Decision record:
  `docs/adr/0001-separate-attraction-and-leadgen-products.md`
- Shared design contract: `design.md`
- Provides auth, RBAC, module membership, dashboard comments, Paperclip routing
  primitives, safe local snapshot primitives, deployment/tooling, contracts
  needed by multiple products, and shared UI primitives.
- Does not own module report logic, report registry, ontology, manager
  whitelist, sync policy, screen copy, or module-specific dashboard layout.
- Future AI-agent and automation layers must use explicit module capabilities
  and safe read models exposed through shared/platform boundaries.

## Relationships

- `attraction` and `leadgen` are separate products, not skins of one report.
- Shared/platform exists to make common concerns reusable without absorbing
  module-owned business logic.
- New modules, such as `onboarding`, must start with their own module ontology
  and capability surface instead of copying attraction or leadgen assumptions.
- Physical repository extraction is deferred until storage, route, sync, and web
  runtime seams are explicit enough to avoid duplicating hidden coupling.
