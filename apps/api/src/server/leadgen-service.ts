import type {
  LeadgenFunnelReport,
  ManualSyncSummary,
  SyncProgressEvent
} from "@bitrix24-reporting/contracts";

import { performLeadgenSync, type LeadgenSyncClient } from "../domain/leadgen-sync.js";
import { createReportingService } from "./service.js";
import type { SqliteRepository } from "./sqlite-repository.js";

interface LeadgenRangeRequest {
  periodDays?: number;
  range?: {
    from: string;
    to: string;
  };
  filters?: {
    managerIds?: string[];
    sourceKeys?: string[];
  };
}

interface CreateLeadgenServiceInput {
  categoryId: string;
  managerIds: string[];
  qualityFieldName: string;
  client: LeadgenSyncClient;
  repository: SqliteRepository;
  defaultPeriodDays: number;
  now?: () => Date;
}

export interface LeadgenService {
  getLeadgenFunnelReport(input: LeadgenRangeRequest): Promise<LeadgenFunnelReport>;
  performSync(input?: {
    onProgress?: (event: SyncProgressEvent) => void;
  }): Promise<ManualSyncSummary>;
}

export function createLeadgenService(input: CreateLeadgenServiceInput): LeadgenService {
  const nowFactory = input.now ?? (() => new Date());
  const reporting = createReportingService({
    dealCategoryIds: [input.categoryId],
    leadgenCategoryId: input.categoryId,
    leadgenManagerIds: input.managerIds,
    qualityFieldName: input.qualityFieldName,
    client: input.client as never,
    repository: input.repository,
    defaultPeriodDays: input.defaultPeriodDays,
    now: nowFactory
  });

  return {
    getLeadgenFunnelReport(inputRange) {
      return reporting.getLeadgenFunnelReport(inputRange);
    },

    performSync(syncInput) {
      return performLeadgenSync({
        client: input.client,
        repository: input.repository,
        categoryId: input.categoryId,
        managerIds: input.managerIds,
        now: () => nowFactory().toISOString(),
        ...(syncInput?.onProgress ? { onProgress: syncInput.onProgress } : {})
      });
    }
  };
}
