import { describe, expect, it } from "vitest";

import type {
  ConversionEventVisitSnapshot,
  DealSnapshot,
  StageCatalogEntry,
  StageHistorySnapshot
} from "@bitrix24-reporting/contracts";
import {
  buildConversionEventsReport,
  parseConversionEventDate,
  resolveConversionEventName,
  resolveConversionEventStatus
} from "../src/domain/conversion-events";

function deal(params: Partial<DealSnapshot> & Pick<DealSnapshot, "id">): DealSnapshot {
  return {
    id: params.id,
    title: null,
    contactId: params.contactId ?? null,
    leadId: null,
    categoryId: "10",
    stageId: params.stageId ?? "C10:DEMO",
    stageSemanticId: params.stageSemanticId ?? "P",
    opportunity: null,
    assignedById: params.assignedById ?? "78",
    sourceId: params.sourceId ?? "WEB",
    qualityValue: null,
    businessClubValue: params.businessClubValue ?? "ClubFirst One",
    targetGroupValue: null,
    meetingTypeValue: null,
    meetingDateValue: null,
    tariffValue: null,
    conversionEventValue: params.conversionEventValue ?? null,
    refusalReasonValue: null,
    refusalReasonDetail: null,
    dateCreate: params.dateCreate ?? "2026-04-01T09:00:00.000Z",
    dateModify: params.dateModify ?? "2026-04-30T09:00:00.000Z",
    dateClosed: params.dateClosed ?? null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    utmTerm: null
  };
}

const stageCatalog: StageCatalogEntry[] = [
  {
    entityType: "deal",
    categoryId: "10",
    statusId: "C10:NEW",
    name: "Активация",
    semanticId: "P",
    sortOrder: 10
  },
  {
    entityType: "deal",
    categoryId: "10",
    statusId: "C10:DEMO",
    name: "Демонстрация",
    semanticId: "P",
    sortOrder: 20
  },
  {
    entityType: "deal",
    categoryId: "10",
    statusId: "C10:WON",
    name: "Передано в клуб",
    semanticId: "S",
    sortOrder: 30
  },
  {
    entityType: "deal",
    categoryId: "10",
    statusId: "C10:LOSE",
    name: "Корзина",
    semanticId: "F",
    sortOrder: 40
  }
];

