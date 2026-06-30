import { describe, expect, it, vi } from "vitest";

import { createCallEnrichmentWritebackService } from "../src/server/call-enrichment-writeback";
import type {
  EnrichmentProposalBatchRecord,
  EnrichmentProposalRecord
} from "../src/server/sqlite-repository";

const batch = {
  id: "batch-1",
  callId: "CALL1",
  activityId: "A1",
  dealId: "23841",
  contactId: "901",
  managerId: "7",
  callAnalysisRunId: "run-1",
  status: "pending",
  expiresAt: "2026-06-30T10:00:00.000Z",
  telegramChatId: "chat-7",
  telegramMessageId: "42",
  createdAt: "2026-06-28T10:00:00.000Z",
  updatedAt: "2026-06-28T10:00:00.000Z"
} satisfies EnrichmentProposalBatchRecord;

const contactProposal = {
  id: "proposal-1",
  batchId: "batch-1",
  entityType: "contact",
  entityId: "901",
  fieldCode: "UF_CRM_1647946359",
  fieldTitle: "Оборот бизнеса",
  actionType: "fill_empty",
  currentValue: null,
  proposedValue: "500-1000 млн. рублей",
  normalizedValue: "602",
  confidence: 0.86,
  evidenceSnippet: "оборот 500-1000 млн",
  status: "pending",
  createdAt: "2026-06-28T10:00:00.000Z",
  updatedAt: "2026-06-28T10:00:00.000Z"
} satisfies EnrichmentProposalRecord;

const dealProposal = {
  ...contactProposal,
  id: "proposal-deal-1",
  entityType: "deal",
  entityId: "23841",
  fieldCode: "UF_CRM_1766147164481",
  fieldTitle: "Ключевые проекты",
  actionType: "fill_empty",
  currentValue: null,
  proposedValue: "Ключевой проект",
  normalizedValue: "Ключевой проект"
} satisfies EnrichmentProposalRecord;

const overwriteProposal = {
  ...contactProposal,
  id: "proposal-overwrite-1",
  actionType: "overwrite",
  currentValue: "7116",
  proposedValue: "500-1000 млн. рублей",
  normalizedValue: "602"
} satisfies EnrichmentProposalRecord;

function createRepository(
  overrides: Partial<ReturnType<typeof createRepositoryBase>> = {}
) {
  return {
    ...createRepositoryBase(),
    ...overrides
  };
}

function createRepositoryBase() {
  return {
    getEnrichmentProposal: vi.fn().mockResolvedValue(contactProposal),
    getEnrichmentProposalBatch: vi.fn().mockResolvedValue(batch),
    appendEnrichmentProposalEvent: vi.fn().mockResolvedValue(undefined),
    markEnrichmentProposalDecision: vi.fn().mockResolvedValue(true),
    markEnrichmentProposalApplied: vi.fn().mockResolvedValue(undefined),
    markEnrichmentProposalFailed: vi.fn().mockResolvedValue(undefined)
  };
}

function createBitrix(overrides: Partial<ReturnType<typeof createBitrixBase>> = {}) {
  return {
    ...createBitrixBase(),
    ...overrides
  };
}

function createBitrixBase() {
  return {
    getContactEnrichmentValues: vi
      .fn()
      .mockResolvedValue({ UF_CRM_1647946359: null }),
    getDealEnrichmentValues: vi.fn().mockResolvedValue({}),
    updateContactEnrichmentField: vi.fn().mockResolvedValue(undefined),
    updateDealEnrichmentField: vi.fn().mockResolvedValue(undefined)
  };
}

