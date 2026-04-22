# Proto To Web Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current `apps/web` interface with the existing `apps/proto` product shell, preserve comment mode, and connect live backend data for non-sales scenes.

**Architecture:** Move the prototype shell into `apps/web` as the only interface, keep the local comment middleware and storage file intact, and add a scene-level data adapter that maps live backend payloads into the existing prototype visual structure. Keep the sales scene on mock data until the sales methodology is finalized.

**Tech Stack:** Vite, React 19, TypeScript, Tailwind CSS v4, local Vite middleware, existing Express API, Testing Library, Vitest

---

### Task 1: Move the prototype shell into `apps/web`

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.test.tsx`
- Create: `apps/web/src/proto/App.tsx`
- Create: `apps/web/src/proto/scenes.tsx`
- Create: `apps/web/src/proto/types.ts`
- Create: `apps/web/src/proto/comments-api.ts`
- Create: `apps/web/src/proto/use-proto-comments.ts`
- Create: `apps/web/src/components/ui/command.tsx`
- Create: `apps/web/src/components/ui/popover.tsx`
- Create: `apps/web/src/components/ui/textarea.tsx`
- Update imports in any moved files to point at `apps/web/src/...`

**Step 1:** Copy the prototype app shell and supporting files into `apps/web/src/proto`.

**Step 2:** Replace the current `apps/web/src/App.tsx` entrypoint so it renders the moved prototype shell only.

**Step 3:** Bring over missing UI primitives required by the prototype shell.

**Step 4:** Update `apps/web/src/App.test.tsx` so it validates the new main interface instead of the temporary design template.

### Task 2: Preserve comment mode in the main app

**Files:**
- Modify: `apps/web/vite.config.ts`
- Reuse: `.codex/proto-comments/comments.json`
- Test: `apps/web/src/App.test.tsx`

**Step 1:** Add the prototype comments middleware to `apps/web/vite.config.ts`.

**Step 2:** Point the moved `comments-api` at the same `GET/POST /__proto/comments` contract and the same `.codex/proto-comments/comments.json` file.

**Step 3:** Verify add/edit/archive/delete comment flows still work from the new main app shell.

### Task 3: Introduce live scene data adapters

**Files:**
- Create: `apps/web/src/proto/live-reporting.ts`
- Modify: `apps/web/src/proto/scenes.tsx`
- Reuse: `apps/web/src/lib/api-client.ts`
- Reuse: `apps/web/src/lib/dashboard-types.ts`

**Step 1:** Create a scene data adapter that fetches and maps:
- `activities-workload`
- `calls-workload`
- `cohort-conversion`
- `toc-flow`

**Step 2:** Keep `sales` on mock data and clearly isolate that mock path inside the adapter.

**Step 3:** Convert live payloads into the exact visual shapes expected by the prototype scene components so the visual layout stays unchanged.

### Task 4: Wire filters from the prototype shell to live backend inputs

**Files:**
- Modify: `apps/web/src/proto/App.tsx`
- Modify: `apps/web/src/proto/scenes.tsx`
- Reuse: `apps/web/src/lib/api-client.ts`

**Step 1:** Map prototype filter state into backend query inputs:
- main date range
- compare ranges
- manager filters
- source filters

**Step 2:** Fetch fresh scene data when filters change or when the user applies filters.

**Step 3:** Keep compare periods flowing into backend using the already implemented `compareFrom/compareTo` contract.

### Task 5: Verify end-to-end behavior

**Files:**
- Test: `apps/web/src/App.test.tsx`
- Test: `apps/web/src/lib/api-client.test.ts`
- Add if needed: `apps/web/src/proto/live-reporting.test.ts`

**Step 1:** Add or update tests for:
- main app renders prototype shell
- comment mode shell affordances remain visible
- compare period filters remain present
- live scene adapter produces expected view-models from backend payloads

**Step 2:** Run:
- `pnpm --filter @bitrix24-reporting/web test`
- `pnpm --filter @bitrix24-reporting/web typecheck`
- `pnpm --filter @bitrix24-reporting/api test`
- `pnpm --filter @bitrix24-reporting/api typecheck`

**Step 3:** Fix any integration regressions before stopping.
