import { describe, expect, it } from "vitest";

import {
  ALLOWED_DEAL_FIELDS,
  ALLOWED_LEAD_FIELDS,
  buildDealListParams,
  buildLeadListParams
} from "../src/bitrix/selectors";

describe("Bitrix24 selector whitelist", () => {
  it("keeps deal field selection free from contact and company data", () => {
    expect(ALLOWED_DEAL_FIELDS).toEqual([
      "ID",
      "LEAD_ID",
      "DATE_CREATE",
      "DATE_MODIFY",
      "DATE_CLOSED",
      "CATEGORY_ID",
      "STAGE_ID",
      "STAGE_SEMANTIC_ID",
      "OPPORTUNITY",
      "ASSIGNED_BY_ID",
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

  it("builds delta params against DATE_MODIFY with deterministic ordering", () => {
    expect(
      buildDealListParams({
        modifiedAfter: "2026-04-08T10:00:00.000Z",
        start: 50
      })
    ).toEqual({
      select: ALLOWED_DEAL_FIELDS,
      filter: {
        ">DATE_MODIFY": "2026-04-08T10:00:00.000Z"
      },
      order: {
        DATE_MODIFY: "ASC",
        ID: "ASC"
      },
      start: 50
    });

    expect(buildLeadListParams({ start: 0 })).toEqual({
      select: ALLOWED_LEAD_FIELDS,
      filter: {},
      order: {
        DATE_MODIFY: "ASC",
        ID: "ASC"
      },
      start: 0
    });
  });
});
