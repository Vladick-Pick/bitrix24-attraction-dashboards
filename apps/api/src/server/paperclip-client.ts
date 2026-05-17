export interface CreatePaperclipIssueInput {
  companyId: string;
  projectId: string;
  goalId: string;
  assigneeAgentId: string;
  title: string;
  description: string;
  priority?: "critical" | "high" | "medium" | "low";
}

export interface PaperclipIssueResult {
  id: string;
  identifier?: string | null;
  status?: string | null;
}

export interface PaperclipIssueCreator {
  createIssue(input: CreatePaperclipIssueInput): Promise<PaperclipIssueResult>;
  getIssue?(issueId: string): Promise<PaperclipIssueResult>;
}

export class PaperclipClient implements PaperclipIssueCreator {
  private readonly apiUrl: string;
  private readonly apiToken: string;

  constructor(input: { apiUrl: string; apiToken: string }) {
    this.apiUrl = input.apiUrl.replace(/\/+$/, "");
    this.apiToken = input.apiToken;
  }

  async createIssue(input: CreatePaperclipIssueInput): Promise<PaperclipIssueResult> {
    const response = await fetch(
      `${this.apiUrl}/api/companies/${encodeURIComponent(input.companyId)}/issues`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: input.title,
          description: input.description,
          priority: input.priority ?? "medium",
          status: "todo",
          projectId: input.projectId,
          goalId: input.goalId,
          assigneeAgentId: input.assigneeAgentId
        })
      }
    );

    if (!response.ok) {
      throw new Error(`PAPERCLIP_CREATE_ISSUE_FAILED_${response.status}`);
    }

    const data = (await response.json()) as Partial<PaperclipIssueResult>;
    if (!data.id) {
      throw new Error("PAPERCLIP_CREATE_ISSUE_INVALID_RESPONSE");
    }

    return {
      id: data.id,
      identifier: data.identifier ?? null,
      status: data.status ?? null
    };
  }

  async getIssue(issueId: string): Promise<PaperclipIssueResult> {
    const response = await fetch(
      `${this.apiUrl}/api/issues/${encodeURIComponent(issueId)}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.apiToken}`,
          "Accept": "application/json"
        }
      }
    );

    if (!response.ok) {
      throw new Error(`PAPERCLIP_GET_ISSUE_FAILED_${response.status}`);
    }

    const data = (await response.json()) as Partial<PaperclipIssueResult>;
    if (!data.id) {
      throw new Error("PAPERCLIP_GET_ISSUE_INVALID_RESPONSE");
    }

    return {
      id: data.id,
      identifier: data.identifier ?? null,
      status: data.status ?? null
    };
  }
}
