import type {
  DealSnapshot,
  ManagerDirectoryEntry,
  StageCatalogEntry
} from "@bitrix24-reporting/contracts";

export const UNATTRIBUTED_SOURCE_KEY = "UNATTRIBUTED";
export const UNATTRIBUTED_SOURCE_LABEL = "Без источника";
export const UNASSIGNED_MANAGER_ID = "UNASSIGNED";
export const UNASSIGNED_MANAGER_NAME = "Без менеджера";

export function normalizeCategoryId(value: string | null) {
  return value?.trim() || "0";
}

export function buildSourceLabelMap(stageCatalog: StageCatalogEntry[]) {
  return new Map(
    stageCatalog
      .filter((entry) => entry.entityType === "source")
      .map((entry) => [entry.statusId, entry.name])
  );
}

export function resolveDealSource(
  deal: DealSnapshot,
  sourceLabels: Map<string, string>
) {
  if (deal.sourceId) {
    return {
      key: deal.sourceId,
      label: sourceLabels.get(deal.sourceId) ?? deal.sourceId
    };
  }

  if (deal.utmSource) {
    return {
      key: deal.utmSource,
      label: deal.utmSource
    };
  }

  return {
    key: UNATTRIBUTED_SOURCE_KEY,
    label: UNATTRIBUTED_SOURCE_LABEL
  };
}

export function buildManagerDirectoryMap(rows: ManagerDirectoryEntry[]) {
  return new Map(rows.map((row) => [row.id, row.name]));
}

export function resolveManagerName(
  managerId: string,
  managerDirectory: Map<string, string>
) {
  if (managerId === UNASSIGNED_MANAGER_ID) {
    return UNASSIGNED_MANAGER_NAME;
  }

  return managerDirectory.get(managerId) ?? managerId;
}

export function toMonthBucket(value: string | null) {
  if (!value) {
    return null;
  }

  return value.slice(0, 7);
}
