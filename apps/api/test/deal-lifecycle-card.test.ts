import { describe, expect, it } from "vitest";

import type {
  DealSnapshot,
  DealTouchpointFactSnapshot,
  EventSnapshot,
  EventVisitFactSnapshot,
  StageCatalogEntry,
  StageHistorySnapshot,
  UnitEconomicsCostFact,
  UnitEconomicsCostRule
} from "@bitrix24-reporting/contracts";

import { DEFAULT_PRICING_RULES } from "../src/domain/deal-economics.js";
import { buildDealLifecycleCard } from "../src/domain/deal-lifecycle-card.js";

const range = {
  from: "2026-04-01T00:00:00.000Z",
  to: "2026-04-30T23:59:59.999Z"
};

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
    statusId: "C10:MEETING",
    name: "Встреча-знакомство",
    semanticId: "P",
    sortOrder: 20
  },
  {
    entityType: "deal",
    categoryId: "10",
    statusId: "C10:WON",
    name: "Передана в клуб",
    semanticId: "S",
    sortOrder: 30
  },
  {
    entityType: "source",
    categoryId: null,
    statusId: "LEADGEN_US",
    name: "Лидген УС",
    semanticId: null,
    sortOrder: 10
  }
] satisfies StageCatalogEntry[];

const stageHistory = [
  {
    id: "stage-base",
    ownerId: "DEAL_WON",
    categoryId: "10",
    stageId: "C10:BASE",
    stageSemanticId: "P",
    typeId: 1,
    createdTime: "2026-04-10T09:00:00.000Z"
  },
  {
    id: "stage-meeting",
    ownerId: "DEAL_WON",
    categoryId: "10",
    stageId: "C10:MEETING",
    stageSemanticId: "P",
    typeId: 2,
    createdTime: "2026-04-15T09:00:00.000Z"
  },
  {
    id: "stage-won",
    ownerId: "DEAL_WON",
    categoryId: "10",
    stageId: "C10:WON",
    stageSemanticId: "S",
    typeId: 2,
    createdTime: "2026-04-20T09:00:00.000Z"
  }
] satisfies StageHistorySnapshot[];

const baseDeal = {
  id: "DEAL_WON",
  title: null,
  contactId: null,
  leadId: null,
  categoryId: "10",
  stageId: "C10:WON",
  stageSemanticId: "S",
  opportunity: 1_100_000,
  assignedById: "78",
  sourceId: "LEADGEN_US",
  qualityValue: "Готов к встрече",
  businessClubValue: "ClubFirst One",
  targetGroupValue: "ClubFirst Russia",
  meetingTypeValue: "Очная",
  meetingDateValue: "2026-04-18T12:00:00.000Z",
  tariffValue: "Федеральный",
  conversionEventValue: null,
  refusalReasonValue: null,
  refusalReasonDetail: null,
  dateCreate: "2026-04-10T09:00:00.000Z",
  dateModify: "2026-04-20T12:00:00.000Z",
  dateClosed: "2026-04-20T12:00:00.000Z",
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmContent: null,
  utmTerm: null
} satisfies DealSnapshot;

const events = [
  {
    eventId: "GUEST_EVENT",
    entityTypeId: 1036,
    categoryId: null,
    title: "Гостевая встреча ClubFirst",
    eventDate: "2026-04-18T12:00:00.000Z",
    startAt: null,
    endAt: null,
    stageId: "SUCCESS",
    stageName: "Проведено",
    status: "completed",
    eventTypeId: null,
    eventTypeLabel: null,
    formatId: null,
    createdTime: "2026-04-01T00:00:00.000Z",
    updatedTime: "2026-04-18T12:00:00.000Z"
  }
] satisfies EventSnapshot[];