describe("conversion events report", () => {
  it("parses safe event names and event dates without retaining client names", () => {
    expect(
      resolveConversionEventName(
        null,
        "Посещение Омаров Омар Магомедович в Знакомство с клубом 29.04."
      )
    ).toBe("Знакомство с клубом 29.04.");
    expect(parseConversionEventDate("Знакомство с клубом 29.04.", 2026)).toBe(
      "2026-04-29T00:00:00.000Z"
    );
  });

  it("maps Bitrix event stages into report statuses", () => {
    expect(resolveConversionEventStatus("На мероприятии")).toBe("attended");
    expect(resolveConversionEventStatus("Посетил")).toBe("attended");
    expect(resolveConversionEventStatus("Отказ")).toBe("refused");
    expect(resolveConversionEventStatus("Приглашен")).toBe("invited");
    expect(resolveConversionEventStatus("Черновик")).toBe("unknown");
  });

  it("aggregates attendance and next-step conversion by event", () => {
    const visits: ConversionEventVisitSnapshot[] = [
      {
        id: "V1",
        eventName: "Знакомство с клубом 29.04.",
        eventDate: "2026-04-29T00:00:00.000Z",
        status: "attended",
        stageId: "DT:ATTENDED",
        stageName: "На мероприятии",
        dealId: "D1",
        contactId: "C1",
        managerId: null,
        sourceId: null,
        createdTime: "2026-04-20T10:00:00.000Z",
        updatedTime: "2026-04-29T14:00:00.000Z"
      },
      {
        id: "V2",
        eventName: "Знакомство с клубом 29.04.",
        eventDate: "2026-04-29T00:00:00.000Z",
        status: "attended",
        stageId: "DT:ATTENDED",
        stageName: "На мероприятии",
        dealId: "D2",
        contactId: "C2",
        managerId: null,
        sourceId: null,
        createdTime: "2026-04-20T10:00:00.000Z",
        updatedTime: "2026-04-29T14:00:00.000Z"
      },
      {
        id: "V3",
        eventName: "Знакомство с клубом 29.04.",
        eventDate: "2026-04-29T00:00:00.000Z",
        status: "refused",
        stageId: "DT:REFUSED",
        stageName: "Отказ",
        dealId: "D3",
        contactId: "C3",
        managerId: null,
        sourceId: null,
        createdTime: "2026-04-20T10:00:00.000Z",
        updatedTime: "2026-04-29T14:00:00.000Z"
      },
      {
        id: "V4",
        eventName: "Знакомство с клубом 29.04.",
        eventDate: "2026-04-29T00:00:00.000Z",
        status: "invited",
        stageId: "DT:INVITED",
        stageName: "Приглашен",
        dealId: "D4",
        contactId: "C4",
        managerId: null,
        sourceId: null,
        createdTime: "2026-04-20T10:00:00.000Z",
        updatedTime: "2026-04-29T14:00:00.000Z"
      },
      {
        id: "V5",
        eventName: "Знакомство с клубом 29.04.",
        eventDate: "2026-04-29T00:00:00.000Z",
        status: "unknown",
        stageId: "DT:DRAFT",
        stageName: "Черновик",
        dealId: null,
        contactId: "C5",
        managerId: "78",
        sourceId: "WEB",
        createdTime: "2026-04-20T10:00:00.000Z",
        updatedTime: "2026-04-29T14:00:00.000Z"
      }
    ];
    const stageHistory: StageHistorySnapshot[] = [
      {
        id: "H1",
        ownerId: "D1",
        categoryId: "10",
        stageId: "C10:NEW",
        stageSemanticId: "P",
        typeId: null,
        createdTime: "2026-04-20T10:00:00.000Z"
      },
      {
        id: "H2",
        ownerId: "D1",
        categoryId: "10",
        stageId: "C10:DEMO",
        stageSemanticId: "P",
        typeId: null,
        createdTime: "2026-04-30T10:00:00.000Z"
      },
      {
        id: "H3",
        ownerId: "D2",
        categoryId: "10",
        stageId: "C10:NEW",
        stageSemanticId: "P",
        typeId: null,
        createdTime: "2026-04-20T10:00:00.000Z"
      },
      {
        id: "H4",
        ownerId: "D2",
        categoryId: "10",
        stageId: "C10:LOSE",
        stageSemanticId: "F",
        typeId: null,
        createdTime: "2026-04-30T10:00:00.000Z"
      }
    ];

    const report = buildConversionEventsReport({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      visits,
      deals: [
        deal({ id: "D1", assignedById: "78", sourceId: "WEB" }),
        deal({ id: "D2", assignedById: "79", sourceId: "PARTNER" }),
        deal({ id: "D3", assignedById: "78", sourceId: "WEB" }),
        deal({ id: "D4", assignedById: "78", sourceId: "AD" })
      ],
      stageCatalog,
      stageHistory,
      managerDirectory: [
        { id: "78", name: "Егоров Андрей" },
        { id: "79", name: "Ромашова Ольга" }
      ],
      sourceLabels: new Map([
        ["WEB", "Веб"],
        ["PARTNER", "Партнеры"],
        ["AD", "Реклама"]
      ])
    });

    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({
      eventName: "Знакомство с клубом 29.04.",
      invitedCount: 5,
      attendedCount: 2,
      refusedCount: 1,
      missedCount: 3,
      attendanceRate: 40,
      nextStepEligibleCount: 2,
      nextStepCount: 1,
      nextStepRate: 50,
      unlinkedCount: 1,
      unknownStatusCount: 1
    });
    expect(report.rows[0]?.managerBreakdown).toEqual([
      { key: "78", label: "Егоров Андрей", count: 4 },
      { key: "79", label: "Ромашова Ольга", count: 1 }
    ]);
    expect(report.warnings).toContain(
      'Conversion event visit V5 has unknown status "Черновик".'
    );
    expect(report.warnings).toContain(
      "Conversion event visit V5 is not linked to an attraction deal."
    );
  });

  it("links visits by contact and prefers deals with matching conversion event value", () => {
    const report = buildConversionEventsReport({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      visits: [
        {
          id: "V_CONTACT",
          eventName: "Знакомство с клубом 29.04.",
          eventDate: "2026-04-29T00:00:00.000Z",
          status: "attended",
          stageId: "DT:ATTENDED",
          stageName: "На мероприятии",
          dealId: null,
          contactId: "C100",
          managerId: null,
          sourceId: null,
          createdTime: "2026-04-20T10:00:00.000Z",
          updatedTime: "2026-04-29T14:00:00.000Z"
        }
      ],
      deals: [
        deal({
          id: "D_OLD",
          contactId: "C100",
          assignedById: "78",
          conversionEventValue: "Другое мероприятие 20.04.",
          dateCreate: "2026-04-01T09:00:00.000Z",
          dateModify: "2026-04-21T09:00:00.000Z"
        }),
        deal({
          id: "D_MATCH",
          contactId: "C100",
          assignedById: "79",
          sourceId: "PARTNER",
          conversionEventValue: "Знакомство с клубом 29.04.",
          dateCreate: "2026-04-02T09:00:00.000Z",
          dateModify: "2026-04-28T09:00:00.000Z"
        })
      ],
      stageCatalog,
      stageHistory: [
        {
          id: "H_MATCH",
          ownerId: "D_MATCH",
          categoryId: "10",
          stageId: "C10:WON",
          stageSemanticId: "S",
          typeId: null,
          createdTime: "2026-04-30T10:00:00.000Z"
        }
      ],
      managerDirectory: [
        { id: "78", name: "Егоров Андрей" },
        { id: "79", name: "Ромашова Ольга" }
      ],
      sourceLabels: new Map([
        ["WEB", "Веб"],
        ["PARTNER", "Партнеры"]
      ])
    });

    expect(report.rows[0]).toMatchObject({
      attendedCount: 1,
      nextStepEligibleCount: 1,
      nextStepCount: 1,
      unlinkedCount: 0
    });
    expect(report.rows[0]?.managerBreakdown).toEqual([
      { key: "79", label: "Ромашова Ольга", count: 1 }
    ]);
    expect(report.warnings).toEqual([]);
  });
});
