import { randomUUID } from "node:crypto";

import {
  getCallEnrichmentFieldByCode
} from "./call-enrichment-fields.js";
import {
  isUnresolvedEnrichmentReference,
  normalizeCallEnrichmentValue,
  valuesAreEquivalent
} from "./call-enrichment-current-values.js";
import { safeErrorMessage } from "./safe-error-message.js";
import type { CallEnrichmentValuesRow } from "../bitrix/client.js";
import type {
  EnrichmentProposalBatchRecord,
  EnrichmentProposalEventInput,
  EnrichmentProposalRecord,
  MarkEnrichmentProposalDecisionInput,
  MarkEnrichmentProposalFailedInput,
  SqliteRepository
} from "./sqlite-repository.js";

export type CallEnrichmentWritebackAction = "approve" | "decline";
export type CallEnrichmentWritebackMode = "disabled" | "limited" | "enabled";

export interface ApplyManagerEnrichmentDecisionInput {
  proposalId: string;
  managerId: string;
  action: CallEnrichmentWritebackAction;
  decidedAt: string;
}

export type CallEnrichmentWritebackResult =
  | { status: "applied"; proposalId: string }
  | { status: "recorded"; proposalId: string; reason: string }
  | { status: "declined"; proposalId: string }
  | { status: "already_decided"; proposalId: string }
  | { status: "conflict"; proposalId: string; reason: string }
  | { status: "expired"; proposalId: string }
  | { status: "failed"; proposalId: string; reason: string }
  | { status: "rejected"; proposalId: string; reason: string };

export interface CallEnrichmentWritebackService {
  applyManagerEnrichmentDecision(
    input: ApplyManagerEnrichmentDecisionInput
  ): Promise<CallEnrichmentWritebackResult>;
}

interface CallEnrichmentWritebackRepository
  extends Pick<
    SqliteRepository,
    | "getEnrichmentProposal"
    | "getEnrichmentProposalBatch"
    | "appendEnrichmentProposalEvent"
    | "markEnrichmentProposalDecision"
    | "markEnrichmentProposalApplied"
    | "markEnrichmentProposalFailed"
  > {}

interface CallEnrichmentWritebackBitrixClient {
  getContactEnrichmentValues(
    contactId: string
  ): Promise<CallEnrichmentValuesRow | null>;
  getDealEnrichmentValues(dealId: string): Promise<CallEnrichmentValuesRow | null>;
  updateContactEnrichmentField(input: {
    entityId: string;
    fieldCode: string;
    value: unknown;
  }): Promise<void>;
  updateDealEnrichmentField(input: {
    entityId: string;
    fieldCode: string;
    value: unknown;
  }): Promise<void>;
}

export interface CreateCallEnrichmentWritebackServiceInput {
  repository: CallEnrichmentWritebackRepository;
  bitrix?: CallEnrichmentWritebackBitrixClient;
  writebackMode?: CallEnrichmentWritebackMode;
  pilotManagerIds?: string[];
  idGenerator?: () => string;
}

