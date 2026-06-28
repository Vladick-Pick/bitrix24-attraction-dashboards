# ADR 0002: Manager-approved call enrichment writeback

## Status

Accepted

## Context

The repository security model is read-only for Bitrix24 reporting and local
snapshot sync. Current reporting surfaces must not write CRM data, store raw
personal payloads, or expose generic Bitrix clients to agents.

The call enrichment feature needs a different path: after Bitrix receives a
call, the local system may analyze the recording, extract missing CRM facts, and
ask the responsible manager to approve proposed field updates. The LLM output is
advisory only; it must not write to Bitrix directly.

Product decisions for V1:

- no Telegram notification when the call has no live dialogue;
- no Telegram notification when there is no meaningful CRM update;
- one Telegram proposal batch per call;
- buttons per proposal, without manual text editing;
- pending proposals expire after 48 hours;
- no automatic write on expiry;
- every manager action is audited;
- `Ключевые проекты` and `Связи и знакомства внутри клуба` are deal fields;
- the other agreed enrichment fields are contact fields.

## Options

1. Keep strict read-only Bitrix access and skip CRM writeback.
2. Build a generic CRM field editor controlled by prompts or UI payloads.
3. Build a narrow proposal-approved write adapter.

## Decision

Use a narrow proposal-approved write adapter.

The existing reporting, sync, MCP, and agent-readable report surfaces remain
read-only. The writeback exception belongs only to the call enrichment subsystem
and only after a stored proposal is approved by the responsible manager.

The safe path is:

1. Bitrix call event enters the local API.
2. A cheap dialogue gate skips voicemail, robot, silence, and no-answer calls.
3. Full call analysis runs only for live dialogue.
4. The enrichment agent creates normalized candidates for allowlisted fields.
5. The system compares candidates with current CRM values.
6. Meaningful differences become stored local proposals.
7. The manager approves or declines proposals in Telegram.
8. The server re-reads the current Bitrix value immediately before applying.
9. Only entity-specific allowlisted fields can be updated.

Allowed write methods for this subsystem are limited to:

- `crm.contact.update` for the agreed contact enrichment field allowlist;
- `crm.deal.update` for the agreed deal enrichment field allowlist.

## Consequences

- The field allowlist is a code contract, not prompt text.
- LLM output can create candidates, never Bitrix method calls.
- Telegram approval is required before any write.
- Proposal state changes require audit events.
- Expired proposals are not applied.
- Current Bitrix values are re-read before writeback to detect conflicts.
- MCP remains read-only and exposes no enrichment write tool.
- Reporting pages continue to read only cached local data.
- Future manual Telegram editing requires a new decision because it changes the
  trust boundary.

## Revisit Conditions

Revisit this decision when:

- pilot writeback incidents show the allowlist is too broad or too narrow;
- more CRM fields are requested;
- Telegram manual editing is added;
- another module needs the same destructive capability;
- Bitrix permissions are split so write scopes can be issued separately from
  reporting scopes.
