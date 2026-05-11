import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { DashboardData, ManualSyncSummary } from "@bitrix24-reporting/contracts";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createPasswordAuthService,
  createSqliteAuthStore,
  hashPassword
} from "../src/server/auth";
import { createApp } from "../src/server/app";
import { createSqliteRepository } from "../src/server/sqlite-repository";

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function createMinimalService(): Parameters<typeof createApp>[0] {
  const dashboard: DashboardData = {
    salesSummary: {
      salesCount: 0,
      salesAmount: 0,
      averageSaleAmount: 0,
      attractionRevenueAmount: 0,
      averageAttractionRevenueAmount: 0,
      membershipAmount: 0,
      averageMembershipAmount: 0,
      pricingWarnings: [],
      newDealsCount: 0,
      conversionRate: 0
    },
    managerGroups: []
  };
  const syncSummary: ManualSyncSummary = {
    syncRunId: 1,
    leadsSynced: 0,
    dealsSynced: 0,
    mode: "delta",
    modifiedAfter: null,
    finishedAt: "2026-05-10T00:00:00.000Z",
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

async function createCommentsApp(input: {
  userRole?: "leader" | "employee";
  paperclipCreateIssue?: (payload: unknown) => Promise<{
    id: string;
    identifier?: string | null;
    status?: string | null;
  }>;
} = {}) {
  const directory = mkdtempSync(join(tmpdir(), "bitrix24-comments-"));
  tempDirs.push(directory);
  const databaseUrl = `file:${join(directory, "reporting.sqlite")}`;
  const repository = createSqliteRepository({
    databaseUrl,
    defaultWonStageIds: ["C10:WON"]
  });
  const store = createSqliteAuthStore({ databaseUrl });
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
    login: "user@example.com",
    passwordHash: await hashPassword("correct-password"),
    now: new Date("2026-05-10T08:00:00.000Z")
  });
  await store.setModuleMembership({
    userId: user.id,
    moduleId: "attraction",
    role: input.userRole ?? "leader",
    status: "active",
    now: new Date("2026-05-10T08:00:00.000Z")
  });
  const auth = createPasswordAuthService({
    store,
    sessionSecret: "test-session-secret-with-at-least-32-bytes",
    cookieName: "b24dash_session",
    ttlHours: 12,
    secureCookie: false
  });
  const paperclip = {
    createIssue: vi.fn(
      input.paperclipCreateIssue ??
        (async () => ({
          id: "paperclip-issue-1",
          identifier: "BIT-42",
          status: "todo"
        }))
    ),
    getIssue: vi.fn(async ({ issueId }: { issueId: string }) => ({
      id: issueId,
      identifier: issueId === "paperclip-issue-1" ? "BIT-42" : "BIT-43",
      status: "in_progress"
    }))
  };
  const app = createApp(createMinimalService(), {
    auth,
    comments: repository,
    authStore: store,
    paperclip
  } as unknown as Parameters<typeof createApp>[1]);
  const agent = request.agent(app);
  const loginResponse = await agent
    .post("/api/auth/login")
    .send({ login: "user@example.com", password: "correct-password" })
    .expect(200);
  const csrfToken = loginResponse.body.csrfToken as string;

  return {
    app,
    agent,
    csrfToken,
    repository,
    store,
    paperclip
  };
}

function commentPayload(overrides: Record<string, unknown> = {}) {
  return {
    sceneId: "sales",
    x: 0.25,
    y: 0.5,
    text: "Проверь блок продаж user@example.com +7 999 111 22 33",
    anchor: {
      blockId: "sales-summary-card",
      blockLabel: "Выиграно",
      blockSelector: '[data-comment-block-id="sales-summary-card"]',
      blockRole: "section",
      elementSelector: "section:nth-of-type(2)",
      elementLabel: "Выиграно",
      relativeX: 0.1,
      relativeY: 0.2
    },
    context: {
      filters: {
        rangeStart: "2026-05-01T00:00:00.000+03:00",
        rangeEnd: "2026-05-10T23:59:59.999+03:00",
        managers: ["78"],
        sources: ["WEB"]
      }
    },
    ...overrides
  };
}

