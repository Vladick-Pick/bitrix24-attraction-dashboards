# Dashboard Comments To Paperclip V1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make attraction dashboard comments persist as first-class module records and create Paperclip issues with visible delivery/status feedback.

**Architecture:** Extend the existing password-session auth and SQLite repository instead of adding a second auth system. Keep V1 scoped to the `attraction` module, reuse the existing pin/comment UI, and add a Paperclip outbox path that persists the comment before trying to create the external issue.

**Tech Stack:** Express 5, Zod, better-sqlite3, Vitest/Supertest, React 19, Vite, TypeScript.

---

### Task 1: Module RBAC Foundation

**Files:**
- Modify: `apps/api/src/server/auth.ts`
- Modify: `apps/api/src/server/app.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/src/config/env.ts`
- Test: `apps/api/test/auth.test.ts`

**Steps:**
1. Add `modules` and `module_memberships` SQLite tables in the auth store.
2. Extend `AuthenticatedUser` to include `id`, `modules`, module role, and permissions.
3. Seed `attraction` from env/defaults and assign the first existing active user as `leader` when no active membership exists.
4. Update `/api/auth/me` and login responses.
5. Add leader-only helper checks for admin routes.

### Task 2: Comment Storage And Outbox

**Files:**
- Modify: `apps/api/src/server/sqlite-repository.ts`
- Modify: `apps/api/src/server/app.ts`
- Create: `apps/api/src/server/paperclip-client.ts`
- Test: `apps/api/test/sqlite.test.ts`
- Test: `apps/api/test/http.test.ts`

**Steps:**
1. Add metadata columns to `proto_comments`: module, author, Paperclip issue id/identifier, Paperclip status, sync status, sync error, retry count, last sync time, context JSON.
2. Add CRUD methods for comments while keeping legacy proto comment reads compatible.
3. Implement `PaperclipClient.createIssue` using `PAPERCLIP_API_URL` and `PAPERCLIP_API_TOKEN`.
4. On `POST /api/comments`, insert the comment as queued, attempt Paperclip issue creation immediately, then mark as sent or failed.
5. Add `POST /api/comments/:id/retry` for failed/queued records.
6. Sanitize the Paperclip issue description: module, author login, anchor, filters/range, redacted comment text, implementation instructions only.

### Task 3: API Surface

**Files:**
- Modify: `apps/api/src/server/app.ts`
- Test: `apps/api/test/http.test.ts`
- Test: `apps/api/test/auth.test.ts`

**Steps:**
1. Add `GET /api/comments`, `POST /api/comments`, `PATCH /api/comments/:id`, `POST /api/comments/:id/archive`.
2. Add `GET /api/comment-notifications`.
3. Add `GET /api/admin/module-users`, `POST /api/admin/module-users`, `PATCH /api/admin/module-users/:id`.
4. Keep CSRF protection on all mutating routes through the existing middleware.
5. Preserve existing `/api/proto-comments` compatibility where practical.

### Task 4: Web Integration

**Files:**
- Modify: `apps/web/src/lib/api-client.ts`
- Modify: `apps/web/src/proto/types.ts`
- Modify: `apps/web/src/proto/use-proto-comments.ts`
- Modify: `apps/web/src/proto/proto-app.tsx`
- Test: `apps/web/src/lib/api-client.test.ts`
- Test: `apps/web/src/proto/proto-app.test.tsx`

**Steps:**
1. Add typed API client methods for comments, notifications, and module users.
2. Refactor the comment hook from bulk overwrite to create/update/archive/retry calls when using `/api/comments`.
3. Show top notification chips near the dashboard header for sent, in work, needs input, done, failed.
4. Hide archive/admin controls from employees and show the mini-admin only to leaders.
5. Keep local dev fallback for non-API comment endpoints.

### Task 5: Verification

**Commands:**
- `pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/auth.test.ts apps/api/test/http.test.ts apps/api/test/sqlite.test.ts`
- `pnpm --filter @bitrix24-reporting/web exec vitest run apps/web/src/lib/api-client.test.ts apps/web/src/proto/proto-app.test.tsx`
- `pnpm --filter @bitrix24-reporting/api typecheck`
- `pnpm --filter @bitrix24-reporting/web typecheck`

**Expected Result:** Focused API and web tests pass. If broader suites are too slow or blocked, record the exact failure and keep the branch in a reviewable state.
