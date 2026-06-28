import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createCallEnrichmentOrchestrator,
  type CallEnrichmentAnalysisService,
  type CallEnrichmentPipeline,
  type CallEnrichmentProposalNotifier
} from "../src/server/call-enrichment-orchestrator";
import type { CallEnrichmentProposalDraft } from "../src/server/call-enrichment-diff";
import { createCallEnrichmentWritebackService } from "../src/server/call-enrichment-writeback";
import { createSqliteRepository, type SqliteRepository } from "../src/server/sqlite-repository";

const tempDirs: string[] = [];
const repositories: SqliteRepository[] = [];

const callEvent = {
  callId: "CALL1",
  activityId: "A1",
  dealId: "23841",
  contactId: "901",
  managerId: "7",
  durationSeconds: 90,
  occurredAt: "2026-06-28T10:00:00.000Z"
};

const context = {
  attributes: {
    callId: "CALL1",
    crmActivityId: "A1",
    dealId: "23841",
    contactId: "901",
    managerId: "7"
  }
};

const readyAnalysis = {
  callId: "CALL1",
  runId: "run-1",
  status: "ready",
  transcriptByRoles: [],
  fullTranscriptText: "Менеджер: Добрый день.\nКлиент: Добрый день.",
  aiEvaluation: {
    callClassification: {
      type: "primary_sales",
      confidence: 0.9,
      reason: "Живой диалог."
    }
  },
  rawAiEvaluation: {},
  attributes: context.attributes,
  model: "test-model",
  promptVersion: "test-prompt",
  analyzedAt: "2026-06-28T10:01:00.000Z",
  updatedAt: "2026-06-28T10:01:00.000Z"
} as const;

function createTempRepository() {
  const directory = mkdtempSync(join(tmpdir(), "call-enrichment-e2e-"));
  tempDirs.push(directory);
  const repository = createSqliteRepository({
    databaseUrl: `file:${join(directory, "test.db")}`,
    defaultWonStageIds: ["C10:WON"]
  });
  repositories.push(repository);
  return repository;
}

function createAnalysis(
  overrides: Partial<CallEnrichmentAnalysisService> = {}
): CallEnrichmentAnalysisService {
  return {
    getCallAnalysisContext: vi.fn().mockResolvedValue(context),
    analyzeCall: vi.fn().mockResolvedValue({
      status: "ready",
      reusedExistingResult: false,
      result: readyAnalysis
    }),
    ...overrides
  };
}

function createPipeline(proposals: CallEnrichmentProposalDraft[] = []) {
  return {
    runAfterCallAnalysis: vi.fn().mockResolvedValue({
      proposals,
      skipped: []
    })
  } satisfies CallEnrichmentPipeline;
}

async function queueWithRepository(input: {
  repository: SqliteRepository;
  analysis?: CallEnrichmentAnalysisService;
  pipeline?: CallEnrichmentPipeline;
  proposalNotifier?: CallEnrichmentProposalNotifier;
  idGenerator?: () => string;
}) {
  const orchestrator = createCallEnrichmentOrchestrator({
    analysis: input.analysis ?? createAnalysis(),
    repository: input.repository,
    enrichmentPipeline: input.pipeline ?? createPipeline(),
    ...(input.proposalNotifier
      ? { proposalNotifier: input.proposalNotifier }
      : {}),
    idGenerator:
      input.idGenerator ??
      vi
        .fn()
        .mockReturnValueOnce("batch-1")
        .mockReturnValueOnce("proposal-1")
        .mockReturnValueOnce("event-1"),
    now: () => new Date("2026-06-28T10:00:00.000Z")
  });
  return orchestrator.queueAutomaticCallAnalysis(callEvent);
}

