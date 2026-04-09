import type { StageCatalogEntry } from "@bitrix24-reporting/contracts";

import { buildDealListParams, buildLeadListParams } from "./selectors";
import {
  assertAllowedBitrixMethod,
  assertSafeSelectFields,
  redactWebhookUrl
} from "./security";

interface BitrixClientConfig {
  portalHost?: string;
  userId?: string;
  webhookToken?: string;
  timeoutMs: number;
}

interface BitrixResponse<T> {
  result?: T;
  next?: number;
  error?: string;
  error_description?: string;
}

interface LeadListRow {
  ID: string;
  DATE_CREATE: string;
  DATE_MODIFY: string;
  STATUS_ID: string;
  SOURCE_ID: string | null;
  OPPORTUNITY: number | null;
  ASSIGNED_BY_ID: string | null;
  UTM_SOURCE: string | null;
  UTM_MEDIUM: string | null;
  UTM_CAMPAIGN: string | null;
  UTM_CONTENT: string | null;
  UTM_TERM: string | null;
}

interface DealListRow {
  ID: string;
  LEAD_ID: string | null;
  DATE_CREATE: string;
  DATE_MODIFY: string;
  DATE_CLOSED?: string | null;
  CATEGORY_ID: string | null;
  STAGE_ID: string;
  STAGE_SEMANTIC_ID: string | null;
  OPPORTUNITY: number | null;
  ASSIGNED_BY_ID: string | null;
  UTM_SOURCE: string | null;
  UTM_MEDIUM: string | null;
  UTM_CAMPAIGN: string | null;
  UTM_CONTENT: string | null;
  UTM_TERM: string | null;
}

interface StatusRow {
  ENTITY_ID: string;
  STATUS_ID: string;
  NAME: string;
  EXTRA?: {
    SEMANTICS?: string | null;
    COLOR?: string | null;
  };
}

function delay(milliseconds: number) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, milliseconds);
  });
}

export class BitrixClient {
  private readonly baseUrl: string | null;

  constructor(private readonly config: BitrixClientConfig) {
    this.baseUrl =
      config.portalHost && config.userId && config.webhookToken
        ? `https://${config.portalHost}/rest/${config.userId}/${config.webhookToken}`
        : null;
  }

  private ensureConfigured() {
    if (!this.baseUrl) {
      throw new Error("Bitrix24 webhook credentials are not configured.");
    }
  }

  private async call<T>(method: string, params: Record<string, unknown>) {
    this.ensureConfigured();
    assertAllowedBitrixMethod(method);

    if (Array.isArray(params.select)) {
      assertSafeSelectFields(
        params.select.filter((value): value is string => typeof value === "string")
      );
    }

    const url = `${this.baseUrl}/${method}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(params),
        signal: controller.signal
      });

      const payload = (await response.json()) as BitrixResponse<T>;
      if (!response.ok || payload.error) {
        throw new Error(
          `Bitrix24 ${method} failed at ${redactWebhookUrl(url)}: ${
            payload.error_description ?? payload.error ?? response.statusText
          }`
        );
      }

      return payload;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async collectPagedList<T>(
    method: string,
    buildParams: (start: number) => Record<string, unknown>
  ) {
    const rows: T[] = [];
    let start = 0;

    while (true) {
      const response = await this.call<T[]>(method, buildParams(start));
      const page = response.result ?? [];
      rows.push(...page);

      if (page.length < 50) {
        break;
      }

      start += 50;
      await delay(this.config.timeoutMs === 0 ? 0 : 250);
    }

    return rows;
  }

  async listLeads(cursor: { modifiedAfter: string | null }) {
    return this.collectPagedList<LeadListRow>("crm.lead.list", (start) =>
      buildLeadListParams(
        cursor.modifiedAfter
          ? {
              modifiedAfter: cursor.modifiedAfter,
              start
            }
          : { start }
      )
    );
  }

  async listDeals(cursor: { modifiedAfter: string | null }) {
    return this.collectPagedList<DealListRow>("crm.deal.list", (start) =>
      buildDealListParams(
        cursor.modifiedAfter
          ? {
              modifiedAfter: cursor.modifiedAfter,
              start
            }
          : { start }
      )
    );
  }

  async fetchLeadStages(): Promise<StageCatalogEntry[]> {
    const response = await this.call<StatusRow[]>("crm.status.list", {
      filter: {
        ENTITY_ID: "STATUS"
      }
    });

    return (response.result ?? []).map((row) => ({
      entityType: "lead",
      categoryId: null,
      statusId: row.STATUS_ID,
      name: row.NAME,
      semanticId: row.EXTRA?.SEMANTICS ?? null
    }));
  }

  async fetchDealStages(): Promise<StageCatalogEntry[]> {
    const response = await this.call<StatusRow[]>("crm.status.list", {});

    return (response.result ?? [])
      .filter(
        (row) => row.ENTITY_ID === "DEAL_STAGE" || row.ENTITY_ID.startsWith("DEAL_STAGE_")
      )
      .map((row) => ({
        entityType: "deal",
        categoryId:
          row.ENTITY_ID === "DEAL_STAGE"
            ? "0"
            : row.ENTITY_ID.slice("DEAL_STAGE_".length),
        statusId: row.STATUS_ID,
        name: row.NAME,
        semanticId: row.EXTRA?.SEMANTICS ?? null
      }));
  }
}
