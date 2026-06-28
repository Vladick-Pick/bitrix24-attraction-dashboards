# Plan 023: Add Telegram approval batches for enrichment proposals

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If a STOP condition occurs, stop and report; do not improvise. When done,
> update the status row for this plan in `plans/README.md` unless a reviewer says
> they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 912fb5d..HEAD -- apps/api/src/server/telegram-client.ts apps/api/src/server/app.ts apps/api/src/config/env.ts apps/api/src/server/routes/attraction-routes.ts apps/api/src/server/routes/attraction-call-handlers.ts apps/api/test/http.test.ts apps/api/test/env.test.ts`
>
> If any in-scope file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding. On mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: plans/017-add-call-enrichment-proposal-storage.md, plans/022-add-current-crm-values-diff.md
- **Category**: feature
- **Planned at**: commit `912fb5d`, 2026-06-28

## Why this matters

The manager should approve CRM updates where they already work: Telegram. V1 is
intentionally simple: one message batch per call, buttons per proposal, no manual
editing. The callback must use short server-side tokens because Telegram
`callback_data` is limited to 1-64 bytes.

## Current state

Relevant files:

- `apps/api/src/server/telegram-client.ts` - currently supports only plain
  `sendMessage`.
- `apps/api/src/server/app.ts` - schedules the daily Telegram activity report.
- `apps/api/src/config/env.ts` - has `TELEGRAM_ACTIVITY_REPORT_*` settings.
- `apps/api/test/http.test.ts` - contains Telegram activity report scheduling
  tests.
- `apps/api/test/env.test.ts` - contains Telegram activity report env tests.

Current excerpts:

- `apps/api/src/server/telegram-client.ts:1-3` defines `sendMessage(input:
  { chatId; text })`.
- `apps/api/src/server/telegram-client.ts:19-48` posts to Telegram
  `sendMessage` with `disable_web_page_preview`.
- `apps/api/src/server/app.ts:1678-1857` owns daily Telegram report scheduling
  and retry.
- `apps/api/test/http.test.ts:4072-4208` tests Telegram report schedule,
  disabled state, and retry.

External docs note:

- Telegram Bot API `InlineKeyboardButton.callback_data` supports 1-64 bytes.
- Callback queries should be answered with `answerCallbackQuery` so the Telegram
  client stops showing a loading state.
- Official docs: https://core.telegram.org/bots/api

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Session gate | `pnpm session:preflight` | exits 0 on a clean fresh task branch |
| Telegram/client tests | `pnpm --filter @bitrix24-reporting/api exec vitest run test/telegram-client.test.ts test/telegram-enrichment-approval.test.ts` | exits 0 |
| HTTP tests | `pnpm --filter @bitrix24-reporting/api exec vitest run test/http.test.ts` | exits 0 |
| Env tests | `pnpm --filter @bitrix24-reporting/api exec vitest run test/env.test.ts` | exits 0 |
| API typecheck | `pnpm --filter @bitrix24-reporting/api typecheck` | exits 0 |
| API lint | `pnpm --filter @bitrix24-reporting/api lint` | exits 0 |

## Scope

**In scope**:

- `apps/api/src/server/telegram-client.ts`
- `apps/api/src/server/telegram-enrichment-approval.ts` (create)
- `apps/api/src/server/routes/telegram-enrichment-routes.ts` (create, or add to
  a focused route module)
- `apps/api/src/server/app.ts`
- `apps/api/src/config/env.ts`
- `apps/api/test/telegram-client.test.ts` (create if absent)
- `apps/api/test/telegram-enrichment-approval.test.ts` (create)
- `apps/api/test/http.test.ts`
- `apps/api/test/env.test.ts`

**Out of scope**:

- Manual text editing in Telegram.
- Manager reminders.
- Dashboard UI for proposals.
- Bitrix write adapter implementation, except calling an interface.
- Reusing `TELEGRAM_ACTIVITY_REPORT_*` env names for this feature.

## Git workflow

- Branch: `codex/telegram-enrichment-approval`.
- Do not commit, push, or open a PR unless instructed.

## Steps

### Step 1: Add enrichment Telegram env settings

In `apps/api/src/config/env.ts`, add separate settings:

- `TELEGRAM_ENRICHMENT_ENABLED`: `"true" | "false"`, default `"false"`.
- `TELEGRAM_ENRICHMENT_BOT_TOKEN`: optional.
- `TELEGRAM_ENRICHMENT_MANAGER_CHAT_IDS`: CSV of `bitrixUserId:telegramChatId`
  pairs, for V1.
- `TELEGRAM_ENRICHMENT_CALLBACK_SECRET`: optional 32+ char secret if the callback
  endpoint is exposed as webhook.

Derived:

- `telegramEnrichmentEnabled`
- `telegramEnrichmentManagerChatIds: Record<string, string>`

Validation:

- If enabled, require bot token and at least one manager mapping.
- Do not require daily activity report settings.

**Verify**: env tests pass.

### Step 2: Extend Telegram client without breaking daily reports

In `apps/api/src/server/telegram-client.ts`, keep `TelegramMessageSender` for
daily reports. Add a separate interface:

```ts
export interface TelegramInteractiveSender {
  sendMessage(input: {
    chatId: string;
    text: string;
    replyMarkup?: unknown;
  }): Promise<{ messageId: string | null }>;
  editMessageReplyMarkup?(input: ...): Promise<void>;
  answerCallbackQuery(input: { callbackQueryId: string; text?: string }): Promise<void>;
}
```

`sendMessage` should support `reply_markup` only when provided. Preserve existing
daily report behavior.

**Verify**: existing Telegram activity report HTTP tests still pass.

### Step 3: Add server-side callback tokens

Do not serialize proposal payload into `callback_data`.

Create token records in SQLite or reuse proposal event metadata if Plan 017 added
a suitable table. Preferred: add a small table if needed:

- `telegram_enrichment_action_tokens`
- `token TEXT PRIMARY KEY`
- `batch_id TEXT NOT NULL`
- `proposal_id TEXT NOT NULL`
- `action TEXT NOT NULL`
- `manager_id TEXT NOT NULL`
- `expires_at TEXT NOT NULL`
- `used_at TEXT`

If this adds schema, include repository methods and SQLite tests in this plan.

Token format sent to Telegram should be short, e.g. `ce:<opaqueId>`, and fit
within 64 bytes.

**Verify**: unit test asserts every generated `callback_data` length <= 64.

### Step 4: Format one batch per call

Create `apps/api/src/server/telegram-enrichment-approval.ts`.

Input: proposal batch and proposals from repository.

Message format:

- Header: after call, fields to fill.
- Deal id and contact id only; no contact name/phone/email.
- For each proposal:
  - field title;
  - current value if safe and short;
  - proposed value;
  - short evidence snippet;
  - confidence if useful.
- Buttons:
  - `Записать` for `fill_empty`;
  - `Перезаписать` for `overwrite`;
  - `Не заполнять`.

Do not include full transcript.
Do not include links to Bitrix unless product/security approves.

**Verify**: snapshot/string tests check no transcript, no phone/email/name keys,
and expected buttons.

### Step 5: Add callback route

Add a Telegram callback endpoint, for example:

- `POST /api/telegram/enrichment/callback`

Security:

- Verify Telegram callback secret header or configured webhook secret.
- Validate callback body with Zod.
- Resolve token server-side.
- Check token not expired and not used.
- Check callback Telegram user/chat maps to expected manager id.
- Call an injected `applyManagerDecision` service interface:
  - approve fill/overwrite;
  - decline.
- Always call `answerCallbackQuery` after processing or after validation failure
  with a safe short message.

**Verify**: HTTP tests with fake sender and fake decision service pass.

### Step 6: Wire batch sending after proposal creation

When orchestrator from Plan 020/022 creates a batch with proposals:

- find manager's Telegram chat id from mapping;
- if no mapping, leave batch pending or failed with audit reason
  `TELEGRAM_CHAT_NOT_CONFIGURED`;
- send exactly one message;
- store `telegram_chat_id` and `telegram_message_id` on batch;
- do not send when no proposals exist.

**Verify**: tests assert no proposals -> no send; two proposals -> one send with
two proposal button rows.

## Test plan

- New Telegram client tests for `reply_markup` and `answerCallbackQuery`.
- New approval formatter/callback tests.
- Extend HTTP tests for callback route auth and decisions.
- Extend env tests for new settings.

## Done criteria

- [ ] Telegram enrichment env is separate from daily activity reports.
- [ ] One batch message is sent per call when proposals exist.
- [ ] No message is sent for no-dialogue or no-op calls.
- [ ] `callback_data` uses short tokens <= 64 bytes.
- [ ] Callback route validates secret, token, expiry, and manager ownership.
- [ ] Callback calls a decision service interface but does not write Bitrix
  directly.
- [ ] Existing daily Telegram report tests still pass.

## STOP conditions

Stop and report if:

- Product asks for manual value editing in Telegram; that is out of V1 scope.
- Telegram manager id mapping is unavailable and cannot be represented as env
  config.
- Callback route cannot be secured without exposing a broad unauthenticated
  mutating endpoint.

## Maintenance notes

Keep Telegram as an action adapter. It formats proposals and converts callbacks
into manager decisions; it should not contain diff logic or Bitrix update logic.