export function createCallEnrichmentWritebackService(
  input: CreateCallEnrichmentWritebackServiceInput
): CallEnrichmentWritebackService {
  const idGenerator = input.idGenerator ?? randomUUID;
  const writebackMode = input.writebackMode ?? "enabled";
  const pilotManagerIds = new Set(input.pilotManagerIds ?? []);

  async function applyManagerEnrichmentDecision(
    decision: ApplyManagerEnrichmentDecisionInput
  ): Promise<CallEnrichmentWritebackResult> {
    const loaded = await loadPendingDecisionContext(decision);
    if ("result" in loaded) {
      return loaded.result;
    }

    const { proposal } = loaded;
    if (decision.action === "decline") {
      return declineProposal(decision);
    }

    const descriptor = getCallEnrichmentFieldByCode(proposal.fieldCode);
    if (!descriptor || descriptor.entityType !== proposal.entityType) {
      return markFailed(decision, "FIELD_NOT_ALLOWLISTED");
    }

    if (!descriptor.writableInV1) {
      return markFailed(decision, "FIELD_NOT_WRITABLE_IN_V1");
    }

    if (isUnresolvedEnrichmentReference(proposal.normalizedValue)) {
      return markFailed(decision, "UNRESOLVED_REFERENCE");
    }

    const disabledReason = getWritebackDisabledReason(decision.managerId);
    if (disabledReason) {
      return recordApprovedWithoutWrite(decision, disabledReason);
    }

    if (!input.bitrix) {
      return markFailed(decision, "BITRIX_WRITEBACK_NOT_CONFIGURED");
    }

    const bitrix = input.bitrix;
    if (proposal.status === "pending") {
      const decisionWasMarked = await markApproved(decision, "telegram_approved");
      if (!decisionWasMarked) {
        return { status: "already_decided", proposalId: decision.proposalId };
      }
    }

    let currentValues: CallEnrichmentValuesRow | null;
    try {
      currentValues = await readCurrentValues(bitrix, proposal);
    } catch (error) {
      return markBitrixFailure(decision, error, "BITRIX_READ_FAILED");
    }

    if (!currentValues) {
      return markConflict(decision, "CURRENT_VALUE_UNAVAILABLE");
    }

    const current = normalizeCallEnrichmentValue(
      descriptor,
      currentValues[proposal.fieldCode]
    );
    if (proposal.actionType === "fill_empty" && !current.isEmpty) {
      return markConflict(decision, "CURRENT_VALUE_NOT_EMPTY");
    }

    if (proposal.actionType === "overwrite") {
      const original = normalizeCallEnrichmentValue(
        descriptor,
        proposal.currentValue
      );
      if (!valuesAreEquivalent(current.value, original.value)) {
        return markConflict(decision, "CURRENT_VALUE_CHANGED");
      }
    }

    try {
      await updateBitrixField(bitrix, proposal);
    } catch (error) {
      return markBitrixFailure(decision, error, "BITRIX_UPDATE_FAILED");
    }

    await input.repository.markEnrichmentProposalApplied({
      proposalId: proposal.id,
      appliedAt: decision.decidedAt,
      eventId: idGenerator(),
      actorType: "manager",
      actorId: decision.managerId,
      metadata: {
        bitrixEntityType: proposal.entityType,
        bitrixFieldCode: proposal.fieldCode
      }
    });

    return { status: "applied", proposalId: proposal.id };
  }

  async function loadPendingDecisionContext(
    decision: ApplyManagerEnrichmentDecisionInput
  ): Promise<
    | {
        proposal: EnrichmentProposalRecord;
        batch: EnrichmentProposalBatchRecord;
      }
    | { result: CallEnrichmentWritebackResult }
  > {
    const proposal = await input.repository.getEnrichmentProposal(
      decision.proposalId
    );
    if (!proposal) {
      return {
        result: {
          status: "rejected",
          proposalId: decision.proposalId,
          reason: "PROPOSAL_NOT_FOUND"
        }
      };
    }

    const batch = await input.repository.getEnrichmentProposalBatch(
      proposal.batchId
    );
    if (!batch) {
      return {
        result: {
          status: "rejected",
          proposalId: decision.proposalId,
          reason: "BATCH_NOT_FOUND"
        }
      };
    }

    if (batch.managerId !== decision.managerId) {
      await appendAuditEvent(batch, proposal, decision, "decision.rejected", {
        reason: "MANAGER_MISMATCH"
      });
      return {
        result: {
          status: "rejected",
          proposalId: proposal.id,
          reason: "MANAGER_MISMATCH"
        }
      };
    }

    const canStartDecision =
      proposal.status === "pending" &&
      ["pending", "partially_applied"].includes(batch.status);
    const canResumeApprovedWrite =
      decision.action === "approve" &&
      proposal.status === "approved" &&
      ["pending", "approved", "partially_applied", "failed"].includes(
        batch.status
      );

    if (!canStartDecision && !canResumeApprovedWrite) {
      return {
        result: {
          status: "already_decided",
          proposalId: proposal.id
        }
      };
    }

    if (Date.parse(batch.expiresAt) <= Date.parse(decision.decidedAt)) {
      await input.repository.markEnrichmentProposalFailed({
        proposalId: proposal.id,
        failedAt: decision.decidedAt,
        eventId: idGenerator(),
        status: "expired",
        actorType: "manager",
        actorId: decision.managerId,
        reason: "PROPOSAL_EXPIRED",
        metadata: null
      });
      return {
        result: {
          status: "expired",
          proposalId: proposal.id
        }
      };
    }

    return { proposal, batch };
  }

  async function declineProposal(decision: ApplyManagerEnrichmentDecisionInput) {
    const decisionWasMarked = await input.repository.markEnrichmentProposalDecision({
      proposalId: decision.proposalId,
      status: "declined",
      actorId: decision.managerId,
      decidedAt: decision.decidedAt,
      eventId: idGenerator(),
      reason: "telegram_declined",
      metadata: null
    });

    return decisionWasMarked
      ? ({ status: "declined", proposalId: decision.proposalId } as const)
      : ({ status: "already_decided", proposalId: decision.proposalId } as const);
  }

  async function recordApprovedWithoutWrite(
    decision: ApplyManagerEnrichmentDecisionInput,
    reason: string
  ) {
    const decisionWasMarked = await markApproved(decision, reason);
    return decisionWasMarked
      ? ({ status: "recorded", proposalId: decision.proposalId, reason } as const)
      : ({ status: "already_decided", proposalId: decision.proposalId } as const);
  }

  async function markApproved(
    decision: ApplyManagerEnrichmentDecisionInput,
    reason: string
  ) {
    return input.repository.markEnrichmentProposalDecision({
      proposalId: decision.proposalId,
      status: "approved",
      actorId: decision.managerId,
      decidedAt: decision.decidedAt,
      eventId: idGenerator(),
      reason,
      metadata: null
    } satisfies MarkEnrichmentProposalDecisionInput);
  }

  async function markConflict(
    decision: ApplyManagerEnrichmentDecisionInput,
    reason: string
  ) {
    await markFailedStatus(decision, reason, "conflict");
    return {
      status: "conflict",
      proposalId: decision.proposalId,
      reason
    } as const;
  }

  async function markFailed(
    decision: ApplyManagerEnrichmentDecisionInput,
    reason: string
  ) {
    await markFailedStatus(decision, reason, "failed");
    return {
      status: "failed",
      proposalId: decision.proposalId,
      reason
    } as const;
  }

  async function markBitrixFailure(
    decision: ApplyManagerEnrichmentDecisionInput,
    error: unknown,
    reason: "BITRIX_READ_FAILED" | "BITRIX_UPDATE_FAILED"
  ) {
    const metadata = {
      errorMessage: safeErrorMessage(error)
    };
    await input.repository.markEnrichmentProposalFailed({
      proposalId: decision.proposalId,
      failedAt: decision.decidedAt,
      eventId: idGenerator(),
      status: "failed",
      actorType: "manager",
      actorId: decision.managerId,
      reason,
      metadata
    });
    return {
      status: "failed",
      proposalId: decision.proposalId,
      reason
    } as const;
  }

  async function markFailedStatus(
    decision: ApplyManagerEnrichmentDecisionInput,
    reason: string,
    status: NonNullable<MarkEnrichmentProposalFailedInput["status"]>
  ) {
    await input.repository.markEnrichmentProposalFailed({
      proposalId: decision.proposalId,
      failedAt: decision.decidedAt,
      eventId: idGenerator(),
      status,
      actorType: "manager",
      actorId: decision.managerId,
      reason,
      metadata: null
    });
  }

  async function readCurrentValues(
    bitrix: CallEnrichmentWritebackBitrixClient,
    proposal: EnrichmentProposalRecord
  ) {
    return proposal.entityType === "contact"
      ? bitrix.getContactEnrichmentValues(proposal.entityId)
      : bitrix.getDealEnrichmentValues(proposal.entityId);
  }

  async function updateBitrixField(
    bitrix: CallEnrichmentWritebackBitrixClient,
    proposal: EnrichmentProposalRecord
  ) {
    const updateInput = {
      entityId: proposal.entityId,
      fieldCode: proposal.fieldCode,
      value: proposal.normalizedValue
    };

    if (proposal.entityType === "contact") {
      await bitrix.updateContactEnrichmentField(updateInput);
      return;
    }

    await bitrix.updateDealEnrichmentField(updateInput);
  }

  function getWritebackDisabledReason(managerId: string) {
    if (writebackMode === "disabled") {
      return "WRITEBACK_DISABLED_TELEGRAM_ONLY";
    }

    if (writebackMode === "limited" && !pilotManagerIds.has(managerId)) {
      return "WRITEBACK_DISABLED_MANAGER_NOT_IN_PILOT";
    }

    return null;
  }

  async function appendAuditEvent(
    batch: EnrichmentProposalBatchRecord,
    proposal: EnrichmentProposalRecord,
    decision: ApplyManagerEnrichmentDecisionInput,
    action: string,
    metadata: Record<string, unknown>
  ) {
    await input.repository.appendEnrichmentProposalEvent({
      id: idGenerator(),
      batchId: batch.id,
      proposalId: proposal.id,
      actorType: "manager",
      actorId: decision.managerId,
      action,
      beforeStatus: proposal.status,
      afterStatus: proposal.status,
      reason: String(metadata.reason ?? action),
      metadata,
      createdAt: decision.decidedAt
    } satisfies EnrichmentProposalEventInput);
  }

  return {
    applyManagerEnrichmentDecision
  };
}