describe("createCallEnrichmentWritebackService", () => {
  it("applies an approved fill-empty contact proposal after re-reading Bitrix", async () => {
    const repository = createRepository();
    const bitrix = createBitrix();
    const service = createCallEnrichmentWritebackService({
      repository,
      bitrix,
      idGenerator: () => "event-1"
    });

    await expect(
      service.applyManagerEnrichmentDecision({
        proposalId: "proposal-1",
        managerId: "7",
        action: "approve",
        decidedAt: "2026-06-28T11:00:00.000Z"
      })
    ).resolves.toEqual({
      status: "applied",
      proposalId: "proposal-1"
    });

    expect(bitrix.getContactEnrichmentValues).toHaveBeenCalledWith("901");
    expect(bitrix.updateContactEnrichmentField).toHaveBeenCalledWith({
      entityId: "901",
      fieldCode: "UF_CRM_1647946359",
      value: "602"
    });
    expect(repository.markEnrichmentProposalApplied).toHaveBeenCalledWith({
      proposalId: "proposal-1",
      appliedAt: "2026-06-28T11:00:00.000Z",
      eventId: "event-1",
      actorType: "manager",
      actorId: "7",
      metadata: {
        bitrixEntityType: "contact",
        bitrixFieldCode: "UF_CRM_1647946359"
      }
    });
  });

  it("marks a stale fill-empty proposal as conflict without writing", async () => {
    const repository = createRepository();
    const bitrix = createBitrix({
      getContactEnrichmentValues: vi
        .fn()
        .mockResolvedValue({ UF_CRM_1647946359: "7116" })
    });
    const service = createCallEnrichmentWritebackService({
      repository,
      bitrix,
      idGenerator: () => "event-1"
    });

    await expect(
      service.applyManagerEnrichmentDecision({
        proposalId: "proposal-1",
        managerId: "7",
        action: "approve",
        decidedAt: "2026-06-28T11:00:00.000Z"
      })
    ).resolves.toEqual({
      status: "conflict",
      proposalId: "proposal-1",
      reason: "CURRENT_VALUE_NOT_EMPTY"
    });

    expect(bitrix.updateContactEnrichmentField).not.toHaveBeenCalled();
    expect(repository.markEnrichmentProposalFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        proposalId: "proposal-1",
        status: "conflict",
        reason: "CURRENT_VALUE_NOT_EMPTY"
      })
    );
  });

  it("applies deal-only enrichment fields through the deal update method", async () => {
    const repository = createRepository({
      getEnrichmentProposal: vi.fn().mockResolvedValue(dealProposal)
    });
    const bitrix = createBitrix({
      getDealEnrichmentValues: vi
        .fn()
        .mockResolvedValue({ UF_CRM_1766147164481: null })
    });
    const service = createCallEnrichmentWritebackService({
      repository,
      bitrix,
      idGenerator: () => "event-1"
    });

    await expect(
      service.applyManagerEnrichmentDecision({
        proposalId: "proposal-deal-1",
        managerId: "7",
        action: "approve",
        decidedAt: "2026-06-28T11:00:00.000Z"
      })
    ).resolves.toEqual({
      status: "applied",
      proposalId: "proposal-deal-1"
    });

    expect(bitrix.updateDealEnrichmentField).toHaveBeenCalledWith({
      entityId: "23841",
      fieldCode: "UF_CRM_1766147164481",
      value: "Ключевой проект"
    });
    expect(bitrix.updateContactEnrichmentField).not.toHaveBeenCalled();
  });

  it("records approved decisions without Bitrix writes when writeback is disabled", async () => {
    const repository = createRepository();
    const bitrix = createBitrix();
    const service = createCallEnrichmentWritebackService({
      repository,
      bitrix,
      writebackMode: "disabled",
      idGenerator: () => "event-1"
    });

    await expect(
      service.applyManagerEnrichmentDecision({
        proposalId: "proposal-1",
        managerId: "7",
        action: "approve",
        decidedAt: "2026-06-28T11:00:00.000Z"
      })
    ).resolves.toEqual({
      status: "recorded",
      proposalId: "proposal-1",
      reason: "WRITEBACK_DISABLED_TELEGRAM_ONLY"
    });

    expect(repository.markEnrichmentProposalDecision).toHaveBeenCalledWith({
      proposalId: "proposal-1",
      status: "approved",
      actorId: "7",
      decidedAt: "2026-06-28T11:00:00.000Z",
      eventId: "event-1",
      reason: "WRITEBACK_DISABLED_TELEGRAM_ONLY",
      metadata: null
    });
    expect(bitrix.getContactEnrichmentValues).not.toHaveBeenCalled();
    expect(bitrix.updateContactEnrichmentField).not.toHaveBeenCalled();
  });

  it("records non-pilot approvals without writes in limited write mode", async () => {
    const repository = createRepository();
    const bitrix = createBitrix();
    const service = createCallEnrichmentWritebackService({
      repository,
      bitrix,
      writebackMode: "limited",
      pilotManagerIds: ["other-manager"],
      idGenerator: () => "event-1"
    });

    await expect(
      service.applyManagerEnrichmentDecision({
        proposalId: "proposal-1",
        managerId: "7",
        action: "approve",
        decidedAt: "2026-06-28T11:00:00.000Z"
      })
    ).resolves.toMatchObject({
      status: "recorded",
      reason: "WRITEBACK_DISABLED_MANAGER_NOT_IN_PILOT"
    });
    expect(bitrix.updateContactEnrichmentField).not.toHaveBeenCalled();
  });

  it("writes pilot manager approvals in limited write mode", async () => {
    const repository = createRepository();
    const bitrix = createBitrix();
    const service = createCallEnrichmentWritebackService({
      repository,
      bitrix,
      writebackMode: "limited",
      pilotManagerIds: ["7"],
      idGenerator: () => "event-1"
    });

    await expect(
      service.applyManagerEnrichmentDecision({
        proposalId: "proposal-1",
        managerId: "7",
        action: "approve",
        decidedAt: "2026-06-28T11:00:00.000Z"
      })
    ).resolves.toEqual({
      status: "applied",
      proposalId: "proposal-1"
    });
    expect(bitrix.updateContactEnrichmentField).toHaveBeenCalledTimes(1);
  });

  it("allows pending proposals in a partially applied batch to be applied", async () => {
    const repository = createRepository({
      getEnrichmentProposalBatch: vi.fn().mockResolvedValue({
        ...batch,
        status: "partially_applied"
      })
    });
    const bitrix = createBitrix();
    const service = createCallEnrichmentWritebackService({
      repository,
      bitrix,
      idGenerator: () => "event-1"
    });

    await expect(
      service.applyManagerEnrichmentDecision({
        proposalId: "proposal-1",
        managerId: "7",
        action: "approve",
        decidedAt: "2026-06-28T11:00:00.000Z"
      })
    ).resolves.toEqual({
      status: "applied",
      proposalId: "proposal-1"
    });
  });

  it("marks stale overwrite proposals as conflict without writing", async () => {
    const repository = createRepository({
      getEnrichmentProposal: vi.fn().mockResolvedValue(overwriteProposal)
    });
    const bitrix = createBitrix({
      getContactEnrichmentValues: vi
        .fn()
        .mockResolvedValue({ UF_CRM_1647946359: "604" })
    });
    const service = createCallEnrichmentWritebackService({
      repository,
      bitrix,
      idGenerator: () => "event-1"
    });

    await expect(
      service.applyManagerEnrichmentDecision({
        proposalId: "proposal-overwrite-1",
        managerId: "7",
        action: "approve",
        decidedAt: "2026-06-28T11:00:00.000Z"
      })
    ).resolves.toEqual({
      status: "conflict",
      proposalId: "proposal-overwrite-1",
      reason: "CURRENT_VALUE_CHANGED"
    });

    expect(bitrix.updateContactEnrichmentField).not.toHaveBeenCalled();
  });

  it("marks expired proposals without calling Bitrix", async () => {
    const repository = createRepository({
      getEnrichmentProposalBatch: vi.fn().mockResolvedValue({
        ...batch,
        expiresAt: "2026-06-28T10:30:00.000Z"
      })
    });
    const bitrix = createBitrix();
    const service = createCallEnrichmentWritebackService({
      repository,
      bitrix,
      idGenerator: () => "event-1"
    });

    await expect(
      service.applyManagerEnrichmentDecision({
        proposalId: "proposal-1",
        managerId: "7",
        action: "approve",
        decidedAt: "2026-06-28T11:00:00.000Z"
      })
    ).resolves.toEqual({
      status: "expired",
      proposalId: "proposal-1"
    });

    expect(repository.markEnrichmentProposalFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "expired",
        reason: "PROPOSAL_EXPIRED"
      })
    );
    expect(bitrix.updateContactEnrichmentField).not.toHaveBeenCalled();
  });

  it("marks Bitrix update failures as failed with a safe short message", async () => {
    const repository = createRepository();
    const bitrix = createBitrix({
      updateContactEnrichmentField: vi
        .fn()
        .mockRejectedValue(
          new Error(
            `Bitrix failed at https://portal/rest/1/secret/crm.contact.update: user@example.com +7 999 111-22-33 ${"x".repeat(400)}`
          )
        )
    });
    const service = createCallEnrichmentWritebackService({
      repository,
      bitrix,
      idGenerator: () => "event-1"
    });

    await expect(
      service.applyManagerEnrichmentDecision({
        proposalId: "proposal-1",
        managerId: "7",
        action: "approve",
        decidedAt: "2026-06-28T11:00:00.000Z"
      })
    ).resolves.toEqual({
      status: "failed",
      proposalId: "proposal-1",
      reason: "BITRIX_UPDATE_FAILED"
    });

    expect(repository.markEnrichmentProposalFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        reason: "BITRIX_UPDATE_FAILED",
        metadata: {
          errorMessage: expect.stringMatching(/^Bitrix failed/)
        }
      })
    );
    const metadata = vi.mocked(repository.markEnrichmentProposalFailed).mock
      .calls[0]?.[0].metadata;
    expect(String(metadata?.errorMessage).length).toBeLessThanOrEqual(180);
    expect(metadata?.errorMessage).not.toContain("https://portal");
    expect(metadata?.errorMessage).not.toContain("user@example.com");
    expect(metadata?.errorMessage).not.toContain("+7 999 111-22-33");
  });

  it("marks Bitrix current-value read failures as failed without throwing", async () => {
    const repository = createRepository();
    const bitrix = createBitrix({
      getContactEnrichmentValues: vi
        .fn()
        .mockRejectedValue(new Error("Bitrix current value read failed"))
    });
    const service = createCallEnrichmentWritebackService({
      repository,
      bitrix,
      idGenerator: () => "event-1"
    });

    await expect(
      service.applyManagerEnrichmentDecision({
        proposalId: "proposal-1",
        managerId: "7",
        action: "approve",
        decidedAt: "2026-06-28T11:00:00.000Z"
      })
    ).resolves.toEqual({
      status: "failed",
      proposalId: "proposal-1",
      reason: "BITRIX_READ_FAILED"
    });

    expect(bitrix.updateContactEnrichmentField).not.toHaveBeenCalled();
    expect(repository.markEnrichmentProposalFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        reason: "BITRIX_READ_FAILED"
      })
    );
  });

  it("resumes an approved proposal write even when sibling proposals keep the batch pending", async () => {
    const approvedProposal = {
      ...contactProposal,
      status: "approved"
    } satisfies EnrichmentProposalRecord;
    const repository = createRepository({
      getEnrichmentProposal: vi.fn().mockResolvedValue(approvedProposal),
      getEnrichmentProposalBatch: vi.fn().mockResolvedValue({
        ...batch,
        status: "pending"
      })
    });
    const bitrix = createBitrix();
    const service = createCallEnrichmentWritebackService({
      repository,
      bitrix,
      idGenerator: () => "event-1"
    });

    await expect(
      service.applyManagerEnrichmentDecision({
        proposalId: "proposal-1",
        managerId: "7",
        action: "approve",
        decidedAt: "2026-06-28T11:00:00.000Z"
      })
    ).resolves.toEqual({
      status: "applied",
      proposalId: "proposal-1"
    });

    expect(repository.markEnrichmentProposalDecision).not.toHaveBeenCalled();
    expect(bitrix.updateContactEnrichmentField).toHaveBeenCalledWith({
      entityId: "901",
      fieldCode: "UF_CRM_1647946359",
      value: "602"
    });
    expect(repository.markEnrichmentProposalApplied).toHaveBeenCalledWith(
      expect.objectContaining({
        proposalId: "proposal-1"
      })
    );
  });

  it("declines a proposal without calling Bitrix", async () => {
    const repository = createRepository();
    const bitrix = createBitrix();
    const service = createCallEnrichmentWritebackService({
      repository,
      bitrix,
      idGenerator: () => "event-1"
    });

    await expect(
      service.applyManagerEnrichmentDecision({
        proposalId: "proposal-1",
        managerId: "7",
        action: "decline",
        decidedAt: "2026-06-28T11:00:00.000Z"
      })
    ).resolves.toEqual({
      status: "declined",
      proposalId: "proposal-1"
    });

    expect(repository.markEnrichmentProposalDecision).toHaveBeenCalledWith({
      proposalId: "proposal-1",
      status: "declined",
      actorId: "7",
      decidedAt: "2026-06-28T11:00:00.000Z",
      eventId: "event-1",
      reason: "telegram_declined",
      metadata: null
    });
    expect(bitrix.updateContactEnrichmentField).not.toHaveBeenCalled();
    expect(bitrix.updateDealEnrichmentField).not.toHaveBeenCalled();
  });

  it("rejects manager mismatches before reading or writing Bitrix", async () => {
    const repository = createRepository();
    const bitrix = createBitrix();
    const service = createCallEnrichmentWritebackService({
      repository,
      bitrix,
      idGenerator: () => "event-1"
    });

    await expect(
      service.applyManagerEnrichmentDecision({
        proposalId: "proposal-1",
        managerId: "other-manager",
        action: "approve",
        decidedAt: "2026-06-28T11:00:00.000Z"
      })
    ).resolves.toEqual({
      status: "rejected",
      proposalId: "proposal-1",
      reason: "MANAGER_MISMATCH"
    });

    expect(bitrix.getContactEnrichmentValues).not.toHaveBeenCalled();
    expect(bitrix.updateContactEnrichmentField).not.toHaveBeenCalled();
  });
});
