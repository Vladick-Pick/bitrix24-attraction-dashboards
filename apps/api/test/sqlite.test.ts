import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createSqliteRepository } from "../src/server/sqlite-repository";

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("createSqliteRepository", () => {
  it("initializes schema, persists won stage settings and tracks the latest sync cursor", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bitrix24-reporting-"));
    tempDirs.push(directory);

    const repository = createSqliteRepository({
      databaseUrl: `file:${join(directory, "reporting.db")}`,
      defaultWonStageIds: ["C1:WON"]
    });

    expect(await repository.getWonStageIds()).toEqual(["C1:WON"]);

    await repository.replaceStageCatalog([
      {
        entityType: "deal",
        categoryId: "1",
        statusId: "C1:WON",
        name: "Won",
        semanticId: "S"
      }
    ]);

    await repository.upsertLeads([
      {
        id: "L1",
        statusId: "NEW",
        sourceId: "WEB",
        opportunity: 1000,
        assignedById: null,
        dateCreate: "2026-04-01T00:00:00.000Z",
        dateModify: "2026-04-02T00:00:00.000Z",
        utmSource: "google",
        utmMedium: null,
        utmCampaign: null,
        utmContent: null,
        utmTerm: null
      }
    ]);

    await repository.upsertDeals([
      {
        id: "D1",
        leadId: "L1",
        categoryId: "1",
        stageId: "C1:WON",
        stageSemanticId: "S",
        opportunity: 1000,
        assignedById: null,
        dateCreate: "2026-04-01T00:00:00.000Z",
        dateModify: "2026-04-08T00:00:00.000Z",
        dateClosed: "2026-04-08T00:00:00.000Z",
        utmSource: "google",
        utmMedium: null,
        utmCampaign: null,
        utmContent: null,
        utmTerm: null
      }
    ]);

    expect(await repository.getLatestSuccessCursor()).toBe("2026-04-08T00:00:00.000Z");
    expect((await repository.getStageCatalog())[0]?.name).toBe("Won");

    await repository.setWonStageIds(["C1:PAID"]);
    expect(await repository.getWonStageIds()).toEqual(["C1:PAID"]);
  });
});
