import { describe, expect, it } from "vitest";

import { performManualSync } from "../src/domain/sync";

describe("performManualSync", () => {
  it("runs backfill first, then delta sync based on DATE_MODIFY and updates sync summary", async () => {
    const calls: Array<{ entity: string; modifiedAfter: string | null }> = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-07T00:00:00.000Z",
      replaceStageCatalog: async () => undefined,
      upsertLeads: async (rows: unknown[]) => rows.length,
      upsertDeals: async (rows: unknown[]) => rows.length,
      createSyncRun: async () => 17,
      finishSyncRun: async () => undefined
    };
    const client = {
      fetchLeadStages: async () => [],
      fetchDealStages: async () => [],
      listLeads: async (cursor: { modifiedAfter: string | null }) => {
        calls.push({ entity: "lead", modifiedAfter: cursor.modifiedAfter });
        return [
          {
            ID: "L1",
            DATE_CREATE: "2026-04-01T00:00:00.000Z",
            DATE_MODIFY: "2026-04-08T10:00:00.000Z",
            STATUS_ID: "NEW",
            SOURCE_ID: "WEB",
            OPPORTUNITY: 1000,
            ASSIGNED_BY_ID: "7",
            UTM_SOURCE: "google",
            UTM_MEDIUM: null,
            UTM_CAMPAIGN: null,
            UTM_CONTENT: null,
            UTM_TERM: null
          }
        ];
      },
      listDeals: async (cursor: { modifiedAfter: string | null }) => {
        calls.push({ entity: "deal", modifiedAfter: cursor.modifiedAfter });
        return [
          {
            ID: "D1",
            LEAD_ID: "L1",
            DATE_CREATE: "2026-04-01T00:00:00.000Z",
            DATE_MODIFY: "2026-04-08T10:00:00.000Z",
            DATE_CLOSED: null,
            CATEGORY_ID: "1",
            STAGE_ID: "C1:NEW",
            STAGE_SEMANTIC_ID: "P",
            OPPORTUNITY: 1000,
            ASSIGNED_BY_ID: "7",
            UTM_SOURCE: null,
            UTM_MEDIUM: null,
            UTM_CAMPAIGN: null,
            UTM_CONTENT: null,
            UTM_TERM: null
          }
        ];
      }
    };

    const result = await performManualSync({
      client,
      repository: repo,
      now: () => "2026-04-09T00:00:00.000Z"
    });

    expect(calls).toEqual([
      { entity: "lead", modifiedAfter: "2026-04-07T00:00:00.000Z" },
      { entity: "deal", modifiedAfter: "2026-04-07T00:00:00.000Z" }
    ]);
    expect(result).toEqual({
      syncRunId: 17,
      leadsSynced: 1,
      dealsSynced: 1,
      mode: "delta",
      modifiedAfter: "2026-04-07T00:00:00.000Z",
      finishedAt: "2026-04-09T00:00:00.000Z"
    });
  });

  it("falls back to full backfill when no successful cursor exists", async () => {
    const repo = {
      getLatestSuccessCursor: async () => null,
      replaceStageCatalog: async () => undefined,
      upsertLeads: async () => 0,
      upsertDeals: async () => 0,
      createSyncRun: async () => 1,
      finishSyncRun: async () => undefined
    };
    const cursors: Array<string | null> = [];
    const client = {
      fetchLeadStages: async () => [],
      fetchDealStages: async () => [],
      listLeads: async (cursor: { modifiedAfter: string | null }) => {
        cursors.push(cursor.modifiedAfter);
        return [];
      },
      listDeals: async (cursor: { modifiedAfter: string | null }) => {
        cursors.push(cursor.modifiedAfter);
        return [];
      }
    };

    const result = await performManualSync({
      client,
      repository: repo,
      now: () => "2026-04-09T00:00:00.000Z"
    });

    expect(cursors).toEqual([null, null]);
    expect(result.mode).toBe("full");
  });
});
