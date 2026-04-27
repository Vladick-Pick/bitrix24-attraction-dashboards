export const ALLOWED_DEAL_FIELDS = [
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
  "crm.status.list",
  "crm.deal.fields",
  "crm.contact.list",
  "crm.contact.fields",
  "crm.item.list",
  "crm.stagehistory.list",
  "crm.activity.list",
  "voximplant.statistic.get",
  "user.get"
] as const;

interface SelectorOptions {
  categoryIds: string[];
  assignedByIds?: string[];
  modifiedAfter?: string;
  start?: number;
  qualityFieldName?: string;
  customFieldNames?: string[];
}

interface BackfillSelectorOptions {
  afterId: string;
  categoryIds: string[];
  assignedByIds?: string[];
  qualityFieldName?: string;
  customFieldNames?: string[];
}

function buildCategoryFilter(categoryIds: string[]) {
  if (categoryIds.length === 1) {
    return {
      CATEGORY_ID: categoryIds[0]
    };
  }

  return {
    "@CATEGORY_ID": categoryIds
  };
}

function buildAssignedByFilter(assignedByIds: string[] | undefined) {
  if (!assignedByIds || assignedByIds.length === 0) {
    return {};
  }

  if (assignedByIds.length === 1) {
    return {
      ASSIGNED_BY_ID: assignedByIds[0]
    };
  }

  return {
    "@ASSIGNED_BY_ID": assignedByIds
  };
}

function buildDealScopeFilter(options: {
  categoryIds: string[];
  assignedByIds?: string[];
}) {
  return {
    ...buildCategoryFilter(options.categoryIds),
    ...buildAssignedByFilter(options.assignedByIds)
  };
}

function buildDealSelectFields(options: {
  qualityFieldName?: string;
  customFieldNames?: string[];
}) {
  return [
    ...ALLOWED_DEAL_FIELDS,
    ...Array.from(
      new Set([
        ...(options.qualityFieldName ? [options.qualityFieldName] : []),
        ...(options.customFieldNames ?? [])
      ])
    )
  ];
}

export function buildDealListParams(options: SelectorOptions) {
  return {
    select: buildDealSelectFields(options),
    filter: options.modifiedAfter
      ? {
          ...buildDealScopeFilter(options),
          ">=DATE_MODIFY": options.modifiedAfter
        }
      : buildDealScopeFilter(options),
    order: {
      ID: "ASC" as const
    },
    start: options.start ?? 0
  };
}

export function buildDealBackfillParams(options: BackfillSelectorOptions) {
  return {
    select: buildDealSelectFields(options),
    filter: {
      ...buildDealScopeFilter(options),
      ">ID": options.afterId
    },
    order: {
      ID: "ASC" as const
    },
    start: -1
  };
}

export function buildLeadListParams(options: SelectorOptions) {
  return {
    select: [...ALLOWED_LEAD_FIELDS],
    filter: options.modifiedAfter
      ? { ">=DATE_MODIFY": options.modifiedAfter }
      : {},
    order: {
      ID: "ASC" as const
    },
    start: options.start ?? 0
  };
}

export function buildLeadBackfillParams(options: BackfillSelectorOptions) {
  return {
    select: [...ALLOWED_LEAD_FIELDS],
    filter: {
      ">ID": options.afterId
    },
    order: {
      ID: "ASC" as const
    },
    start: -1
  };
}