describe("dashboard comments to Paperclip", () => {
  it("returns module role and permissions from /api/auth/me", async () => {
    const { agent, store } = await createCommentsApp();

    await agent
      .get("/api/auth/me")
      .expect(200)
      .expect(({ body }) => {
        expect(body.user.id).toEqual(expect.any(Number));
        expect(body.user.modules).toEqual([
          expect.objectContaining({
            id: "attraction",
            slug: "attraction",
            role: "leader",
            permissions: expect.arrayContaining([
              "comments:create",
              "comments:archive",
              "module-users:manage"
            ])
          })
        ]);
      });

    store.close();
  });

  it("lets authenticated users update profile names and change their own password", async () => {
    const { app, agent, csrfToken, store } = await createCommentsApp();

    await agent
      .patch("/api/auth/me")
      .set("X-CSRF-Token", csrfToken)
      .send({ firstName: "Мария", lastName: "Потапова" })
      .expect(200)
      .expect(({ body }) => {
        expect(body.user).toEqual(
          expect.objectContaining({
            login: "user@example.com",
            firstName: "Мария",
            lastName: "Потапова"
          })
        );
      });

    await agent
      .post("/api/auth/change-password")
      .set("X-CSRF-Token", csrfToken)
      .send({
        currentPassword: "wrong-password",
        newPassword: "updated-password"
      })
      .expect(403)
      .expect(({ body }) => {
        expect(body.code).toBe("CURRENT_PASSWORD_INVALID");
      });

    await agent
      .post("/api/auth/change-password")
      .set("X-CSRF-Token", csrfToken)
      .send({
        currentPassword: "correct-password",
        newPassword: "updated-password"
      })
      .expect(204);

    const nextAgent = request.agent(app);
    await nextAgent
      .post("/api/auth/login")
      .send({ login: "user@example.com", password: "correct-password" })
      .expect(401);
    await agent
      .post("/api/auth/logout")
      .set("X-CSRF-Token", csrfToken)
      .expect(204);
    await nextAgent
      .post("/api/auth/login")
      .send({ login: "user@example.com", password: "updated-password" })
      .expect(200);

    store.close();
  });

  it("persists a comment first and marks it sent when Paperclip issue creation succeeds", async () => {
    const { agent, csrfToken, paperclip, store } = await createCommentsApp();

    await agent
      .post("/api/comments")
      .set("X-CSRF-Token", csrfToken)
      .send(commentPayload())
      .expect(201)
      .expect(({ body }) => {
        expect(body.comment.paperclipIssueId).toBe("paperclip-issue-1");
        expect(body.comment.paperclipIssueIdentifier).toBe("BIT-42");
        expect(body.comment.paperclipSyncStatus).toBe("sent");
        expect(body.comment.paperclipStatus).toBe("sent");
      });

    expect(paperclip.createIssue).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(paperclip.createIssue.mock.calls[0]?.[0])).not.toMatch(
      /user@example\.com|\+7 999/
    );

    await agent
      .get("/api/comment-notifications")
      .expect(200)
      .expect(({ body }) => {
        expect(body.notifications).toEqual([
          expect.objectContaining({
            paperclipIssueIdentifier: "BIT-42",
            status: "in_work"
          })
        ]);
      });

    store.close();
  });

  it("keeps failed Paperclip delivery visible and retries without losing the comment", async () => {
    const { agent, csrfToken, paperclip, store } = await createCommentsApp({
      paperclipCreateIssue: vi
        .fn()
        .mockRejectedValueOnce(new Error("Paperclip unavailable"))
        .mockResolvedValueOnce({
          id: "paperclip-issue-2",
          identifier: "BIT-43",
          status: "todo"
        })
    });

    const response = await agent
      .post("/api/comments")
      .set("X-CSRF-Token", csrfToken)
      .send(commentPayload({ text: "Проверь ошибку отправки" }))
      .expect(201);

    expect(response.body.comment.paperclipSyncStatus).toBe("failed");
    expect(response.body.comment.paperclipError).toContain("Paperclip unavailable");

    await agent
      .post(`/api/comments/${response.body.comment.id}/retry`)
      .set("X-CSRF-Token", csrfToken)
      .expect(200)
      .expect(({ body }) => {
        expect(body.comment.paperclipIssueIdentifier).toBe("BIT-43");
        expect(body.comment.paperclipSyncStatus).toBe("sent");
      });

    expect(paperclip.createIssue).toHaveBeenCalledTimes(2);
    store.close();
  });

  it("allows only module leaders to archive comments", async () => {
    const leader = await createCommentsApp({ userRole: "leader" });
    const created = await leader.agent
      .post("/api/comments")
      .set("X-CSRF-Token", leader.csrfToken)
      .send(commentPayload({ text: "Архивируемая заметка" }))
      .expect(201);

    await leader.agent
      .post(`/api/comments/${created.body.comment.id}/archive`)
      .set("X-CSRF-Token", leader.csrfToken)
      .expect(200)
      .expect(({ body }) => {
        expect(body.comment.status).toBe("archived");
      });

    leader.store.close();

    const employee = await createCommentsApp({ userRole: "employee" });
    const employeeComment = await employee.agent
      .post("/api/comments")
      .set("X-CSRF-Token", employee.csrfToken)
      .send(commentPayload({ text: "Нельзя архивировать" }))
      .expect(201);

    await employee.agent
      .post(`/api/comments/${employeeComment.body.comment.id}/archive`)
      .set("X-CSRF-Token", employee.csrfToken)
      .expect(403);

    employee.store.close();
  });

  it("allows only module leaders to manage module users", async () => {
    const leader = await createCommentsApp({ userRole: "leader" });

    const created = await leader.agent
      .post("/api/admin/module-users")
      .set("X-CSRF-Token", leader.csrfToken)
      .send({
        login: "employee@example.com",
        firstName: "Анна",
        lastName: "Егорова",
        password: "correct-password",
        role: "employee"
      })
      .expect(201);

    expect(created.body.user).toMatchObject({
      login: "employee@example.com",
      firstName: "Анна",
      lastName: "Егорова",
      moduleId: "attraction",
      moduleRole: "employee",
      membershipStatus: "active",
      disabled: false
    });

    await leader.agent
      .get("/api/admin/module-users")
      .expect(200)
      .expect(({ body }) => {
        expect(body.users).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              login: "employee@example.com",
              moduleRole: "employee"
            })
          ])
        );
      });

    await leader.agent
      .patch(`/api/admin/module-users/${created.body.user.id}`)
      .set("X-CSRF-Token", leader.csrfToken)
      .send({
        firstName: "Анна",
        lastName: "Петрова",
        role: "leader",
        password: "next-password"
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.user.firstName).toBe("Анна");
        expect(body.user.lastName).toBe("Петрова");
        expect(body.user.moduleRole).toBe("leader");
      });

    await leader.agent
      .delete(`/api/admin/module-users/${created.body.user.id}`)
      .set("X-CSRF-Token", leader.csrfToken)
      .expect(200)
      .expect(({ body }) => {
        expect(body.user.disabled).toBe(true);
        expect(body.user.membershipStatus).toBe("disabled");
      });

    const outsider = await leader.store.createUser({
      login: "outsider@example.com",
      firstName: null,
      lastName: null,
      passwordHash: await hashPassword("outsider-password")
    });
    await leader.agent
      .patch(`/api/admin/module-users/${outsider.id}`)
      .set("X-CSRF-Token", leader.csrfToken)
      .send({ firstName: "Вне", password: "changed-password" })
      .expect(404);
    await expect(leader.store.findUserByLogin("outsider@example.com")).resolves.toEqual(
      expect.objectContaining({
        firstName: null,
        lastName: null
      })
    );

    leader.store.close();

    const employee = await createCommentsApp({ userRole: "employee" });
    await employee.agent.get("/api/admin/module-users").expect(403);
    await employee.agent
      .post("/api/admin/module-users")
      .set("X-CSRF-Token", employee.csrfToken)
      .send({
        login: "blocked@example.com",
        password: "correct-password",
        role: "employee"
      })
      .expect(403);

    employee.store.close();
  });
});
