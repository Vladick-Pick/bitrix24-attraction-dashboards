import type { ManagerDirectoryEntry, ReportFilters } from "@bitrix24-reporting/contracts";

export const ATTRACTION_MANAGER_CATALOG = [
  { id: "78", name: "Егоров Андрей" },
  { id: "11234", name: "Ромашова Ольга" },
  { id: "7824", name: "Мусальникова Кристина" },
  { id: "6994", name: "Кузнецова Анастасия" },
  { id: "7814", name: "Дарья Бычкова" },
  { id: "72", name: "Крохалева Мария" },
  { id: "2236", name: "Потапова Мария" },
  { id: "2764", name: "Каньков Вячеслав" },
  { id: "13020", name: "Какулия Илья" }
] satisfies ManagerDirectoryEntry[];

export const ATTRACTION_MANAGER_IDS = ATTRACTION_MANAGER_CATALOG.map(
  (manager) => manager.id
);

const attractionManagerOrder = new Map(
  ATTRACTION_MANAGER_IDS.map((id, index) => [id, index])
);
const NO_ATTRACTION_MANAGER_MATCH_ID = "__NO_ATTRACTION_MANAGER_MATCH__";

export function normalizeAttractionManagerFilters(
  filters: ReportFilters | undefined,
  managerIds: string[] = ATTRACTION_MANAGER_IDS
): ReportFilters {
  const effectiveManagerIds =
    managerIds.length > 0 ? managerIds : [NO_ATTRACTION_MANAGER_MATCH_ID];
  const managerIdSet = new Set(effectiveManagerIds);
  const requestedManagerIds = filters?.managerIds ?? [];
  const scopedManagerIds = requestedManagerIds.filter((id) =>
    managerIdSet.has(id)
  );

  return {
    ...(filters ?? {}),
    managerIds:
      requestedManagerIds.length > 0
        ? scopedManagerIds.length > 0
          ? scopedManagerIds
          : [NO_ATTRACTION_MANAGER_MATCH_ID]
        : effectiveManagerIds
  };
}

export function sortAttractionManagers(rows: ManagerDirectoryEntry[]) {
  return [...rows].sort((left, right) => {
    const leftOrder = attractionManagerOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = attractionManagerOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.name.localeCompare(right.name, "ru");
  });
}
