import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import type { DashboardData, ManualSyncSummary } from "@bitrix24-reporting/contracts";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import {
  createPasswordAuthService,
  createSqliteAuthStore,
  hashPassword
} from "../src/server/auth";
import { createApp } from "../src/server/app";

function createMinimalService(): Parameters<typeof createApp>[0] {
  const dashboard: DashboardData = {
    salesSummary: {
      salesCount: 1,
      salesAmount: 1000,
      averageSaleAmount: 1000,
      attractionRevenueAmount: 1000,
      averageAttractionRevenueAmount: 1000,
      membershipAmount: 1000,
      averageMembershipAmount: 1000,
      pricingWarnings: [],
      newDealsCount: 1,
      conversionRate: 100
    },
    managerGroups: []
  };
  const syncSummary: ManualSyncSummary = {
    syncRunId: 1,
    leadsSynced: 0,
    dealsSynced: 0,
    mode: "delta",
    modifiedAfter: null,
    finishedAt: "2026-04-09T00:00:00.000Z",
    snapshotBefore: {
      deals: 0,
      activities: 0,
      calls: 0,
      stageHistory: 0
    },
    snapshotAfter: {
      deals: 0,
      activities: 0,
      calls: 0,
      stageHistory: 0
    },
    changes: {
      deals: 0,
      dealBreakdown: {
        total: 0,
        created: 0,
        updated: 0,
        closed: 0,
        reopened: 0,
        unchanged: 0
      },
      activities: 0,
      calls: 0,
      stageHistory: 0,
      managers: 0
    },
    diagnostics: []
  };

  return {
    getDashboard: async () => dashboard,
    performSync: async () => syncSummary
  } as unknown as Parameters<typeof createApp>[0];
}

