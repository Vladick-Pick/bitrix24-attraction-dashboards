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

export interface PaperclipIssueCommentInput {
  issueId: string;
  body: string;
  reopen?: boolean;
  origin?: "dashboard_rework" | "issue_comment";
}

export interface PaperclipIssueClient {
  createIssue(input: PaperclipIssueInput): Promise<PaperclipIssue>;
  getIssue(input: { issueId: string }): Promise<PaperclipIssue>;
  addIssueComment(input: PaperclipIssueCommentInput): Promise<void>;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export class PaperclipClient implements PaperclipIssueClient {
  readonly #apiUrl: string;
  readonly #apiToken: string;
  readonly #reworkCommentMode: PaperclipReworkCommentMode;

  constructor(input: {
    apiUrl: string;
    apiToken: string;
    reworkCommentMode?: PaperclipReworkCommentMode;
  }) {
    this.#apiUrl = input.apiUrl.replace(/\/$/, "");
    this.#apiToken = input.apiToken;
    this.#reworkCommentMode = input.reworkCommentMode ?? "board";
  }

  #headers(input: { includeAuthorization: boolean; contentType?: boolean }) {
    return {
      Accept: "application/json",
      ...(input.includeAuthorization
        ? { Authorization: `Bearer ${this.#apiToken}` }
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

  async addIssueComment(input: PaperclipIssueCommentInput): Promise<void> {
    const boardOriginated =
      input.origin === "dashboard_rework" && this.#reworkCommentMode === "board";
    const response = await fetch(
      `${this.#apiUrl}/api/issues/${encodeURIComponent(input.issueId)}/comments`,
      {
        method: "POST",
        headers: this.#headers({
          includeAuthorization: !boardOriginated,
          contentType: true
        }),
        body: JSON.stringify({
          body: input.body,
          ...(input.reopen === undefined ? {} : { reopen: input.reopen }),
          ...(boardOriginated ? { interrupt: true } : {})
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Paperclip issue comment failed with ${response.status}`);
    }
  }
}
