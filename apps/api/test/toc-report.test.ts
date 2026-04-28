import { describe, expect, it } from "vitest";
import type { StageCatalogEntry } from "@bitrix24-reporting/contracts";

import { buildTocFlowReport } from "../src/domain/toc-report";

const range = {
  from: "2026-04-01T00:00:00.000Z",
  to: "2026-04-10T23:59:59.999Z"
} as const;

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
    statusId: "C10:PREPARATION",
    name: "Звонок-знакомство",
    semanticId: "P",
    sortOrder: 20
  },
  {
    entityType: "deal",
    categoryId: "10",
    statusId: "C10:DEMO",
    name: "Демонстрация",
    semanticId: "P",
    sortOrder: 30
  },
  {
    entityType: "deal",
    categoryId: "10",
    statusId: "C10:WON",
    name: "Успешно реализовано",
    semanticId: "S",
    sortOrder: 40
  },
  {
    entityType: "deal",
    categoryId: "10",
    statusId: "C10:LOSE",
    name: "Проиграно",
    semanticId: "F",
    sortOrder: 50
  }
];

function createDeal(params: {
  id: string;
  stageId: string;
  stageSemanticId: string;
  dateCreate: string;
  dateModify: string;
  dateClosed?: string | null;
}) {
  return {
    id: params.id,
    leadId: null,
    categoryId: "10",
    stageId: params.stageId,
    stageSemanticId: params.stageSemanticId,
    opportunity: 10_000,
    assignedById: "7",
    sourceId: "WEB",
    qualityValue: null,
    dateCreate: params.dateCreate,
    dateModify: params.dateModify,
    dateClosed: params.dateClosed ?? null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    utmTerm: null
  };
}

function createHistory(
  id: string,
  ownerId: string,
  stageId: string,
  stageSemanticId: string,
  createdTime: string
) {
  return {
    id,
    ownerId,
    categoryId: "10",
    stageId,
    stageSemanticId,
    typeId: null,
    createdTime
  };
}

function getRow(
  result: ReturnType<typeof buildTocFlowReport>,
  stageId: string
) {
  const row = result.rows.find((item) => item.stageId === stageId);
  expect(row).toBeDefined();
  return row!;
}