describe("password session auth", () => {
  const directories: string[] = [];

  afterEach(() => {
    for (const directory of directories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  async function createAuthTestApp(input: {
    disabled?: boolean;
    ttlHours?: number;
    rateLimit?: {
      maxFailures: number;
      windowMs: number;
    };
    now?: () => Date;
  } = {}) {
    const directory = mkdtempSync(join(tmpdir(), "bitrix24-auth-"));
    directories.push(directory);
    const store = createSqliteAuthStore({
      databaseUrl: `file:${join(directory, "reporting.sqlite")}`
    });
    await store.createUser({
      login: "admin",
      passwordHash: await hashPassword("correct-password"),
      disabled: input.disabled ?? false,
      now: new Date("2026-04-30T10:00:00.000Z")
    });
    const auth = createPasswordAuthService({
      store,
      sessionSecret: "test-session-secret-with-at-least-32-bytes",
      cookieName: "b24dash_session",
      ttlHours: input.ttlHours ?? 12,
      secureCookie: false,
      ...(input.rateLimit ? { rateLimit: input.rateLimit } : {}),
      ...(input.now ? { now: input.now } : {})
    });

    return {
      app: createApp(createMinimalService(), {
        auth
      }),
      store
    };
  }

  it("backfills legacy auth users into the attraction module as leaders", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bitrix24-auth-"));
    directories.push(directory);
    const databasePath = join(directory, "reporting.sqlite");
    const database = new Database(databasePath);
    database.exec(`
      CREATE TABLE auth_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        login TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        disabled INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        disabled_at TEXT,
        last_login_at TEXT
      );
    `);
    database
      .prepare(
        `INSERT INTO auth_users (
          login,
          password_hash,
          disabled,
          created_at,
          updated_at,
          disabled_at
        ) VALUES (?, ?, 0, ?, ?, NULL)`
      )
      .run(
        "legacy-admin",
        await hashPassword("correct-password"),
        "2026-04-30T10:00:00.000Z",
        "2026-04-30T10:00:00.000Z"
      );
    database.close();

    const store = createSqliteAuthStore({
      databaseUrl: `file:${databasePath}`
    });
    const user = await store.findUserByLogin("legacy-admin");

    await expect(user ? store.getUserModules(user.id) : null).resolves.toEqual([
      expect.objectContaining({
        key: "attraction",
        role: "leader",
        permissions: expect.arrayContaining(["module-users:manage"])
      })
    ]);

    store.close();
  });

  it("does not auto-grant attraction leadership to later generic auth users", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bitrix24-auth-"));
    directories.push(directory);
    const store = createSqliteAuthStore({
      databaseUrl: `file:${join(directory, "reporting.sqlite")}`
    });

    const first = await store.createUser({
      login: "first-admin",
      passwordHash: await hashPassword("first-password")
    });
    const later = await store.createUser({
      login: "later-user",
      passwordHash: await hashPassword("later-password")
    });

    await expect(store.getUserModules(first.id)).resolves.toEqual([
      expect.objectContaining({
        key: "attraction",
        role: "leader"
      })
    ]);
    await expect(store.getUserModules(later.id)).resolves.toEqual([]);

    store.close();
  });

  it("keeps health public but rejects report APIs without a valid session", async () => {
    const { app, store } = await createAuthTestApp();

    await request(app).get("/api/health").expect(200);
    await request(app)
      .get("/api/dashboard")
      .expect(401)
      .expect(({ body }) => {
        expect(body.code).toBe("UNAUTHORIZED");
      });

    store.close();
  });

  it("logs in with a valid password, sets an HttpOnly cookie and returns csrf from /me", async () => {
    const { app, store } = await createAuthTestApp();
    const agent = request.agent(app);

    const loginResponse = await agent
      .post("/api/auth/login")
      .send({ login: "admin", password: "correct-password" })
      .expect(200);

    expect(loginResponse.headers["set-cookie"]?.[0]).toContain("HttpOnly");
    expect(loginResponse.body.user).toEqual({
      login: "admin",
      role: "admin"
    });
    expect(loginResponse.body.csrfToken).toEqual(expect.any(String));

    await agent
      .get("/api/auth/me")
      .expect(200)
      .expect(({ body }) => {
        expect(body.user.login).toBe("admin");
        expect(body.csrfToken).toEqual(expect.any(String));
      });

    await agent.get("/api/dashboard").expect(200);

    store.close();
  });

  it("uses a generic invalid credentials response and does not set a cookie", async () => {
    const { app, store } = await createAuthTestApp();

    await request(app)
      .post("/api/auth/login")
      .send({ login: "admin", password: "wrong-password" })
      .expect(401)
      .expect(({ body, headers }) => {
        expect(body.code).toBe("INVALID_CREDENTIALS");
        expect(JSON.stringify(body)).not.toMatch(/password|login/i);
        expect(headers["set-cookie"]).toBeUndefined();
      });

    store.close();
  });

  it("rejects disabled users", async () => {
    const { app, store } = await createAuthTestApp({ disabled: true });

    await request(app)
      .post("/api/auth/login")
      .send({ login: "admin", password: "correct-password" })
      .expect(401)
      .expect(({ body }) => {
        expect(body.code).toBe("INVALID_CREDENTIALS");
      });

    store.close();
  });

  it("rejects expired sessions", async () => {
    let current = new Date("2026-04-30T10:00:00.000Z");
    const { app, store } = await createAuthTestApp({
      ttlHours: 1,
      now: () => current
    });
    const agent = request.agent(app);

    await agent
      .post("/api/auth/login")
      .send({ login: "admin", password: "correct-password" })
      .expect(200);

    current = new Date("2026-04-30T11:00:01.000Z");
    await agent.get("/api/dashboard").expect(401);

    store.close();
  });

  it("requires X-CSRF-Token for mutating requests and invalidates sessions on logout", async () => {
    const { app, store } = await createAuthTestApp();
    const agent = request.agent(app);

    const loginResponse = await agent
      .post("/api/auth/login")
      .send({ login: "admin", password: "correct-password" })
      .expect(200);
    const csrfToken = loginResponse.body.csrfToken as string;

    await agent.post("/api/sync").expect(403);
    await agent.post("/api/sync").set("X-CSRF-Token", "wrong").expect(403);
    await agent.post("/api/sync").set("X-CSRF-Token", csrfToken).expect(200);

    await agent
      .post("/api/auth/logout")
      .set("X-CSRF-Token", csrfToken)
      .expect(204);
    await agent.get("/api/auth/me").expect(401);

    store.close();
  });

  it("keeps existing csrf tokens valid when /me is loaded again in another tab", async () => {
    const { app, store } = await createAuthTestApp();
    const agent = request.agent(app);

    await agent
      .post("/api/auth/login")
      .send({ login: "admin", password: "correct-password" })
      .expect(200);

    const firstMeResponse = await agent.get("/api/auth/me").expect(200);
    const firstCsrfToken = firstMeResponse.body.csrfToken as string;
    await agent.get("/api/auth/me").expect(200);

    await agent.post("/api/sync").set("X-CSRF-Token", firstCsrfToken).expect(200);

    store.close();
  });

  it("runs password verification work for missing users to reduce login timing leaks", async () => {
    const { store } = await createAuthTestApp({
      rateLimit: {
        maxFailures: 20,
        windowMs: 60_000
      }
    });
    const auth = createPasswordAuthService({
      store,
      sessionSecret: "test-session-secret-with-at-least-32-bytes",
      cookieName: "b24dash_session",
      secureCookie: false,
      rateLimit: {
        maxFailures: 20,
        windowMs: 60_000
      }
    });

    const knownUserStartedAt = performance.now();
    await expect(
      auth.login({
        login: "admin",
        password: "wrong-password",
        rateLimitKey: "127.0.0.1"
      })
    ).rejects.toThrow("INVALID_CREDENTIALS");
    const knownUserDuration = performance.now() - knownUserStartedAt;

    const missingUserStartedAt = performance.now();
    await expect(
      auth.login({
        login: "missing",
        password: "wrong-password",
        rateLimitKey: "127.0.0.1"
      })
    ).rejects.toThrow("INVALID_CREDENTIALS");
    const missingUserDuration = performance.now() - missingUserStartedAt;

    expect(missingUserDuration).toBeGreaterThan(knownUserDuration * 0.5);

    store.close();
  });

  it("rate limits repeated login failures by IP and login", async () => {
    const { app, store } = await createAuthTestApp({
      rateLimit: {
        maxFailures: 2,
        windowMs: 60_000
      }
    });

    for (let index = 0; index < 2; index += 1) {
      await request(app)
        .post("/api/auth/login")
        .send({ login: "admin", password: "wrong-password" })
        .expect(401);
    }

    await request(app)
      .post("/api/auth/login")
      .send({ login: "admin", password: "wrong-password" })
      .expect(429)
      .expect(({ body }) => {
        expect(body.code).toBe("LOGIN_RATE_LIMITED");
      });

    store.close();
  });
});
