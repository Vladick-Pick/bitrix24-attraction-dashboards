# Attraction Message Metrics Research

Date: `2026-05-24`

This note records the current Bitrix24 / Open Lines findings for future message
metric implementation in the attraction module.

## Confirmed Access

- The production webhook now has `imopenlines` scope in addition to `crm`.
- `imopenlines.crm.chat.get`, `imopenlines.dialog.get`, and
  `imopenlines.session.history.get` are available.
- `im.dialog.messages.get` is still blocked with `insufficient_scope`; plain
  `im.*` methods are not available to the webhook.
- For message counts, `im` scope is not required yet: `imopenlines.session.history.get`
  returns a `message` object whose keys can be counted without persisting message text.

## Safe Counting Model

Use `crm.activity.list` with `PROVIDER_ID = IMOPENLINES_SESSION` as the entrypoint.
For period queries, filter candidate activities by `LAST_UPDATED` and then filter
individual history messages by their own `date`.

Safe message fields for local persistence:

- Bitrix message id;
- chat id;
- session id;
- message date;
- CRM owner type/id;
- activity id;
- responsible manager id;
- source/integration/channel;
- direction bucket;
- file/attachment presence as a boolean if needed.

Do not persist or expose:

- message text or `textlegacy`;
- raw attachments;
- contact names, phones, emails, avatars, URLs, or raw Bitrix payloads.

System messages must be excluded from business counts:

- `senderid = 0` means Bitrix/Open Lines system event.

Current provisional direction buckets:

- `connector`: `users[senderid].connector = true`.
- `operator`: sender is a regular Bitrix user.
- `system`: `senderid = 0`.

Important limitation: `connector` is not the same as "received from client" in all
cases. If a manager sends from Wazzup, Telegram, Max, or another external client
outside Bitrix, Bitrix may still record the message as an `imconnector` user.
Therefore Bitrix-only data can reliably count non-system Open Lines messages, but
cannot yet reliably split all messages into `sent` vs `received`.

## Source And Channel Mapping

Use `imopenlines.crm.chat.get` and/or `imopenlines.session.history.get.result.chat`
to identify the connector. The useful fields are connector title and chat
`entityId`.

Observed source patterns:

- `olchat_tg_connector` -> `OLChat: Telegram`;
- `olchat_wa_connector_2` -> `OLChat: WhatsApp`;
- `wz_telegram...` -> `WAZZUP: Telegram`;
- `wz_max...` -> `WAZZUP: Max`;
- future Wazzup WhatsApp should be mapped from a `wz_*whatsapp*` or `wz_*wa*`
  connector pattern when it appears.

The source/channel mapping should be centralized before any report uses it.

## Manager Attribution

Two attribution modes were checked:

- by Open Lines activity `RESPONSIBLE_ID`;
- by attraction deal `ASSIGNED_BY_ID`, using the activity CRM owner deal or the
  latest matching attraction deal for contact-owned activities.

These produce different totals. For attraction sales/reporting, the recommended
default is attribution by attraction deal responsible. Keep activity responsible
as an audit/debug dimension because Open Lines ownership can differ from deal
ownership.

## Read-Only Production Sample

Period checked: `2026-05-17T00:00:00+03:00` through `2026-05-24T13:05`
Europe/Istanbul.

By attraction deal responsible:

- external connector messages: `75`;
- Bitrix user/operator messages: `0`;
- system messages excluded: `121`;
- sessions checked: `26`.

By source:

- `OLChat: Telegram`: `41`;
- `WAZZUP: Max`: `15`;
- `WAZZUP: Telegram`: `15`;
- `OLChat: WhatsApp`: `4`.

By manager:

- `78` / Egorov Andrey: `15`, all `WAZZUP: Max`;
- `6994` / Kuznetsova Anastasia: `18`, all `OLChat: Telegram`;
- `72` / Krokhaleva Maria: `1`, all `OLChat: Telegram`;
- `2236` / Potapova Maria: `39`, split across `OLChat: Telegram`,
  `WAZZUP: Telegram`, and `OLChat: WhatsApp`;
- `13020` / Kakulia Ilya: `2`, all `OLChat: WhatsApp`.

By Open Lines activity responsible, the same period yielded:

- external connector messages: `91`;
- Bitrix user/operator messages: `0`;
- system messages excluded: `181`;
- sessions checked: `32`;
- sources: `OLChat: Telegram` `89`, `OLChat: WhatsApp` `2`.

## Implementation Implications

- A Bitrix-only V1 can show "non-system Open Lines messages" by manager/source.
- Do not label connector messages as definitive `received` until direction is
  validated against a known conversation or Wazzup API.
- Exact `sent` / `received` for Wazzup likely requires Wazzup API or webhooks,
  because Wazzup exposes direction/status metadata that Bitrix Open Lines does
  not reliably expose through the current webhook data.
- If `im` scope is later added, `im.dialog.messages.get` can be tested as an
  alternate message-history source, but it should follow the same privacy rule:
  count metadata only, never persist message text.
