import { describe, expect, it } from "vitest";

import type {
  DealSnapshot,
  ManagerDirectoryEntry,
  StageCatalogEntry,
  StageHistorySnapshot
} from "@bitrix24-reporting/contracts";
import { buildAcquisitionOutcomesReport } from "../src/domain/operational-reports";

const range = {
  from: "2026-04-01T00:00:00.000Z",
  to: "2026-04-30T23:59:59.999Z"
};

const stageCatalog: StageCatalogEntry[] = [
  {
    entityType: "deal",
    categoryId: "10",
    statusId: "C10:NEW",
    name: "База входящая",
    semanticId: "P",
    sortOrder: 10
  },
  {
    entityType: "deal",
    categoryId: "10",
    statusId: "C10:LOSE",
    name: "Корзина",
    semanticId: "F",
    sortOrder: 90
  },
  {
    entityType: "deal",
    categoryId: "10",
    statusId: "C10:RETURN",
    name: "Возврат в Лидген(неквал)",
    semanticId: "F",
    sortOrder: 100
  },
  {
    entityType: "source",
    categoryId: null,
    statusId: "WEB",
    name: "Сайт",
    semanticId: null,
    sortOrder: 10
  },
  {
    entityType: "source",
    categoryId: null,
    statusId: "PARTNER",
    name: "Партнеры",
    semanticId: null,
    sortOrder: 20
  }
];

const managerDirectory: ManagerDirectoryEntry[] = [
  { id: "78", name: "Егоров Андрей" },
  { id: "11234", name: "Ромашова Ольга" }
];

