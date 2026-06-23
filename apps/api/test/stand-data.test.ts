import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createReportingService } from "../src/server/service";
import { createSqliteRepository } from "../src/server/sqlite-repository";
import { seedStandData } from "../src/tools/stand-data";

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function assertNoVisibleStandMarkers(value: unknown) {
  expect(JSON.stringify(value)).not.toMatch(
    /demo|fake|synthetic|фейк|тестов|демо/i
  );
}

describe("seedStandData", () => {
  it("creates a production-like populated stand without visible demo markers", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bitrix24-reporting-stand-"));
    tempDirs.push(directory);
    const repository = createSqliteRepository({
      databaseUrl: `file:${join(directory, "attraction.db")}`,
      defaultWonStageIds: ["C10:WON"]
    });

    await seedStandData({
      repository,
      now: new Date("2026-06-22T09:00:00.000Z")
    });
    await seedStandData({
      repository,
      now: new Date("2026-06-22T09:00:00.000Z")
    });

    const service = createReportingService({
      dealCategoryIds: ["10"],
      leadgenCategoryId: "28",
      leadgenManagerIds: [],
      qualityFieldName: "UF_CRM_1730380390",
      tariffFieldName: "UF_CRM_1643901145",
      businessClubFieldName: "UF_CRM_1747682957",
      meetingTypeFieldName: "UF_CRM_1669784114991",
      meetingDateFieldName: "UF_CRM_1669784197394",
      repository,
      client: {} as never,
      defaultPeriodDays: 30,
      bootstrapLookbackDays: 365,
      now: () => new Date("2026-06-22T09:00:00.000Z")
    });

    const meta = await service.getMeta();
    const dashboard = await service.getDashboard({ periodDays: 90 });
    const cohorts = await service.getCohortConversionReport({
      includeBreakdown: true
    });
    const calls = await service.getCallsWorkloadReport({ periodDays: 90 });
    const actionOutcomes = await service.getManagerActionOutcomeReport({});
    const conversionEvents = await service.getConversionEventsReport({ periodDays: 180 });
    const unitEconomics = await service.getUnitEconomicsReport({ periodDays: 180 });
    const salesPlanQuarter = await service.getSalesPlanQuarter({
      year: 2026,
      quarter: 2
    });
    const queue = await service.getCallAnalysisQueue({ periodDays: 90 });
    const lifecycleCardsWithConversionEvents = actionOutcomes.cohortStatusRows
      .flatMap((row) => row.dealDetails)
      .filter((detail) =>
        detail.lifecycleCard?.stageTimeline.some((stage) =>
          stage.events.some(
            (event) =>
              event.id.startsWith("conversion-event-visit:") &&
              Boolean(event.badgeLabel)
          )
        )
      );

    expect(meta.syncHealth.status).toBe("ready");
    expect(meta.snapshotStats.deals).toBeGreaterThanOrEqual(240);
    expect(dashboard.salesSummary.newDealsCount).toBeGreaterThan(0);
    expect(dashboard.salesSummary.attractionRevenueAmount).toBeGreaterThan(0);
    expect(dashboard.managerGroups.length).toBeGreaterThan(0);
    expect(cohorts.rows.length).toBeGreaterThan(0);
    expect(calls.totalCalls).toBeGreaterThanOrEqual(1_000);
    expect(calls.managerRows.length).toBeGreaterThanOrEqual(6);
    expect(calls.managerRows.every((row) => row.totalCalls >= 100)).toBe(true);
    expect(actionOutcomes.cohortStatusRows.length).toBeGreaterThan(0);
    expect(conversionEvents.totalInvitedCount).toBeGreaterThanOrEqual(180);
    expect(conversionEvents.totalAttendedCount).toBeGreaterThanOrEqual(60);
    expect(lifecycleCardsWithConversionEvents.length).toBeGreaterThanOrEqual(160);
    expect(unitEconomics.summary.attractionRevenue).toBeGreaterThan(0);
    expect(unitEconomics.summary.contributionResult).toBeGreaterThan(0);
    expect(unitEconomics.summary.netProfit).toBeGreaterThan(0);
    expect(unitEconomics.managerRows.every((row) => row.financialResult > 0)).toBe(
      true
    );
    expect(salesPlanQuarter.rows.length).toBeGreaterThanOrEqual(18);
    expect(
      salesPlanQuarter.rows.every(
        (row) => row.quarterPlannedDeals > 0 && row.quarterPlannedAmount > 0
      )
    ).toBe(true);
    expect(queue.totals.ready).toBeGreaterThanOrEqual(180);

    assertNoVisibleStandMarkers({
      meta,
      dashboard,
      cohorts,
      calls,
      actionOutcomes,
      conversionEvents,
      unitEconomics,
      salesPlanQuarter,
      queue
    });
  });
});