const costRules = [
  {
    id: "leadgen-ready-to-meet",
    articleId: "lead_purchase",
    pnlLevel: "variable_contribution",
    costBehavior: "variable",
    calculationMethod: "amount_per_lead",
    unitPrice: 40_000,
    percent: null,
    amount: null,
    sourceKey: "LEADGEN_US",
    qualityValue: "Готов к встрече",
    enabled: true,
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    sortOrder: 10
  },
  {
    id: "contractation-per-won",
    articleId: "contractation",
    pnlLevel: "variable_contribution",
    costBehavior: "variable",
    calculationMethod: "amount_per_contract",
    unitPrice: 5_000,
    percent: null,
    amount: null,
    sourceKey: null,
    qualityValue: null,
    enabled: true,
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    sortOrder: 20
  },
  {
    id: "guest-meeting-participant",
    articleId: "demo_events",
    pnlLevel: "variable_contribution",
    costBehavior: "variable",
    calculationMethod: "amount_per_participant",
    unitPrice: 7_000,
    percent: null,
    amount: null,
    sourceKey: null,
    qualityValue: null,
    eventNamePattern: "Гостевая встреча",
    enabled: true,
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    sortOrder: 30
  }
] satisfies UnitEconomicsCostRule[];

const employeeCostFact = {
  id: "employee-april",
  articleId: "community_integrators_fixed",
  pnlLevel: "above_ebitda",
  costBehavior: "fixed",
  calculationMethod: "manual_amount",
  periodStart: "2026-04-01",
  periodEnd: "2026-04-30",
  amount: 90_000,
  currency: "RUB",
  quantity: 1,
  sourceSystem: "manual",
  sourceReference: null,
  confidence: "manual",
  status: "active",
  comment: null
} satisfies UnitEconomicsCostFact;

function touchpoint(
  overrides: Partial<DealTouchpointFactSnapshot> & Pick<DealTouchpointFactSnapshot, "factId" | "kind" | "occurredAt">
): DealTouchpointFactSnapshot {
  return {
    sourceSystem: "bitrix24",
    sourceEntityType: "test",
    sourceEntityId: overrides.factId,
    dealId: "DEAL_WON",
    contactId: null,
    leadId: null,
    managerId: "78",
    sourceId: "LEADGEN_US",
    stageIdAtEvent: "C10:MEETING",
    stageNameAtEvent: "Встреча-знакомство",
    linkConfidence: "high",
    linkReason: "test",
    payloadJson: null,
    ...overrides
  };
}

function eventVisit(
  overrides: Partial<EventVisitFactSnapshot> = {}
): EventVisitFactSnapshot {
  return {
    visitId: "VISIT_GUEST_1",
    eventId: "GUEST_EVENT",
    dealId: "DEAL_WON",
    contactId: null,
    leadId: null,
    managerId: "78",
    sourceId: "LEADGEN_US",
    currentStageId: "ATTENDED",
    currentStageName: "Посетил",
    invitedAt: "2026-04-16T10:00:00.000Z",
    confirmedAt: null,
    attendedAt: "2026-04-18T12:00:00.000Z",
    refusedAt: null,
    finalStatus: "attended",
    eventDate: "2026-04-18T12:00:00.000Z",
    stageIdAtEvent: "C10:MEETING",
    linkConfidence: "high",
    linkReason: "test",
    payloadJson: JSON.stringify({ eventName: "Гостевая встреча ClubFirst" }),
    ...overrides
  };
}

