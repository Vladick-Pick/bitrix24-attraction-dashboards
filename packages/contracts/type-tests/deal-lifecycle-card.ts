import type {
  DealLifecycleCard,
  DealLifecycleStatus,
  DealSaleEconomics,
  DealTimelineEvent,
  DealTimelineEventKind,
  ManagerActionOutcomeDealDetail,
  SalesDealRow,
} from "../src/index.js";

const status: DealLifecycleStatus = "won";
const eventKind: DealTimelineEventKind = "conversion_event_visit";

const event = {
  id: "conversion-event-visit:VISIT_1",
  kind: eventKind,
  occurredAt: "2026-06-01T10:00:00.000Z",
  stageId: "C10:UC_61CBCU",
  stageName: "Активация",
  title: "Мероприятие: Гостевая встреча ClubFirst",
  detail: "пришел",
  badgeLabel: "Гостевая встреча ClubFirst · пришел",
  linkConfidence: "high",
} satisfies DealTimelineEvent;

const economics = {
  revenueMode: "actual",
  attractionRevenueAmount: 300_000,
  membershipAmount: 1_100_000,
  saleCostAmount: 63_500,
  marginAmount: 236_500,
  allocatedFixedCostAmount: 45_000,
  fullyLoadedCostAmount: 108_500,
  fullyLoadedMarginAmount: 191_500,
  costRows: [
    {
      id: "lead:143536:leadgen-ready-to-meet",
      articleId: "lead_purchase",
      label: "Лид",
      amount: 40_000,
      basis: "Созданная сделка источника/качества",
      sourceSystem: "rule",
      confidence: "inferred",
    },
  ],
  allocatedFixedCostRows: [
    {
      id: "fixed-fact:2026-06:78:employee-june",
      articleId: "community_integrators_fixed",
      label: "Комьюнити-интеграторы, постоянная часть",
      amount: 45_000,
      basis: "Постоянные расходы месяца 2026-06 / 2 выигранные сделки менеджера",
      sourceSystem: "fact",
      confidence: "manual",
    },
  ],
} satisfies DealSaleEconomics;

const card = {
  dealId: "143536",
  managerId: "78",
  managerName: "Ромашова Ольга",
  status,
  stageId: "C10:WON",
  stageName: "Передана в клуб",
  dateCreate: "2026-02-12T09:00:00.000Z",
  dateClosed: "2026-06-15T12:00:00.000Z",
  dateModify: "2026-06-15T12:00:00.000Z",
  cycleDays: 123,
  sourceKey: "LEADGEN_US",
  sourceLabel: "Лидген УС",
  qualityValue: "Готов к коммуникации",
  businessClubValue: "ClubFirst One",
  targetGroupValue: "ClubFirst Russia",
  meetingTypeValue: "Очная",
  meetingDateValue: "2026-02-20T10:00:00.000Z",
  tariffValue: "Федеральный Москва",
  economics,
  eventSummary: {
    callSummary: {
      total: 21,
      incoming: 4,
      outgoing: 2,
      successful: 14,
      failed: 7,
      overThirtySeconds: 14,
      connectedOverThirtySeconds: 14,
    },
    taskSummary: {
      created: 34,
      closed: 34,
    },
    meetingSummary: {
      total: 1,
    },
    conversionEventVisits: 3,
  },
  stageTimeline: [
    {
      stageId: "C10:UC_61CBCU",
      stageName: "Активация",
      enteredAt: "2026-02-20T10:00:00.000Z",
      leftAt: "2026-03-12T09:00:00.000Z",
      durationHours: 479,
      callSummary: {
        total: 1,
        incoming: 0,
        outgoing: 1,
        successful: 1,
        failed: 0,
        overThirtySeconds: 1,
        connectedOverThirtySeconds: 1,
      },
      taskSummary: {
        created: 6,
        closed: 7,
      },
      meetingEvents: [],
      events: [event],
    },
  ],
} satisfies DealLifecycleCard;

card.stageTimeline[0]?.events[0]?.badgeLabel?.toLocaleLowerCase("ru-RU");

const salesDeal = {
  dealId: "143536",
  dealTitle: "143536",
  managerId: "78",
  managerName: "Ромашова Ольга",
  amount: 300_000,
  attractionRevenueAmount: 300_000,
  membershipAmount: 1_100_000,
  pricingStatus: "priced",
  pricingWarnings: [],
  dateCreate: "2026-02-12T09:00:00.000Z",
  dateClosed: "2026-06-15T12:00:00.000Z",
  cycleDays: 123,
  cohortContext: {
    createdMonth: "2026-02",
    cohortCreatedDeals: 10,
    cohortWonDeals: 2,
    cohortWonConversionRate: 20,
  },
  callSummary: card.eventSummary.callSummary,
  taskSummary: card.eventSummary.taskSummary,
  meetingSummary: card.eventSummary.meetingSummary,
  stageTimeline: card.stageTimeline,
  lifecycleCard: card,
} satisfies SalesDealRow;

const managerActionDetail = {
  dealId: "143536",
  stageId: "C10:WON",
  stageName: "Передана в клуб",
  amount: 300_000,
  dateCreate: "2026-02-12T09:00:00.000Z",
  dateClosed: "2026-06-15T12:00:00.000Z",
  dateModify: "2026-06-15T12:00:00.000Z",
  taskSummary: card.eventSummary.taskSummary,
  callSummary: card.eventSummary.callSummary,
  meetingSummary: card.eventSummary.meetingSummary,
  sla: {
    sla1: { status: "onTime", hours: 1 },
    sla2: { status: "late", hours: 24 },
    sla3: { status: "noTouch", hours: null },
  },
  stageTimeline: card.stageTimeline,
  lifecycleCard: {
    ...card,
    sla: {
      sla1: { status: "onTime", hours: 1 },
      sla2: { status: "late", hours: 24 },
      sla3: { status: "noTouch", hours: null },
    },
  },
} satisfies ManagerActionOutcomeDealDetail;

salesDeal.lifecycleCard.stageTimeline[0]?.events[0]?.id.toLocaleLowerCase("ru-RU");
managerActionDetail.lifecycleCard.sla?.sla3.status.toLocaleLowerCase("ru-RU");
