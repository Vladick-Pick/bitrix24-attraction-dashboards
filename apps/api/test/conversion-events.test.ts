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
    expect(
      parseConversionEventDate(
        "МСК Гость Клуба: Александр Аузан 17.10.23 Александр Аузан оффлайн",
        2026
      )
    ).toBe("2023-10-17T00:00:00.000Z");
    expect(
      parseConversionEventDate(
        "МСК Networking-сессия CF EXPERIENCE 21.05.26 оффлайн",
        2025
      )
    ).toBe("2026-05-21T00:00:00.000Z");
  });

  it("maps Bitrix event stages into report statuses", () => {
    expect(resolveConversionEventStatus("На мероприятии")).toBe("attended");
    expect(resolveConversionEventStatus("Посетил")).toBe("attended");
    expect(resolveConversionEventStatus("Пойду")).toBe("confirmed");
    expect(resolveConversionEventStatus("Отказ")).toBe("refused");
    expect(resolveConversionEventStatus("Приглашен")).toBe("invited");
    expect(resolveConversionEventStatus("DT162_14:NEW")).toBe("invited");
    expect(resolveConversionEventStatus("DT162_14:PREPARATION")).toBe(
      "confirmed"
    );
    expect(resolveConversionEventStatus("DT162_14:SUCCESS")).toBe("attended");
    expect(resolveConversionEventStatus("DT162_14:FAIL")).toBe("refused");
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
      invitedCount: 4,
      confirmedCount: 0,
      attendedCount: 2,
      refusedCount: 1,
      missedCount: 2,
      attendanceRate: 50,
      nextStepEligibleCount: 2,
      nextStepCount: 1,
      nextStepRate: 50,
      unlinkedCount: 0,
      unknownStatusCount: 0
    });
    expect(report.rows[0]?.managerBreakdown).toEqual([
      { key: "78", label: "Егоров Андрей", count: 3 },
      { key: "79", label: "Ромашова Ольга", count: 1 }
    ]);
    expect(report.warnings).toEqual([]);
  });

  it("ignores contact-only raw visits instead of linking them to attraction deals", () => {
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

    expect(report.rows).toEqual([]);
    expect(report.warnings).toEqual([]);
  });

  it("includes planned attraction events with zero visits when event type is enabled", () => {
    const report = buildConversionEventsReport({
      range: {
        from: "2026-05-25T00:00:00.000Z",
        to: "2026-05-31T23:59:59.999Z"
      },
      visits: [],
      events: [
        {
          eventId: "31394",
          entityTypeId: 137,
          categoryId: 12,
          title: "Гостевая встреча 28.05.",
          eventDate: "2026-05-28T00:00:00.000Z",
          startAt: "2026-05-28T10:00:00.000Z",
          endAt: null,
          stageId: "DT137_12:PLANNED",
          stageName: "Планируется",
          status: "planned",
          eventTypeId: "128",
          eventTypeLabel: "Мероприятие привлечения",
          formatId: null,
          createdTime: "2026-05-14T08:18:44.000Z",
          updatedTime: "2026-05-19T20:57:57.000Z"
        },
        {
          eventId: "99999",
          entityTypeId: 137,
          categoryId: 12,
          title: "Внутреннее мероприятие",
          eventDate: "2026-05-28T00:00:00.000Z",
          startAt: null,
          endAt: null,
          stageId: "DT137_12:PLANNED",
          stageName: "Планируется",
          status: "planned",
          eventTypeId: "999",
          eventTypeLabel: "Не привлечение",
          formatId: null,
          createdTime: "2026-05-14T08:18:44.000Z",
          updatedTime: "2026-05-19T20:57:57.000Z"
        }
      ],
      eventTypeSettings: [
        {
          moduleKey: "attraction",
          eventTypeId: "128",
          eventTypeLabel: "Мероприятие привлечения",
          enabled: true,
          updatedAt: "2026-05-24T12:00:00.000Z"
        }
      ],
      deals: [],
      stageCatalog,
      stageHistory: [],
      managerDirectory: [],
      sourceLabels: new Map()
    });

    expect(report.rows).toEqual([
      expect.objectContaining({
        eventName: "Гостевая встреча 28.05.",
        eventDate: "2026-05-28T00:00:00.000Z",
        invitedCount: 0,
        confirmedCount: 0,
        attendedCount: 0,
        missedCount: 0
      })
    ]);
  });

  it("does not include planned zero-visit events until their event type is enabled", () => {
    const report = buildConversionEventsReport({
      range: {
        from: "2026-05-25T00:00:00.000Z",
        to: "2026-05-31T23:59:59.999Z"
      },
      visits: [],
      events: [
        {
          eventId: "31394",
          entityTypeId: 137,
          categoryId: 12,
          title: "Гостевая встреча 28.05.",
          eventDate: "2026-05-28T00:00:00.000Z",
          startAt: "2026-05-28T10:00:00.000Z",
          endAt: null,
          stageId: "DT137_12:PLANNED",
          stageName: "Планируется",
          status: "planned",
          eventTypeId: "128",
          eventTypeLabel: "Мероприятие привлечения",
          formatId: null,
          createdTime: "2026-05-14T08:18:44.000Z",
          updatedTime: "2026-05-19T20:57:57.000Z"
        }
      ],
      eventTypeSettings: [],
      deals: [],
      stageCatalog,
      stageHistory: [],
      managerDirectory: [],
      sourceLabels: new Map()
    });

    expect(report.rows).toEqual([]);
  });

  it("keeps raw visits that are missing from a stale fact layer", () => {
    const report = buildConversionEventsReport({
      range: {
        from: "2026-05-25T00:00:00.000Z",
        to: "2026-05-31T23:59:59.999Z"
      },
      eventVisitFacts: [
        {
          visitId: "V_FACT",
          eventId: null,
          dealId: "D1",
          contactId: "C1",
          leadId: null,
          managerId: "78",
          sourceId: "WEB",
          currentStageId: "DT:INVITED",
          currentStageName: "Приглашен",
          invitedAt: "2026-05-18T12:00:00.000Z",
          confirmedAt: null,
          attendedAt: null,
          refusedAt: null,
          finalStatus: "invited",
          eventDate: "2026-05-28T00:00:00.000Z",
          stageIdAtEvent: null,
          linkConfidence: "high",
          linkReason: "event_visit_deal",
          payloadJson: JSON.stringify({
            eventName: "Гостевая встреча 28.05.",
            visitUpdatedTime: "2026-05-18T12:00:00.000Z"
          })
        }
      ],
      visits: [
        {
          id: "V_FACT",
          eventName: "Гостевая встреча 28.05.",
          eventDate: "2026-05-28T00:00:00.000Z",
          status: "invited",
          stageId: "DT:INVITED",
          stageName: "Приглашен",
          dealId: "D1",
          contactId: "C1",
          managerId: "78",
          sourceId: "WEB",
          createdTime: "2026-05-18T12:00:00.000Z",
          updatedTime: "2026-05-18T12:00:00.000Z"
        },
        {
          id: "V_RAW_ONLY",
          eventName: "Гостевая встреча 28.05.",
          eventDate: "2026-05-28T00:00:00.000Z",
          status: "confirmed",
          stageId: "DT:CONFIRMED",
          stageName: "Пойду",
          dealId: "D2",
          contactId: "C2",
          managerId: "79",
          sourceId: "PARTNER",
          createdTime: "2026-05-19T12:00:00.000Z",
          updatedTime: "2026-05-20T12:00:00.000Z"
        }
      ],
      deals: [
        deal({ id: "D1", contactId: "C1", assignedById: "78", sourceId: "WEB" }),
        deal({
          id: "D2",
          contactId: "C2",
          assignedById: "79",
          sourceId: "PARTNER"
        })
      ],
      stageCatalog,
      stageHistory: [],
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
      eventName: "Гостевая встреча 28.05.",
      invitedCount: 2,
      confirmedCount: 1
    });
    expect(report.rows[0]?.managerBreakdown).toEqual([
      { key: "78", label: "Егоров Андрей", count: 1 },
      { key: "79", label: "Ромашова Ольга", count: 1 }
    ]);
  });

  it("counts fact invitations and confirmations by their status timestamps", () => {
    const report = buildConversionEventsReport({
      range: {
        from: "2026-05-18T00:00:00.000Z",
        to: "2026-05-18T23:59:59.999Z"
      },
      eventVisitFacts: [
        {
          visitId: "V_INVITED_IN_RANGE",
          eventId: null,
          dealId: "D1",
          contactId: "C1",
          leadId: null,
          managerId: "78",
          sourceId: "WEB",
          currentStageId: "DT:CONFIRMED",
          currentStageName: "Пойду",
          invitedAt: "2026-05-18T12:00:00.000Z",
          confirmedAt: "2026-05-20T12:00:00.000Z",
          attendedAt: null,
          refusedAt: null,
          finalStatus: "confirmed",
          eventDate: "2026-05-28T00:00:00.000Z",
          stageIdAtEvent: null,
          linkConfidence: "high",
          linkReason: "event_visit_deal",
          payloadJson: JSON.stringify({
            eventName: "Гостевая встреча 28.05."
          })
        },
        {
          visitId: "V_CONFIRMED_IN_RANGE",
          eventId: null,
          dealId: "D2",
          contactId: "C2",
          leadId: null,
          managerId: "79",
          sourceId: "PARTNER",
          currentStageId: "DT:CONFIRMED",
          currentStageName: "Пойду",
          invitedAt: "2026-05-10T12:00:00.000Z",
          confirmedAt: "2026-05-18T13:00:00.000Z",
          attendedAt: null,
          refusedAt: null,
          finalStatus: "confirmed",
          eventDate: "2026-05-28T00:00:00.000Z",
          stageIdAtEvent: null,
          linkConfidence: "high",
          linkReason: "event_visit_deal",
          payloadJson: JSON.stringify({
            eventName: "Гостевая встреча 28.05."
          })
        }
      ],
      visits: [],
      deals: [
        deal({ id: "D1", contactId: "C1", assignedById: "78", sourceId: "WEB" }),
        deal({
          id: "D2",
          contactId: "C2",
          assignedById: "79",
          sourceId: "PARTNER"
        })
      ],
      stageCatalog,
      stageHistory: [],
      managerDirectory: [
        { id: "78", name: "Егоров Андрей" },
        { id: "79", name: "Ромашова Ольга" }
      ],
      sourceLabels: new Map([
        ["WEB", "Веб"],
        ["PARTNER", "Партнеры"]
      ]),
      asOf: "2026-05-25T12:00:00.000Z"
    });

    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({
      eventName: "Гостевая встреча 28.05.",
      eventDate: "2026-05-28T00:00:00.000Z",
      invitedCount: 1,
      confirmedCount: 1,
      attendedCount: 0,
      missedCount: 0
    });
  });

  it("deduplicates multiple visit rows for the same event and deal in report counts", () => {
    const report = buildConversionEventsReport({
      range: {
        from: "2026-03-18T00:00:00.000Z",
        to: "2026-03-18T23:59:59.999Z"
      },
      eventVisitFacts: [
        {
          visitId: "V_REFUSED",
          eventId: "E1",
          dealId: "D1",
          contactId: "C1",
          leadId: null,
          managerId: "78",
          sourceId: "WEB",
          currentStageId: "DT:REFUSED",
          currentStageName: "Отказ",
          invitedAt: "2026-03-18T10:40:53.000Z",
          confirmedAt: null,
          attendedAt: null,
          refusedAt: "2026-03-19T00:00:12.000Z",
          finalStatus: "refused",
          eventDate: "2026-03-18T00:00:00.000Z",
          stageIdAtEvent: null,
          linkConfidence: "high",
          linkReason: "event_visit_deal",
          payloadJson: JSON.stringify({
            eventName: "ЕКБ Networking-сессия в Екатеринбурге 18.03.26 оффлайн"
          })
        },
        {
          visitId: "V_ATTENDED",
          eventId: "E1",
          dealId: "D1",
          contactId: "C1",
          leadId: null,
          managerId: "78",
          sourceId: "WEB",
          currentStageId: "DT:ATTENDED",
          currentStageName: "На мероприятии",
          invitedAt: "2026-03-23T11:22:23.000Z",
          confirmedAt: null,
          attendedAt: "2026-03-23T11:22:29.000Z",
          refusedAt: null,
          finalStatus: "attended",
          eventDate: "2026-03-18T00:00:00.000Z",
          stageIdAtEvent: null,
          linkConfidence: "high",
          linkReason: "event_visit_deal",
          payloadJson: JSON.stringify({
            eventName: "ЕКБ Networking-сессия в Екатеринбурге 18.03.26 оффлайн"
          })
        }
      ],
      visits: [],
      deals: [deal({ id: "D1", contactId: "C1", assignedById: "78", sourceId: "WEB" })],
      stageCatalog,
      stageHistory: [],
      managerDirectory: [{ id: "78", name: "Егоров Андрей" }],
      sourceLabels: new Map([["WEB", "Веб"]]),
      asOf: "2026-03-24T12:00:00.000Z"
    });

    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({
      invitedCount: 1,
      attendedCount: 1,
      refusedCount: 0,
      missedCount: 0
    });
    expect(report.warnings).toContain(
      "Duplicate conversion event visits were deduplicated for 1 event/deal pair."
    );
  });

  it("ignores contact-only visits even when an attraction deal exists for that contact", () => {
    const report = buildConversionEventsReport({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      visits: [
        {
          id: "V_FUTURE_DEAL",
          eventName: "Знакомство с клубом 29.04.",
          eventDate: "2026-04-29T00:00:00.000Z",
          status: "attended",
          stageId: "DT:ATTENDED",
          stageName: "На мероприятии",
          dealId: null,
          contactId: "C_FUTURE",
          managerId: null,
          sourceId: null,
          createdTime: "2026-04-20T10:00:00.000Z",
          updatedTime: "2026-04-29T14:00:00.000Z"
        }
      ],
      deals: [
        deal({
          id: "D_FUTURE",
          contactId: "C_FUTURE",
          dateCreate: "2026-05-01T09:00:00.000Z",
          dateModify: "2026-05-01T09:00:00.000Z"
        })
      ],
      stageCatalog,
      stageHistory: [],
      managerDirectory: [],
      sourceLabels: new Map()
    });

    expect(report.rows).toEqual([]);
    expect(report.warnings).toEqual([]);
  });
});
