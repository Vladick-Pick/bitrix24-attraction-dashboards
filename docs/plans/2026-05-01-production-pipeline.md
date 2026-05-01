# Production Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a clean CI/CD pipeline that deploys reviewed `main` commits to the Timeweb VPS.

**Architecture:** GitHub Actions verifies every change and deploys `main` through SSH. The VPS pulls exact commits from GitHub, rebuilds Docker Compose, verifies health, and can rollback to the previous commit on failure.

**Tech Stack:** GitHub Actions, SSH, Docker Compose, Caddy, pnpm, Node 24.

---

### Task 1: CI Workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Steps:**
1. Checkout code.
2. Enable Corepack and setup Node 24 with pnpm cache.
3. Run `pnpm install --frozen-lockfile`.
4. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
5. Validate Docker Compose with `.env.example`.

### Task 2: Deploy Workflow

**Files:**
- Create: `.github/workflows/deploy-production.yml`

**Steps:**
1. Repeat verification before deploy.
2. Configure SSH from repository secrets.
3. Send `scripts/deploy-production.sh` to the VPS over stdin.
4. Deploy only after verification succeeds.

### Task 3: VPS Deploy Script

**Files:**
- Create: `scripts/deploy-production.sh`
- Create: `scripts/rollback-production.sh`

**Steps:**
1. Ensure data directory exists and is owned by UID/GID `10001`.
2. Convert a non-git app directory into a cloned repo while preserving `.env.production`.
3. Fetch and checkout the exact requested commit.
4. Run `docker compose up -d --build --remove-orphans`.
5. Verify health, unauthenticated `401`, and non-root container.
6. Rollback to the previous commit if build/start/health fails.

### Task 4: Documentation

**Files:**
- Create: `docs/deployment-pipeline.md`
- Create: `docs/plans/2026-05-01-production-pipeline-design.md`

**Steps:**
1. Document the branch-to-main-to-production flow.
2. Document GitHub secrets.
3. Document manual deploy and rollback.
4. Document billing expectations for GitHub Actions.

### Task 5: Server Wiring

**Steps:**
1. Generate a VPS read-only GitHub deploy key.
2. Add it to GitHub deploy keys.
3. Generate a GitHub Actions -> VPS SSH key.
4. Add its public key to VPS `authorized_keys`.
5. Store private key and deployment metadata in GitHub Actions secrets.
6. Run a manual deploy workflow or equivalent remote script verification.
