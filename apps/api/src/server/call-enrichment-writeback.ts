import { randomUUID } from "node:crypto";

import {
  getCallEnrichmentFieldByCode
} from "./call-enrichment-fields.js";
import {
  isUnresolvedEnrichmentReference,
  normalizeCallEnrichmentValue,
  valuesAreEquivalent
} from "./call-enrichment-current-values.js";
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

export interface ApplyManagerEnrichmentDecisionInput {
  proposalId: string;
  managerId: string;
  action: CallEnrichmentWritebackAction;
  decidedAt: string;
}

export type CallEnrichmentWritebackResult =
  | { status: "applied"; proposalId: string }
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
  bitrix: CallEnrichmentWritebackBitrixClient;
  idGenerator?: () => string;
}

const SAFE_ERROR_MESSAGE_LENGTH = 180;

export function createCallEnrichmentWritebackService(
  input: CreateCallEnrichmentWritebackServiceInput
): CallEnrichmentWritebackService {
  const idGenerator = input.idGenerator ?? randomUUID;

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

    const decisionWasMarked = await markApproved(decision);
    if (!decisionWasMarked) {
      return { status: "already_decided", proposalId: decision.proposalId };
    }

    const currentValues = await readCurrentValues(proposal);
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
      await updateBitrixField(proposal);
    } catch (error) {
      return markBitrixFailure(decision, error);
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

    if (
      proposal.status !== "pending" ||
      !["pending", "partially_applied"].includes(batch.status)
    ) {
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

  async function markApproved(decision: ApplyManagerEnrichmentDecisionInput) {
    return input.repository.markEnrichmentProposalDecision({
      proposalId: decision.proposalId,
      status: "approved",
      actorId: decision.managerId,
      decidedAt: decision.decidedAt,
      eventId: idGenerator(),
      reason: "telegram_approved",
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
    error: unknown
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
      reason: "BITRIX_UPDATE_FAILED",
      metadata
    });
    return {
      status: "failed",
      proposalId: decision.proposalId,
      reason: "BITRIX_UPDATE_FAILED"
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

  async function readCurrentValues(proposal: EnrichmentProposalRecord) {
    return proposal.entityType === "contact"
      ? input.bitrix.getContactEnrichmentValues(proposal.entityId)
      : input.bitrix.getDealEnrichmentValues(proposal.entityId);
  }

  async function updateBitrixField(proposal: EnrichmentProposalRecord) {
    const updateInput = {
      entityId: proposal.entityId,
      fieldCode: proposal.fieldCode,
      value: proposal.normalizedValue
    };

    if (proposal.entityType === "contact") {
      await input.bitrix.updateContactEnrichmentField(updateInput);
      return;
    }

    await input.bitrix.updateDealEnrichmentField(updateInput);
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

function safeErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "unknown";
  }

  return error.message
    .replace(/https?:\/\/\S+/giu, "[url]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, "[email]")
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/gu, "[phone]")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, SAFE_ERROR_MESSAGE_LENGTH);
}