function deal(input: Partial<DealSnapshot> & Pick<DealSnapshot, "id">): DealSnapshot {
  return {
    leadId: null,
    categoryId: "10",
    stageId: "C10:NEW",
    stageSemanticId: "P",
    opportunity: null,
    assignedById: "78",
    sourceId: "WEB",
    qualityValue: "Готов ко встрече",
    businessClubValue: "ClubOne",
    targetGroupValue: "ClubFirst",
    meetingTypeValue: "Очная",
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

function stageHistory(
  input: Partial<StageHistorySnapshot> & Pick<StageHistorySnapshot, "id" | "ownerId">
): StageHistorySnapshot {
  return {
    categoryId: "10",
    stageId: "C10:LOSE",
    stageSemanticId: "F",
    typeId: null,
    createdTime: "2026-05-05T10:00:00.000Z",
    ...input
  };
}

describe("buildAcquisitionOutcomesReport", () => {
  it("groups outcomes by period and customer workload by open funnel deals", () => {
    const report = buildAcquisitionOutcomesReport({
      range,
      deals: [
        deal({ id: "D1", assignedById: "78", sourceId: "WEB", qualityValue: "Готов ко встрече" }),
        deal({ id: "D2", assignedById: "78", sourceId: "PARTNER", qualityValue: "Готов к коммуникации" }),
        deal({ id: "D3", assignedById: "11234", sourceId: "WEB", qualityValue: null }),
        deal({
          id: "D4",
          assignedById: "78",
          sourceId: "WEB",
          stageId: "C10:LOSE",
          stageSemanticId: "F",
          refusalReasonValue: "Клиенту не интересен формат",
          dateCreate: "2026-03-20T10:00:00.000Z",
          dateModify: "2026-04-08T10:00:00.000Z",
          dateClosed: "2026-04-08T10:00:00.000Z"
        }),
        deal({
          id: "D5",
          assignedById: "78",
          sourceId: "WEB",
          businessClubValue: "ClubTwo",
          stageId: "C10:RETURN",
          stageSemanticId: "F",
          refusalReasonValue: "Не дозвонились в течении месяца/нет телефона",
          dateCreate: "2026-03-21T10:00:00.000Z",
          dateModify: "2026-04-09T10:00:00.000Z",
          dateClosed: "2026-04-09T10:00:00.000Z"
        }),
        deal({
          id: "D6",
          assignedById: "11234",
          sourceId: "PARTNER",
          businessClubValue: "ClubThree",
          stageId: "C10:LOSE",
          stageSemanticId: "F",
          refusalReasonValue: "Клиенту не интересен формат",
          dateCreate: "2026-03-22T10:00:00.000Z",
          dateModify: "2026-04-10T10:00:00.000Z",
          dateClosed: "2026-04-10T10:00:00.000Z"
        }),
        deal({
          id: "D7",
          categoryId: "28",
          assignedById: "78",
          sourceId: "WEB",
          stageId: "C28:LOSE",
          stageSemanticId: "F",
          refusalReasonValue: "Должно быть вне скоупа",
          dateCreate: "2026-04-05T10:00:00.000Z",
          dateModify: "2026-04-10T10:00:00.000Z",
          dateClosed: "2026-04-10T10:00:00.000Z"
        }),
        deal({
          id: "D8",
          assignedById: "78",
          businessClubValue: "ClubTwo",
          targetGroupValue: "ClubFuture",
          dateCreate: "2026-03-05T10:00:00.000Z",
          dateModify: "2026-04-10T10:00:00.000Z"
        }),
        deal({
          id: "D9",
          assignedById: "11234",
          businessClubValue: "ClubThree",
          targetGroupValue: "395454",
          dateCreate: "2026-03-06T10:00:00.000Z",
          dateModify: "2026-04-10T10:00:00.000Z"
        })
      ],
      stageCatalog,
      managerDirectory
    });

    expect(report.totalNewDeals).toBe(3);
    expect(report.totalLostDeals).toBe(3);
    expect(report.businessClubByManager).toEqual([
      {
        managerId: "78",
        managerName: "Егоров Андрей",
        totalDeals: 3,
        businessClubs: [
          {
            businessClubKey: "ClubOne",
            businessClubLabel: "ClubOne",
            count: 2
          },
          {
            businessClubKey: "ClubTwo",
            businessClubLabel: "ClubTwo",
            count: 1
          }
        ],
        targetGroups: [
          {
            targetGroupKey: "ClubFirst",
            targetGroupLabel: "ClubFirst",
            count: 2
          },
          {
            targetGroupKey: "ClubFuture",
            targetGroupLabel: "ClubFuture",
            count: 1
          }
        ]
      },
      {
        managerId: "11234",
        managerName: "Ромашова Ольга",
        totalDeals: 2,
        businessClubs: [
          {
            businessClubKey: "ClubOne",
            businessClubLabel: "ClubOne",
            count: 1
          },
          {
            businessClubKey: "ClubThree",
            businessClubLabel: "ClubThree",
            count: 1
          }
        ],
        targetGroups: [
          {
            targetGroupKey: "UNSPECIFIED",
            targetGroupLabel: "Без таргет-группы",
            count: 1
          },
          {
            targetGroupKey: "ClubFirst",
            targetGroupLabel: "ClubFirst",
            count: 1
          }
        ]
      }
    ]);
    expect(report.newDealsByManager[0]).toEqual({
      managerId: "78",
      managerName: "Егоров Андрей",
      totalNewDeals: 2,
      sources: [
        {
          sourceKey: "PARTNER",
          sourceLabel: "Партнеры",
          totalNewDeals: 1,
          qualities: [
            {
              qualityKey: "Готов к коммуникации",
              qualityLabel: "Готов к коммуникации",
              count: 1
            }
          ]
        },
        {
          sourceKey: "WEB",
          sourceLabel: "Сайт",
          totalNewDeals: 1,
          qualities: [
            {
              qualityKey: "Готов ко встрече",
              qualityLabel: "Готов ко встрече",
              count: 1
            }
          ]
        }
      ]
    });
    expect(report.newDealsByManager[1]).toMatchObject({
      managerId: "11234",
      managerName: "Ромашова Ольга",
      totalNewDeals: 1,
      sources: [
        {
          sourceKey: "WEB",
          sourceLabel: "Сайт",
          qualities: [
            {
              qualityKey: "UNQUALIFIED",
              qualityLabel: "Без итогового качества",
              count: 1
            }
          ]
        }
      ]
    });
    expect(report.lostStages).toEqual([
      {
        stageId: "C10:LOSE",
        stageName: "Корзина",
        count: 2
      },
      {
        stageId: "C10:RETURN",
        stageName: "Возврат в Лидген(неквал)",
        count: 1
      }
    ]);
    expect(report.lostDealsByManager).toEqual([
      {
        managerId: "78",
        managerName: "Егоров Андрей",
        totalLostDeals: 2,
        stages: [
          { stageId: "C10:LOSE", stageName: "Корзина", count: 1 },
          { stageId: "C10:RETURN", stageName: "Возврат в Лидген(неквал)", count: 1 }
        ]
      },
      {
        managerId: "11234",
        managerName: "Ромашова Ольга",
        totalLostDeals: 1,
        stages: [{ stageId: "C10:LOSE", stageName: "Корзина", count: 1 }]
      }
    ]);
    expect(report.topLossReasons).toEqual([
      {
        stageId: "C10:LOSE",
        stageName: "Корзина",
        managerId: "78",
        managerName: "Егоров Андрей",
        reasonKey: "Клиенту не интересен формат",
        reasonLabel: "Клиенту не интересен формат",
        count: 1
      },
      {
        stageId: "C10:LOSE",
        stageName: "Корзина",
        managerId: "11234",
        managerName: "Ромашова Ольга",
        reasonKey: "Клиенту не интересен формат",
        reasonLabel: "Клиенту не интересен формат",
        count: 1
      },
      {
        stageId: "C10:RETURN",
        stageName: "Возврат в Лидген(неквал)",
        managerId: "78",
        managerName: "Егоров Андрей",
        reasonKey: "Не дозвонились в течении месяца/нет телефона",
        reasonLabel: "Не дозвонились в течении месяца/нет телефона",
        count: 1
      }
    ]);
    expect(report.lostDealDetails).toEqual([
      {
        dealId: "D4",
        managerId: "78",
        managerName: "Егоров Андрей",
        sourceKey: "WEB",
        sourceLabel: "Сайт",
        businessClubValue: "ClubOne",
        stageId: "C10:LOSE",
        stageName: "Корзина",
        reasonKey: "Клиенту не интересен формат",
        reasonLabel: "Клиенту не интересен формат",
        reasonDetail: null
      },
      {
        dealId: "D6",
        managerId: "11234",
        managerName: "Ромашова Ольга",
        sourceKey: "PARTNER",
        sourceLabel: "Партнеры",
        businessClubValue: "ClubThree",
        stageId: "C10:LOSE",
        stageName: "Корзина",
        reasonKey: "Клиенту не интересен формат",
        reasonLabel: "Клиенту не интересен формат",
        reasonDetail: null
      },
      {
        dealId: "D5",
        managerId: "78",
        managerName: "Егоров Андрей",
        sourceKey: "WEB",
        sourceLabel: "Сайт",
        businessClubValue: "ClubTwo",
        stageId: "C10:RETURN",
        stageName: "Возврат в Лидген(неквал)",
        reasonKey: "Не дозвонились в течении месяца/нет телефона",
        reasonLabel: "Не дозвонились в течении месяца/нет телефона",
        reasonDetail: null
      }
    ]);
  });

  it("dates lost basket counts by the terminal stage transition instead of later deal modification", () => {
    const historicalBasketDeal = deal({
      id: "D10",
      assignedById: "78",
      sourceId: "WEB",
      stageId: "C10:LOSE",
      stageSemanticId: "F",
      dateCreate: "2026-04-15T10:00:00.000Z",
      dateModify: "2026-05-05T10:00:00.000Z",
      dateClosed: null
    });
    const currentBasketDeal = deal({
      id: "D11",
      assignedById: "78",
      sourceId: "WEB",
      stageId: "C10:LOSE",
      stageSemanticId: "F",
      dateCreate: "2026-05-02T10:00:00.000Z",
      dateModify: "2026-05-06T10:00:00.000Z",
      dateClosed: null
    });
    const deals = [historicalBasketDeal, currentBasketDeal];
    const history = [
      stageHistory({
        id: "SH10",
        ownerId: "D10",
        createdTime: "2026-04-20T10:00:00.000Z"
      }),
      stageHistory({
        id: "SH11",
        ownerId: "D11",
        createdTime: "2026-05-06T10:00:00.000Z"
      })
    ];

    const mayWeekReport = buildAcquisitionOutcomesReport({
      range: {
        from: "2026-05-04T00:00:00.000Z",
        to: "2026-05-10T23:59:59.999Z"
      },
      deals,
      stageCatalog,
      managerDirectory,
      stageHistory: history
    });
    const aprilWeekReport = buildAcquisitionOutcomesReport({
      range: {
        from: "2026-04-20T00:00:00.000Z",
        to: "2026-04-26T23:59:59.999Z"
      },
      deals,
      stageCatalog,
      managerDirectory,
      stageHistory: history
    });

    expect(mayWeekReport.lostStages).toEqual([
      {
        stageId: "C10:LOSE",
        stageName: "Корзина",
        count: 1
      }
    ]);
    expect(mayWeekReport.lostDealDetails.map((row) => row.dealId)).toEqual(["D11"]);
    expect(aprilWeekReport.lostStages).toEqual([
      {
        stageId: "C10:LOSE",
        stageName: "Корзина",
        count: 1
      }
    ]);
    expect(aprilWeekReport.lostDealDetails.map((row) => row.dealId)).toEqual(["D10"]);
  });
});