afterEach(() => {
  for (const repository of repositories.splice(0)) {
    repository.close();
  }
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("call enrichment end to end", () => {
  it("skips no-dialogue calls before extraction, Telegram, or writeback", async () => {
    const repository = createTempRepository();
    const pipeline = createPipeline();

    await expect(
      queueWithRepository({
        repository,
        pipeline,
        analysis: createAnalysis({
          analyzeCall: vi.fn().mockResolvedValue({
            status: "skipped",
            reusedExistingResult: false,
            callId: "CALL1",
            dialogueGate: {
              callId: "CALL1",
              model: "cheap-model",
              promptVersion: "dialogue-v1",
              analyzedAt: "2026-06-28T10:01:00.000Z",
              gate: {
                hasDialogue: false,
                evidenceType: "operator_no_answer",
                confidence: 0.92,
                reason: "Не удалось дозвониться.",
                evidenceSnippet: "Не удалось дозвониться."
              },
              rawGate: {},
              usage: { totalTokens: 40 }
            }
          })
        })
      })
    ).resolves.toEqual({
      status: "skipped",
      callId: "CALL1",
      reason: "NO_DIALOGUE"
    });
    expect(pipeline.runAfterCallAnalysis).not.toHaveBeenCalled();
    await expect(repository.getEnrichmentProposalBatchByCallId("CALL1")).resolves.toMatchObject({
      status: "failed"
    });
  });

  it("records no-op dialogue analysis without Telegram or writeback proposals", async () => {
    const repository = createTempRepository();

    await expect(
      queueWithRepository({
        repository,
        pipeline: createPipeline([])
      })
    ).resolves.toEqual({
      status: "skipped",
      callId: "CALL1",
      reason: "NO_MATERIAL_UPDATES"
    });
    await expect(repository.listEnrichmentProposals("batch-1")).resolves.toEqual([]);
    await expect(repository.listEnrichmentProposalEvents("batch-1")).resolves.toEqual([
      expect.objectContaining({
        action: "batch.skipped",
        reason: "NO_MATERIAL_UPDATES"
      })
    ]);
  });

  it("records telegram-only approvals without writing Bitrix", async () => {
    const repository = createTempRepository();
    const updateContactEnrichmentField = vi.fn();
    const proposalNotifier = {
      sendProposalBatch: vi.fn().mockResolvedValue(undefined)
    } satisfies CallEnrichmentProposalNotifier;

    await queueWithRepository({
      repository,
      proposalNotifier,
      pipeline: createPipeline([
        {
          entityType: "contact",
          entityId: "901",
          fieldCode: "UF_CRM_1647946359",
          fieldTitle: "Оборот бизнеса",
          actionType: "fill_empty",
          currentValue: null,
          proposedValue: "500-1000 млн. рублей",
          normalizedValue: "602",
          confidence: 0.88,
          evidenceSnippet: "оборот 500-1000 млн"
        }
      ])
    });
    expect(proposalNotifier.sendProposalBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        batch: expect.objectContaining({
          id: "batch-1",
          callId: "CALL1",
          managerId: "7"
        }),
        proposals: [
          expect.objectContaining({
            entityType: "contact",
            fieldCode: "UF_CRM_1647946359"
          })
        ]
      })
    );

    const service = createCallEnrichmentWritebackService({
      repository,
      bitrix: {
        getContactEnrichmentValues: vi.fn().mockResolvedValue({}),
        getDealEnrichmentValues: vi.fn().mockResolvedValue({}),
        updateContactEnrichmentField,
        updateDealEnrichmentField: vi.fn()
      },
      writebackMode: "disabled",
      idGenerator: () => "event-approved"
    });

    await expect(
      service.applyManagerEnrichmentDecision({
        proposalId: "proposal-1",
        managerId: "7",
        action: "approve",
        decidedAt: "2026-06-28T10:05:00.000Z"
      })
    ).resolves.toMatchObject({
      status: "recorded",
      reason: "WRITEBACK_DISABLED_TELEGRAM_ONLY"
    });
    expect(updateContactEnrichmentField).not.toHaveBeenCalled();
  });

  it("writes pilot manager contact and deal proposals in limited write mode", async () => {
    const repository = createTempRepository();
    await queueWithRepository({
      repository,
      pipeline: createPipeline([
        {
          entityType: "deal",
          entityId: "23841",
          fieldCode: "UF_CRM_1766147164481",
          fieldTitle: "Ключевые проекты",
          actionType: "fill_empty",
          currentValue: null,
          proposedValue: "Ключевой проект",
          normalizedValue: "Ключевой проект",
          confidence: 0.9,
          evidenceSnippet: "запускаю новый проект"
        }
      ])
    });
    const updateDealEnrichmentField = vi.fn().mockResolvedValue(undefined);
    const service = createCallEnrichmentWritebackService({
      repository,
      bitrix: {
        getContactEnrichmentValues: vi.fn().mockResolvedValue({}),
        getDealEnrichmentValues: vi
          .fn()
          .mockResolvedValue({ UF_CRM_1766147164481: null }),
        updateContactEnrichmentField: vi.fn(),
        updateDealEnrichmentField
      },
      writebackMode: "limited",
      pilotManagerIds: ["7"],
      idGenerator: vi
        .fn()
        .mockReturnValueOnce("event-approved")
        .mockReturnValueOnce("event-applied")
    });

    await expect(
      service.applyManagerEnrichmentDecision({
        proposalId: "proposal-1",
        managerId: "7",
        action: "approve",
        decidedAt: "2026-06-28T10:05:00.000Z"
      })
    ).resolves.toEqual({
      status: "applied",
      proposalId: "proposal-1"
    });
    expect(updateDealEnrichmentField).toHaveBeenCalledWith({
      entityId: "23841",
      fieldCode: "UF_CRM_1766147164481",
      value: "Ключевой проект"
    });
  });

  it("expires ignored proposals and rejects later approvals", async () => {
    const repository = createTempRepository();
    await queueWithRepository({
      repository,
      pipeline: createPipeline([
        {
          entityType: "contact",
          entityId: "901",
          fieldCode: "UF_CRM_1647946359",
          fieldTitle: "Оборот бизнеса",
          actionType: "fill_empty",
          currentValue: null,
          proposedValue: "500-1000 млн. рублей",
          normalizedValue: "602",
          confidence: 0.88,
          evidenceSnippet: "оборот 500-1000 млн"
        }
      ])
    });

    await repository.expirePendingEnrichmentProposals({
      expiredAt: "2026-06-30T10:00:01.000Z"
    });

    const service = createCallEnrichmentWritebackService({
      repository,
      bitrix: {
        getContactEnrichmentValues: vi.fn().mockResolvedValue({}),
        getDealEnrichmentValues: vi.fn().mockResolvedValue({}),
        updateContactEnrichmentField: vi.fn(),
        updateDealEnrichmentField: vi.fn()
      }
    });
    await expect(
      service.applyManagerEnrichmentDecision({
        proposalId: "proposal-1",
        managerId: "7",
        action: "approve",
        decidedAt: "2026-06-30T10:05:00.000Z"
      })
    ).resolves.toEqual({
      status: "already_decided",
      proposalId: "proposal-1"
    });
  });
});
