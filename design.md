# Project Design Contract

This file is the shared UI contract for every dashboard module in this repository.
Module reports may differ by workflow and metrics, but they must not invent a separate visual language unless a reviewed shared/platform issue explicitly changes the product design system.

## Source Of Truth

- Primary implementation reference: `apps/web/src/proto/proto.css`.
- Primary composition reference: `apps/web/src/proto/proto-app.tsx`.
- Primary module context: `docs/modules/<module-key>/MODULE_ONTOLOGY.md`.
- For UI tasks, read `AGENTS.md`, this file, and the target module ontology before editing code.

## Product Feel

The product is an internal Bitrix24 reporting workspace, not a marketing site.

The interface should feel:

- operational, quiet, and dense enough for repeated work;
- light, white, and slate-based, matching the current attraction dashboard shell;
- structured around filters, metrics, tables, status strips, and commentable report sections;
- consistent across `attraction`, `leadgen`, and future modules at the shell/control/component level.

Module-specific reports can have different information architecture, but users should still feel they are in the same product.

## Visual Foundation

Use the existing attraction/proto dashboard style as the baseline:

- Font: `Manrope Variable` via `--font-body` and `--font-display`.
- Page background: pale gray-blue workspace using `--bg-main`, `--bg-tint`, and subtle fixed grid texture.
- Text: `--ink-900` for primary text, `--ink-700` for secondary emphasis, `--ink-500` for labels and metadata.
- Accent: blue `--accent` / `--accent-strong` for primary actions, active tabs, and metric accent lines.
- Surfaces: translucent white panels with soft borders and restrained shadows.
- Status colors: green, neutral slate, amber, and red from the existing token set.

Do not introduce per-module theme palettes. `leadgen` must not become visually warmer, darker, more decorative, or more card-heavy than `attraction`.

## Shared Primitives

Prefer these existing primitives before adding new styles:

| Primitive | Use | Current class/source |
| --- | --- | --- |
| Page shell | Full dashboard layout, max width, module header, filters, report body | `max-w-[1420px]`, `grid gap-6`, `panel` |
| Panel | Header, filters, admin sections, report sections | `.panel` |
| Metric tile | KPI counters and short numeric summaries | `.metric` |
| Badge | Status, counts, sync state, module state | `.badge-chip`, `.badge-green`, `.badge-neutral` |
| Tabs | Scene/report navigation inside a module | `.tab-chip`, `.tab-chip-active` |
| Inputs | Date fields, filters, profile fields | `.field` |
| Buttons | Primary and secondary commands | `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-dark` |
| Sync/status strip | Snapshot and sync metadata | `.sync-strip`, `.sync-strip-*` |
| Tables | Dense report breakdowns | existing table styles in `proto.css` |

If a module needs a new primitive, add it to the shared CSS and document it here. Avoid one-off Tailwind-only styling when the pattern will recur.

## Layout Rules

- Use one product shell for all modules: header -> sync/status -> filters -> active module report.
- Keep the top module switcher visually aligned with the existing header controls.
- Keep report sections as full-width panels or responsive grids of panels.
- Do not place large page sections inside nested cards. Small bordered rows inside a panel are acceptable for lists and compact facts.
- Use `grid gap-6` for major vertical rhythm and `gap-3`/`gap-4` for control groups.
- Keep dashboard content constrained to the existing `max-w-[1420px]` shell.
- On mobile, controls wrap rather than shrink text below readable sizes.

## Typography

- Dashboard headers use `text-3xl font-bold` at the page level.
- Section headers use `text-xl` or `text-2xl` depending on section importance.
- Compact labels use the existing `subtle-label` style.
- Avoid hero-scale type inside dashboard panels.
- Do not use negative letter spacing. Keep labels short and scannable.

## Module Boundaries

Shared UI:

- app shell;
- module switcher;
- account/admin screens;
- filters panel;
- comments drawer and comment mode affordances;
- notification controls;
- buttons, inputs, badges, metrics, panels, tables.

Module-owned UI:

- report registry;
- report section ordering;
- report copy;
- comment block ids and labels;
- module-specific empty states and warnings.

`leadgen` can have a different report interface from `attraction`, but it must be built from the same primitives and visual proportions. A `leadgen` dashboard comment should affect only `leadgen` report code/docs unless the issue is explicitly marked shared/platform.

## Commentable Blocks

Every major report section that can receive dashboard comments must include stable:

- `data-comment-block-id`;
- `data-comment-block-label`.

Block ids must be module-scoped when the section is module-specific, for example `leadgen-funnel-summary`. Do not reuse attraction block ids for leadgen sections.

Comments, notifications, and Paperclip payloads must keep module context visible and must not include personal Bitrix data, deal names, contact names, phones, emails, or raw upstream payloads.

## Leadgen Design Constraints

For `leadgen`:

- use the same shell, header, filters, status strip, buttons, badges, panels, metrics, and tables as `attraction`;
- keep the report content focused on `Лидген УС`, stages, sources/UTM, managers, and reasons;
- preserve separate leadgen manager whitelist behavior in data/report copy;
- do not add a separate leadgen color theme, hero area, marketing copy, decorative cards, or standalone visual identity;
- any new leadgen-only UI pattern must either be promoted to a documented shared primitive or kept tightly scoped to leadgen report sections.

## Anti-Patterns

Avoid:

- module-specific visual themes without a shared design issue;
- oversized hero sections or landing-page composition inside the authenticated dashboard;
- decorative gradient blobs, unrelated illustrations, or visual ornament that does not carry dashboard information;
- nested cards for ordinary layout;
- duplicated CSS tokens for colors, shadows, radius, or spacing already covered by `proto.css`;
- text labels that overflow buttons, badges, metric tiles, or table cells;
- raw Bitrix personal data in visible UI or comments.

## Implementation Checklist

Before finishing a UI task:

- Confirm the work follows this file and `AGENTS.md`.
- Confirm module-specific changes are scoped to the selected module.
- Reuse existing primitives before adding styles.
- If styles diverge intentionally, document the reason in this file or the module ontology.
- Check responsive layout for desktop and mobile widths.
- Run the relevant local verification for the changed files.
