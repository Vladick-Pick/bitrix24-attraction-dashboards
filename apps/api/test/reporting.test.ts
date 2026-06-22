import { describe, expect, it } from "vitest";

import { buildDashboard } from "../src/domain/reporting";
import { DEFAULT_PRICING_RULES } from "../src/domain/deal-economics";

describe("buildDashboard", () => {
  it("reports attraction revenue separately from membership amount", () => {
    const result = buildDashboard({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      wonStageIds: ["C10:WON"],
      leads: [],
      deals: [
        {
          id: "PRICED",
          leadId: null,
          categoryId: "10",
          stageId: "C10:WON",
          stageSemanticId: "S",
          opportunity: 1_300_000,
          assignedById: "78",
          sourceId: "WEB",
          qualityValue: null,
          businessClubValue: "ClubFirst One",
          targetGroupValue: "ClubFirst Russia",
          meetingTypeValue: null,
          meetingDateValue: null,
          tariffValue: "Федеральный Москва",
          dateCreate: "2026-03-10T00:00:00.000Z",
          dateModify: "2026-04-10T00:00:00.000Z",
          dateClosed: "2026-04-10T00:00:00.000Z",
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        },
        {
          id: "UNPRICED",
          leadId: null,
          categoryId: "10",
          stageId: "C10:WON",
          stageSemanticId: "S",
          opportunity: 890_000,
          assignedById: "78",
          sourceId: "WEB",
          qualityValue: null,
          businessClubValue: "ClubFirst One",
          targetGroupValue: null,
          meetingTypeValue: null,
          meetingDateValue: null,
          tariffValue: null,
          dateCreate: "2026-03-12T00:00:00.000Z",
          dateModify: "2026-04-11T00:00:00.000Z",
          dateClosed: "2026-04-11T00:00:00.000Z",
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        }
      ],
      stageCatalog: [
        {
          entityType: "deal",
          categoryId: "10",
          statusId: "C10:WON",
          name: "Передано в клуб",
          semanticId: "S",
          sortOrder: 10
        },
        {
          entityType: "source",
          categoryId: null,
          statusId: "WEB",
          name: "Website",
          semanticId: null,
          sortOrder: 10
        }
      ],
      stageHistory: [],
      activities: [],
      calls: [],
      managerDirectory: [{ id: "78", name: "Егоров Андрей" }],
      pricingRules: DEFAULT_PRICING_RULES
    });

    expect(result.salesSummary.salesCount).toBe(2);
    expect(result.salesSummary.salesAmount).toBe(300_000);
    expect(result.salesSummary.attractionRevenueAmount).toBe(300_000);
    expect(result.salesSummary.averageAttractionRevenueAmount).toBe(150_000);
    expect(result.salesSummary.membershipAmount).toBe(2_190_000);
    expect(result.salesSummary.averageMembershipAmount).toBe(1_095_000);
    expect(result.salesSummary.pricingWarnings.join(" ")).toContain("UNPRICED");
    expect(result.managerGroups[0]?.totalSalesAmount).toBe(300_000);
    expect(result.managerGroups[0]?.averageAttractionRevenueAmount).toBe(150_000);
    expect(result.managerGroups[0]?.totalMembershipAmount).toBe(2_190_000);
    expect(result.managerGroups[0]?.averageMembershipAmount).toBe(1_095_000);
    expect(result.managerGroups[0]?.deals[0]).toEqual(
      expect.objectContaining({
        dealId: "UNPRICED",
        amount: 0,
        attractionRevenueAmount: null,
        membershipAmount: 890_000,
        pricingStatus: "missingContractFields"
      })
    );
  });

  it("adds a lifecycle card with event timeline and sale costs to sales deal rows", () => {
    const result = buildDashboard({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      wonStageIds: ["C10:WON"],
      leads: [],
      deals: [
        {
          id: "LIFE_WON",
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
        }
      ],
      stageCatalog: [
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
          statusId: "C10:WON",
          name: "Передано в клуб",
          semanticId: "S",
          sortOrder: 20
        },
        {
          entityType: "source",
          categoryId: null,
          statusId: "LEADGEN_US",
          name: "Лидген УС",
          semanticId: null,
          sortOrder: 10
        }
      ],
      stageHistory: [
        {
          id: "SH-LIFE-BASE",
          ownerId: "LIFE_WON",
          categoryId: "10",
          stageId: "C10:BASE",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-10T09:00:00.000Z"
        },
        {
          id: "SH-LIFE-WON",
          ownerId: "LIFE_WON",
          categoryId: "10",
          stageId: "C10:WON",
          stageSemanticId: "S",
          typeId: null,
          createdTime: "2026-04-20T12:00:00.000Z"
        }
      ],
      activities: [],
      calls: [],
      managerDirectory: [{ id: "78", name: "Ромашова Ольга" }],
      pricingRules: DEFAULT_PRICING_RULES,
      dealTouchpointFacts: [
        {
          factId: "conversion-event-visit:VISIT_DASHBOARD",
          kind: "conversion_event_visit",
          sourceSystem: "bitrix24",
          sourceEntityType: "dynamic",
          sourceEntityId: "VISIT_DASHBOARD",
          occurredAt: "2026-04-18T12:00:00.000Z",
          dealId: "LIFE_WON",
          contactId: null,
          leadId: null,
          managerId: "78",
          sourceId: "LEADGEN_US",
          stageIdAtEvent: "C10:BASE",
          stageNameAtEvent: "База входящая",
          linkConfidence: "high",
          linkReason: "test",
          payloadJson: JSON.stringify({
            eventId: "EVENT_GUEST",
            eventName: "Гостевая встреча ClubFirst",
            status: "attended"
          })
        }
      ],
      eventVisitFacts: [
        {
          visitId: "VISIT_DASHBOARD",
          eventId: "EVENT_GUEST",
          dealId: "LIFE_WON",
          contactId: null,
          leadId: null,
          managerId: "78",
          sourceId: "LEADGEN_US",
          currentStageId: "ATTENDED",
          currentStageName: "Посетил",
          invitedAt: "2026-04-17T10:00:00.000Z",
          confirmedAt: null,
          attendedAt: "2026-04-18T12:00:00.000Z",
          refusedAt: null,
          finalStatus: "attended",
          eventDate: "2026-04-18T12:00:00.000Z",
          stageIdAtEvent: "C10:BASE",
          linkConfidence: "high",
          linkReason: "test",
          payloadJson: JSON.stringify({ eventName: "Гостевая встреча ClubFirst" })
        }
      ],
      events: [
        {
          eventId: "EVENT_GUEST",
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
      ],
      costRules: [
        {
          id: "leadgen-ready",
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
          id: "contractation",
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
          id: "guest-event",
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
      ],
      costFacts: [],
      eventParticipantMode: "attended"
    });

    const lifecycleCard = result.managerGroups[0]?.deals[0]?.lifecycleCard;

    expect(lifecycleCard).toMatchObject({
      dealId: "LIFE_WON",
      status: "won",
      managerName: "Ромашова Ольга",
      economics: {
        revenueMode: "actual",
        attractionRevenueAmount: 300_000,
        membershipAmount: 1_100_000,
        saleCostAmount: 52_000,
        marginAmount: 248_000
      }
    });
    expect(lifecycleCard?.stageTimeline[0]?.events).toEqual([
      expect.objectContaining({
        id: "conversion-event-visit:VISIT_DASHBOARD",
        badgeLabel: "Гостевая встреча ClubFirst · пришел"
      })
    ]);
  });

  it("uses the won-stage entry time as the sale date instead of dateModify fallback", () => {
    const deal = {
      id: "124972",
      leadId: null,
      categoryId: "10",
      stageId: "C10:WON",
      stageSemanticId: "S",
      opportunity: 890000,
      assignedById: "2764",
      sourceId: null,
      qualityValue: null,
      dateCreate: "2024-12-02T16:19:34+03:00",
      dateModify: "2026-04-10T09:45:02+03:00",
      dateClosed: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmContent: null,
      utmTerm: null
    };
    const baseInput = {
      wonStageIds: ["C10:WON"],
      leads: [],
      deals: [deal],
      stageCatalog: [
        {
          entityType: "deal" as const,
          categoryId: "10",
          statusId: "C10:NEW",
          name: "База входящая",
          semanticId: "P",
          sortOrder: 10
        },
        {
          entityType: "deal" as const,
          categoryId: "10",
          statusId: "C10:WON",
          name: "Передано в клуб",
          semanticId: "S",
          sortOrder: 20
        }
      ],
      stageHistory: [
        {
          id: "SH-1",
          ownerId: "124972",
          categoryId: "10",
          stageId: "C10:NEW",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2024-12-02T16:19:34+03:00"
        },
        {
          id: "SH-2",
          ownerId: "124972",
          categoryId: "10",
          stageId: "C10:WON",
          stageSemanticId: "S",
          typeId: null,
          createdTime: "2025-01-29T17:16:22+03:00"
        }
      ],
      activities: [],
      calls: [],
      managerDirectory: [{ id: "2764", name: "Каньков Вячеслав" }]
    };

    const aprilResult = buildDashboard({
      ...baseInput,
      range: {
        from: "2026-04-06T00:00:00.000Z",
        to: "2026-04-12T23:59:59.999Z"
      }
    });
    const januaryResult = buildDashboard({
      ...baseInput,
      range: {
        from: "2025-01-29T00:00:00.000Z",
        to: "2025-01-29T23:59:59.999Z"
      }
    });

    expect(aprilResult.salesSummary.salesCount).toBe(0);
    expect(januaryResult.salesSummary.salesCount).toBe(1);
    expect(januaryResult.managerGroups[0]?.deals[0]).toEqual(
      expect.objectContaining({
        dealId: "124972",
        dateClosed: "2025-01-29T17:16:22+03:00",
        cycleDays: 58.04
      })
    );
    expect(januaryResult.managerGroups[0]?.deals[0]?.stageTimeline.at(-1)).toEqual(
      expect.objectContaining({
        stageId: "C10:WON",
        stageName: "Передано в клуб",
        enteredAt: "2025-01-29T17:16:22+03:00",
        leftAt: "2025-01-29T17:16:22+03:00",
        durationHours: 0,
        meetingEvents: []
      })
    );
  });

  it("builds a won-deal drilldown with cohort, call, task and stage timeline details", () => {
    const result = buildDashboard({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      wonStageIds: ["C1:WON"],
      leads: [],
      deals: [
        {
          id: "D-101",
          leadId: "L1",
          categoryId: "1",
          stageId: "C1:WON",
          stageSemanticId: "S",
          opportunity: 90000,
          assignedById: "7",
          sourceId: "WEB",
          qualityValue: "3.1 Готов ко встрече",
          targetGroupValue: "ClubFirst",
          tariffValue: "Федеральный Москва",
          dateCreate: "2026-03-10T10:00:00.000Z",
          dateModify: "2026-04-20T12:00:00.000Z",
          dateClosed: "2026-04-20T12:00:00.000Z",
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        },
        {
          id: "D-102",
          leadId: "L2",
          categoryId: "1",
          stageId: "C1:WON",
          stageSemanticId: "S",
          opportunity: 120000,
          assignedById: "7",
          sourceId: "WEB",
          qualityValue: null,
          targetGroupValue: null,
          tariffValue: null,
          dateCreate: "2026-03-15T09:00:00.000Z",
          dateModify: "2026-04-20T12:00:00.000Z",
          dateClosed: "2026-04-20T12:00:00.000Z",
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        },
        {
          id: "D-103",
          leadId: "L3",
          categoryId: "1",
          stageId: "C1:WON",
          stageSemanticId: "S",
          opportunity: 150000,
          assignedById: "9",
          sourceId: "REFERRAL",
          qualityValue: null,
          targetGroupValue: null,
          tariffValue: null,
          dateCreate: "2026-04-01T08:00:00.000Z",
          dateModify: "2026-04-18T15:00:00.000Z",
          dateClosed: "2026-04-18T15:00:00.000Z",
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        },
        {
          id: "D-104",
          leadId: "L4",
          categoryId: "1",
          stageId: "C1:LOSE",
          stageSemanticId: "F",
          opportunity: 30000,
          assignedById: "7",
          sourceId: "WEB",
          qualityValue: null,
          targetGroupValue: null,
          tariffValue: null,
          dateCreate: "2026-03-18T08:00:00.000Z",
          dateModify: "2026-04-08T09:00:00.000Z",
          dateClosed: "2026-04-08T09:00:00.000Z",
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        }
      ],
      stageCatalog: [
        {
          entityType: "deal",
          categoryId: "1",
          statusId: "C1:NEW",
          name: "New",
          semanticId: "P",
          sortOrder: 10
        },
        {
          entityType: "deal",
          categoryId: "1",
          statusId: "C1:CALL",
          name: "Call",
          semanticId: "P",
          sortOrder: 20
        },
        {
          entityType: "deal",
          categoryId: "1",
          statusId: "C1:WON",
          name: "Won",
          semanticId: "S",
          sortOrder: 30
        },
        {
          entityType: "deal",
          categoryId: "1",
          statusId: "C1:LOSE",
          name: "Lost",
          semanticId: "F",
          sortOrder: 40
        },
        {
          entityType: "source",
          categoryId: null,
          statusId: "WEB",
          name: "Website",
          semanticId: null,
          sortOrder: 10
        },
        {
          entityType: "source",
          categoryId: null,
          statusId: "REFERRAL",
          name: "Referral",
          semanticId: null,
          sortOrder: 20
        }
      ],
      stageHistory: [
        {
          id: "SH-1",
          ownerId: "D-101",
          categoryId: "1",
          stageId: "C1:NEW",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-03-10T10:00:00.000Z"
        },
        {
          id: "SH-2",
          ownerId: "D-101",
          categoryId: "1",
          stageId: "C1:CALL",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-03-12T09:00:00.000Z"
        },
        {
          id: "SH-3",
          ownerId: "D-101",
          categoryId: "1",
          stageId: "C1:WON",
          stageSemanticId: "S",
          typeId: null,
          createdTime: "2026-04-19T12:00:00.000Z"
        },
        {
          id: "SH-4",
          ownerId: "D-102",
          categoryId: "1",
          stageId: "C1:NEW",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-03-15T09:00:00.000Z"
        },
        {
          id: "SH-5",
          ownerId: "D-102",
          categoryId: "1",
          stageId: "C1:WON",
          stageSemanticId: "S",
          typeId: null,
          createdTime: "2026-04-20T12:00:00.000Z"
        }
      ],
      activities: [
        {
          id: "TASK-1",
          ownerTypeId: "2",
          ownerId: "D-101",
          typeId: "6",
          providerId: "CRM_TODO",
          responsibleId: "7",
          createdTime: "2026-03-11T12:00:00.000Z",
          deadline: null,
          lastUpdated: "2026-03-11T12:00:00.000Z",
          completed: true,
          completedTime: "2026-03-13T12:00:00.000Z"
        },
        {
          id: "TASK-2",
          ownerTypeId: "2",
          ownerId: "D-101",
          typeId: "6",
          providerId: "CRM_TODO",
          responsibleId: "7",
          createdTime: "2026-03-15T12:00:00.000Z",
          deadline: null,
          lastUpdated: "2026-03-16T12:00:00.000Z",
          completed: false,
          completedTime: null
        },
        {
          id: "MEETING-1",
          ownerTypeId: "2",
          ownerId: "D-101",
          typeId: "1",
          providerId: "CRM_MEETING",
          responsibleId: "7",
          createdTime: "2026-03-17T10:00:00.000Z",
          deadline: "2026-03-18T16:00:00.000Z",
          lastUpdated: "2026-03-17T10:00:00.000Z",
          completed: false,
          completedTime: null
        },
        {
          id: "CALL-ACTIVITY-1",
          ownerTypeId: "2",
          ownerId: "D-101",
          typeId: "2",
          providerId: "VOXIMPLANT_CALL",
          responsibleId: "7",
          createdTime: "2026-03-14T12:00:00.000Z",
          deadline: null,
          lastUpdated: "2026-03-14T12:00:00.000Z",
          completed: true,
          completedTime: "2026-03-14T12:05:00.000Z"
        }
      ],
      calls: [
        {
          id: "CALL-1",
          crmActivityId: "CALL-ACTIVITY-1",
          portalUserId: "7",
          callType: "1",
          callStartDate: "2026-03-14T12:00:00.000Z",
          callDurationSeconds: 65,
          crmEntityType: null,
          crmEntityId: null,
          callFailedCode: "200"
        },
        {
          id: "CALL-2",
          crmActivityId: null,
          portalUserId: "7",
          callType: "2",
          callStartDate: "2026-03-18T10:00:00.000Z",
          callDurationSeconds: 20,
          crmEntityType: "DEAL",
          crmEntityId: "D-101",
          callFailedCode: null
        },
        {
          id: "CALL-3",
          crmActivityId: null,
          portalUserId: "7",
          callType: "1",
          callStartDate: "2026-03-19T10:00:00.000Z",
          callDurationSeconds: 0,
          crmEntityType: "CONTACT",
          crmEntityId: "CONTACT-1",
          callFailedCode: "486"
        }
      ],
      managerDirectory: [
        { id: "7", name: "Анна Петрова" },
        { id: "9", name: "Борис Иванов" }
      ]
    });

    expect(result).toMatchObject({
      salesSummary: {
        salesCount: 3,
        salesAmount: 360000,
        averageSaleAmount: 120000,
        newDealsCount: 1,
        conversionRate: 100,
        meetingsCount: 1
      },
      managerGroups: [
        {
          managerId: "7",
          managerName: "Анна Петрова",
          totalWonDeals: 2,
          totalSalesAmount: 210000,
          deals: [
            {
              dealId: "D-102",
              dealTitle: "D-102",
              managerId: "7",
              managerName: "Анна Петрова",
              amount: 120000,
              dateCreate: "2026-03-15T09:00:00.000Z",
              dateClosed: "2026-04-20T12:00:00.000Z",
              cycleDays: 36.13,
              sourceKey: "WEB",
              sourceLabel: "Website",
              qualityValue: null,
              businessClubValue: null,
              targetGroupValue: null,
              meetingTypeValue: null,
              meetingDateValue: null,
              tariffValue: null,
              cohortContext: {
                createdMonth: "2026-03",
                cohortCreatedDeals: 3,
                cohortWonDeals: 2,
                cohortWonConversionRate: 66.67
              },
              callSummary: {
                total: 0,
                incoming: 0,
                outgoing: 0,
                successful: 0,
                failed: 0,
                overThirtySeconds: 0,
                connectedOverThirtySeconds: 0
              },
              taskSummary: {
                created: 0,
                closed: 0
              },
              meetingSummary: {
                total: 0
              },
              stageTimeline: [
                {
                  stageId: "C1:NEW",
                  stageName: "New",
                  enteredAt: "2026-03-15T09:00:00.000Z",
                  leftAt: "2026-04-20T12:00:00.000Z",
                  durationHours: 867,
                  meetingEvents: []
                },
                {
                  stageId: "C1:WON",
                  stageName: "Won",
                  enteredAt: "2026-04-20T12:00:00.000Z",
                  leftAt: "2026-04-20T12:00:00.000Z",
                  durationHours: 0,
                  meetingEvents: []
                }
              ]
            },
            {
              dealId: "D-101",
              dealTitle: "D-101",
              managerId: "7",
              managerName: "Анна Петрова",
              amount: 90000,
              dateCreate: "2026-03-10T10:00:00.000Z",
              dateClosed: "2026-04-19T12:00:00.000Z",
              cycleDays: 40.08,
              sourceKey: "WEB",
              sourceLabel: "Website",
              qualityValue: "3.1 Готов ко встрече",
              businessClubValue: null,
              targetGroupValue: "ClubFirst",
              meetingTypeValue: null,
              meetingDateValue: null,
              tariffValue: "Федеральный Москва",
              cohortContext: {
                createdMonth: "2026-03",
                cohortCreatedDeals: 3,
                cohortWonDeals: 2,
                cohortWonConversionRate: 66.67
              },
              callSummary: {
                total: 2,
                incoming: 1,
                outgoing: 1,
                successful: 2,
                failed: 0,
                overThirtySeconds: 1,
                connectedOverThirtySeconds: 1
              },
              taskSummary: {
                created: 2,
                closed: 1
              },
              meetingSummary: {
                total: 1
              },
              stageTimeline: [
                {
                  stageId: "C1:NEW",
                  stageName: "New",
                  enteredAt: "2026-03-10T10:00:00.000Z",
                  leftAt: "2026-03-12T09:00:00.000Z",
                  durationHours: 47,
                  meetingEvents: []
                },
                {
                  stageId: "C1:CALL",
                  stageName: "Call",
                  enteredAt: "2026-03-12T09:00:00.000Z",
                  leftAt: "2026-04-19T12:00:00.000Z",
                  durationHours: 915,
                  meetingEvents: [
                    {
                      activityId: "MEETING-1",
                      createdAt: "2026-03-17T10:00:00.000Z",
                      timelineAt: "2026-03-17T10:00:00.000Z",
                      scheduledAt: "2026-03-18T16:00:00.000Z",
                      completed: false
                    }
                  ]
                },
                {
                  stageId: "C1:WON",
                  stageName: "Won",
                  enteredAt: "2026-04-19T12:00:00.000Z",
                  leftAt: "2026-04-19T12:00:00.000Z",
                  durationHours: 0,
                  meetingEvents: []
                }
              ]
            }
          ]
        },
        {
          managerId: "9",
          managerName: "Борис Иванов",
          totalWonDeals: 1,
          totalSalesAmount: 150000,
          deals: [
            {
              dealId: "D-103",
              dealTitle: "D-103",
              managerId: "9",
              managerName: "Борис Иванов",
              amount: 150000,
              dateCreate: "2026-04-01T08:00:00.000Z",
              dateClosed: "2026-04-18T15:00:00.000Z",
              cycleDays: 17.29,
              sourceKey: "REFERRAL",
              sourceLabel: "Referral",
              qualityValue: null,
              businessClubValue: null,
              targetGroupValue: null,
              meetingTypeValue: null,
              meetingDateValue: null,
              tariffValue: null,
              cohortContext: {
                createdMonth: "2026-04",
                cohortCreatedDeals: 1,
                cohortWonDeals: 1,
                cohortWonConversionRate: 100
              },
              callSummary: {
                total: 0,
                incoming: 0,
                outgoing: 0,
                successful: 0,
                failed: 0,
                overThirtySeconds: 0,
                connectedOverThirtySeconds: 0
              },
              taskSummary: {
                created: 0,
                closed: 0
              },
              meetingSummary: {
                total: 0
              },
              stageTimeline: [
                {
                  stageId: "C1:WON",
                  stageName: "Won",
                  enteredAt: "2026-04-01T08:00:00.000Z",
                  leftAt: "2026-04-18T15:00:00.000Z",
                  durationHours: 415,
                  meetingEvents: []
                }
              ]
            }
          ]
        }
      ]
    });
  });

  it("uses a safe stage label when dashboard timeline history references a missing catalog stage", () => {
    const result = buildDashboard({
      range: {
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-05-31T23:59:59.999Z"
      },
      wonStageIds: ["C10:WON"],
      leads: [],
      deals: [
        {
          id: "142306",
          leadId: null,
          categoryId: "10",
          stageId: "C10:WON",
          stageSemanticId: "S",
          opportunity: 300000,
          assignedById: "78",
          sourceId: "WEB",
          qualityValue: null,
          businessClubValue: "ClubFirst One",
          targetGroupValue: "ClubFirst Russia",
          meetingTypeValue: null,
          meetingDateValue: null,
          tariffValue: null,
          dateCreate: "2026-01-28T09:00:00.000Z",
          dateModify: "2026-05-07T10:00:00.000Z",
          dateClosed: "2026-05-07T10:00:00.000Z",
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        }
      ],
      stageCatalog: [
        {
          entityType: "deal",
          categoryId: "10",
          statusId: "C10:WON",
          name: "Передано в клуб",
          semanticId: "S",
          sortOrder: 20
        },
        {
          entityType: "source",
          categoryId: null,
          statusId: "WEB",
          name: "Website",
          semanticId: null,
          sortOrder: 10
        }
      ],
      stageHistory: [
        {
          id: "H-142306-MISSING-CATALOG-STAGE",
          ownerId: "142306",
          categoryId: "10",
          stageId: "C10:UC_Z8RAZJ",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-03-07T09:00:00.000Z"
        },
        {
          id: "H-142306-WON",
          ownerId: "142306",
          categoryId: "10",
          stageId: "C10:WON",
          stageSemanticId: "S",
          typeId: null,
          createdTime: "2026-05-07T10:00:00.000Z"
        }
      ],
      activities: [
        {
          id: "TASK-142306",
          ownerTypeId: "2",
          ownerId: "142306",
          typeId: "6",
          providerId: "CRM_TODO",
          responsibleId: "78",
          createdTime: "2026-03-10T10:00:00.000Z",
          deadline: "2026-03-11T10:00:00.000Z",
          lastUpdated: "2026-03-11T10:30:00.000Z",
          completed: true,
          completedTime: "2026-03-11T10:30:00.000Z"
        },
        {
          id: "MEETING-142306",
          ownerTypeId: "2",
          ownerId: "142306",
          typeId: "1",
          providerId: "CRM_MEETING",
          responsibleId: "78",
          createdTime: "2026-03-12T11:00:00.000Z",
          deadline: "2026-03-13T12:00:00.000Z",
          lastUpdated: "2026-03-12T11:00:00.000Z",
          completed: false,
          completedTime: null
        }
      ],
      calls: [
        {
          id: "CALL-142306",
          crmActivityId: null,
          portalUserId: "78",
          callType: "1",
          callStartDate: "2026-03-09T10:00:00.000Z",
          callDurationSeconds: 75,
          crmEntityType: "DEAL",
          crmEntityId: "142306",
          callFailedCode: "200"
        }
      ],
      managerDirectory: [{ id: "78", name: "Manager 78" }]
    });

    const timeline = result.managerGroups[0]?.deals[0]?.stageTimeline ?? [];
    const missingStage = timeline[0];

    expect(result.managerGroups[0]?.deals[0]?.dealId).toBe("142306");
    expect(missingStage).toEqual(
      expect.objectContaining({
        stageId: "C10:UC_Z8RAZJ",
        stageName: "Этап недоступен",
        callSummary: expect.objectContaining({
          total: 1,
          successful: 1
        }),
        taskSummary: {
          created: 1,
          closed: 1
        },
        meetingEvents: [
          {
            activityId: "MEETING-142306",
            createdAt: "2026-03-12T11:00:00.000Z",
            timelineAt: "2026-03-12T11:00:00.000Z",
            scheduledAt: "2026-03-13T12:00:00.000Z",
            completed: false
          }
        ]
      })
    );
    expect(missingStage?.stageName).not.toBe("C10:UC_Z8RAZJ");
    expect(timeline[1]).toEqual(
      expect.objectContaining({
        stageId: "C10:WON",
        stageName: "Передано в клуб"
      })
    );
  });

  it("places meeting events in the stage timeline by activity creation time, not scheduled deadline", () => {
    const result = buildDashboard({
      range: {
        from: "2026-03-01T00:00:00.000Z",
        to: "2026-03-31T23:59:59.999Z"
      },
      wonStageIds: ["C1:WON"],
      leads: [],
      deals: [
        {
          id: "D-201",
          leadId: null,
          categoryId: "1",
          stageId: "C1:WON",
          stageSemanticId: "S",
          opportunity: 100000,
          assignedById: "7",
          sourceId: null,
          qualityValue: null,
          targetGroupValue: null,
          tariffValue: null,
          dateCreate: "2026-03-10T10:00:00.000Z",
          dateModify: "2026-03-20T10:00:00.000Z",
          dateClosed: "2026-03-20T10:00:00.000Z",
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        }
      ],
      stageCatalog: [
        {
          entityType: "deal",
          categoryId: "1",
          statusId: "C1:NEW",
          name: "New",
          semanticId: "P",
          sortOrder: 10
        },
        {
          entityType: "deal",
          categoryId: "1",
          statusId: "C1:CALL",
          name: "Call",
          semanticId: "P",
          sortOrder: 20
        },
        {
          entityType: "deal",
          categoryId: "1",
          statusId: "C1:WON",
          name: "Won",
          semanticId: "S",
          sortOrder: 30
        }
      ],
      stageHistory: [
        {
          id: "SH-201-1",
          ownerId: "D-201",
          categoryId: "1",
          stageId: "C1:NEW",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-03-10T10:00:00.000Z"
        },
        {
          id: "SH-201-2",
          ownerId: "D-201",
          categoryId: "1",
          stageId: "C1:CALL",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-03-14T10:00:00.000Z"
        },
        {
          id: "SH-201-3",
          ownerId: "D-201",
          categoryId: "1",
          stageId: "C1:WON",
          stageSemanticId: "S",
          typeId: null,
          createdTime: "2026-03-20T10:00:00.000Z"
        }
      ],
      activities: [
        {
          id: "MEETING-201",
          ownerTypeId: "2",
          ownerId: "D-201",
          typeId: "1",
          providerId: "CRM_MEETING",
          responsibleId: "7",
          createdTime: "2026-03-12T11:00:00.000Z",
          deadline: "2026-03-18T16:00:00.000Z",
          lastUpdated: "2026-03-12T11:00:00.000Z",
          completed: false,
          completedTime: null
        }
      ],
      calls: [],
      managerDirectory: [{ id: "7", name: "Анна Петрова" }]
    });

    expect(result.managerGroups[0]?.deals[0]?.stageTimeline).toEqual([
      expect.objectContaining({
        stageId: "C1:NEW",
        stageName: "New",
        enteredAt: "2026-03-10T10:00:00.000Z",
        leftAt: "2026-03-14T10:00:00.000Z",
        durationHours: 96,
        meetingEvents: [
          {
            activityId: "MEETING-201",
            createdAt: "2026-03-12T11:00:00.000Z",
            timelineAt: "2026-03-12T11:00:00.000Z",
            scheduledAt: "2026-03-18T16:00:00.000Z",
            completed: false
          }
        ]
      }),
      expect.objectContaining({
        stageId: "C1:CALL",
        stageName: "Call",
        enteredAt: "2026-03-14T10:00:00.000Z",
        leftAt: "2026-03-20T10:00:00.000Z",
        durationHours: 144,
        meetingEvents: []
      }),
      expect.objectContaining({
        stageId: "C1:WON",
        stageName: "Won",
        enteredAt: "2026-03-20T10:00:00.000Z",
        leftAt: "2026-03-20T10:00:00.000Z",
        durationHours: 0,
        meetingEvents: []
      })
    ]);
  });

  it("adds call and task summaries to each stage timeline entry by interval", () => {
    const result = buildDashboard({
      range: {
        from: "2026-03-01T00:00:00.000Z",
        to: "2026-03-31T23:59:59.999Z"
      },
      wonStageIds: ["C1:WON"],
      leads: [],
      deals: [
        {
          id: "D-STAGE-ACTIONS",
          leadId: null,
          categoryId: "1",
          stageId: "C1:WON",
          stageSemanticId: "S",
          opportunity: 100000,
          assignedById: "7",
          sourceId: null,
          qualityValue: null,
          targetGroupValue: null,
          tariffValue: null,
          dateCreate: "2026-03-10T10:00:00.000Z",
          dateModify: "2026-03-20T10:00:00.000Z",
          dateClosed: "2026-03-20T10:00:00.000Z",
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        }
      ],
      stageCatalog: [
        {
          entityType: "deal",
          categoryId: "1",
          statusId: "C1:NEW",
          name: "New",
          semanticId: "P",
          sortOrder: 10
        },
        {
          entityType: "deal",
          categoryId: "1",
          statusId: "C1:CALL",
          name: "Call",
          semanticId: "P",
          sortOrder: 20
        },
        {
          entityType: "deal",
          categoryId: "1",
          statusId: "C1:WON",
          name: "Won",
          semanticId: "S",
          sortOrder: 30
        }
      ],
      stageHistory: [
        {
          id: "SH-STAGE-ACTIONS-1",
          ownerId: "D-STAGE-ACTIONS",
          categoryId: "1",
          stageId: "C1:NEW",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-03-10T10:00:00.000Z"
        },
        {
          id: "SH-STAGE-ACTIONS-2",
          ownerId: "D-STAGE-ACTIONS",
          categoryId: "1",
          stageId: "C1:CALL",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-03-14T10:00:00.000Z"
        },
        {
          id: "SH-STAGE-ACTIONS-3",
          ownerId: "D-STAGE-ACTIONS",
          categoryId: "1",
          stageId: "C1:WON",
          stageSemanticId: "S",
          typeId: null,
          createdTime: "2026-03-20T10:00:00.000Z"
        }
      ],
      activities: [
        {
          id: "TASK-STAGE-A",
          ownerTypeId: "2",
          ownerId: "D-STAGE-ACTIONS",
          typeId: "6",
          providerId: "CRM_TODO",
          responsibleId: "7",
          createdTime: "2026-03-12T09:00:00.000Z",
          deadline: null,
          lastUpdated: "2026-03-16T09:00:00.000Z",
          completed: true,
          completedTime: "2026-03-16T09:00:00.000Z"
        },
        {
          id: "TASK-STAGE-B",
          ownerTypeId: "2",
          ownerId: "D-STAGE-ACTIONS",
          typeId: "6",
          providerId: "CRM_TODO",
          responsibleId: "7",
          createdTime: "2026-03-15T09:00:00.000Z",
          deadline: null,
          lastUpdated: "2026-03-20T10:00:00.000Z",
          completed: true,
          completedTime: "2026-03-20T10:00:00.000Z"
        },
        {
          id: "MEETING-STAGE",
          ownerTypeId: "2",
          ownerId: "D-STAGE-ACTIONS",
          typeId: "1",
          providerId: "CRM_MEETING",
          responsibleId: "7",
          createdTime: "2026-03-15T11:00:00.000Z",
          deadline: "2026-03-17T11:00:00.000Z",
          lastUpdated: "2026-03-15T11:00:00.000Z",
          completed: false,
          completedTime: null
        }
      ],
      calls: [
        {
          id: "CALL-STAGE-NEW",
          crmActivityId: null,
          portalUserId: "7",
          callType: "2",
          callStartDate: "2026-03-12T10:00:00.000Z",
          callDurationSeconds: 20,
          crmEntityType: "DEAL",
          crmEntityId: "D-STAGE-ACTIONS",
          callFailedCode: null
        },
        {
          id: "CALL-STAGE-BOUNDARY",
          crmActivityId: null,
          portalUserId: "7",
          callType: "1",
          callStartDate: "2026-03-14T10:00:00.000Z",
          callDurationSeconds: 0,
          crmEntityType: "DEAL",
          crmEntityId: "D-STAGE-ACTIONS",
          callFailedCode: "486"
        },
        {
          id: "CALL-STAGE-WON",
          crmActivityId: null,
          portalUserId: "7",
          callType: "1",
          callStartDate: "2026-03-20T10:00:00.000Z",
          callDurationSeconds: 65,
          crmEntityType: "DEAL",
          crmEntityId: "D-STAGE-ACTIONS",
          callFailedCode: "200"
        }
      ],
      managerDirectory: [{ id: "7", name: "Анна Петрова" }]
    });

    expect(result.managerGroups[0]?.deals[0]).toEqual(
      expect.objectContaining({
        callSummary: {
          total: 3,
          incoming: 1,
          outgoing: 2,
          successful: 2,
          failed: 1,
          overThirtySeconds: 1,
          connectedOverThirtySeconds: 1
        },
        taskSummary: {
          created: 2,
          closed: 2
        }
      })
    );
    expect(result.managerGroups[0]?.deals[0]?.stageTimeline).toEqual([
      expect.objectContaining({
        stageId: "C1:NEW",
        callSummary: {
          total: 1,
          incoming: 1,
          outgoing: 0,
          successful: 1,
          failed: 0,
          overThirtySeconds: 0,
          connectedOverThirtySeconds: 0
        },
        taskSummary: {
          created: 1,
          closed: 0
        },
        meetingEvents: []
      }),
      expect.objectContaining({
        stageId: "C1:CALL",
        callSummary: {
          total: 1,
          incoming: 0,
          outgoing: 1,
          successful: 0,
          failed: 1,
          overThirtySeconds: 0,
          connectedOverThirtySeconds: 0
        },
        taskSummary: {
          created: 1,
          closed: 1
        },
        meetingEvents: [
          {
            activityId: "MEETING-STAGE",
            createdAt: "2026-03-15T11:00:00.000Z",
            timelineAt: "2026-03-15T11:00:00.000Z",
            scheduledAt: "2026-03-17T11:00:00.000Z",
            completed: false
          }
        ]
      }),
      expect.objectContaining({
        stageId: "C1:WON",
        callSummary: {
          total: 1,
          incoming: 0,
          outgoing: 1,
          successful: 1,
          failed: 0,
          overThirtySeconds: 1,
          connectedOverThirtySeconds: 1
        },
        taskSummary: {
          created: 0,
          closed: 1
        },
        meetingEvents: []
      })
    ]);
  });

  it("relabels leaked numeric target-group ids in the sales drilldown", () => {
    const result = buildDashboard({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      wonStageIds: ["C1:WON"],
      leads: [],
      deals: [
        {
          id: "D-UNKNOWN-TG",
          leadId: null,
          categoryId: "1",
          stageId: "C1:WON",
          stageSemanticId: "S",
          opportunity: 50000,
          assignedById: "7",
          sourceId: "WEB",
          qualityValue: null,
          businessClubValue: null,
          targetGroupValue: "395454",
          meetingTypeValue: null,
          tariffValue: null,
          refusalReasonValue: null,
          refusalReasonDetail: null,
          dateCreate: "2026-04-01T08:00:00.000Z",
          dateModify: "2026-04-18T15:00:00.000Z",
          dateClosed: "2026-04-18T15:00:00.000Z",
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        }
      ],
      stageCatalog: [
        {
          entityType: "deal",
          categoryId: "1",
          statusId: "C1:WON",
          name: "Won",
          semanticId: "S",
          sortOrder: 10
        }
      ],
      stageHistory: [],
      activities: [],
      calls: [],
      managerDirectory: [{ id: "7", name: "Менеджер" }]
    });

    expect(result.managerGroups[0]?.deals[0]).toEqual(
      expect.objectContaining({
        dealId: "D-UNKNOWN-TG",
        targetGroupValue: null
      })
    );
  });
  it("treats zero-duration calls with null failed code as failed in the sales drilldown", () => {
    const result = buildDashboard({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      wonStageIds: ["C1:WON"],
      leads: [],
      deals: [
        {
          id: "D-CALL-EDGE",
          leadId: null,
          categoryId: "1",
          stageId: "C1:WON",
          stageSemanticId: "S",
          opportunity: 50000,
          assignedById: "7",
          sourceId: "WEB",
          qualityValue: null,
          businessClubValue: null,
          targetGroupValue: null,
          meetingTypeValue: null,
          tariffValue: null,
          refusalReasonValue: null,
          refusalReasonDetail: null,
          dateCreate: "2026-04-01T08:00:00.000Z",
          dateModify: "2026-04-18T15:00:00.000Z",
          dateClosed: "2026-04-18T15:00:00.000Z",
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        }
      ],
      stageCatalog: [
        {
          entityType: "deal",
          categoryId: "1",
          statusId: "C1:NEW",
          name: "New",
          semanticId: "P",
          sortOrder: 10
        },
        {
          entityType: "deal",
          categoryId: "1",
          statusId: "C1:WON",
          name: "Won",
          semanticId: "S",
          sortOrder: 20
        },
        {
          entityType: "source",
          categoryId: null,
          statusId: "WEB",
          name: "Website",
          semanticId: null,
          sortOrder: 10
        }
      ],
      stageHistory: [
        {
          id: "D-CALL-EDGE-H1",
          ownerId: "D-CALL-EDGE",
          categoryId: "1",
          stageId: "C1:NEW",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-01T08:00:00.000Z"
        },
        {
          id: "D-CALL-EDGE-H2",
          ownerId: "D-CALL-EDGE",
          categoryId: "1",
          stageId: "C1:WON",
          stageSemanticId: "S",
          typeId: null,
          createdTime: "2026-04-18T15:00:00.000Z"
        }
      ],
      activities: [],
      calls: [
        {
          id: "CALL-EDGE-1",
          crmActivityId: null,
          portalUserId: "7",
          callType: "1",
          callStartDate: "2026-04-10T10:00:00.000Z",
          callDurationSeconds: 0,
          crmEntityType: "DEAL",
          crmEntityId: "D-CALL-EDGE",
          callFailedCode: null
        }
      ],
      managerDirectory: [{ id: "7", name: "Менеджер" }]
    });

    expect(result.managerGroups[0]?.deals[0]?.callSummary).toEqual(
      expect.objectContaining({
        total: 1,
        successful: 0,
        failed: 1,
        connectedOverThirtySeconds: 0
      })
    );
  });
});
