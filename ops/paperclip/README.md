# Bitrix24 Dashboards Paperclip Operating System

This directory is the versioned operating layer for the `Bitrix24 Dashboards` Paperclip company.

## Purpose

The product goal is not "many agents". The goal is a small, auditable software factory for dashboard maintenance:

```text
module ontology -> dashboard comment -> Paperclip issue -> plan -> implementation -> proof -> fresh verification -> PR/deploy -> self-correction
```

The operating layer now covers `attraction` and `leadgen`. The same structure should scale to future modules such as sales and operations without leaking data, comments, report assumptions, or access across modules.

## Source Of Truth

- Live runtime source of truth: Paperclip company `Bitrix24 Dashboards`
- Reviewable source of truth: this repo under `ops/paperclip`
- Product module context: `docs/modules`
- Repo-wide agent rules: `AGENTS.md`

Runtime changes should be:

1. proposed in repo docs;
2. reviewed like normal code/process changes;
3. copied to Paperclip managed instruction paths;
4. verified against the live company state.

## Operating Principles

- Keep module context explicit on every issue.
- Keep module-owned UI/report changes isolated. A `leadgen` comment changes only `leadgen` code/docs unless the issue is explicitly shared/platform.
- Keep implementation, review, and release gates separate.
- Do not send personal Bitrix data to Paperclip.
- Prefer small PRs with proof artifacts over large unverified patches.
- Use GitHub/CI/deploy pipelines as the normal production path.
- Treat workflow and instructions as versioned product, not chat memory.

## Directory Map

- `agents/`: active agent instruction bundles and runtime mapping.
- `workflows/`: canonical workflows for issue intake, feature work, bugfixes, module onboarding, release, and self-improvement.
- `proof-loop.md`: required task evidence contract.
- `team-growth.md`: when to add, split, pause, or remove agents/tools.
- `metrics.md`: quality and reliability metrics for the agent team.
