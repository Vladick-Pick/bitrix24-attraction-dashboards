import { describe, expect, it } from "vitest";

import type {
  DealSnapshot,
  EventSnapshot,
  EventVisitFactSnapshot,
  ManagerDirectoryEntry,
  StageCatalogEntry
} from "@bitrix24-reporting/contracts";

import {
  DEFAULT_UNIT_ECONOMICS_COST_RULES,
  buildUnitEconomicsReport
} from "../src/domain/unit-economics";
import { DEFAULT_PRICING_RULES } from "../src/domain/deal-economics";

const range = {
  from: "2026-04-01T00:00:00.000Z",
  to: "2026-04-30T23:59:59.999Z"
};

const stageCatalog: StageCatalogEntry[] = [
  {
    entityType: "source",
    categoryId: null,
    statusId: "8",
    name: "Лидген УС",
    semanticId: null,
    sortOrder: 5
  },
  {
    entityType: "source",
    categoryId: null,
    statusId: "LEADGEN_US",
    name: "Лидген УС",
    semanticId: null,
    sortOrder: 10
  },
  {
    entityType: "source",
    categoryId: null,
    statusId: "WEB",
    name: "Сайт",
    semanticId: null,
    sortOrder: 20
  }
];

const managerDirectory: ManagerDirectoryEntry[] = [
  { id: "78", name: "Мария Потапова" },
  { id: "99", name: "Илья Орлов" }
];

const events: EventSnapshot[] = [
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
  },
  {
    eventId: "BUSINESS_DIALOG_EVENT",
    entityTypeId: 1036,
    categoryId: null,
    title: "Бизнес-диалог: Борис Титов, 13.05",
    eventDate: "2026-04-19T12:00:00.000Z",
    startAt: null,
    endAt: null,
    stageId: "SUCCESS",
    stageName: "Проведено",
    status: "completed",
    eventTypeId: null,
    eventTypeLabel: null,
    formatId: null,
    createdTime: "2026-04-01T00:00:00.000Z",
    updatedTime: "2026-04-19T12:00:00.000Z"
  }
];

const eventVisitFacts: EventVisitFactSnapshot[] = [
  {
    visitId: "VISIT_GUEST_1",
    eventId: "GUEST_EVENT",
    dealId: "LEADGEN_WON",
    contactId: null,
    leadId: null,
    managerId: "78",
    sourceId: "LEADGEN_US",
    currentStageId: "ATTENDED",
    currentStageName: "Посетил",
    invitedAt: "2026-04-16T10:00:00.000Z",
    confirmedAt: "2026-04-17T10:00:00.000Z",
    attendedAt: "2026-04-18T12:00:00.000Z",
    refusedAt: null,
    finalStatus: "attended",
    eventDate: "2026-04-18T12:00:00.000Z",
    stageIdAtEvent: "C10:MEETING",
    linkConfidence: "high",
    linkReason: "test",
    payloadJson: JSON.stringify({ eventName: "Гостевая встреча ClubFirst" })
  },
  {
    visitId: "VISIT_BUSINESS_DIALOG_1",
    eventId: "BUSINESS_DIALOG_EVENT",
    dealId: "LEADGEN_WON",
    contactId: null,
    leadId: null,
    managerId: "78",
    sourceId: "LEADGEN_US",
    currentStageId: "ATTENDED",
    currentStageName: "Посетил",
    invitedAt: "2026-04-17T10:00:00.000Z",
    confirmedAt: "2026-04-18T10:00:00.000Z",
    attendedAt: "2026-04-19T12:00:00.000Z",
    refusedAt: null,
    finalStatus: "attended",
    eventDate: "2026-04-19T12:00:00.000Z",
    stageIdAtEvent: "C10:MEETING",
    linkConfidence: "high",
    linkReason: "test",
    payloadJson: JSON.stringify({ eventName: "Бизнес-диалог: Борис Титов, 13.05" })
  }
];

