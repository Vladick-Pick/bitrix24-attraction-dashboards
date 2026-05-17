import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { DashboardData, ManualSyncSummary } from "@bitrix24-reporting/contracts";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import {
  createPasswordAuthService,
  createSqliteAuthStore,
  hashPassword
} from "../src/server/auth";
import { createApp } from "../src/server/app";
import type {
  DashboardCommentRecord,
  PaperclipCommentStatus,
  PaperclipSyncStatus
} from "../src/server/sqlite-repository";

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
    configOverrides?: Partial<Parameters<typeof createApp>[1]>;
  } = {}) {
    const directory = mkdtempSync(join(tmpdir(), "bitrix24-auth-"));
    directories.push(directory);
    const store = createSqliteAuthStore({
      databaseUrl: `file:${join(directory, "reporting.sqlite")}`
    });
    await store.ensureModule({
      id: "attraction",
      slug: "attraction",
      name: "Привлечение",
      bitrixCategoryId: "10",
      paperclipCompanyId: "company-1",
      paperclipProjectId: "project-1",
      paperclipGoalId: "goal-1",
      paperclipTriageAgentId: "agent-1"
    });
    const user = await store.createUser({
      login: "admin",
      passwordHash: await hashPassword("correct-password"),
      disabled: input.disabled ?? false,
      now: new Date("2026-04-30T10:00:00.000Z")
    });
    await store.setModuleMembership({
      userId: user.id,
      moduleId: "attraction",
      role: "leader",
      status: "active",
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
        auth,
        ...input.configOverrides
      }),
      store
    };
  }

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
    expect(loginResponse.body.user).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        login: "admin",
        role: "admin",
        modules: expect.any(Array)
      })
    );
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

  it("promotes the first active user to super admin and returns every module", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bitrix24-auth-"));
    directories.push(directory);
    const store = createSqliteAuthStore({
      databaseUrl: `file:${join(directory, "reporting.sqlite")}`
    });
    await store.ensureModule({
      id: "attraction",
      slug: "attraction",
      name: "Привлечение",
      bitrixCategoryId: "10"
    });
    await store.ensureModule({
      id: "leadgen",
      slug: "leadgen",
      name: "Лидогенерация",
      bitrixCategoryId: "28"
    });
    await store.createUser({
      login: "owner@example.com",
      passwordHash: await hashPassword("correct-password"),
      now: new Date("2026-05-14T10:00:00.000Z")
    });
    await store.ensureDefaultSuperAdmin();
    const auth = createPasswordAuthService({
      store,
      sessionSecret: "test-session-secret-with-at-least-32-bytes",
      cookieName: "b24dash_session",
      ttlHours: 12,
      secureCookie: false
    });
    const app = createApp(createMinimalService(), {
      auth
    });

    await request(app)
      .post("/api/auth/login")
      .send({ login: "owner@example.com", password: "correct-password" })
      .expect(200)
      .expect(({ body }) => {
        expect(body.user.isSuperAdmin).toBe(true);
        expect(body.user.modules.map((module: { id: string }) => module.id)).toEqual([
          "attraction",
          "leadgen"
        ]);
        expect(
          body.user.modules.every((module: { permissions: string[] }) =>
            module.permissions.includes("module-users:manage")
          )
        ).toBe(true);
      });

    store.close();
  });

  it("lets only super admins grant explicit module memberships", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bitrix24-auth-"));
    directories.push(directory);
    const store = createSqliteAuthStore({
      databaseUrl: `file:${join(directory, "reporting.sqlite")}`
    });
    await store.ensureModule({
      id: "attraction",
      slug: "attraction",
      name: "Привлечение",
      bitrixCategoryId: "10"
    });
    await store.ensureModule({
      id: "leadgen",
      slug: "leadgen",
      name: "Лидогенерация",
      bitrixCategoryId: "28"
    });
    const owner = await store.createUser({
      login: "owner@example.com",
      passwordHash: await hashPassword("correct-password"),
      now: new Date("2026-05-14T10:00:00.000Z")
    });
    const target = await store.createUser({
      login: "target@example.com",
      passwordHash: await hashPassword("target-password"),
      now: new Date("2026-05-14T10:00:00.000Z")
    });
    const moduleLeader = await store.createUser({
      login: "leader@example.com",
      passwordHash: await hashPassword("leader-password"),
      now: new Date("2026-05-14T10:00:00.000Z")
    });
    await store.setModuleMembership({
      userId: moduleLeader.id,
      moduleId: "attraction",
      role: "leader",
      status: "active"
    });
    await store.ensureDefaultSuperAdmin();
    const auth = createPasswordAuthService({
      store,
      sessionSecret: "test-session-secret-with-at-least-32-bytes",
      cookieName: "b24dash_session",
      ttlHours: 12,
      secureCookie: false
    });
    const app = createApp(createMinimalService(), {
      auth,
      authStore: store
    });
    const ownerAgent = request.agent(app);
    const ownerLogin = await ownerAgent
      .post("/api/auth/login")
      .send({ login: owner.login, password: "correct-password" })
      .expect(200);

    await ownerAgent
      .get("/api/admin/platform/access")
      .expect(200)
      .expect(({ body }) => {
        expect(body.modules.map((module: { id: string }) => module.id)).toEqual([
          "attraction",
          "leadgen"
        ]);
        expect(body.users).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: target.id,
              login: "target@example.com",
              memberships: []
            })
          ])
        );
      });

    await ownerAgent
      .patch(`/api/admin/platform/users/${target.id}/module-memberships`)
      .set("X-CSRF-Token", ownerLogin.body.csrfToken as string)
      .send({
        memberships: [
          { moduleId: "leadgen", role: "employee", status: "active" },
          { moduleId: "attraction", role: "leader", status: "active" }
        ]
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.user.memberships).toEqual([
          expect.objectContaining({
            moduleId: "attraction",
            moduleRole: "leader",
            membershipStatus: "active"
          }),
          expect.objectContaining({
            moduleId: "leadgen",
            moduleRole: "employee",
            membershipStatus: "active"
          })
        ]);
      });

    await request(app)
      .post("/api/auth/login")
      .send({ login: "target@example.com", password: "target-password" })
      .expect(200)
      .expect(({ body }) => {
        expect(body.user.modules.map((module: { id: string }) => module.id)).toEqual([
          "attraction",
          "leadgen"
        ]);
      });

    const leaderAgent = request.agent(app);
    const leaderLogin = await leaderAgent
      .post("/api/auth/login")
      .send({ login: "leader@example.com", password: "leader-password" })
      .expect(200);
    await leaderAgent.get("/api/admin/platform/access").expect(403);
    await leaderAgent
      .patch(`/api/admin/platform/users/${target.id}/module-memberships`)
      .set("X-CSRF-Token", leaderLogin.body.csrfToken as string)
      .send({ memberships: [] })
      .expect(403);

    store.close();
  });

  it("rejects attraction API access for users without attraction membership", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bitrix24-auth-"));
    directories.push(directory);
    const store = createSqliteAuthStore({
      databaseUrl: `file:${join(directory, "reporting.sqlite")}`
    });
    await store.ensureModule({
      id: "attraction",
      slug: "attraction",
      name: "Привлечение",
      bitrixCategoryId: "10"
    });
    await store.ensureModule({
      id: "leadgen",
      slug: "leadgen",
      name: "Лидогенерация",
      bitrixCategoryId: "28"
    });
    const user = await store.createUser({
      login: "leadgen@example.com",
      passwordHash: await hashPassword("correct-password"),
      now: new Date("2026-05-14T10:00:00.000Z")
    });
    await store.setModuleMembership({
      userId: user.id,
      moduleId: "leadgen",
      role: "leader",
      status: "active"
    });
    const auth = createPasswordAuthService({
      store,
      sessionSecret: "test-session-secret-with-at-least-32-bytes",
      cookieName: "b24dash_session",
      ttlHours: 12,
      secureCookie: false
    });
    const app = createApp(createMinimalService(), {
      auth,
      authStore: store
    });
    const agent = request.agent(app);
    const loginResponse = await agent
      .post("/api/auth/login")
      .send({ login: "leadgen@example.com", password: "correct-password" })
      .expect(200);

    expect(loginResponse.body.user.modules.map((module: { id: string }) => module.id)).toEqual([
      "leadgen"
    ]);
    await agent.get("/api/dashboard").expect(403);
    await agent
      .post("/api/sync")
      .set("X-CSRF-Token", loginResponse.body.csrfToken as string)
      .expect(403);

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

  it("returns a dashboard comment to the existing Paperclip issue as a board-originated rework note", async () => {
    let commentRecord: DashboardCommentRecord = {
      id: "comment-rework-1",
      moduleId: "attraction",
      authorUserId: 0,
      authorLogin: "admin",
      sceneId: "sales",
      x: 0.25,
      y: 0.4,
      text: "Дата встречи есть в атрибутах, но нет предупреждения в таймлайне",
      status: "open" as const,
      archivedAt: null,
      createdAt: "2026-05-12T15:00:00.000Z",
      updatedAt: "2026-05-12T15:00:00.000Z",
      anchor: {
        blockId: "deal-143570",
        blockLabel: "143570",
        blockSelector: "[data-deal-id=\"143570\"]",
        blockRole: "sales-deal",
        elementSelector: "[data-stage-timeline]",
        elementLabel: "Таймлайн этапов",
        relativeX: 0.5,
        relativeY: 0.5
      },
      context: {
        dealId: "143570",
        range: {
          from: "2026-02-01T00:00:00.000+03:00",
          to: "2026-05-12T23:59:59.999+03:00"
        }
      },
      paperclipIssueId: "issue-143570",
      paperclipIssueIdentifier: "BIT-6",
      paperclipStatus: "done" as const,
      paperclipSyncStatus: "sent" as const,
      paperclipError: null,
      paperclipLastSyncedAt: "2026-05-12T16:00:00.000Z",
      paperclipRetryCount: 0
    };
    const paperclipComments: Array<{
      issueId: string;
      body: string;
      reopen?: boolean;
      origin?: string;
    }> = [];
    const comments = {
      getDashboardComments: async () => ({
        comments: [commentRecord],
        updatedAt: commentRecord.updatedAt
      }),
      getDashboardCommentById: async (id: string) =>
        id === commentRecord.id ? commentRecord : null,
      createDashboardComment: async () => commentRecord,
      updateDashboardComment: async () => commentRecord,
      archiveDashboardComment: async () => commentRecord,
      updateDashboardCommentPaperclip: async (input: {
        id: string;
        paperclipStatus: PaperclipCommentStatus;
        paperclipSyncStatus: PaperclipSyncStatus;
        paperclipError?: string | null;
        paperclipLastSyncedAt?: string | null;
      }) => {
        commentRecord = {
          ...commentRecord,
          paperclipStatus: input.paperclipStatus,
          paperclipSyncStatus: input.paperclipSyncStatus,
          paperclipError: input.paperclipError ?? null,
          paperclipLastSyncedAt: input.paperclipLastSyncedAt ?? null,
          updatedAt: input.paperclipLastSyncedAt ?? commentRecord.updatedAt
        };
        return commentRecord;
      }
    };
    const paperclip = {
      createIssue: async () => ({
        id: "unused",
        identifier: "BIT-unused",
        status: "todo"
      }),
      getIssue: async () => ({
        id: "issue-143570",
        identifier: "BIT-6",
        status: "done"
      }),
      listIssueComments: async () => [],
      addIssueComment: async (input: {
        issueId: string;
        body: string;
        reopen?: boolean;
      }) => {
        paperclipComments.push(input);
      }
    };
    const { app, store } = await createAuthTestApp({
      configOverrides: {
        comments,
        paperclip
      } as unknown as Partial<Parameters<typeof createApp>[1]>
    });
    const agent = request.agent(app);
    const loginResponse = await agent
      .post("/api/auth/login")
      .send({ login: "admin", password: "correct-password" })
      .expect(200);
    commentRecord = {
      ...commentRecord,
      authorUserId: loginResponse.body.user.id as number
    };

    await agent
      .post("/api/comments/comment-rework-1/rework")
      .set("X-CSRF-Token", loginResponse.body.csrfToken as string)
      .send({
        text: "Нужно не переносить бейдж на этап встречи, а показать предупреждение: Дата встречи раньше создания сделки. Телефон +7 999 123-45-67"
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.comment.paperclipStatus).toBe("in_work");
        expect(body.comment.paperclipSyncStatus).toBe("sent");
        expect(body.comment.status).toBe("open");
      });

    expect(paperclipComments).toHaveLength(1);
    expect(paperclipComments[0]).toEqual(
        expect.objectContaining({
          issueId: "issue-143570",
          origin: "dashboard_rework",
          reopen: true
        })
    );
    expect(paperclipComments[0]?.body).toContain("@Dashboard Engineering Manager");
    expect(paperclipComments[0]?.body).toContain("Возврат на доработку из dashboard review");
    expect(paperclipComments[0]?.body).toContain(
      "Source: dashboard-system / board-originated rework"
    );
    expect(paperclipComments[0]?.body).toContain("Дата встречи раньше создания сделки");
    expect(paperclipComments[0]?.body).toContain("[redacted-phone]");
    expect(paperclipComments[0]?.body).not.toContain("+7 999 123-45-67");

    store.close();
  });

  it("rejects dashboard rework when the comment has no linked Paperclip issue", async () => {
    const commentRecord = {
      id: "comment-without-paperclip",
      moduleId: "attraction",
      authorUserId: 0,
      authorLogin: "admin",
      sceneId: "sales",
      x: 0.25,
      y: 0.4,
      text: "Комментарий без связанной задачи",
      status: "open" as const,
      archivedAt: null,
      createdAt: "2026-05-12T15:00:00.000Z",
      updatedAt: "2026-05-12T15:00:00.000Z",
      paperclipIssueId: null,
      paperclipIssueIdentifier: null,
      paperclipStatus: "sent" as const,
      paperclipSyncStatus: "sent" as const,
      paperclipError: null,
      paperclipLastSyncedAt: null,
      paperclipRetryCount: 0
    };
    const comments = {
      getDashboardComments: async () => ({
        comments: [commentRecord],
        updatedAt: commentRecord.updatedAt
      }),
      getDashboardCommentById: async () => commentRecord,
      createDashboardComment: async () => commentRecord,
      updateDashboardComment: async () => commentRecord,
      archiveDashboardComment: async () => commentRecord,
      updateDashboardCommentPaperclip: async () => commentRecord
    };
    const { app, store } = await createAuthTestApp({
      configOverrides: {
        comments
      } as unknown as Partial<Parameters<typeof createApp>[1]>
    });
    const agent = request.agent(app);
    const loginResponse = await agent
      .post("/api/auth/login")
      .send({ login: "admin", password: "correct-password" })
      .expect(200);

    await agent
      .post("/api/comments/comment-without-paperclip/rework")
      .set("X-CSRF-Token", loginResponse.body.csrfToken as string)
      .send({ text: "Вернуть в работу" })
      .expect(409)
      .expect(({ body }) => {
        expect(body.code).toBe("PAPERCLIP_ISSUE_NOT_LINKED");
      });

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
