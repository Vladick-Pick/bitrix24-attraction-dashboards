import { describe, expect, it } from "vitest";

import {
  ALLOWED_DEAL_FIELDS,
  ALLOWED_LEAD_FIELDS,
  buildConversionEventItemListParams,
  buildDealBackfillParams,
  buildDealListParams
} from "../src/bitrix/selectors";

describe("Bitrix24 selector whitelist", () => {
  it("keeps deal field selection free from deal names, contact data and company data", () => {
    expect(ALLOWED_DEAL_FIELDS).toEqual([
      "ID",
      "CONTACT_ID",
      "LEAD_ID",
      "DATE_CREATE",
      "DATE_MODIFY",
      "DATE_CLOSED",
      "CATEGORY_ID",
      "STAGE_ID",
      "STAGE_SEMANTIC_ID",
      "OPPORTUNITY",
      "ASSIGNED_BY_ID",
      "SOURCE_ID",
      "UTM_SOURCE",
      "UTM_MEDIUM",
      "UTM_CAMPAIGN",
      "UTM_CONTENT",
      "UTM_TERM"
    ]);
  });

  it("keeps lead field selection free from pii and contact methods", () => {
    expect(ALLOWED_LEAD_FIELDS).toEqual([
      "ID",
      "DATE_CREATE",
      "DATE_MODIFY",
      "STATUS_ID",
      "SOURCE_ID",
      "OPPORTUNITY",
      "ASSIGNED_BY_ID",
      "UTM_SOURCE",
      "UTM_MEDIUM",
      "UTM_CAMPAIGN",
      "UTM_CONTENT",
      "UTM_TERM"
    ]);
  });

  it("builds smart-process item params without selecting raw client names", () => {
    expect(
      buildConversionEventItemListParams({
        entityTypeId: 177,
        modifiedAfter: "2026-04-08T10:00:00.000Z",
        start: 50,
        eventNameFieldName: "ufCrmEventName",
        eventDateFieldName: "ufCrmEventDate"
      })
    ).toEqual({
      entityTypeId: 177,
      select: [
        "id",
        "title",
        "stageId",
        "categoryId",
        "createdTime",
        "updatedTime",
        "assignedById",
        "contactId",
        "parentId2",
        "sourceId",
        "ufCrmEventName",
        "ufCrmEventDate"
      ],
      filter: {
        ">=updatedTime": "2026-04-08T10:00:00.000Z"
      },
      order: {
        id: "ASC"
      },
      start: 50
    });
  });

  it("builds delta list params against DATE_MODIFY with stable ID ordering", () => {
    expect(
      buildDealListParams({
        modifiedAfter: "2026-04-08T10:00:00.000Z",
        start: 50,
        categoryIds: ["10"],
        customFieldNames: [
          "UF_CRM_1730380390",
          "UF_CRM_1647422744",
          "UF_CRM_1647422890"
        ]
      })
    ).toEqual({
      select: [
        ...ALLOWED_DEAL_FIELDS,
        "UF_CRM_1730380390",
        "UF_CRM_1647422744",
        "UF_CRM_1647422890"
      ],
      filter: {
        ">=DATE_MODIFY": "2026-04-08T10:00:00.000Z",
        CATEGORY_ID: "10"
      },
      order: {
        ID: "ASC"
      },
      start: 50
    });
  });

  it("builds optimized full-sync params using ascending IDs and disabled totals", () => {
    expect(
      buildDealBackfillParams({
        afterId: "0",
        categoryIds: ["10"],
        customFieldNames: [
          "UF_CRM_1730380390",
          "UF_CRM_1647422744",
          "UF_CRM_1647422890"
        ]
      })
    ).toEqual({
      select: [
        ...ALLOWED_DEAL_FIELDS,
        "UF_CRM_1730380390",
        "UF_CRM_1647422744",
        "UF_CRM_1647422890"
      ],
      filter: {
        ">ID": "0",
        CATEGORY_ID: "10"
      },
      order: {
        ID: "ASC"
      },
      start: -1
    });
  });

  it("builds category filters for multi-category deal requests", () => {
    expect(
      buildDealListParams({
        modifiedAfter: "2026-04-08T10:00:00.000Z",
        start: 0,
        categoryIds: ["10", "28"]
      })
    ).toEqual({
      select: ALLOWED_DEAL_FIELDS,
      filter: {
        ">=DATE_MODIFY": "2026-04-08T10:00:00.000Z",
        "@CATEGORY_ID": ["10", "28"]
      },
      order: {
        ID: "ASC"
      },
      start: 0
    });
  });

  it("adds the attraction manager scope to deal requests when provided", () => {
    expect(
      buildDealListParams({
        modifiedAfter: "2026-04-08T10:00:00.000Z",
        start: 0,
        categoryIds: ["10"],
        assignedByIds: ["78", "11234"]
      })
    ).toEqual({
      select: ALLOWED_DEAL_FIELDS,
      filter: {
        ">=DATE_MODIFY": "2026-04-08T10:00:00.000Z",
        CATEGORY_ID: "10",
        "@ASSIGNED_BY_ID": ["78", "11234"]
      },
      order: {
        ID: "ASC"
      },
      start: 0
    });
  });
});
