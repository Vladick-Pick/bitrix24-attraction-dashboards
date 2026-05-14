## Summary
- 

## Module
- [ ] `attraction`
- [ ] `leadgen`
- [ ] shared/platform

## Affected Areas
- [ ] API / auth / RBAC
- [ ] reporting / sync / data contract
- [ ] web UI / report registry
- [ ] comments / Paperclip
- [ ] docs / agent instructions
- [ ] deploy / infra

## Issue
- Closes #

## Verification
- [ ] `pnpm --filter @bitrix24-reporting/api test -- --runInBand`
- [ ] `pnpm --filter @bitrix24-reporting/web exec vitest run`
- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm build`
- [ ] `ENV_FILE=.env.example docker compose -p bitrix24-reporting config >/dev/null`
- [ ] Module-specific smoke notes added
- [ ] Other:

## Notes
- 

## Module Isolation
- [ ] Module ontology was checked for every selected module.
- [ ] Attraction behavior is unchanged unless `attraction` or `shared/platform` is selected.
- [ ] Leadgen behavior is unchanged unless `leadgen` or `shared/platform` is selected.
- [ ] No deal names, contact names, phones, emails, raw Bitrix payloads, cookies, tokens, or secrets are stored, displayed, logged, or sent to Paperclip.