describe("buildTocFlowReport", () => {
  it("treats an active stage with queue and zero throughput as the bottleneck", () => {
    const result = buildTocFlowReport({
      range,
      deals: [
        createDeal({
          id: "1",
          stageId: "C10:WON",
          stageSemanticId: "S",
          dateCreate: "2026-04-01T09:00:00.000Z",
          dateModify: "2026-04-10T09:00:00.000Z",
          dateClosed: "2026-04-10T09:00:00.000Z"
        }),
        createDeal({
          id: "2",
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          dateCreate: "2026-04-02T10:00:00.000Z",
          dateModify: "2026-04-05T10:00:00.000Z"
        }),
        createDeal({
          id: "3",
          stageId: "C10:DEMO",
          stageSemanticId: "P",
          dateCreate: "2026-04-03T11:00:00.000Z",
          dateModify: "2026-04-08T11:00:00.000Z"
        })
      ],
      stageCatalog,
      stageHistory: [
        createHistory("H1", "1", "C10:NEW", "P", "2026-04-01T09:00:00.000Z"),
        createHistory("H2", "1", "C10:PREPARATION", "P", "2026-04-03T09:00:00.000Z"),
        createHistory("H3", "1", "C10:DEMO", "P", "2026-04-06T09:00:00.000Z"),
        createHistory("H4", "1", "C10:WON", "S", "2026-04-10T09:00:00.000Z"),
        createHistory("H5", "2", "C10:NEW", "P", "2026-04-02T10:00:00.000Z"),
        createHistory("H6", "2", "C10:PREPARATION", "P", "2026-04-05T10:00:00.000Z"),
        createHistory("H7", "3", "C10:NEW", "P", "2026-04-03T11:00:00.000Z"),
        createHistory("H8", "3", "C10:PREPARATION", "P", "2026-04-04T11:00:00.000Z"),
        createHistory("H9", "3", "C10:DEMO", "P", "2026-04-08T11:00:00.000Z")
      ]
    });

    expect(result).toEqual({
      range,
      businessDays: 8,
      warnings: [],
      estimatedGainPerDay: null,
      bottleneck: {
        stageId: "C10:DEMO",
        stageName: "Демонстрация",
        throughputPerDay: 0,
        queueEnd: 1,
        queueBufferDays: null
      },
      rows: [
        {
          stageId: "C10:NEW",
          stageName: "База входящая",
          stageSemanticId: "P",
          sortOrder: 10,
          enteredDeals: 3,
          movedNextDeals: 3,
          throughputPerDay: 0.38,
          queueEnd: 0,
          queueBufferDays: 0,
          averageStageDurationDays: 2
        },
        {
          stageId: "C10:PREPARATION",
          stageName: "Звонок-знакомство",
          stageSemanticId: "P",
          sortOrder: 20,
          enteredDeals: 3,
          movedNextDeals: 2,
          throughputPerDay: 0.25,
          queueEnd: 1,
          queueBufferDays: 4,
          averageStageDurationDays: 3.5
        },
        {
          stageId: "C10:DEMO",
          stageName: "Демонстрация",
          stageSemanticId: "P",
          sortOrder: 30,
          enteredDeals: 2,
          movedNextDeals: 0,
          throughputPerDay: 0,
          queueEnd: 1,
          queueBufferDays: null,
          averageStageDurationDays: 0
        }
      ],
      stageDistribution: {
        totalCreatedDeals: 3,
        nodes: [
          {
            stageId: "C10:NEW",
            stageName: "База входящая",
            sortOrder: 10,
            dealCount: 3,
            shareOfCreatedDeals: 100
          },
          {
            stageId: "C10:PREPARATION",
            stageName: "Звонок-знакомство",
            sortOrder: 20,
            dealCount: 3,
            shareOfCreatedDeals: 100
          },
          {
            stageId: "C10:DEMO",
            stageName: "Демонстрация",
            sortOrder: 30,
            dealCount: 2,
            shareOfCreatedDeals: 66.67
          },
          {
            stageId: "C10:WON",
            stageName: "Успешно реализовано",
            sortOrder: 40,
            dealCount: 1,
            shareOfCreatedDeals: 33.33
          }
        ],
        edges: [
          {
            fromStageId: null,
            fromStageName: null,
            toStageId: "C10:NEW",
            toStageName: "База входящая",
            dealCount: 3,
            conversionRate: 100
          },
          {
            fromStageId: "C10:NEW",
            fromStageName: "База входящая",
            toStageId: "C10:PREPARATION",
            toStageName: "Звонок-знакомство",
            dealCount: 3,
            conversionRate: 100
          },
          {
            fromStageId: "C10:PREPARATION",
            fromStageName: "Звонок-знакомство",
            toStageId: "C10:DEMO",
            toStageName: "Демонстрация",
            dealCount: 2,
            conversionRate: 66.67
          },
          {
            fromStageId: "C10:DEMO",
            fromStageName: "Демонстрация",
            toStageId: "C10:WON",
            toStageName: "Успешно реализовано",
            dealCount: 1,
            conversionRate: 50
          }
        ],
        routeNodes: [
          {
            step: 0,
            stageId: "C10:NEW",
            stageName: "База входящая",
            sortOrder: 10,
            dealCount: 3,
            shareOfCreatedDeals: 100
          },
          {
            step: 1,
            stageId: "C10:PREPARATION",
            stageName: "Звонок-знакомство",
            sortOrder: 20,
            dealCount: 3,
            shareOfCreatedDeals: 100
          },
          {
            step: 2,
            stageId: "C10:DEMO",
            stageName: "Демонстрация",
            sortOrder: 30,
            dealCount: 2,
            shareOfCreatedDeals: 66.67
          },
          {
            step: 3,
            stageId: "C10:WON",
            stageName: "Успешно реализовано",
            sortOrder: 40,
            dealCount: 1,
            shareOfCreatedDeals: 33.33
          }
        ],
        routeEdges: [
          {
            fromStep: 0,
            fromStageId: "C10:NEW",
            fromStageName: "База входящая",
            toStep: 1,
            toStageId: "C10:PREPARATION",
            toStageName: "Звонок-знакомство",
            dealCount: 3,
            conversionRate: 100
          },
          {
            fromStep: 1,
            fromStageId: "C10:PREPARATION",
            fromStageName: "Звонок-знакомство",
            toStep: 2,
            toStageId: "C10:DEMO",
            toStageName: "Демонстрация",
            dealCount: 2,
            conversionRate: 66.67
          },
          {
            fromStep: 2,
            fromStageId: "C10:DEMO",
            fromStageName: "Демонстрация",
            toStep: 3,
            toStageId: "C10:WON",
            toStageName: "Успешно реализовано",
            dealCount: 1,
            conversionRate: 50
          }
        ]
      }
    });
  });

  it("counts movedNextDeals only for the canonical next active stage", () => {
    const result = buildTocFlowReport({
      range,
      deals: [
        createDeal({
          id: "1",
          stageId: "C10:DEMO",
          stageSemanticId: "P",
          dateCreate: "2026-04-01T09:00:00.000Z",
          dateModify: "2026-04-03T09:00:00.000Z"
        }),
        createDeal({
          id: "2",
          stageId: "C10:DEMO",
          stageSemanticId: "P",
          dateCreate: "2026-04-01T10:00:00.000Z",
          dateModify: "2026-04-02T10:00:00.000Z"
        }),
        createDeal({
          id: "3",
          stageId: "C10:NEW",
          stageSemanticId: "P",
          dateCreate: "2026-04-01T11:00:00.000Z",
          dateModify: "2026-04-03T11:00:00.000Z"
        }),
        createDeal({
          id: "4",
          stageId: "C10:DEMO",
          stageSemanticId: "P",
          dateCreate: "2026-04-01T12:00:00.000Z",
          dateModify: "2026-04-04T12:00:00.000Z"
        })
      ],
      stageCatalog,
      stageHistory: [
        createHistory("H1", "1", "C10:NEW", "P", "2026-04-01T09:00:00.000Z"),
        createHistory("H2", "1", "C10:PREPARATION", "P", "2026-04-02T09:00:00.000Z"),
        createHistory("H3", "1", "C10:DEMO", "P", "2026-04-03T09:00:00.000Z"),
        createHistory("H4", "2", "C10:NEW", "P", "2026-04-01T10:00:00.000Z"),
        createHistory("H5", "2", "C10:DEMO", "P", "2026-04-02T10:00:00.000Z"),
        createHistory("H6", "3", "C10:NEW", "P", "2026-04-01T11:00:00.000Z"),
        createHistory("H7", "3", "C10:PREPARATION", "P", "2026-04-02T11:00:00.000Z"),
        createHistory("H8", "3", "C10:NEW", "P", "2026-04-03T11:00:00.000Z"),
        createHistory("H9", "4", "C10:NEW", "P", "2026-04-01T12:00:00.000Z"),
        createHistory("H10", "4", "C10:PREPARATION", "P", "2026-04-02T12:00:00.000Z"),
        createHistory("H11", "4", "C10:PREPARATION", "P", "2026-04-03T12:00:00.000Z"),
        createHistory("H12", "4", "C10:DEMO", "P", "2026-04-04T12:00:00.000Z")
      ]
    });

    expect(getRow(result, "C10:NEW")).toMatchObject({
      movedNextDeals: 3
    });
    expect(getRow(result, "C10:PREPARATION")).toMatchObject({
      movedNextDeals: 2
    });
    expect(getRow(result, "C10:DEMO")).toMatchObject({
      movedNextDeals: 0
    });
  });

  it("builds factual stage distribution for deals created in the selected range", () => {
    const result = buildTocFlowReport({
      range,
      deals: [
        createDeal({
          id: "1",
          stageId: "C10:DEMO",
          stageSemanticId: "P",
          dateCreate: "2026-04-01T09:00:00.000Z",
          dateModify: "2026-04-03T09:00:00.000Z"
        }),
        createDeal({
          id: "2",
          stageId: "C10:DEMO",
          stageSemanticId: "P",
          dateCreate: "2026-04-01T10:00:00.000Z",
          dateModify: "2026-04-02T10:00:00.000Z"
        }),
        createDeal({
          id: "3",
          stageId: "C10:WON",
          stageSemanticId: "S",
          dateCreate: "2026-03-25T10:00:00.000Z",
          dateModify: "2026-04-02T10:00:00.000Z",
          dateClosed: "2026-04-02T10:00:00.000Z"
        })
      ],
      stageCatalog,
      stageHistory: [
        createHistory("H1", "1", "C10:NEW", "P", "2026-04-01T09:00:00.000Z"),
        createHistory("H2", "1", "C10:PREPARATION", "P", "2026-04-02T09:00:00.000Z"),
        createHistory("H3", "1", "C10:DEMO", "P", "2026-04-03T09:00:00.000Z"),
        createHistory("H4", "2", "C10:NEW", "P", "2026-04-01T10:00:00.000Z"),
        createHistory("H5", "2", "C10:DEMO", "P", "2026-04-02T10:00:00.000Z"),
        createHistory("H6", "3", "C10:NEW", "P", "2026-03-25T10:00:00.000Z"),
        createHistory("H7", "3", "C10:PREPARATION", "P", "2026-04-01T10:00:00.000Z"),
        createHistory("H8", "3", "C10:WON", "S", "2026-04-02T10:00:00.000Z")
      ]
    });

    expect((result as any).stageDistribution).toEqual({
      totalCreatedDeals: 2,
      nodes: [
        {
          stageId: "C10:NEW",
          stageName: "База входящая",
          sortOrder: 10,
          dealCount: 2,
          shareOfCreatedDeals: 100
        },
        {
          stageId: "C10:PREPARATION",
          stageName: "Звонок-знакомство",
          sortOrder: 20,
          dealCount: 1,
          shareOfCreatedDeals: 50
        },
        {
          stageId: "C10:DEMO",
          stageName: "Демонстрация",
          sortOrder: 30,
          dealCount: 2,
          shareOfCreatedDeals: 100
        }
      ],
      edges: [
        {
          fromStageId: null,
          fromStageName: null,
          toStageId: "C10:NEW",
          toStageName: "База входящая",
          dealCount: 2,
          conversionRate: 100
        },
        {
          fromStageId: "C10:NEW",
          fromStageName: "База входящая",
          toStageId: "C10:PREPARATION",
          toStageName: "Звонок-знакомство",
          dealCount: 1,
          conversionRate: 50
        },
        {
          fromStageId: "C10:NEW",
          fromStageName: "База входящая",
          toStageId: "C10:DEMO",
          toStageName: "Демонстрация",
          dealCount: 1,
          conversionRate: 50
        },
        {
          fromStageId: "C10:PREPARATION",
          fromStageName: "Звонок-знакомство",
          toStageId: "C10:DEMO",
          toStageName: "Демонстрация",
          dealCount: 1,
          conversionRate: 100
        }
      ],
      routeNodes: [
        {
          step: 0,
          stageId: "C10:NEW",
          stageName: "База входящая",
          sortOrder: 10,
          dealCount: 2,
          shareOfCreatedDeals: 100
        },
        {
          step: 1,
          stageId: "C10:PREPARATION",
          stageName: "Звонок-знакомство",
          sortOrder: 20,
          dealCount: 1,
          shareOfCreatedDeals: 50
        },
        {
          step: 1,
          stageId: "C10:DEMO",
          stageName: "Демонстрация",
          sortOrder: 30,
          dealCount: 1,
          shareOfCreatedDeals: 50
        },
        {
          step: 2,
          stageId: "C10:DEMO",
          stageName: "Демонстрация",
          sortOrder: 30,
          dealCount: 1,
          shareOfCreatedDeals: 50
        }
      ],
      routeEdges: [
        {
          fromStep: 0,
          fromStageId: "C10:NEW",
          fromStageName: "База входящая",
          toStep: 1,
          toStageId: "C10:PREPARATION",
          toStageName: "Звонок-знакомство",
          dealCount: 1,
          conversionRate: 50
        },
        {
          fromStep: 0,
          fromStageId: "C10:NEW",
          fromStageName: "База входящая",
          toStep: 1,
          toStageId: "C10:DEMO",
          toStageName: "Демонстрация",
          dealCount: 1,
          conversionRate: 50
        },
        {
          fromStep: 1,
          fromStageId: "C10:PREPARATION",
          fromStageName: "Звонок-знакомство",
          toStep: 2,
          toStageId: "C10:DEMO",
          toStageName: "Демонстрация",
          dealCount: 1,
          conversionRate: 100
        }
      ]
    });
  });

  it("calculates route transition rates from the visible source step", () => {
    const result = buildTocFlowReport({
      range,
      deals: [
        createDeal({
          id: "1",
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          dateCreate: "2026-04-01T09:00:00.000Z",
          dateModify: "2026-04-03T09:00:00.000Z"
        }),
        createDeal({
          id: "2",
          stageId: "C10:LOSE",
          stageSemanticId: "F",
          dateCreate: "2026-04-01T10:00:00.000Z",
          dateModify: "2026-04-02T10:00:00.000Z"
        }),
        createDeal({
          id: "3",
          stageId: "C10:LOSE",
          stageSemanticId: "F",
          dateCreate: "2026-04-01T11:00:00.000Z",
          dateModify: "2026-04-03T11:00:00.000Z"
        }),
        createDeal({
          id: "4",
          stageId: "C10:LOSE",
          stageSemanticId: "F",
          dateCreate: "2026-04-01T12:00:00.000Z",
          dateModify: "2026-04-03T12:00:00.000Z"
        })
      ],
      stageCatalog,
      stageHistory: [
        createHistory("H1", "1", "C10:NEW", "P", "2026-04-01T09:00:00.000Z"),
        createHistory("H2", "1", "C10:LOSE", "F", "2026-04-02T09:00:00.000Z"),
        createHistory("H3", "1", "C10:PREPARATION", "P", "2026-04-03T09:00:00.000Z"),
        createHistory("H4", "2", "C10:NEW", "P", "2026-04-01T10:00:00.000Z"),
        createHistory("H5", "2", "C10:LOSE", "F", "2026-04-02T10:00:00.000Z"),
        createHistory("H6", "3", "C10:NEW", "P", "2026-04-01T11:00:00.000Z"),
        createHistory("H7", "3", "C10:PREPARATION", "P", "2026-04-02T11:00:00.000Z"),
        createHistory("H8", "3", "C10:LOSE", "F", "2026-04-03T11:00:00.000Z"),
        createHistory("H9", "4", "C10:NEW", "P", "2026-04-01T12:00:00.000Z"),
        createHistory("H10", "4", "C10:PREPARATION", "P", "2026-04-02T12:00:00.000Z"),
        createHistory("H11", "4", "C10:LOSE", "F", "2026-04-03T12:00:00.000Z")
      ]
    });

    const aggregateReturnToCall = result.stageDistribution?.edges.find(
      (edge) =>
        edge.fromStageId === "C10:LOSE" && edge.toStageId === "C10:PREPARATION"
    );

    expect(aggregateReturnToCall).toMatchObject({
      dealCount: 1,
      conversionRate: 25
    });
    expect((result.stageDistribution as any).routeNodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          step: 1,
          stageId: "C10:LOSE",
          dealCount: 2,
          shareOfCreatedDeals: 50
        })
      ])
    );
    expect((result.stageDistribution as any).routeEdges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromStep: 1,
          fromStageId: "C10:LOSE",
          toStep: 2,
          toStageId: "C10:PREPARATION",
          dealCount: 1,
          conversionRate: 50
        })
      ])
    );
  });
});
