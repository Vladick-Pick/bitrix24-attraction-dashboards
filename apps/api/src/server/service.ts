import type { DashboardData, ManualSyncSummary } from "@bitrix24-reporting/contracts";

import { buildDashboard } from "../domain/reporting";
import { performManualSync } from "../domain/sync";
import type { StageCatalogEntry } from "@bitrix24-reporting/contracts";
import type { SyncClient } from "../domain/sync";
import type { SqliteRepository } from "./sqlite-repository";

interface CreateReportingServiceInput {
  repository: SqliteRepository;
  client: SyncClient;
  defaultPeriodDays: number;
  now?: () => Date;
}

export interface ReportingService {
  getDashboard(input: { periodDays: number }): Promise<DashboardData>;
  getMeta(): Promise<{
    stageCatalog: StageCatalogEntry[];
    wonStageIds: string[];
    defaultPeriodDays: number;
    lastSync: {
      finishedAt: string;
      leadsSynced: number;
      dealsSynced: number;
      mode: "full" | "delta";
    } | null;
  }>;
  performSync(): Promise<ManualSyncSummary>;
  updateWonStages(stageIds: string[]): Promise<{ wonStageIds: string[] }>;
}

function createRange(periodDays: number, now: Date) {
  const to = new Date(now);
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - (periodDays - 1));
  from.setUTCHours(0, 0, 0, 0);
  to.setUTCHours(23, 59, 59, 999);

  return {
    from: from.toISOString(),
    to: to.toISOString()
  };
}

export function createReportingService(
  input: CreateReportingServiceInput
): ReportingService {
  const nowFactory = input.now ?? (() => new Date());

  return {
    async getDashboard({ periodDays }) {
      const safePeriod = Number.isFinite(periodDays) && periodDays > 0
        ? periodDays
        : input.defaultPeriodDays;
      const [deals, leads, stageCatalog, wonStageIds] = await Promise.all([
        input.repository.getAllDeals(),
        input.repository.getAllLeads(),
        input.repository.getStageCatalog(),
        input.repository.getWonStageIds()
      ]);

      return buildDashboard({
        range: createRange(safePeriod, nowFactory()),
        wonStageIds,
        deals,
        leads,
        stageCatalog
      });
    },

    async getMeta() {
      const [stageCatalog, wonStageIds, lastSync] = await Promise.all([
        input.repository.getStageCatalog(),
        input.repository.getWonStageIds(),
        input.repository.getLastSyncSummary()
      ]);

      return {
        stageCatalog,
        wonStageIds,
        defaultPeriodDays: input.defaultPeriodDays,
        lastSync
      };
    },

    async performSync() {
      return performManualSync({
        client: input.client,
        repository: input.repository,
        now: () => nowFactory().toISOString()
      });
    },

    async updateWonStages(stageIds) {
      await input.repository.setWonStageIds(stageIds);
      return {
        wonStageIds: await input.repository.getWonStageIds()
      };
    }
  };
}