const baseDeal: Omit<DealSnapshot, "id" | "stageId" | "stageSemanticId" | "sourceId" | "qualityValue" | "dateCreate" | "dateClosed"> = {
  title: null,
  contactId: null,
  leadId: null,
  categoryId: "10",
  opportunity: 1_000_000,
  assignedById: "78",
  businessClubValue: "ClubFirst One",
  targetGroupValue: "ClubFirst Russia",
  meetingTypeValue: null,
  meetingDateValue: null,
  tariffValue: "Федеральный",
  conversionEventValue: null,
  refusalReasonValue: null,
  refusalReasonDetail: null,
  dateModify: "2026-04-20T00:00:00.000Z",
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmContent: null,
  utmTerm: null
};

function deal(overrides: Partial<DealSnapshot> & Pick<DealSnapshot, "id">): DealSnapshot {
  return {
    ...baseDeal,
    stageId: "C10:WON",
    stageSemanticId: "S",
    sourceId: "LEADGEN_US",
    qualityValue: "Готов к встрече",
    dateCreate: "2026-04-10T00:00:00.000Z",
    dateClosed: "2026-04-20T00:00:00.000Z",
    ...overrides
  };
}

describe("buildUnitEconomicsReport", () => {
  it("calculates P&L with paid Leadgen US ready-to-meet leads, free other sources, and 5000 contractation per won deal", () => {
    const report = buildUnitEconomicsReport({
      range,
      deals: [
        deal({ id: "LEADGEN_WON" }),
        deal({
          id: "LEADGEN_ACTIVE",
          stageId: "C10:NEW",
          stageSemanticId: "P",
          dateClosed: null
        }),
        deal({
          id: "WEB_WON",
          assignedById: "99",
          sourceId: "WEB",
          qualityValue: "Любое качество"
        })
      ],
      stageCatalog,
      stageHistory: [],
      managerDirectory,
      pricingRules: DEFAULT_PRICING_RULES,
      costRules: [
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
          id: "ctg-technology-center",
          articleId: "ctg_technology_center",
          pnlLevel: "above_ebitda",
          costBehavior: "variable",
          calculationMethod: "percent_of_module_revenue",
          unitPrice: null,
          percent: 10,
          amount: null,
          sourceKey: null,
          qualityValue: null,
          enabled: true,
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          sortOrder: 30
        }
      ],
      costFacts: [
        {
          id: "facility-april",
          articleId: "facility_aho",
          pnlLevel: "above_ebitda",
          costBehavior: "fixed",
          calculationMethod: "manual_amount",
          periodStart: "2026-04-01",
          periodEnd: "2026-04-30",
          amount: 31_500,
          currency: "RUB",
          quantity: 1,
          sourceSystem: "manual",
          sourceReference: null,
          confidence: "manual",
          status: "active",
          comment: null
        }
      ]
    });

    expect(report.summary.createdDeals).toBe(3);
    expect(report.summary.wonDeals).toBe(2);
    expect(report.summary.purchasedLeads).toBe(2);
    expect(report.summary.attractionRevenue).toBe(600_000);
    expect(report.summary.clubRevenue).toBe(2_000_000);
    expect(report.summary.leadPurchaseCost).toBe(80_000);
    expect(report.summary.contractationCost).toBe(10_000);
    expect(report.summary.variableCosts).toBe(90_000);
    expect(report.summary.contributionResult).toBe(510_000);
    expect(report.summary.aboveEbitdaCosts).toBe(91_500);
    expect(report.summary.ebitda).toBe(418_500);
    expect(report.summary.netProfit).toBe(418_500);
    expect(report.summary.contributionMargin).toBe(0.85);
    expect(report.summary.ebitdaMargin).toBe(0.6975);

    const leadgenReady = report.sourceQualityRows.find(
      (row) => row.sourceKey === "LEADGEN_US" && row.qualityValue === "Готов к встрече"
    );
    const web = report.sourceQualityRows.find((row) => row.sourceKey === "WEB");

    expect(leadgenReady).toMatchObject({
      sourceLabel: "Лидген УС",
      createdDeals: 2,
      wonDeals: 1,
      leadPurchaseCost: 80_000,
      contractationCost: 5_000,
      financialResult: 215_000
    });
    expect(web).toMatchObject({
      sourceLabel: "Сайт",
      createdDeals: 1,
      wonDeals: 1,
      leadPurchaseCost: 0,
      contractationCost: 5_000,
      financialResult: 295_000
    });
    expect(report.managerRows).toEqual([
      expect.objectContaining({
        managerId: "99",
        managerName: "Илья Орлов",
        createdDeals: 1,
        wonDeals: 1,
        purchasedLeads: 0,
        attractionRevenue: 300_000,
        leadPurchaseCost: 0,
        contractationCost: 5_000,
        variableCosts: 5_000,
        financialResult: 265_000,
        margin: 0.8833
      }),
      expect.objectContaining({
        managerId: "78",
        managerName: "Мария Потапова",
        createdDeals: 2,
        wonDeals: 1,
        purchasedLeads: 2,
        attractionRevenue: 300_000,
        leadPurchaseCost: 80_000,
        contractationCost: 5_000,
        variableCosts: 85_000,
        financialResult: 185_000,
        margin: 0.6167
      })
    ]);
    expect(report.costRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          articleId: "lead_purchase",
          calculationMethod: "amount_per_lead",
          amount: 80_000,
          quantity: 2,
          unitPrice: 40_000,
          sourceKey: "LEADGEN_US",
          qualityValue: "Готов к встрече"
        }),
        expect.objectContaining({
          articleId: "contractation",
          calculationMethod: "amount_per_contract",
          amount: 10_000,
          quantity: 2,
          unitPrice: 5_000
        })
      ])
    );
  });

  it("ships editable default rules for lead purchase and 5000 contractation", () => {
    expect(DEFAULT_UNIT_ECONOMICS_COST_RULES).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "leadgen-us-ready-to-meet-default",
          articleId: "lead_purchase",
          calculationMethod: "amount_per_lead",
          sourceKey: "Лидген УС",
          qualityValue: "Готов к встрече",
          unitPrice: 20_000,
          enabled: true
        }),
        expect.objectContaining({
          id: "contractation-per-won-default",
          articleId: "contractation",
          calculationMethod: "amount_per_contract",
          unitPrice: 5_000,
          effectiveFrom: "2025-07-01",
          enabled: true
        }),
        expect.objectContaining({
          id: "leadgen-us-attended-meeting-default",
          articleId: "lead_purchase",
          calculationMethod: "amount_per_lead",
          sourceKey: "Лидген УС",
          qualityValue: "Пришёл на встречу",
          unitPrice: 40_000,
          enabled: true
        }),
        expect.objectContaining({
          id: "guest-meeting-participant-default",
          articleId: "demo_events",
          pnlLevel: "variable_contribution",
          calculationMethod: "amount_per_participant",
          unitPrice: 5_000,
          eventNamePattern: "Гостевая встреча",
          enabled: true
        }),
        expect.objectContaining({
          id: "other-conversion-event-participant-default",
          articleId: "demo_events",
          pnlLevel: "variable_contribution",
          calculationMethod: "amount_per_participant",
          unitPrice: 15_000,
          eventNamePattern: null,
          enabled: true
        })
      ])
    );
  });

  it("allocates shared assistant fixed costs across manager rows", () => {
    const report = buildUnitEconomicsReport({
      range,
      deals: [
        deal({ id: "MARIA_WON" }),
        deal({
          id: "ILYA_WON",
          assignedById: "99",
          sourceId: "WEB",
          qualityValue: "Любое качество"
        })
      ],
      stageCatalog,
      stageHistory: [],
      managerDirectory,
      pricingRules: DEFAULT_PRICING_RULES,
      costRules: [
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
          eventNamePattern: null,
          enabled: true,
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          sortOrder: 10
        }
      ],
      costFacts: []
    });

    expect(report.summary.aboveEbitdaCosts).toBe(140_000);
    expect(report.costRows.find((row) => row.articleId === "assistant")).toMatchObject({
      amount: 140_000,
      quantity: 1
    });

    for (const managerId of ["78", "99"]) {
      const manager = report.managerRows.find((row) => row.managerId === managerId);
      const assistantRow = manager?.directCostRows.find(
        (row) => row.articleId === "assistant"
      );

      expect(assistantRow).toMatchObject({
        amount: 70_000,
        basis: "Общие расходы / 2 менеджера"
      });
    }
  });

  it("matches paid Leadgen US rules by source label when Bitrix source id is numeric", () => {
    const report = buildUnitEconomicsReport({
      range,
      deals: [
        deal({
          id: "LEADGEN_NUMERIC_SOURCE",
          sourceId: "8",
          qualityValue: "3.1 Готов ко встрече с представителем клуба"
        })
      ],
      stageCatalog,
      stageHistory: [],
      pricingRules: DEFAULT_PRICING_RULES,
      costRules: [
        {
          id: "leadgen-label-ready-to-meet",
          articleId: "lead_purchase",
          pnlLevel: "variable_contribution",
          costBehavior: "variable",
          calculationMethod: "amount_per_lead",
          unitPrice: 40_000,
          percent: null,
          amount: null,
          sourceKey: "Лидген УС",
          qualityValue: "Готов к встрече",
          enabled: true,
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          sortOrder: 10
        }
      ],
      costFacts: []
    });

    expect(report.summary.purchasedLeads).toBe(1);
    expect(report.summary.leadPurchaseCost).toBe(40_000);
    expect(report.sourceQualityRows[0]).toMatchObject({
      sourceKey: "8",
      sourceLabel: "Лидген УС",
      qualityValue: "3.1 Готов ко встрече с представителем клуба",
      leadPurchaseCost: 40_000
    });
  });

  it("shows and accounts paid Leadgen US rows for every configured final quality", () => {
    const report = buildUnitEconomicsReport({
      range,
      deals: [
        deal({
          id: "LEADGEN_READY",
          qualityValue: "3.1 Готов ко встрече с представителем клуба"
        }),
        deal({
          id: "LEADGEN_CONTRACT",
          qualityValue: "5 Готов к заключению Договора"
        })
      ],
      stageCatalog,
      stageHistory: [],
      managerDirectory,
      pricingRules: DEFAULT_PRICING_RULES,
      costRules: [
        {
          id: "leadgen-ready-to-meet",
          articleId: "lead_purchase",
          pnlLevel: "variable_contribution",
          costBehavior: "variable",
          calculationMethod: "amount_per_lead",
          unitPrice: 40_000,
          percent: null,
          amount: null,
          sourceKey: "Лидген УС",
          qualityValue: "Готов к встрече",
          eventNamePattern: null,
          enabled: true,
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          sortOrder: 10
        },
        {
          id: "leadgen-ready-to-contract",
          articleId: "lead_purchase",
          pnlLevel: "variable_contribution",
          costBehavior: "variable",
          calculationMethod: "amount_per_lead",
          unitPrice: 55_000,
          percent: null,
          amount: null,
          sourceKey: "Лидген УС",
          qualityValue: "Готов к заключению Договора",
          eventNamePattern: null,
          enabled: true,
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          sortOrder: 20
        }
      ],
      costFacts: []
    });

    expect(report.summary.purchasedLeads).toBe(2);
    expect(report.summary.leadPurchaseCost).toBe(95_000);
    expect(report.sourceQualityRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          qualityValue: "3.1 Готов ко встрече с представителем клуба",
          purchasedLeads: 1,
          leadPurchaseCost: 40_000
        }),
        expect.objectContaining({
          qualityValue: "5 Готов к заключению Договора",
          purchasedLeads: 1,
          leadPurchaseCost: 55_000
        })
      ])
    );
    expect(report.managerRows[0]?.productionCostRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productLabel: "Лидген УС · 3.1 Готов ко встрече с представителем клуба",
          amount: 40_000
        }),
        expect.objectContaining({
          productLabel: "Лидген УС · 5 Готов к заключению Договора",
          amount: 55_000
        })
      ])
    );
  });

  it("counts event costs by invited participants by default and keeps attended-only mode available", () => {
    const refusedGuestVisit: EventVisitFactSnapshot = {
      ...eventVisitFacts[0]!,
      visitId: "VISIT_GUEST_REFUSED",
      currentStageId: "REFUSED",
      currentStageName: "Отказ",
      attendedAt: null,
      refusedAt: "2026-04-18T11:00:00.000Z",
      finalStatus: "refused"
    };
    const input = {
      range,
      deals: [deal({ id: "LEADGEN_WON" })],
      stageCatalog,
      stageHistory: [],
      managerDirectory,
      pricingRules: DEFAULT_PRICING_RULES,
      eventVisitFacts: [refusedGuestVisit],
      events,
      costRules: [
        {
          id: "guest-meeting-participant",
          articleId: "demo_events",
          pnlLevel: "above_ebitda",
          costBehavior: "variable",
          calculationMethod: "amount_per_participant",
          unitPrice: 5_000,
          percent: null,
          amount: null,
          sourceKey: null,
          qualityValue: null,
          eventNamePattern: "Гостевая встреча",
          enabled: true,
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          sortOrder: 15
        }
      ],
      costFacts: []
    } satisfies Parameters<typeof buildUnitEconomicsReport>[0];

    const invitedReport = buildUnitEconomicsReport(input);
    const attendedReport = buildUnitEconomicsReport({
      ...input,
      eventParticipantMode: "attended"
    });

    expect(invitedReport.summary.eventCost).toBe(5_000);
    expect(invitedReport.managerRows[0]?.directCostRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          articleId: "demo_events",
          productLabel: "Гостевая встреча ClubFirst",
          quantity: 1,
          unitPrice: 5_000,
          amount: 5_000,
          basis: "Приглашенные участники периода"
        })
      ])
    );
    expect(attendedReport.summary.eventCost).toBe(0);
    expect(attendedReport.managerRows[0]?.directCostRows).toEqual([]);
  });

  it("keeps margin fields null and emits warnings when revenue denominators are zero", () => {
    const report = buildUnitEconomicsReport({
      range,
      deals: [],
      stageCatalog,
      stageHistory: [],
      pricingRules: DEFAULT_PRICING_RULES,
      costRules: [],
      costFacts: [
        {
          id: "facility-april",
          articleId: "facility_aho",
          pnlLevel: "above_ebitda",
          costBehavior: "fixed",
          calculationMethod: "manual_amount",
          periodStart: "2026-04-01",
          periodEnd: "2026-04-30",
          amount: 31_500,
          currency: "RUB",
          quantity: 1,
          sourceSystem: "manual",
          sourceReference: null,
          confidence: "manual",
          status: "active",
          comment: null
        }
      ]
    });

    expect(report.summary.attractionRevenue).toBe(0);
    expect(report.summary.aboveEbitdaCosts).toBe(31_500);
    expect(report.summary.ebitda).toBe(-31_500);
    expect(report.summary.contributionMargin).toBeNull();
    expect(report.summary.ebitdaMargin).toBeNull();
    expect(report.warnings).toContain(
      "Доход Привлечения равен 0: процентные показатели маржинальности не рассчитываются."
    );
  });

  it("builds manager drill-down sections with revenue, production costs, direct costs, taxes and event rules", () => {
    const report = buildUnitEconomicsReport({
      range,
      deals: [
        deal({ id: "LEADGEN_WON" }),
        deal({
          id: "LEADGEN_ACTIVE",
          stageId: "C10:NEW",
          stageSemanticId: "P",
          dateClosed: null
        }),
        deal({
          id: "WEB_WON",
          assignedById: "99",
          sourceId: "WEB",
          qualityValue: "Без качества"
        })
      ],
      stageCatalog,
      stageHistory: [],
      managerDirectory,
      pricingRules: DEFAULT_PRICING_RULES,
      eventVisitFacts,
      events,
      costRules: [
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
          eventNamePattern: null,
          enabled: true,
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          sortOrder: 10
        },
        {
          id: "guest-meeting-participant",
          articleId: "demo_events",
          pnlLevel: "above_ebitda",
          costBehavior: "variable",
          calculationMethod: "amount_per_participant",
          unitPrice: 5_000,
          percent: null,
          amount: null,
          sourceKey: null,
          qualityValue: null,
          eventNamePattern: "Гостевая встреча",
          enabled: true,
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          sortOrder: 15
        },
        {
          id: "other-conversion-event-participant",
          articleId: "demo_events",
          pnlLevel: "above_ebitda",
          costBehavior: "variable",
          calculationMethod: "amount_per_participant",
          unitPrice: 15_000,
          percent: null,
          amount: null,
          sourceKey: null,
          qualityValue: null,
          eventNamePattern: null,
          enabled: true,
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          sortOrder: 16
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
          eventNamePattern: null,
          enabled: true,
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          sortOrder: 20
        },
        {
          id: "sales-bonus",
          articleId: "sales_bonus",
          pnlLevel: "variable_contribution",
          costBehavior: "variable",
          calculationMethod: "percent_of_club_membership",
          unitPrice: null,
          percent: 4,
          amount: null,
          sourceKey: null,
          qualityValue: null,
          eventNamePattern: null,
          enabled: true,
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          sortOrder: 25
        },
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
          eventNamePattern: null,
          enabled: true,
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          sortOrder: 110
        },
        {
          id: "ctg-technology-center",
          articleId: "ctg_technology_center",
          pnlLevel: "above_ebitda",
          costBehavior: "variable",
          calculationMethod: "percent_of_module_revenue",
          unitPrice: null,
          percent: 6,
          amount: null,
          sourceKey: null,
          qualityValue: null,
          eventNamePattern: null,
          enabled: true,
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          sortOrder: 120
        },
        {
          id: "finance-service",
          articleId: "ctg_finance_service",
          pnlLevel: "below_ebitda",
          costBehavior: "variable",
          calculationMethod: "percent_of_module_revenue",
          unitPrice: null,
          percent: 2,
          amount: null,
          sourceKey: null,
          qualityValue: null,
          eventNamePattern: null,
          enabled: true,
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          sortOrder: 300
        },
        {
          id: "taxes",
          articleId: "taxes",
          pnlLevel: "below_ebitda",
          costBehavior: "variable",
          calculationMethod: "percent_of_module_revenue",
          unitPrice: null,
          percent: 3,
          amount: null,
          sourceKey: null,
          qualityValue: null,
          eventNamePattern: null,
          enabled: true,
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          sortOrder: 310
        }
      ],
      costFacts: []
    });

    const manager = report.managerRows.find((row) => row.managerId === "78");

    expect(manager?.revenueRows).toEqual([
      expect.objectContaining({
        clubLabel: "ClubFirst One",
        tariffLabel: "Федеральный",
        wonDeals: 1,
        attractionRevenue: 300_000,
        clubRevenue: 1_000_000
      })
    ]);
    expect(manager?.productionCostRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          articleId: "lead_purchase",
          productLabel: "Лидген УС · Готов к встрече",
          quantity: 2,
          unitPrice: 40_000,
          amount: 80_000
        }),
        expect.objectContaining({
          articleId: "contractation",
          productLabel: "Won-сделки",
          quantity: 1,
          unitPrice: 5_000,
          amount: 5_000
        }),
        expect.objectContaining({
          articleId: "sales_bonus",
          productLabel: "Бонусы за продажу",
          percent: 4,
          amount: 40_000
        }),
        expect.objectContaining({
          articleId: "ctu_certificate",
          productLabel: "CTU сертификат",
          amount: 0,
          warnings: ["Нет признака применения CTU сертификата в текущих фактах."]
        })
      ])
    );
    expect(manager?.productionCostRows).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          articleId: "demo_events"
        })
      ])
    );
    expect(manager?.directCostRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          articleId: "demo_events",
          productLabel: "Гостевая встреча ClubFirst",
          quantity: 1,
          unitPrice: 5_000,
          amount: 5_000
        }),
        expect.objectContaining({
          articleId: "demo_events",
          productLabel: "Бизнес-диалог: Борис Титов, 13.05",
          quantity: 1,
          unitPrice: 15_000,
          amount: 15_000
        }),
        expect.objectContaining({
          articleId: "community_integrators_fixed",
          productLabel: "120 000 оклад + 40% налог",
          amount: 168_000
        }),
        expect.objectContaining({
          articleId: "ctg_technology_center",
          percent: 6,
          amount: 18_000
        })
      ])
    );
    expect(manager?.taxAndFinanceRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          articleId: "ctg_finance_service",
          percent: 2,
          amount: 6_000
        }),
        expect.objectContaining({
          articleId: "taxes",
          percent: 3,
          amount: 9_000
        })
      ])
    );
    expect(manager).toMatchObject({
      variableCosts: 125_000,
      financialResult: -46_000,
      margin: -0.1533
    });
  });
});
