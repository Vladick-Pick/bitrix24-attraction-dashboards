import { describe, expect, it } from "vitest";

import type { DealSnapshot, StageCatalogEntry } from "@bitrix24-reporting/contracts";
import { buildTargetGroupConversionReport } from "../src/domain/operational-reports";

const range = {
  from: "2026-04-01T00:00:00.000Z",
  to: "2026-04-30T23:59:59.999Z"
};

const stageCatalog: StageCatalogEntry[] = [
  {
    entityType: "deal",
    categoryId: "10",
    statusId: "C10:WON",
    name: "Выиграно",
    semanticId: "S",
    sortOrder: 100
  },
  {
    entityType: "deal",
    categoryId: "10",
    statusId: "C10:NEW",
    name: "База входящая",
    semanticId: "P",
    sortOrder: 10
  }
];

function deal(input: Partial<DealSnapshot> & Pick<DealSnapshot, "id">): DealSnapshot {
  return {
    id: input.id,
    title: null,
    leadId: null,
    categoryId: "10",
    stageId: "C10:NEW",
    stageSemanticId: "P",
    opportunity: 0,
    assignedById: "78",
    sourceId: "WEB",
    qualityValue: null,
    businessClubValue: null,
    targetGroupValue: "ClubFirst",
    meetingTypeValue: null,
    tariffValue: null,
    refusalReasonValue: null,
    refusalReasonDetail: null,
    dateCreate: "2026-04-05T10:00:00.000Z",
    dateModify: "2026-04-05T10:00:00.000Z",
    dateClosed: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    utmTerm: null,
    ...input
  };
}

describe("buildTargetGroupConversionReport", () => {
  it("aggregates created, won, revenue and cycle metrics by target group", () => {
    const report = buildTargetGroupConversionReport({
      range,
      wonStageIds: ["C10:WON"],
      deals: [
        deal({
          id: "D1",
          targetGroupValue: "ClubFirst",
          stageId: "C10:WON",
          stageSemanticId: "S",
          opportunity: 120000,
          dateCreate: "2026-04-01T10:00:00.000Z",
          dateClosed: "2026-04-11T10:00:00.000Z"
        }),
        deal({
          id: "D2",
          targetGroupValue: "ClubFirst",
          stageId: "C10:NEW",
          stageSemanticId: "P",
          opportunity: 100000,
          dateCreate: "2026-04-02T10:00:00.000Z"
        }),
        deal({
          id: "D3",
          targetGroupValue: "ClubFuture",
          stageId: "C10:WON",
          stageSemanticId: "S",
          opportunity: 80000,
          dateCreate: "2026-04-03T10:00:00.000Z",
          dateClosed: "2026-04-08T10:00:00.000Z"
        })
      ],
      stageCatalog,
      stageHistory: []
    });

    expect(report.totalCreatedDeals).toBe(3);
    expect(report.totalWonDeals).toBe(2);
    expect(report.rows).toEqual([
      {
        targetGroupKey: "ClubFirst",
        targetGroupLabel: "ClubFirst",
        createdDeals: 2,
        wonDeals: 1,
        winRate: 0.5,
        salesAmount: 120000,
        averageSaleAmount: 120000,
        averageCycleDays: 10
      },
      {
        targetGroupKey: "ClubFuture",
        targetGroupLabel: "ClubFuture",
        createdDeals: 1,
        wonDeals: 1,
        winRate: 1,
        salesAmount: 80000,
        averageSaleAmount: 80000,
        averageCycleDays: 5
      }
    ]);
  });
});
