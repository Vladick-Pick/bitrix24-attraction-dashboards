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

export interface PaperclipIssueClient {
  createIssue(input: PaperclipIssueInput): Promise<PaperclipIssue>;
  getIssue(input: { issueId: string }): Promise<PaperclipIssue>;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export class PaperclipClient implements PaperclipIssueClient {
  readonly #apiUrl: string;
  readonly #apiToken: string;

  constructor(input: { apiUrl: string; apiToken: string }) {
    this.#apiUrl = input.apiUrl.replace(/\/$/, "");
    this.#apiToken = input.apiToken;
  }

  async createIssue(input: PaperclipIssueInput): Promise<PaperclipIssue> {
    const response = await fetch(
      `${this.#apiUrl}/api/companies/${encodeURIComponent(input.companyId)}/issues`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.#apiToken}`,
          "Content-Type": "application/json"
        },
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
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.#apiToken}`
        }
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
}
