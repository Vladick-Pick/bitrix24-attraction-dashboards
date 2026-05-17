---
name: Backlog task
about: Track dashboard product or engineering work
title: ""
labels: ""
assignees: ""
---

## Problem


## Module
- [ ] `attraction`
- [ ] `leadgen`
- [ ] shared/platform

Apply exactly one module label:

- `module:attraction`
- `module:leadgen`
- `module:shared-platform`

## Affected Areas
- [ ] API / auth / RBAC
- [ ] reporting / sync / data contract
- [ ] web UI / report registry
- [ ] comments / Paperclip
- [ ] docs / agent instructions
- [ ] deploy / infra

## Expected Behavior


## Acceptance Criteria
- [ ] 

## Data Dependencies
- 

## Module Isolation Notes
- Attraction behavior must remain unchanged unless this is an attraction or shared/platform task.
- Leadgen behavior must remain unchanged unless this is a leadgen or shared/platform task.
- Dashboard comments route to module-specific Paperclip projects: `attraction` -> `Attraction Dashboard`, `leadgen` -> `Leadgen Dashboard`.
- Do not use or expose deal names, contact names, phones, emails, raw Bitrix payloads, cookies, tokens, or secrets.

## Verification
- [ ] API tests updated or not needed
- [ ] Web tests updated or not needed
- [ ] Manual check notes added if relevant
