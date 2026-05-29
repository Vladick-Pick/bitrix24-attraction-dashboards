import { describe, expect, it } from "vitest";

import type {
  ActivitySnapshot,
  CallSnapshot,
  DealMeetingDateChangeSnapshot,
  DealSnapshot,
  StageCatalogEntry,
  StageHistorySnapshot
} from "@bitrix24-reporting/contracts";

import {
  buildDealStageFacts,
  buildDealTouchpointFacts
} from "../src/domain/analytics-facts.js";
import { buildFactParityReport } from "../src/domain/fact-parity.js";

describe("buildFactParityReport", () => {
  it("keeps activity and call reports equal when facts are built from raw snapshots", () => {
    const deal: DealSnapshot = {
      id: "D1",
      contactId: "C1",
      leadId: null,
      categoryId: "1",
      stageId: "C1:CALL",
      stageSemanticId: "P",
      opportunity: 0,
      assignedById: "M1",
      sourceId: "WEB",
      qualityValue: null,
      dateCreate: "2026-01-01T00:00:00.000Z",
      dateModify: "2026-01-06T00:00:00.000Z",
      dateClosed: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmContent: null,
      utmTerm: null
    };
    const stageCatalog: StageCatalogEntry[] = [
      {
        entityType: "deal",
        categoryId: "1",
        statusId: "C1:BASE",
        name: "База входящая",
        semanticId: "P",
        sortOrder: 10
      },
      {
        entityType: "deal",
        categoryId: "1",
        statusId: "C1:CALL",
        name: "Звонок-знакомство",
        semanticId: "P",
        sortOrder: 20
      }
    ];
    const stageHistory: StageHistorySnapshot[] = [
      {
        id: "H1",
        ownerId: "D1",
        categoryId: "1",
        stageId: "C1:BASE",
        stageSemanticId: "P",
        typeId: 1,
        createdTime: "2026-01-01T00:00:00.000Z"
      },
      {
        id: "H2",
        ownerId: "D1",
        categoryId: "1",
        stageId: "C1:CALL",
        stageSemanticId: "P",
        typeId: 1,
        createdTime: "2026-01-02T00:00:00.000Z"
      }
    ];
    const activities: ActivitySnapshot[] = [
      {
        id: "T1",
        ownerTypeId: "2",
        ownerId: "D1",
        typeId: null,
        providerId: "CRM_TODO",
        responsibleId: "M1",
        createdTime: "2026-01-03T00:00:00.000Z",
        deadline: null,
        lastUpdated: "2026-01-04T00:00:00.000Z",
        completed: true,
        completedTime: "2026-01-04T00:00:00.000Z"
      },
      {
        id: "A_CALL",
        ownerTypeId: "2",
        ownerId: "D1",
        typeId: "2",
        providerId: "VOXIMPLANT_CALL",
        responsibleId: "M1",
        createdTime: "2026-01-05T00:00:00.000Z",
        deadline: null,
        lastUpdated: "2026-01-05T00:00:00.000Z",
        completed: true,
        completedTime: "2026-01-05T00:00:00.000Z"
      }
    ];
    const calls: CallSnapshot[] = [
      {
        id: "CALL1",
        crmActivityId: "A_CALL",
        portalUserId: "M1",
        callType: "1",
        callStartDate: "2026-01-05T00:00:00.000Z",
        callDurationSeconds: 45,
        crmEntityType: null,
        crmEntityId: null,
        callFailedCode: "200"
      }
    ];
    const meetingDateChanges: DealMeetingDateChangeSnapshot[] = [
      {
        id: "MD1",
        dealId: "D1",
        assignedById: "M1",
        previousMeetingDate: null,
        nextMeetingDate: "2026-01-10T00:00:00.000Z",
        changedAt: "2026-01-06T00:00:00.000Z"
      }
    ];
    const stageFacts = buildDealStageFacts({
      deals: [deal],
      stageHistory,
      stageCatalog
    });
    const touchpointFacts = buildDealTouchpointFacts({
      deals: [deal],
      stageFacts,
      activities,
      calls,
      meetingDateChanges
    });

    const report = buildFactParityReport({
      range: {
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-01-31T23:59:59.999Z"
      },
      deals: [deal],
      stageCatalog,
      stageHistory,
      activities,
      meetingDateChanges,
      calls,
      dealStageFacts: stageFacts,
      dealTouchpointFacts: touchpointFacts,
      managerDirectory: [{ id: "M1", name: "Manager One" }]
    });

    expect(report.activityDiffs).toEqual([]);
    expect(report.callDiffs).toEqual([]);
    expect(report.linkReasonBreakdown).toContainEqual({
      kind: "call",
      linkReason: "activity_owner_deal",
      count: 1
    });
  });
});
