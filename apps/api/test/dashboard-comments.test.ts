import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../src/server/app";
import {
  createPasswordAuthService,
  createSqliteAuthStore,
  hashPassword
} from "../src/server/auth";
import type {
  CreatePaperclipIssueInput,
  PaperclipIssueResult
} from "../src/server/paperclip-client";
import { createSqliteRepository } from "../src/server/sqlite-repository";

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function createMinimalService() {
  return {} as unknown as Parameters<typeof createApp>[0];
}

type PaperclipCreateIssue = (
  input: CreatePaperclipIssueInput
) => Promise<PaperclipIssueResult>;
type PaperclipGetIssue = (issueId: string) => Promise<PaperclipIssueResult>;

async function createAuthenticatedApp(input: {
  paperclipCreateIssue?: PaperclipCreateIssue;
  paperclipGetIssue?: PaperclipGetIssue;
} = {}) {
  const directory = mkdtempSync(join(tmpdir(), "bitrix24-comments-"));
  tempDirs.push(directory);
  const databaseUrl = `file:${join(directory, "reporting.sqlite")}`;
  const repository = createSqliteRepository({
    databaseUrl,
    defaultWonStageIds: ["C10:WON"]
  });
  const authStore = createSqliteAuthStore({
    databaseUrl,
    defaultModuleConfig: {
      moduleKey: "attraction",
      paperclipCompanyId: "company-1",
      paperclipProjectId: "project-1",
      paperclipGoalId: "goal-1",
      paperclipTriageAgentId: "agent-triage"
    }
  });
  await authStore.createUser({
    login: "leader",
    passwordHash: await hashPassword("correct-password"),
    moduleMemberships: [{ moduleKey: "attraction", role: "leader" }],
    now: new Date("2026-05-07T10:00:00.000Z")
  });
  const auth = createPasswordAuthService({
    store: authStore,
    sessionSecret: "test-session-secret-with-at-least-32-bytes",
    cookieName: "b24dash_session",
    ttlHours: 12,
    secureCookie: false,
    now: () => new Date("2026-05-07T10:05:00.000Z")
  });
  const paperclipCreateIssue =
    input.paperclipCreateIssue ??
    vi.fn(async () => ({
      id: "paperclip-issue-1",
      identifier: "PAP-101",
      status: "todo"
    }));
  const app = createApp(createMinimalService(), {
    auth,
    comments: repository,
    paperclip: {
      createIssue: paperclipCreateIssue,
      ...(input.paperclipGetIssue ? { getIssue: input.paperclipGetIssue } : {})
    }
  });
  const agent = request.agent(app);
  const loginResponse = await agent
    .post("/api/auth/login")
    .send({ login: "leader", password: "correct-password" })
    .expect(200);

  return {
    agent,
    csrfToken: loginResponse.body.csrfToken as string,
    authStore,
    repository,
    paperclipCreateIssue,
    paperclipGetIssue: input.paperclipGetIssue
  };
}