describe("buildDealLifecycleCard", () => {
  it("builds a won card with safe events and deal-level sale costs", () => {
    const card = buildDealLifecycleCard({
      range,
      deal: baseDeal,
      status: "won",
      stageCatalog,
      stageHistory,
      touchpointFacts: [
        touchpoint({
          factId: "call:CALL_1",
          kind: "call",
          occurredAt: "2026-04-16T10:00:00.000Z",
          payloadJson: JSON.stringify({
            direction: "outgoing",
            durationSeconds: 90,
            connected: true,
            failed: false,
            overThirtySeconds: true
          })
        }),
        touchpoint({
          factId: "task-created:TASK_1",
          kind: "task_created",
          occurredAt: "2026-04-16T11:00:00.000Z"
        }),
        touchpoint({
          factId: "task-completed:TASK_1",
          kind: "task_completed",
          occurredAt: "2026-04-16T12:00:00.000Z"
        }),
        touchpoint({
          factId: "conversion-event-visit:VISIT_GUEST_1",
          kind: "conversion_event_visit",
          occurredAt: "2026-04-18T12:00:00.000Z",
          payloadJson: JSON.stringify({
            eventId: "GUEST_EVENT",
            eventName: "Гостевая встреча ClubFirst",
            eventDate: "2026-04-18T12:00:00.000Z",
            finalStatus: "attended"
          })
        }),
        touchpoint({
          factId: "meeting:MEETING_1",
          kind: "meeting",
          occurredAt: "2026-04-18T13:00:00.000Z",
          payloadJson: JSON.stringify({ completed: true })
        }),
        touchpoint({
          factId: "meeting-date-changed:MEETING_1",
          kind: "meeting_date_changed",
          occurredAt: "2026-04-17T10:00:00.000Z",
          payloadJson: JSON.stringify({
            previousMeetingDate: "2026-04-17T12:00:00.000Z",
            nextMeetingDate: "2026-04-18T12:00:00.000Z"
          })
        })
      ],
      eventVisitFacts: [eventVisit()],
      events,
      pricingRules: DEFAULT_PRICING_RULES,
      costRules,
      costFacts: [employeeCostFact],
      eventParticipantMode: "attended",
      managerDirectory: [{ id: "78", name: "Ромашова Ольга" }]
    });

    expect(card).toMatchObject({
      dealId: "DEAL_WON",
      managerName: "Ромашова Ольга",
      status: "won",
      sourceLabel: "Лидген УС",
      economics: {
        revenueMode: "actual",
        attractionRevenueAmount: 300_000,
        membershipAmount: 1_100_000,
        saleCostAmount: 52_000,
        marginAmount: 248_000
      },
      eventSummary: {
        conversionEventVisits: 1,
        callSummary: {
          total: 1,
          incoming: 0,
          outgoing: 1,
          successful: 1,
          failed: 0,
          connectedOverThirtySeconds: 1
        },
        taskSummary: {
          created: 1,
          closed: 1
        },
        meetingSummary: {
          total: 1
        }
      }
    });
    expect(card.economics.costRows.map((row) => row.articleId)).toEqual([
      "lead_purchase",
      "contractation",
      "demo_events"
    ]);
    expect(card.economics.costRows).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ articleId: "community_integrators_fixed" })
      ])
    );
    expect(card.stageTimeline[1]?.events.map((event) => event.badgeLabel)).toContain(
      "Гостевая встреча ClubFirst · пришел"
    );
    expect(card.stageTimeline[1]?.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Встреча",
          detail: "проведена"
        }),
        expect.objectContaining({
          title: "Дата встречи изменена",
          detail: "2026-04-17T12:00:00.000Z -> 2026-04-18T12:00:00.000Z"
        })
      ])
    );
    expect(card.stageTimeline[1]?.callSummary).toMatchObject({
      total: 1,
      outgoing: 1,
      connectedOverThirtySeconds: 1
    });
  });

  it("allocates fixed period costs across manager won deals in the sale month", () => {
    const secondWonDeal = {
      ...baseDeal,
      id: "DEAL_WON_SECOND",
      dateCreate: "2026-04-12T09:00:00.000Z",
      dateModify: "2026-04-25T12:00:00.000Z",
      dateClosed: "2026-04-25T12:00:00.000Z"
    } satisfies DealSnapshot;
    const otherMonthWonDeal = {
      ...baseDeal,
      id: "DEAL_WON_MAY",
      dateCreate: "2026-05-01T09:00:00.000Z",
      dateModify: "2026-05-10T12:00:00.000Z",
      dateClosed: "2026-05-10T12:00:00.000Z"
    } satisfies DealSnapshot;

    const card = buildDealLifecycleCard({
      range,
      deal: baseDeal,
      status: "won",
      stageCatalog,
      stageHistory,
      touchpointFacts: [],
      eventVisitFacts: [eventVisit()],
      events,
      pricingRules: DEFAULT_PRICING_RULES,
      costRules,
      costFacts: [employeeCostFact],
      eventParticipantMode: "attended",
      allocationDeals: [baseDeal, secondWonDeal, otherMonthWonDeal]
    });

    expect(card.economics).toMatchObject({
      saleCostAmount: 52_000,
      marginAmount: 248_000,
      allocatedFixedCostAmount: 45_000,
      fullyLoadedCostAmount: 97_000,
      fullyLoadedMarginAmount: 203_000
    });
    expect(card.economics.allocatedFixedCostRows).toEqual([
      expect.objectContaining({
        articleId: "community_integrators_fixed",
        amount: 45_000,
        sourceSystem: "fact",
        basis: "Постоянные расходы менеджера за 2026-04 / 2 выигранные сделки менеджера"
      })
    ]);
  });

  it("splits integrator costs by manager sales and module costs by all module sales", () => {
    const secondManagerDeal = {
      ...baseDeal,
      id: "DEAL_WON_SECOND",
      dateCreate: "2026-04-12T09:00:00.000Z",
      dateModify: "2026-04-25T12:00:00.000Z",
      dateClosed: "2026-04-25T12:00:00.000Z"
    } satisfies DealSnapshot;
    const moduleDeals = [
      baseDeal,
      secondManagerDeal,
      ...["91", "92", "93", "94", "95"].map((managerId, index) => ({
        ...baseDeal,
        id: `DEAL_WON_OTHER_${managerId}`,
        assignedById: managerId,
        dateCreate: `2026-04-${13 + index}T09:00:00.000Z`,
        dateModify: `2026-04-${20 + index}T12:00:00.000Z`,
        dateClosed: `2026-04-${20 + index}T12:00:00.000Z`
      }))
    ] satisfies DealSnapshot[];
    const staleDateClosedDeals = [
      ...Array.from({ length: 5 }, (_, index) => ({
        ...baseDeal,
        id: `DEAL_WON_STALE_MANAGER_${index}`,
        dateCreate: `2026-02-${10 + index}T09:00:00.000Z`,
        dateModify: `2026-04-${10 + index}T12:00:00.000Z`,
        dateClosed: `2026-04-${10 + index}T12:00:00.000Z`
      })),
      ...Array.from({ length: 25 }, (_, index) => {
        const day = String((index % 18) + 1).padStart(2, "0");
        return {
          ...baseDeal,
          id: `DEAL_WON_STALE_MODULE_${index}`,
          assignedById: `STALE_${index}`,
          dateCreate: `2026-02-${day}T09:00:00.000Z`,
          dateModify: `2026-04-${day}T12:00:00.000Z`,
          dateClosed: `2026-04-${day}T12:00:00.000Z`
        };
      })
    ] satisfies DealSnapshot[];
    const allocationDeals = [...moduleDeals, ...staleDateClosedDeals];
    const allocationWonAtByDeal = new Map<string, string>(
      allocationDeals.map((deal) => [
        deal.id,
        staleDateClosedDeals.some((staleDeal) => staleDeal.id === deal.id)
          ? "2026-03-31T12:00:00.000Z"
          : deal.dateClosed ?? deal.dateModify
      ])
    );
    const fixedAndPercentRules = [
      ...costRules,
      {
        id: "community-integrators-fixed",
        articleId: "community_integrators_fixed",
        pnlLevel: "above_ebitda",
        costBehavior: "fixed",
        calculationMethod: "amount_per_period",
        unitPrice: null,
        percent: null,
        amount: 168_000,
        sourceKey: null,
        qualityValue: null,
        enabled: true,
        effectiveFrom: "2026-01-01",
        effectiveTo: null,
        sortOrder: 110
      },
      {
        id: "assistant-fixed",
        articleId: "assistant",
        pnlLevel: "above_ebitda",
        costBehavior: "fixed",
        calculationMethod: "amount_per_period",
        unitPrice: null,
        percent: null,
        amount: 140_000,
        sourceKey: null,
        qualityValue: null,
        enabled: true,
        effectiveFrom: "2026-01-01",
        effectiveTo: null,
        sortOrder: 120
      },
      {
        id: "facility-aho",
        articleId: "facility_aho",
        pnlLevel: "above_ebitda",
        costBehavior: "fixed",
        calculationMethod: "amount_per_period",
        unitPrice: null,
        percent: null,
        amount: 31_500,
        sourceKey: null,
        qualityValue: null,
        enabled: true,
        effectiveFrom: "2026-01-01",
        effectiveTo: null,
        sortOrder: 130
      },
      {
        id: "it-service",
        articleId: "it_service",
        pnlLevel: "above_ebitda",
        costBehavior: "fixed",
        calculationMethod: "amount_per_period",
        unitPrice: null,
        percent: null,
        amount: 10_000,
        sourceKey: null,
        qualityValue: null,
        enabled: true,
        effectiveFrom: "2026-01-01",
        effectiveTo: null,
        sortOrder: 140
      },
      ...[
        ["ctg-technology-center", "ctg_technology_center", 6],
        ["it-development-support", "it_development_support", 4],
        ["other-expenses", "other_expenses", 5],
        ["finance-service", "ctg_finance_service", 2],
        ["taxes", "taxes", 3]
      ].map(([id, articleId, percent], index) => ({
        id: String(id),
        articleId: String(articleId),
        pnlLevel: index >= 3 ? ("below_ebitda" as const) : ("above_ebitda" as const),
        costBehavior: "variable" as const,
        calculationMethod: "percent_of_module_revenue" as const,
        unitPrice: null,
        percent: Number(percent),
        amount: null,
        sourceKey: null,
        qualityValue: null,
        enabled: true,
        effectiveFrom: "2026-01-01",
        effectiveTo: null,
        sortOrder: 200 + index
      }))
    ] satisfies UnitEconomicsCostRule[];

    const card = buildDealLifecycleCard({
      range,
      deal: baseDeal,
      status: "won",
      stageCatalog,
      stageHistory,
      touchpointFacts: [],
      eventVisitFacts: [eventVisit()],
      events,
      pricingRules: DEFAULT_PRICING_RULES,
      costRules: fixedAndPercentRules,
      eventParticipantMode: "attended",
      allocationDeals,
      allocationWonAtByDeal
    });

    expect(card.economics).toMatchObject({
      saleCostAmount: 52_000,
      allocatedFixedCostAmount: 184_750,
      fullyLoadedCostAmount: 236_750,
      fullyLoadedMarginAmount: 63_250
    });
    expect(card.economics.allocatedFixedCostRows).toEqual([
      expect.objectContaining({
        articleId: "community_integrators_fixed",
        label: "Комьюнити-интеграторы, постоянная часть",
        amount: 84_000,
        basis: "Постоянные расходы менеджера за 2026-04 / 2 выигранные сделки менеджера"
      }),
      expect.objectContaining({
        articleId: "facility_aho",
        label: "Facility / АХО",
        amount: 15_750
      }),
      expect.objectContaining({
        articleId: "it_service",
        label: "IT-сервис",
        amount: 5_000
      }),
      expect.objectContaining({
        articleId: "other_fixed_expenses",
        label: "Другие постоянные расходы",
        amount: 80_000,
        basis: "Общемодульные и процентные постоянные расходы за 2026-04 / 7 выигранных сделок модуля"
      })
    ]);
    expect(card.economics.allocatedFixedCostRows).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ articleId: "assistant" })])
    );
  });

  it("keeps linked event costs across the full deal lifecycle, not only the report range", () => {
    const card = buildDealLifecycleCard({
      range: {
        from: "2026-06-01T00:00:00.000Z",
        to: "2026-06-30T23:59:59.999Z"
      },
      deal: {
        ...baseDeal,
        dateCreate: "2026-02-12T09:00:00.000Z",
        dateModify: "2026-06-15T12:00:00.000Z",
        dateClosed: "2026-06-15T12:00:00.000Z"
      },
      status: "won",
      stageCatalog,
      stageHistory: [],
      touchpointFacts: [],
      eventVisitFacts: [
        eventVisit({
          invitedAt: "2026-02-20T09:00:00.000Z",
          attendedAt: "2026-02-20T12:00:00.000Z",
          eventDate: "2026-02-20T12:00:00.000Z"
        })
      ],
      events,
      pricingRules: DEFAULT_PRICING_RULES,
      costRules,
      eventParticipantMode: "attended"
    });

    expect(card.economics.saleCostAmount).toBe(52_000);
    expect(card.economics.costRows.map((row) => row.articleId)).toEqual([
      "lead_purchase",
      "contractation",
      "demo_events"
    ]);
  });

  it("emits stable cost row ids for duplicate event participant costs", () => {
    const card = buildDealLifecycleCard({
      range,
      deal: baseDeal,
      status: "won",
      stageCatalog,
      stageHistory,
      touchpointFacts: [],
      eventVisitFacts: [
        eventVisit({ visitId: "VISIT_GUEST_1" }),
        eventVisit({ visitId: "VISIT_GUEST_2" })
      ],
      events,
      pricingRules: DEFAULT_PRICING_RULES,
      costRules,
      eventParticipantMode: "attended"
    });

    expect(card.economics.saleCostAmount).toBe(59_000);
    expect(card.economics.costRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "event:VISIT_GUEST_1:guest-meeting-participant",
          articleId: "demo_events"
        }),
        expect.objectContaining({
          id: "event:VISIT_GUEST_2:guest-meeting-participant",
          articleId: "demo_events"
        })
      ])
    );
  });

  it("uses fallback summaries and stage timeline when canonical touchpoint facts are absent", () => {
    const fallbackInput = {
      range,
      deal: baseDeal,
      status: "won",
      stageCatalog,
      stageHistory,
      touchpointFacts: [],
      eventVisitFacts: [],
      events,
      pricingRules: DEFAULT_PRICING_RULES,
      costRules,
      fallbackEventSummary: {
        callSummary: {
          total: 3,
          incoming: 1,
          outgoing: 2,
          successful: 2,
          failed: 1,
          overThirtySeconds: 2,
          connectedOverThirtySeconds: 2
        },
        taskSummary: {
          created: 2,
          closed: 1
        },
        meetingSummary: {
          total: 1
        },
        conversionEventVisits: 0
      },
      fallbackStageTimeline: [
        {
          stageId: "C10:BASE",
          stageName: "База входящая",
          enteredAt: "2026-04-10T09:00:00.000Z",
          leftAt: "2026-04-15T09:00:00.000Z",
          durationHours: 120,
          callSummary: {
            total: 3,
            incoming: 1,
            outgoing: 2,
            successful: 2,
            failed: 1,
            overThirtySeconds: 2,
            connectedOverThirtySeconds: 2
          },
          taskSummary: {
            created: 2,
            closed: 1
          },
          meetingEvents: [
            {
              activityId: "MEETING_1",
              createdAt: "2026-04-11T09:00:00.000Z",
              timelineAt: "2026-04-12T09:00:00.000Z",
              scheduledAt: "2026-04-12T09:00:00.000Z",
              completed: true
            }
          ]
        }
      ]
    } satisfies Parameters<typeof buildDealLifecycleCard>[0] & {
      fallbackEventSummary: {
        callSummary: {
          total: number;
          incoming: number;
          outgoing: number;
          successful: number;
          failed: number;
          overThirtySeconds: number;
          connectedOverThirtySeconds: number;
        };
        taskSummary: { created: number; closed: number };
        meetingSummary: { total: number };
        conversionEventVisits: number;
      };
      fallbackStageTimeline: Array<{
        stageId: string;
        stageName: string;
        enteredAt: string;
        leftAt: string;
        durationHours: number;
        callSummary: {
          total: number;
          incoming: number;
          outgoing: number;
          successful: number;
          failed: number;
          overThirtySeconds: number;
          connectedOverThirtySeconds: number;
        };
        taskSummary: { created: number; closed: number };
        meetingEvents: Array<{
          activityId: string;
          createdAt: string;
          timelineAt: string;
          scheduledAt: string;
          completed: boolean;
        }>;
      }>;
    };

    const card = buildDealLifecycleCard(fallbackInput);

    expect(card.eventSummary.callSummary.total).toBe(3);
    expect(card.eventSummary.taskSummary.created).toBe(2);
    expect(card.eventSummary.meetingSummary.total).toBe(1);
    expect(card.stageTimeline[0]).toMatchObject({
      stageId: "C10:BASE",
      callSummary: {
        total: 3,
        connectedOverThirtySeconds: 2
      },
      taskSummary: {
        created: 2,
        closed: 1
      },
      meetingEvents: [
        expect.objectContaining({
          activityId: "MEETING_1"
        })
      ],
      events: []
    });
  });

  it("keeps lost deal revenue at zero while preserving incurred lead and event costs", () => {
    const card = buildDealLifecycleCard({
      range,
      deal: {
        ...baseDeal,
        stageId: "C10:LOSE",
        stageSemanticId: "F",
        dateClosed: "2026-04-19T12:00:00.000Z"
      },
      status: "lost",
      stageCatalog,
      stageHistory: [],
      touchpointFacts: [
        touchpoint({
          factId: "conversion-event-visit:VISIT_GUEST_REFUSED",
          kind: "conversion_event_visit",
          occurredAt: "2026-04-18T12:00:00.000Z",
          payloadJson: JSON.stringify({
            eventName: "Гостевая встреча ClubFirst",
            finalStatus: "refused"
          })
        })
      ],
      eventVisitFacts: [
        eventVisit({
          visitId: "VISIT_GUEST_REFUSED",
          finalStatus: "refused",
          attendedAt: null,
          refusedAt: "2026-04-18T12:00:00.000Z"
        })
      ],
      events,
      pricingRules: DEFAULT_PRICING_RULES,
      costRules,
      eventParticipantMode: "invited"
    });

    expect(card.economics).toMatchObject({
      revenueMode: "none",
      attractionRevenueAmount: 0,
      saleCostAmount: 47_000,
      marginAmount: -47_000
    });
    expect(card.economics.costRows.map((row) => row.articleId)).toEqual([
      "lead_purchase",
      "demo_events"
    ]);
    expect(card.stageTimeline[0]?.events.map((event) => event.badgeLabel)).toContain(
      "Гостевая встреча ClubFirst · отказ"
    );
  });

  it("marks wip revenue as planned and does not calculate final margin", () => {
    const card = buildDealLifecycleCard({
      range,
      deal: {
        ...baseDeal,
        stageId: "C10:MEETING",
        stageSemanticId: "P",
        dateClosed: null
      },
      status: "wip",
      stageCatalog,
      stageHistory: [],
      touchpointFacts: [],
      eventVisitFacts: [],
      events,
      pricingRules: DEFAULT_PRICING_RULES,
      costRules,
      terminalAt: "2026-04-30T23:59:59.999Z"
    });

    expect(card.economics).toMatchObject({
      revenueMode: "planned",
      attractionRevenueAmount: 300_000,
      saleCostAmount: 40_000,
      marginAmount: null
    });
    expect(card.cycleDays).toBe(20.62);
  });
});
