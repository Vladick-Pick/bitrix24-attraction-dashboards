import { describe, expect, it } from "vitest";

import type {
  ActivitySnapshot,
  CallSnapshot,
  ConversionEventVisitSnapshot,
  DealSnapshot,
  StageCatalogEntry,
  StageHistorySnapshot
} from "@bitrix24-reporting/contracts";

import {
  buildConversionEventTouchpointFacts,
  buildDealStageFacts,
  buildDealTouchpointFacts,
  buildEventVisitFacts,
  buildIdentityLinks,
  resolveStageFactAtTime
} from "../src/domain/analytics-facts.js";
import { touchpointFactsToCalls } from "../src/domain/fact-report-adapters.js";

describe("analytics facts", () => {
  const attractionDeal = {
    id: "156562",
    contactId: "321",
    leadId: "900",
    categoryId: "10",
    stageId: "C10:DEMO",
    stageSemanticId: "P",
    opportunity: 181000,
    assignedById: "13020",
    sourceId: "LEADGEN_US",
    qualityValue: "3.1 Готов ко встрече",
    businessClubValue: "ClubFirst Future",
    targetGroupValue: null,
    meetingTypeValue: null,
    meetingDateValue: null,
    tariffValue: null,
    conversionEventValue: null,
    refusalReasonValue: null,
    refusalReasonDetail: null,
    dateCreate: "2026-05-13T09:00:00.000Z",
    dateModify: "2026-05-18T15:00:00.000Z",
    dateClosed: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    utmTerm: null
  } satisfies DealSnapshot;

  const otherFunnelDeal = {
    ...attractionDeal,
    id: "999001",
    contactId: "777",
    leadId: null,
    categoryId: "28",
    stageId: "C28:NEW",
    assignedById: "555"
  } satisfies DealSnapshot;

  const stageCatalog = [
    {
      entityType: "deal",
      categoryId: "10",
      statusId: "C10:BASE",
      name: "База входящая",
      semanticId: "P",
      sortOrder: 10
    },
    {
      entityType: "deal",
      categoryId: "10",
      statusId: "C10:CALL",
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
    }
  ] satisfies StageCatalogEntry[];

  const stageHistory = [
    {
      id: "stage-1",
      ownerId: "156562",
      categoryId: "10",
      stageId: "C10:BASE",
      stageSemanticId: "P",
      typeId: 1,
      createdTime: "2026-05-13T09:00:00.000Z"
    },
    {
      id: "stage-2",
      ownerId: "156562",
      categoryId: "10",
      stageId: "C10:CALL",
      stageSemanticId: "P",
      typeId: 2,
      createdTime: "2026-05-15T09:00:00.000Z"
    },
    {
      id: "stage-3",
      ownerId: "156562",
      categoryId: "10",
      stageId: "C10:DEMO",
      stageSemanticId: "P",
      typeId: 2,
      createdTime: "2026-05-18T09:00:00.000Z"
    }
  ] satisfies StageHistorySnapshot[];

  it("builds identity links from deals and standalone leads", () => {
    const rows = buildIdentityLinks({
      moduleKey: "attraction",
      deals: [attractionDeal],
      leads: [
        {
          id: "900",
          statusId: "CONVERTED",
          sourceId: "LEADGEN_US",
          opportunity: null,
          assignedById: "13020",
          dateCreate: "2026-05-13T08:00:00.000Z",
          dateModify: "2026-05-13T09:00:00.000Z",
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        },
        {
          id: "901",
          statusId: "NEW",
          sourceId: "TG",
          opportunity: null,
          assignedById: "13021",
          dateCreate: "2026-05-14T08:00:00.000Z",
          dateModify: "2026-05-14T09:00:00.000Z",
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        }
      ]
    });

    expect(rows).toEqual([
      expect.objectContaining({
        identityId: "identity:deal:156562",
        dealId: "156562",
        leadId: "900",
        contactId: "321",
        linkReason: "deal_snapshot"
      }),
      expect.objectContaining({
        identityId: "identity:lead:901",
        dealId: null,
        leadId: "901",
        linkReason: "lead_without_deal_snapshot"
      })
    ]);
  });

  it("normalizes stage history and resolves the stage active at event time", () => {
    const facts = buildDealStageFacts({
      deals: [attractionDeal, otherFunnelDeal],
      stageHistory,
      stageCatalog
    });

    expect(facts.filter((fact) => fact.dealId === "156562")).toEqual([
      expect.objectContaining({
        factId: "stage:deal:156562:stage-1",
        stageId: "C10:BASE",
        stageName: "База входящая",
        leftAt: "2026-05-15T09:00:00.000Z"
      }),
      expect.objectContaining({
        factId: "stage:deal:156562:stage-2",
        stageId: "C10:CALL",
        stageName: "Звонок-знакомство",
        leftAt: "2026-05-18T09:00:00.000Z"
      }),
      expect.objectContaining({
        factId: "stage:deal:156562:stage-3",
        stageId: "C10:DEMO",
        stageName: "Демонстрация",
        leftAt: null
      })
    ]);
    expect(facts.find((fact) => fact.dealId === "999001")).toEqual(
      expect.objectContaining({
        factId: "stage:deal:999001:current:999001:C28:NEW",
        stageId: "C28:NEW",
        leftAt: null
      })
    );
    expect(
      resolveStageFactAtTime(facts, "156562", "2026-05-16T10:00:00.000Z")
    ).toEqual(expect.objectContaining({ stageId: "C10:CALL" }));
  });

  it("keeps all manager calls while linking only attributable calls to deals and stages", () => {
    const activities = [
      {
        id: "CALL_ACTIVITY",
        ownerTypeId: "2",
        ownerId: "999001",
        typeId: "2",
        providerId: "VOXIMPLANT_CALL",
        responsibleId: "13020",
        createdTime: "2026-05-16T10:00:00.000Z",
        deadline: null,
        lastUpdated: "2026-05-16T10:01:00.000Z",
        completed: true,
        completedTime: "2026-05-16T10:01:00.000Z"
      },
      {
        id: "TASK_ACTIVITY",
        ownerTypeId: "2",
        ownerId: "156562",
        typeId: "6",
        providerId: "CRM_TODO",
        responsibleId: "13020",
        createdTime: "2026-05-16T11:00:00.000Z",
        deadline: "2026-05-17T11:00:00.000Z",
        lastUpdated: "2026-05-16T12:00:00.000Z",
        completed: true,
        completedTime: "2026-05-17T10:00:00.000Z"
      },
      {
        id: "MEETING_ACTIVITY",
        ownerTypeId: "2",
        ownerId: "156562",
        typeId: "1",
        providerId: "CRM_MEETING",
        responsibleId: "13020",
        createdTime: "2026-05-18T11:00:00.000Z",
        deadline: "2026-05-20T10:00:00.000Z",
        lastUpdated: "2026-05-18T12:00:00.000Z",
        completed: true,
        completedTime: "2026-05-20T12:00:00.000Z"
      }
    ] satisfies ActivitySnapshot[];
    const calls = [
      {
        id: "LINKED_CALL",
        crmActivityId: "CALL_ACTIVITY",
        portalUserId: "13020",
        callType: "1",
        callStartDate: "2026-05-16T10:00:00.000Z",
        callDurationSeconds: 95,
        crmEntityType: "CONTACT",
        crmEntityId: "321",
        callFailedCode: "200"
      },
      {
        id: "UNLINKED_CALL",
        crmActivityId: null,
        portalUserId: "13020",
        callType: "2",
        callStartDate: "2026-05-16T11:00:00.000Z",
        callDurationSeconds: 0,
        crmEntityType: null,
        crmEntityId: null,
        callFailedCode: "304"
      }
    ] satisfies CallSnapshot[];
    const conversionVisits = [
      {
        id: "VISIT_1",
        eventName: "МСК Networking-сессия CF EXPERIENCE 21.05.26 оффлайн",
        eventDate: "2026-05-21T00:00:00.000Z",
        status: "attended",
        stageId: "DT162_14:SUCCESS",
        stageName: "Дошел",
        dealId: "156562",
        contactId: "321",
        managerId: "13020",
        sourceId: "LEADGEN_US",
        createdTime: "2026-05-18T15:00:00.000Z",
        updatedTime: "2026-05-21T18:00:00.000Z"
      }
    ] satisfies ConversionEventVisitSnapshot[];
    const stageFacts = buildDealStageFacts({
      deals: [attractionDeal],
      stageHistory,
      stageCatalog
    });

    const facts = buildDealTouchpointFacts({
      deals: [attractionDeal],
      stageFacts,
      activities,
      activityBindings: [
        {
          activityId: "CALL_ACTIVITY",
          ownerTypeId: "2",
          ownerId: "999001"
        },
        {
          activityId: "CALL_ACTIVITY",
          ownerTypeId: "2",
          ownerId: "156562"
        }
      ],
      calls,
      meetingDateChanges: [
        {
          id: "meeting-date-change-1",
          dealId: "156562",
          assignedById: "13020",
          previousMeetingDate: null,
          nextMeetingDate: "2026-05-28T10:00:00.000Z",
          changedAt: "2026-05-18T13:00:00.000Z"
        }
      ],
      conversionEventVisits: conversionVisits
    });

    expect(facts.filter((fact) => fact.kind === "call")).toEqual([
      expect.objectContaining({
        factId: "call:LINKED_CALL",
        dealId: "156562",
        stageIdAtEvent: "C10:CALL",
        linkReason: "activity_binding_deal"
      }),
      expect.objectContaining({
        factId: "call:UNLINKED_CALL",
        dealId: null,
        managerId: "13020",
        linkReason: "unlinked_call"
      })
    ]);
    expect(touchpointFactsToCalls(facts)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "LINKED_CALL",
          linkReason: "activity_binding_deal",
          linkConfidence: "high"
        }),
        expect.objectContaining({
          id: "UNLINKED_CALL",
          linkReason: "unlinked_call",
          linkConfidence: "low"
        })
      ])
    );
    expect(facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          factId: "task-created:TASK_ACTIVITY",
          kind: "task_created",
          stageIdAtEvent: "C10:CALL"
        }),
        expect.objectContaining({
          factId: "task-completed:TASK_ACTIVITY",
          kind: "task_completed",
          stageIdAtEvent: "C10:CALL"
        }),
        expect.objectContaining({
          factId: "meeting:MEETING_ACTIVITY",
          kind: "meeting",
          stageIdAtEvent: "C10:DEMO"
        }),
        expect.objectContaining({
          factId: "meeting-date-changed:meeting-date-change-1",
          kind: "meeting_date_changed",
          stageIdAtEvent: "C10:DEMO"
        }),
        expect.objectContaining({
          factId: "conversion-event-visit:VISIT_1",
          kind: "conversion_event_visit",
          stageIdAtEvent: "C10:DEMO"
        })
      ])
    );
  });

  it("builds event visit facts from visit status history", () => {
    const stageFacts = buildDealStageFacts({
      deals: [attractionDeal],
      stageHistory,
      stageCatalog
    });

    const facts = buildEventVisitFacts({
      visits: [
        {
          id: "VISIT_1",
          eventId: "31394",
          eventName: "Гостевая встреча 28.05.",
          eventDate: "2026-05-28T00:00:00.000Z",
          status: "attended",
          stageId: "DT162_14:SUCCESS",
          stageName: "Дошел",
          dealId: "156562",
          contactId: "321",
          managerId: "13020",
          sourceId: "LEADGEN_US",
          createdTime: "2026-05-18T12:00:00.000Z",
          updatedTime: "2026-05-28T12:00:00.000Z"
        }
      ],
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
      visitStageHistory: [
        {
          historyId: "H1",
          visitId: "VISIT_1",
          entityTypeId: 162,
          categoryId: 14,
          stageId: "DT162_14:NEW",
          stageName: "Приглашен",
          typeId: 1,
          changedAt: "2026-05-18T12:00:00.000Z"
        },
        {
          historyId: "H2",
          visitId: "VISIT_1",
          entityTypeId: 162,
          categoryId: 14,
          stageId: "DT162_14:CONFIRMED",
          stageName: "Пойду",
          typeId: 2,
          changedAt: "2026-05-20T12:00:00.000Z"
        },
        {
          historyId: "H3",
          visitId: "VISIT_1",
          entityTypeId: 162,
          categoryId: 14,
          stageId: "DT162_14:SUCCESS",
          stageName: "Дошел",
          typeId: 2,
          changedAt: "2026-05-28T12:00:00.000Z"
        }
      ],
      deals: [attractionDeal],
      stageFacts
    });

    expect(facts).toEqual([
      expect.objectContaining({
        visitId: "VISIT_1",
        eventId: "31394",
        dealId: "156562",
        invitedAt: "2026-05-18T12:00:00.000Z",
        confirmedAt: "2026-05-20T12:00:00.000Z",
        attendedAt: "2026-05-28T12:00:00.000Z",
        finalStatus: "attended",
        eventDate: "2026-05-28T00:00:00.000Z",
        stageIdAtEvent: "C10:DEMO"
      })
    ]);
  });

  it("keeps confirmed event visit status when Bitrix stage title is unavailable", () => {
    const stageFacts = buildDealStageFacts({
      deals: [attractionDeal],
      stageHistory,
      stageCatalog
    });

    const facts = buildEventVisitFacts({
      visits: [
        {
          id: "VISIT_CONFIRMED",
          eventId: null,
          eventName: "Гостевая встреча 28.05.",
          eventDate: "2026-05-28T00:00:00.000Z",
          status: "confirmed",
          stageId: "DT162_14:CONFIRMED",
          stageName: "",
          dealId: "156562",
          contactId: "321",
          managerId: "13020",
          sourceId: "LEADGEN_US",
          createdTime: "2026-05-18T12:00:00.000Z",
          updatedTime: "2026-05-20T12:00:00.000Z"
        }
      ],
      events: [],
      visitStageHistory: [],
      deals: [attractionDeal],
      stageFacts
    });

    expect(facts).toEqual([
      expect.objectContaining({
        visitId: "VISIT_CONFIRMED",
        invitedAt: "2026-05-18T12:00:00.000Z",
        confirmedAt: "2026-05-20T12:00:00.000Z",
        finalStatus: "confirmed"
      })
    ]);
  });

  it("does not link contact-only event visits to scoped attraction deals", () => {
    const stageFacts = buildDealStageFacts({
      deals: [attractionDeal],
      stageHistory,
      stageCatalog
    });

    const facts = buildEventVisitFacts({
      visits: [
        {
          id: "CLUB_VISIT_AFTER_DEAL",
          eventId: "CLUB_EVENT",
          eventName: "Клубная встреча после вступления",
          eventDate: "2026-05-28T00:00:00.000Z",
          status: "attended",
          stageId: "DT162_14:SUCCESS",
          stageName: "Дошел",
          dealId: null,
          contactId: "321",
          managerId: "2202",
          sourceId: "CLUB",
          createdTime: "2026-05-20T12:00:00.000Z",
          updatedTime: "2026-05-28T12:00:00.000Z"
        }
      ],
      events: [],
      visitStageHistory: [],
      deals: [attractionDeal],
      stageFacts
    });

    expect(facts).toEqual([
      expect.objectContaining({
        visitId: "CLUB_VISIT_AFTER_DEAL",
        dealId: null,
        contactId: "321",
        stageIdAtEvent: null,
        linkConfidence: "low",
        linkReason: "event_visit_without_direct_deal"
      })
    ]);
  });

  it("does not link contact-only event visits to deals created after the event date", () => {
    const futureDeal = {
      ...attractionDeal,
      id: "FUTURE_DEAL",
      contactId: "321",
      dateCreate: "2026-05-30T09:00:00.000Z",
      dateModify: "2026-05-30T09:00:00.000Z"
    } satisfies DealSnapshot;
    const stageFacts = buildDealStageFacts({
      deals: [futureDeal],
      stageHistory: [],
      stageCatalog
    });

    const facts = buildEventVisitFacts({
      visits: [
        {
          id: "VISIT_BEFORE_DEAL",
          eventId: null,
          eventName: "Гостевая встреча 28.05.",
          eventDate: "2026-05-28T00:00:00.000Z",
          status: "attended",
          stageId: "DT162_14:SUCCESS",
          stageName: "Дошел",
          dealId: null,
          contactId: "321",
          managerId: "13020",
          sourceId: "LEADGEN_US",
          createdTime: "2026-05-18T12:00:00.000Z",
          updatedTime: "2026-05-28T12:00:00.000Z"
        }
      ],
      events: [],
      visitStageHistory: [],
      deals: [futureDeal],
      stageFacts
    });

    expect(facts).toEqual([
      expect.objectContaining({
        visitId: "VISIT_BEFORE_DEAL",
        dealId: null,
        stageIdAtEvent: null,
        linkConfidence: "low",
        linkReason: "event_visit_without_direct_deal"
      })
    ]);
  });

  it("does not promote upstream event visit deal ids outside scoped attraction deals", () => {
    const stageFacts = buildDealStageFacts({
      deals: [attractionDeal],
      stageHistory,
      stageCatalog
    });

    const facts = buildEventVisitFacts({
      visits: [
        {
          id: "VISIT_MISSING_DEAL",
          eventId: null,
          eventName: "Гостевая встреча 28.05.",
          eventDate: "2026-05-28T00:00:00.000Z",
          status: "attended",
          stageId: "DT162_14:SUCCESS",
          stageName: "Дошел",
          dealId: "OUTSIDE_ATTRACTION_DEAL",
          contactId: "NO_SCOPED_DEAL_CONTACT",
          managerId: "13020",
          sourceId: "LEADGEN_US",
          createdTime: "2026-05-18T12:00:00.000Z",
          updatedTime: "2026-05-28T12:00:00.000Z"
        }
      ],
      events: [],
      visitStageHistory: [],
      deals: [attractionDeal],
      stageFacts
    });

    expect(facts).toEqual([
      expect.objectContaining({
        visitId: "VISIT_MISSING_DEAL",
        dealId: null,
        stageIdAtEvent: null,
        linkConfidence: "low",
        linkReason: "event_visit_deal_out_of_scope"
      })
    ]);
    expect(JSON.parse(facts[0]?.payloadJson ?? "{}")).toMatchObject({
      upstreamDealId: "OUTSIDE_ATTRACTION_DEAL"
    });
    expect(
      buildConversionEventTouchpointFacts({
        eventVisitFacts: facts,
        stageFacts
      })
    ).toEqual([]);
  });
});