describe("dashboard comments to Paperclip", () => {
  it("returns module memberships from auth and creates a Paperclip issue for saved comments", async () => {
    const { agent, csrfToken, authStore, repository, paperclipCreateIssue } =
      await createAuthenticatedApp();

    await agent
      .get("/api/auth/me")
      .expect(200)
      .expect(({ body }) => {
        expect(body.user).toMatchObject({
          id: expect.any(Number),
          login: "leader",
          modules: [
            {
              key: "attraction",
              label: "Привлечение",
              role: "leader",
              permissions: expect.arrayContaining([
                "comments:create",
                "comments:archive",
                "module-users:manage"
              ])
            }
          ]
        });
      });

    const createResponse = await agent
      .post("/api/comments")
      .set("X-CSRF-Token", csrfToken)
      .send({
        sceneId: "sales",
        x: 0.25,
        y: 0.5,
        text: "Проверь, почему этот блок не совпадает с планом. email test@example.com phone +7 999 111-22-33 token=secret",
        context: {
          range: {
            from: "2026-05-01T00:00:00.000+03:00",
            to: "2026-05-07T23:59:59.999+03:00"
          },
          filters: {
            managerIds: ["78"],
            sourceKeys: ["WEB"]
          }
        },
        anchor: {
          blockId: "sales-summary-card",
          blockLabel: "Выиграно test@example.com token=secret",
          blockSelector: '[data-comment-block-id="sales-summary-card"]',
          blockRole: "section",
          elementSelector: "section:nth-of-type(2)",
          elementLabel: "Выиграно",
          relativeX: 0.1,
          relativeY: 0.2
        }
      })
      .expect(201);

    expect(createResponse.body).toMatchObject({
      moduleKey: "attraction",
      authorLogin: "leader",
      sceneId: "sales",
      text: "Проверь, почему этот блок не совпадает с планом. email test@example.com phone +7 999 111-22-33 token=secret",
      paperclipStatus: "sent",
      paperclipIssueId: "paperclip-issue-1",
      paperclipIssueIdentifier: "PAP-101",
      anchor: expect.objectContaining({
        blockId: "sales-summary-card"
      })
    });

    expect(paperclipCreateIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "company-1",
        projectId: "project-1",
        goalId: "goal-1",
        assigneeAgentId: "agent-triage",
        title: expect.stringContaining("Комментарий из дашборда"),
        description: expect.stringContaining("sceneId: sales")
      })
    );
    const paperclipDescription =
      vi.mocked(paperclipCreateIssue).mock.calls[0]?.[0].description;
    const paperclipTitle = vi.mocked(paperclipCreateIssue).mock.calls[0]?.[0].title;
    if (!paperclipDescription) {
      throw new Error("Expected Paperclip issue description.");
    }
    expect(paperclipDescription).not.toMatch(
      /phone|email|webhook|token|cookie/i
    );
    expect(paperclipTitle).not.toMatch(/test@example|token=secret/i);

    await agent
      .get("/api/comment-notifications")
      .expect(200)
      .expect(({ body }) => {
        expect(body.notifications).toEqual([
          expect.objectContaining({
            id: createResponse.body.id,
            paperclipStatus: "sent",
            sceneId: "sales"
          })
        ]);
      });

    await agent
      .post(`/api/comments/${createResponse.body.id}/archive`)
      .set("X-CSRF-Token", csrfToken)
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe("archived");
        expect(body.archivedAt).toEqual(expect.any(String));
      });

    await expect(repository.getComments({ moduleKey: "attraction" })).resolves.toEqual([
      expect.objectContaining({
        id: createResponse.body.id,
        status: "archived",
        paperclipStatus: "sent"
      })
    ]);

    repository.close();
    authStore.close();
  });

  it("persists a failed Paperclip delivery without losing the comment", async () => {
    const { agent, csrfToken, authStore, repository } =
      await createAuthenticatedApp({
        paperclipCreateIssue: vi.fn(async () => {
          throw new Error("paperclip unavailable");
        })
      });

    const response = await agent
      .post("/api/comments")
      .set("X-CSRF-Token", csrfToken)
      .send({
        sceneId: "cohorts",
        x: 0.4,
        y: 0.6,
        text: "Нужно проверить когорту",
        anchor: {
          blockId: "cohort-matrix",
          blockLabel: "Когортная матрица",
          blockSelector: '[data-comment-block-id="cohort-matrix"]',
          blockRole: "section",
          elementSelector: "section:nth-of-type(1)",
          elementLabel: "Когортная матрица",
          relativeX: 0.4,
          relativeY: 0.6
        }
      })
      .expect(201);

    expect(response.body).toMatchObject({
      paperclipStatus: "failed",
      paperclipError: "paperclip unavailable",
      paperclipIssueId: null
    });

    await agent
      .get("/api/comment-notifications")
      .expect(200)
      .expect(({ body }) => {
        expect(body.notifications).toEqual([
          expect.objectContaining({
            id: response.body.id,
            paperclipStatus: "failed",
            paperclipError: "paperclip unavailable"
          })
        ]);
      });

    await expect(repository.getComments({ moduleKey: "attraction" })).resolves.toEqual([
      expect.objectContaining({
        id: response.body.id,
        text: "Нужно проверить когорту",
        paperclipStatus: "failed"
      })
    ]);

    repository.close();
    authStore.close();
  });

  it("retries failed Paperclip delivery without creating a new dashboard comment", async () => {
    const paperclipCreateIssue = vi
      .fn<PaperclipCreateIssue>()
      .mockRejectedValueOnce(new Error("paperclip unavailable"))
      .mockResolvedValueOnce({
        id: "paperclip-retry-issue",
        identifier: "PAP-202",
        status: "todo"
      });
    const { agent, csrfToken, authStore, repository } =
      await createAuthenticatedApp({ paperclipCreateIssue });

    const created = await agent
      .post("/api/comments")
      .set("X-CSRF-Token", csrfToken)
      .send({
        sceneId: "cohorts",
        x: 0.4,
        y: 0.6,
        text: "Нужно проверить когорту"
      })
      .expect(201);

    expect(created.body.paperclipStatus).toBe("failed");

    await agent
      .post(`/api/comments/${created.body.id}/retry`)
      .set("X-CSRF-Token", csrfToken)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: created.body.id,
          paperclipStatus: "sent",
          paperclipIssueId: "paperclip-retry-issue",
          paperclipIssueIdentifier: "PAP-202"
        });
      });

    expect(paperclipCreateIssue).toHaveBeenCalledTimes(2);
    await expect(repository.getComments({ moduleKey: "attraction" })).resolves.toHaveLength(1);

    repository.close();
    authStore.close();
  });

  it("refreshes cached comment notifications from Paperclip issue status", async () => {
    const paperclipGetIssue = vi.fn<PaperclipGetIssue>(async () => ({
      id: "paperclip-issue-1",
      identifier: "PAP-101",
      status: "in_progress"
    }));
    const { agent, csrfToken, authStore, repository } =
      await createAuthenticatedApp({ paperclipGetIssue });

    const created = await agent
      .post("/api/comments")
      .set("X-CSRF-Token", csrfToken)
      .send({
        sceneId: "sales",
        x: 0.1,
        y: 0.2,
        text: "Проверь блок"
      })
      .expect(201);

    await agent
      .get("/api/comment-notifications")
      .expect(200)
      .expect(({ body }) => {
        expect(body.notifications).toEqual([
          expect.objectContaining({
            id: created.body.id,
            paperclipStatus: "in_work"
          })
        ]);
      });

    expect(paperclipGetIssue).toHaveBeenCalledWith("paperclip-issue-1");

    repository.close();
    authStore.close();
  });

  it("allows leaders to manage module users while employees can only comment", async () => {
    const { agent, csrfToken, authStore, repository } =
      await createAuthenticatedApp();

    const createdUser = await agent
      .post("/api/admin/module-users")
      .set("X-CSRF-Token", csrfToken)
      .send({
        login: "employee",
        password: "employee-password",
        role: "employee"
      })
      .expect(201);

    expect(createdUser.body).toMatchObject({
      login: "employee",
      disabled: false,
      moduleRole: "employee"
    });

    await agent
      .get("/api/admin/module-users")
      .expect(200)
      .expect(({ body }) => {
        expect(body.users.map((user: { login: string }) => user.login)).toEqual([
          "employee",
          "leader"
        ]);
      });

    const employeeAgent = request.agent(
      createApp(createMinimalService(), {
        auth: createPasswordAuthService({
          store: authStore,
          sessionSecret: "test-session-secret-with-at-least-32-bytes",
          cookieName: "b24dash_session",
          ttlHours: 12,
          secureCookie: false,
          now: () => new Date("2026-05-07T10:05:00.000Z")
        }),
        comments: repository,
        paperclip: {
          createIssue: vi.fn(async () => ({
            id: "employee-issue",
            identifier: "PAP-102",
            status: "todo"
          }))
        }
      })
    );
    const employeeLogin = await employeeAgent
      .post("/api/auth/login")
      .send({ login: "employee", password: "employee-password" })
      .expect(200);

    await employeeAgent.get("/api/admin/module-users").expect(403);
    const employeeComment = await employeeAgent
      .post("/api/comments")
      .set("X-CSRF-Token", employeeLogin.body.csrfToken)
      .send({
        sceneId: "sales",
        x: 0.1,
        y: 0.2,
        text: "Комментарий сотрудника"
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.authorLogin).toBe("employee");
        expect(body.paperclipStatus).toBe("sent");
      });

    await agent
      .patch(`/api/comments/${employeeComment.body.id}`)
      .set("X-CSRF-Token", csrfToken)
      .send({ text: "Лидер переписал комментарий" })
      .expect(403);

    const outsider = await authStore.createUser({
      login: "outsider",
      passwordHash: await hashPassword("outsider-password"),
      moduleMemberships: []
    });

    await agent
      .patch(`/api/admin/module-users/${outsider.id}`)
      .set("X-CSRF-Token", csrfToken)
      .send({ disabled: true })
      .expect(404);
    await expect(authStore.findUserByLogin("outsider")).resolves.toMatchObject({
      disabled: false
    });

    repository.close();
    authStore.close();
  });
});
