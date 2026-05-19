import { afterEach, describe, expect, it, vi } from "vitest";

import { PaperclipClient } from "../src/server/paperclip-client";

describe("PaperclipClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts dashboard rework comments with explicit Paperclip follow-up intent", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new PaperclipClient({
      apiUrl: "http://paperclip.local/",
      apiToken: "agent-token",
      boardApiToken: "board-token",
      reworkCommentMode: "board"
    });

    await client.addIssueComment({
      issueId: "issue-1",
      origin: "dashboard_rework",
      body: "Вернуть в работу",
      reopen: true
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit
    ];
    expect(url).toBe("http://paperclip.local/api/issues/issue-1/comments");
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer board-token");
    expect(JSON.parse(String(init.body))).toEqual({
      body: "Вернуть в работу",
      resume: true
    });
  });

  it("fails fast when board-mode rework has no board token", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new PaperclipClient({
      apiUrl: "http://paperclip.local/",
      apiToken: "agent-token",
      reworkCommentMode: "board"
    });

    await expect(
      client.addIssueComment({
        issueId: "issue-1",
        origin: "dashboard_rework",
        body: "Вернуть в работу",
        reopen: true
      })
    ).rejects.toThrow("Paperclip board API token is required");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps service-mode rework comments on the legacy reopen contract", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new PaperclipClient({
      apiUrl: "http://paperclip.local",
      apiToken: "agent-token",
      reworkCommentMode: "service"
    });

    await client.addIssueComment({
      issueId: "issue-1",
      origin: "dashboard_rework",
      body: "Вернуть в работу",
      reopen: true
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit
    ];
    expect(JSON.parse(String(init.body))).toEqual({
      body: "Вернуть в работу",
      reopen: true
    });
  });

  it("keeps generic issue comments on the configured service token", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new PaperclipClient({
      apiUrl: "http://paperclip.local",
      apiToken: "agent-token",
      reworkCommentMode: "board"
    });

    await client.addIssueComment({
      issueId: "issue-1",
      body: "Обычный комментарий"
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit
    ];
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer agent-token");
    expect(JSON.parse(String(init.body))).toEqual({
      body: "Обычный комментарий"
    });
  });

  it("preserves Paperclip issue comment conflict details for dashboard delivery errors", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: "Issue follow-up blocked by unresolved blockers"
          }),
          {
            status: 409,
            headers: {
              "Content-Type": "application/json"
            }
          }
        )
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new PaperclipClient({
      apiUrl: "http://paperclip.local",
      apiToken: "agent-token",
      boardApiToken: "board-token",
      reworkCommentMode: "board"
    });

    await expect(
      client.addIssueComment({
        issueId: "issue-1",
        origin: "dashboard_rework",
        body: "Вернуть в работу",
        reopen: true
      })
    ).rejects.toMatchObject({
      name: "PaperclipRequestError",
      status: 409,
      message: expect.stringContaining(
        "Issue follow-up blocked by unresolved blockers"
      )
    });
  });

  it("lists issue comments through the authenticated Paperclip API", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify([
            {
              id: "comment-1",
              body: "## Готово к проверке",
              authorAgentId: "agent-1",
              authorUserId: null,
              createdAt: "2026-05-13T12:00:00.000Z",
              updatedAt: "2026-05-13T12:01:00.000Z"
            }
          ]),
          { status: 200 }
        )
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new PaperclipClient({
      apiUrl: "http://paperclip.local",
      apiToken: "agent-token"
    });

    const comments = await client.listIssueComments({ issueId: "issue-1" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit
    ];
    expect(url).toBe("http://paperclip.local/api/issues/issue-1/comments");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer agent-token");
    expect(comments).toEqual([
      {
        id: "comment-1",
        body: "## Готово к проверке",
        authorAgentId: "agent-1",
        authorUserId: null,
        createdAt: "2026-05-13T12:00:00.000Z",
        updatedAt: "2026-05-13T12:01:00.000Z"
      }
    ]);
  });
});
