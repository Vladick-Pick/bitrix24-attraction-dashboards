export interface PaperclipIssueInput {
  companyId: string;
  projectId: string | null;
  goalId: string | null;
  assigneeAgentId: string | null;
  title: string;
  description: string;
  priority?: "critical" | "high" | "medium" | "low";
}

export interface PaperclipIssue {
  id: string;
  identifier: string | null;
  status: string | null;
}

export type PaperclipReworkCommentMode = "board" | "service";

export interface PaperclipIssueComment {
  id: string;
  body: string;
  authorAgentId: string | null;
  authorUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaperclipIssueCommentInput {
  issueId: string;
  body: string;
  reopen?: boolean;
  origin?: "dashboard_rework" | "issue_comment";
}

export interface PaperclipIssueClient {
  createIssue(input: PaperclipIssueInput): Promise<PaperclipIssue>;
  getIssue(input: { issueId: string }): Promise<PaperclipIssue>;
  listIssueComments(input: { issueId: string }): Promise<PaperclipIssueComment[]>;
  addIssueComment(input: PaperclipIssueCommentInput): Promise<void>;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown) {
  const text = asString(value);
  return text || null;
}

function normalizeIssueComment(value: unknown): PaperclipIssueComment | null {
  const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const id = asString(data.id);
  const body = asString(data.body);
  const createdAt = asString(data.createdAt);

  if (!id || !body || !createdAt) {
    return null;
  }

  return {
    id,
    body,
    authorAgentId: asNullableString(data.authorAgentId),
    authorUserId: asNullableString(data.authorUserId),
    createdAt,
    updatedAt: asString(data.updatedAt) || createdAt
  };
}

export class PaperclipClient implements PaperclipIssueClient {
  readonly #apiUrl: string;
  readonly #apiToken: string;
  readonly #boardApiToken: string | null;
  readonly #reworkCommentMode: PaperclipReworkCommentMode;

  constructor(input: {
    apiUrl: string;
    apiToken: string;
    boardApiToken?: string | null;
    reworkCommentMode?: PaperclipReworkCommentMode;
  }) {
    this.#apiUrl = input.apiUrl.replace(/\/$/, "");
    this.#apiToken = input.apiToken;
    this.#boardApiToken = input.boardApiToken?.trim() || null;
    this.#reworkCommentMode = input.reworkCommentMode ?? "board";
  }

  #headers(input: { includeAuthorization: boolean; contentType?: boolean; apiToken?: string }) {
    return {
      Accept: "application/json",
      ...(input.includeAuthorization
        ? { Authorization: `Bearer ${input.apiToken ?? this.#apiToken}` }
        : {}),
      ...(input.contentType ? { "Content-Type": "application/json" } : {})
    };
  }

  async createIssue(input: PaperclipIssueInput): Promise<PaperclipIssue> {
    const response = await fetch(
      `${this.#apiUrl}/api/companies/${encodeURIComponent(input.companyId)}/issues`,
      {
        method: "POST",
        headers: this.#headers({
          includeAuthorization: true,
          contentType: true
        }),
        body: JSON.stringify({
          title: input.title,
          description: input.description,
          priority: input.priority ?? "medium",
          status: "todo",
          ...(input.projectId ? { projectId: input.projectId } : {}),
          ...(input.goalId ? { goalId: input.goalId } : {}),
          ...(input.assigneeAgentId
            ? { assigneeAgentId: input.assigneeAgentId }
            : {})
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Paperclip issue creation failed with ${response.status}`);
    }

    const body = (await response.json()) as unknown;
    const data = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

    return {
      id: asString(data.id),
      identifier: asString(data.identifier) || null,
      status: asString(data.status) || null
    };
  }

  async getIssue(input: { issueId: string }): Promise<PaperclipIssue> {
    const response = await fetch(
      `${this.#apiUrl}/api/issues/${encodeURIComponent(input.issueId)}`,
      {
        method: "GET",
        headers: this.#headers({ includeAuthorization: true })
      }
    );

    if (!response.ok) {
      throw new Error(`Paperclip issue fetch failed with ${response.status}`);
    }

    const body = (await response.json()) as unknown;
    const data = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

    return {
      id: asString(data.id),
      identifier: asString(data.identifier) || null,
      status: asString(data.status) || null
    };
  }

  async listIssueComments(input: { issueId: string }): Promise<PaperclipIssueComment[]> {
    const response = await fetch(
      `${this.#apiUrl}/api/issues/${encodeURIComponent(input.issueId)}/comments`,
      {
        method: "GET",
        headers: this.#headers({ includeAuthorization: true })
      }
    );

    if (!response.ok) {
      throw new Error(`Paperclip issue comments fetch failed with ${response.status}`);
    }

    const body = (await response.json()) as unknown;
    if (!Array.isArray(body)) {
      return [];
    }

    return body.flatMap((item) => {
      const comment = normalizeIssueComment(item);
      return comment ? [comment] : [];
    });
  }

  #dashboardReworkUsesBoardToken(input: PaperclipIssueCommentInput) {
    return (
      input.origin === "dashboard_rework" &&
      input.reopen === true &&
      this.#reworkCommentMode === "board"
    );
  }

  #issueCommentBody(input: PaperclipIssueCommentInput) {
    if (
      this.#dashboardReworkUsesBoardToken(input)
    ) {
      return {
        body: input.body,
        resume: true
      };
    }

    return {
      body: input.body,
      ...(input.reopen === undefined ? {} : { reopen: input.reopen })
    };
  }

  async addIssueComment(input: PaperclipIssueCommentInput): Promise<void> {
    const useBoardToken = this.#dashboardReworkUsesBoardToken(input);
    if (useBoardToken && !this.#boardApiToken) {
      throw new Error("Paperclip board API token is required for dashboard rework comments");
    }

    const response = await fetch(
      `${this.#apiUrl}/api/issues/${encodeURIComponent(input.issueId)}/comments`,
      {
        method: "POST",
        headers: this.#headers({
          includeAuthorization: true,
          contentType: true,
          ...(useBoardToken && this.#boardApiToken ? { apiToken: this.#boardApiToken } : {})
        }),
        body: JSON.stringify(this.#issueCommentBody(input))
      }
    );

    if (!response.ok) {
      throw new Error(`Paperclip issue comment failed with ${response.status}`);
    }
  }
}
