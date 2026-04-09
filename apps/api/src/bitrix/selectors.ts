export const ALLOWED_DEAL_FIELDS = [
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
] as const;

export const ALLOWED_LEAD_FIELDS = [
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
] as const;

export const ALLOWED_BITRIX_METHODS = [
  "crm.deal.list",
  "crm.lead.list",
  "crm.status.list"
] as const;

interface SelectorOptions {
  modifiedAfter?: string;
  start?: number;
}

export function buildDealListParams(options: SelectorOptions) {
  return {
    select: [...ALLOWED_DEAL_FIELDS],
    filter: options.modifiedAfter
      ? { ">DATE_MODIFY": options.modifiedAfter }
      : {},
    order: {
      DATE_MODIFY: "ASC" as const,
      ID: "ASC" as const
    },
    start: options.start ?? 0
  };
}

export function buildLeadListParams(options: SelectorOptions) {
  return {
    select: [...ALLOWED_LEAD_FIELDS],
    filter: options.modifiedAfter
      ? { ">DATE_MODIFY": options.modifiedAfter }
      : {},
    order: {
      DATE_MODIFY: "ASC" as const,
      ID: "ASC" as const
    },
    start: options.start ?? 0
  };
}
