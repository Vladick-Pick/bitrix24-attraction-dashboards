import { afterEach, describe, expect, it, vi } from "vitest";

import { PaperclipClient } from "../src/server/paperclip-client";

describe("PaperclipClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts dashboard rework comments as authenticated dashboard system requests", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new PaperclipClient({
      apiUrl: "http://paperclip.local/",
      apiToken: "agent-token",
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
    expect(headers.get("Authorization")).toBe("Bearer agent-token");
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
});
