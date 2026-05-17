# Paperclip Comments Review Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the dashboard comments to Paperclip review blockers before deployment.

**Architecture:** Keep the V1 module model scoped to `attraction`, preserve legacy admin access through a one-time membership backfill, and separate author permissions from leader archive/admin permissions. Paperclip delivery gets an explicit retry endpoint plus a lightweight status refresh endpoint path; the browser stops pretending failed API mutations were saved locally.

**Tech Stack:** Express, better-sqlite3, Vitest, React, Testing Library.

---

### Task 1: Auth Migration And Module User Boundaries

**Files:**
- Modify: `apps/api/src/server/auth.ts`
- Test: `apps/api/test/auth.test.ts`
- Test: `apps/api/test/dashboard-comments.test.ts`

**Steps:**
1. Add failing tests for legacy `auth_users` gaining attraction leader membership and generic later `createUser` not auto-granting leader.
2. Add failing tests that module-admin updates cannot disable a user outside the current module, and module disable affects membership access rather than global auth where possible.
3. Implement legacy backfill only when the module membership table is empty and auth users already exist.
4. Make implicit leader membership apply only to the first created auth user; require explicit memberships for later users.
5. Verify targeted auth/comment tests.

### Task 2: Comment Save Error Handling

**Files:**
- Modify: `apps/web/src/proto/comments-api.ts`
- Modify: `apps/web/src/proto/use-proto-comments.ts`
- Modify: `apps/web/src/proto/proto-app.tsx`
- Test: `apps/web/src/proto/proto-app.test.tsx`

**Steps:**
1. Add failing web tests for create/archive API failures staying visible as errors instead of mutating local state.
2. Export the server-comment mode check and make API-mode failures set `error` and rethrow.
3. Hide local-only delete for server-backed comments.
4. Verify the targeted ProtoApp tests.

### Task 3: Paperclip Retry, Status Sync, And Sanitization

**Files:**
- Modify: `apps/api/src/server/app.ts`
- Modify: `apps/api/src/server/sqlite-repository.ts`
- Modify: `apps/api/src/server/paperclip-client.ts`
- Modify: `apps/web/src/lib/api-client.ts`
- Test: `apps/api/test/dashboard-comments.test.ts`

**Steps:**
1. Add failing API tests for sanitized Paperclip titles, retrying failed comments, author-only text edits, and status refresh mapping.
2. Add `POST /api/comments/:id/retry` and deliver comments through a shared helper.
3. Add status refresh for notification reads where an issue id exists and Paperclip can return current status.
4. Make title construction use sanitized and bounded text.
5. Verify focused API tests.

### Task 4: Final Verification

**Files:**
- All touched files.

**Steps:**
1. Run API focused tests.
2. Run web focused tests.
3. Run full API and web suites if focused checks pass.
4. Run `pnpm typecheck` and `pnpm lint`.
