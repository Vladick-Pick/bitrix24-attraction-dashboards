import { describe, expect, it, vi } from "vitest";

import { createCallAnalysisService } from "../src/server/call-analysis-service";
import type { CallAnalysisServiceError } from "../src/server/call-analysis-service";
import type { OpenRouterCallAnalysisResult } from "../src/server/openrouter-call-analysis";

const providerResult: OpenRouterCallAnalysisResult = {
  callId: "CALL1",
  model: "google/gemini-2.5-flash",
  promptVersion: "calls-v2",
  analyzedAt: "2026-06-09T12:00:30.000Z",
  usage: {
    totalTokens: 1234
  },
  analysis: {
    transcriptByRoles: [
      {
        role: "manager",
        start: 0,
        end: 4.2,
        text: "Добрый день, расскажите про задачу."
      },
      {
        role: "client",
        start: 4.3,
        end: 9.8,
        text: "Нам важно понять сроки запуска."
      }
    ],
    fullTranscriptText:
      "Менеджер: Добрый день, расскажите про задачу.\nКлиент: Нам важно понять сроки запуска.",
    aiEvaluation: {
      score: 82,
      callClassification: {
        type: "primary_sales",
        confidence: 0.86,
        reason: "Менеджер проводит первичную диагностику."
      },
      rubricApplicability: {
        level: "high",
        reason: "Первичный звонок подходит для sales rubric."
      },
      communicationScore: {
        score: 84,
        rationale: "Менеджер задает вопрос и слышит задачу клиента.",
        evidenceQuotes: ["Добрый день, расскажите про задачу."]
      },
      narrativeScore: {
        score: 70,
        rationale: "Есть диагностика, но нарратив социальной инфраструктуры не раскрыт.",
        evidenceQuotes: ["Нам важно понять сроки запуска."],
        applicableNarratives: ["diagnostic_questions"],
        missedNarratives: ["club_as_social_infrastructure"]
      },
      callTypeInterpretation: "Первичный исходящий звонок больше 30 секунд.",
      summary: "Менеджер выяснил сроки запуска и контекст задачи.",
      strengths: ["Есть диагностика потребности."],
      risks: ["Следующий шаг не закреплен датой."],
      nextStepQuality: "ok",
      suggestedNextStep: "Назначить дату следующего контакта.",
      emotionalBackground: {
        managerTone: "calm",
        clientTone: "neutral",
        frictionSignals: [],
        confidence: 0.7
      },
      evidenceQuotes: ["Нам важно понять сроки запуска."],
      confidence: 0.81
    }
  },
  rawAnalysis: {
    transcriptByRoles: [
      {
        role: "manager",
        start: 0,
        end: 4.2,
        text: "Добрый день, расскажите про задачу."
      },
      {
        role: "client",
        start: 4.3,
        end: 9.8,
        text: "Нам важно понять сроки запуска."
      }
    ],
    fullTranscriptText:
      "Менеджер: Добрый день, расскажите про задачу.\nКлиент: Нам важно понять сроки запуска.",
    aiEvaluation: {
      score: 82
    }
  }
};

const providerResultWithRaw = {
  ...providerResult,
  rawAnalysis: {
    ...providerResult.analysis,
    aiEvaluation: {
      ...providerResult.analysis.aiEvaluation,
      providerOnlyDebug: {
        finishReason: "stop",
        safetyRatings: ["ok"]
      }
    },
    providerOnlyTopLevel: "kept-for-debug"
  }
} satisfies OpenRouterCallAnalysisResult;

function createRepository() {
  return {
    getCallById: vi.fn().mockResolvedValue({
      id: "CALL1",
      crmActivityId: "A1",
      portalUserId: "7",
      callType: "1",
      callStartDate: "2026-06-09T09:00:00.000Z",
      callDurationSeconds: 318,
      crmEntityType: "DEAL",
      crmEntityId: "23841",
      callFailedCode: null
    }),
    getDealsByIds: vi.fn().mockResolvedValue([
      {
        id: "23841",
        leadId: null,
        categoryId: "10",
        stageId: "C10:NEW",
        stageSemanticId: "P",
        opportunity: null,
        assignedById: "7",
        sourceId: "LEADGEN_US",
        qualityValue: null,
        dateCreate: "2026-06-01T09:00:00.000Z",
        dateModify: "2026-06-09T09:30:00.000Z",
        dateClosed: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        utmContent: null,
        utmTerm: null
      }
    ]),
    getActivitiesByIds: vi.fn().mockResolvedValue([
      {
        id: "A1",
        ownerTypeId: "2",
        ownerId: "23841",
        typeId: "2",
        providerId: "VOXIMPLANT_CALL",
        responsibleId: "7",
        createdTime: "2026-06-09T09:00:01.000Z",
        deadline: null,
        lastUpdated: "2026-06-09T09:05:18.000Z",
        completed: true,
        completedTime: "2026-06-09T09:05:18.000Z"
      }
    ]),
    getStageAtDealTime: vi.fn().mockResolvedValue({
      id: "23841:C10:QUALIFICATION:2026-06-09T08:30:00.000Z",
      ownerId: "23841",
      categoryId: "10",
      stageId: "C10:QUALIFICATION",
      stageSemanticId: "P",
      typeId: null,
      createdTime: "2026-06-09T08:30:00.000Z"
    }),
    getManagerDirectory: vi.fn().mockResolvedValue([
      {
        id: "7",
        name: "Мария"
      }
    ]),
    getStageCatalog: vi.fn().mockResolvedValue([
      {
        entityType: "deal",
        categoryId: "10",
        statusId: "C10:QUALIFICATION",
        name: "Квалификация",
        semanticId: "P",
        sortOrder: 20
      }
    ]),
    getCallAnalysisResult: vi.fn().mockResolvedValue(null),
    getLatestCallAnalysisRuns: vi.fn().mockResolvedValue([]),
    startCallAnalysisRun: vi.fn().mockResolvedValue(undefined),
    saveCallAnalysisResult: vi.fn().mockResolvedValue(undefined),
    finishCallAnalysisRun: vi.fn().mockResolvedValue(undefined),
    failCallAnalysisRun: vi.fn().mockResolvedValue(undefined)
  };
}

describe("createCallAnalysisService", () => {
  it("downloads the selected call recording, analyzes it and persists transcript plus metadata", async () => {
    const repository = createRepository();
    const client = {
      listCallRecordingActivitiesByIds: vi.fn().mockResolvedValue([
        {
          ID: "A1",
          OWNER_TYPE_ID: "2",
          OWNER_ID: "23841",
          PROVIDER_ID: "VOXIMPLANT_CALL",
          FILES: [{ id: 338028, name: "call.mp3" }],
          STORAGE_ELEMENT_IDS: []
        }
      ]),
      getDiskFile: vi.fn().mockResolvedValue({
        ID: "338028",
        DOWNLOAD_URL: "https://bitrix.example/disk/download/call.mp3"
      })
    };
    const downloadRecording = vi.fn().mockResolvedValue({
      audio: Buffer.from("mp3-bytes"),
      audioFormat: "mp3"
    });
    const provider = {
      analyzeCall: vi.fn().mockResolvedValue(providerResultWithRaw)
    };

    const service = createCallAnalysisService({
      repository,
      client,
      provider,
      downloadRecording,
      idGenerator: () => "run-1",
      now: () => new Date("2026-06-09T12:00:00.000Z")
    });

    const result = await service.analyzeCall({
      callId: "CALL1",
      triggerMode: "manual"
    });

    expect(downloadRecording).toHaveBeenCalledWith(
      "https://bitrix.example/disk/download/call.mp3"
    );
    expect(provider.analyzeCall).toHaveBeenCalledWith({
      callId: "CALL1",
      audio: Buffer.from("mp3-bytes"),
      audioFormat: "mp3"
    });
    expect(repository.startCallAnalysisRun).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "run-1",
        callId: "CALL1",
        crmActivityId: "A1",
        triggerMode: "manual",
        status: "analyzing",
        startedAt: "2026-06-09T12:00:00.000Z"
      })
    );
    expect(repository.saveCallAnalysisResult).toHaveBeenCalledWith(
      expect.objectContaining({
        callId: "CALL1",
        runId: "run-1",
        status: "ready",
        fullTranscriptText: providerResult.analysis.fullTranscriptText,
        transcriptByRoles: providerResult.analysis.transcriptByRoles,
        aiEvaluation: providerResult.analysis.aiEvaluation,
        rawAiEvaluation: expect.objectContaining({
          score: 82,
          providerOnlyDebug: {
            finishReason: "stop",
            safetyRatings: ["ok"]
          }
        }),
        attributes: expect.objectContaining({
          managerName: "Мария",
          callTypeLabel: "Исх >30",
          bitrixDurationSeconds: 318,
          dealId: "23841",
          dealSourceId: "LEADGEN_US",
          stageAtCallId: "C10:QUALIFICATION",
          stageAtCallName: "Квалификация",
          crmActivityId: "A1"
        }),
        model: "google/gemini-2.5-flash",
        promptVersion: "calls-v2",
        analyzedAt: "2026-06-09T12:00:30.000Z",
        updatedAt: "2026-06-09T12:00:00.000Z"
      })
    );
    expect(repository.finishCallAnalysisRun).toHaveBeenCalledWith({
      runId: "run-1",
      finishedAt: "2026-06-09T12:00:00.000Z",
      status: "ready",
      model: "google/gemini-2.5-flash",
      promptVersion: "calls-v2",
      recordingSource: "bitrix_disk",
      recordingFileId: "338028"
    });
    expect(result).toMatchObject({
      status: "ready",
      reusedExistingResult: false,
      result: {
        callId: "CALL1",
        aiEvaluation: {
          score: 82
        },
        rawAiEvaluation: {
          score: 82,
          providerOnlyDebug: {
            finishReason: "stop",
            safetyRatings: ["ok"]
          }
        }
      }
    });
  });

  it("rejects a second analysis while the selected call already has an active run", async () => {
    const repository = {
      ...createRepository(),
      getLatestCallAnalysisRuns: vi.fn().mockResolvedValue([
        {
          callId: "CALL1",
          status: "analyzing",
          startedAt: "2026-06-09T12:00:00.000Z",
          finishedAt: null,
          model: null,
          promptVersion: null,
          errorCode: null,
          errorMessage: null
        }
      ])
    };
    const provider = {
      analyzeCall: vi.fn()
    };

    const service = createCallAnalysisService({
      repository,
      client: {
        listCallRecordingActivitiesByIds: vi.fn(),
        getDiskFile: vi.fn()
      },
      provider,
      downloadRecording: vi.fn(),
      idGenerator: () => "run-duplicate",
      now: () => new Date("2026-06-09T12:00:00.000Z")
    });

    await expect(service.analyzeCall({ callId: "CALL1" })).rejects.toMatchObject({
      code: "CALL_ANALYSIS_ALREADY_RUNNING",
      statusCode: 409
    } satisfies Partial<CallAnalysisServiceError>);
    expect(provider.analyzeCall).not.toHaveBeenCalled();
    expect(repository.startCallAnalysisRun).not.toHaveBeenCalled();
  });

  it("does not re-run OpenRouter when a ready result already exists", async () => {
    const readyResult = {
      callId: "CALL1",
      runId: "previous-run",
      status: "ready" as const,
      transcriptByRoles: providerResult.analysis.transcriptByRoles,
      fullTranscriptText: providerResult.analysis.fullTranscriptText,
      aiEvaluation: providerResult.analysis.aiEvaluation,
      rawAiEvaluation: providerResult.analysis.aiEvaluation,
      attributes: {},
      model: "google/gemini-2.5-flash",
      promptVersion: "calls-v2",
      analyzedAt: "2026-06-09T12:00:30.000Z",
      updatedAt: "2026-06-09T12:00:40.000Z"
    };
    const repository = {
      ...createRepository(),
      getCallAnalysisResult: vi.fn().mockResolvedValue(readyResult)
    };
    const provider = {
      analyzeCall: vi.fn()
    };

    const service = createCallAnalysisService({
      repository,
      client: {
        listCallRecordingActivitiesByIds: vi.fn(),
        getDiskFile: vi.fn()
      },
      provider,
      downloadRecording: vi.fn(),
      idGenerator: () => "run-2",
      now: () => new Date("2026-06-09T12:00:00.000Z")
    });

    await expect(service.analyzeCall({ callId: "CALL1" })).resolves.toEqual({
      status: "ready",
      reusedExistingResult: true,
      result: readyResult
    });
    expect(provider.analyzeCall).not.toHaveBeenCalled();
    expect(repository.startCallAnalysisRun).not.toHaveBeenCalled();
  });

  it("returns a persisted analysis result without starting a new run", async () => {
    const readyResult = {
      callId: "CALL1",
      runId: "previous-run",
      status: "ready" as const,
      transcriptByRoles: providerResult.analysis.transcriptByRoles,
      fullTranscriptText: providerResult.analysis.fullTranscriptText,
      aiEvaluation: providerResult.analysis.aiEvaluation,
      rawAiEvaluation: providerResult.analysis.aiEvaluation,
      attributes: {},
      model: "google/gemini-2.5-flash",
      promptVersion: "calls-v2",
      analyzedAt: "2026-06-09T12:00:30.000Z",
      updatedAt: "2026-06-09T12:00:40.000Z"
    };
    const repository = {
      ...createRepository(),
      getCallAnalysisResult: vi.fn().mockResolvedValue(readyResult)
    };
    const service = createCallAnalysisService({
      repository,
      client: {
        listCallRecordingActivitiesByIds: vi.fn(),
        getDiskFile: vi.fn()
      },
      provider: {
        analyzeCall: vi.fn()
      },
      downloadRecording: vi.fn()
    });

    await expect(service.getCallAnalysisResult("CALL1")).resolves.toBe(
      readyResult
    );
    expect(repository.startCallAnalysisRun).not.toHaveBeenCalled();
  });

  it("marks the run as error when a selected call has no downloadable recording", async () => {
    const repository = createRepository();
    const service = createCallAnalysisService({
      repository,
      client: {
        listCallRecordingActivitiesByIds: vi.fn().mockResolvedValue([]),
        getDiskFile: vi.fn()
      },
      provider: {
        analyzeCall: vi.fn()
      },
      downloadRecording: vi.fn(),
      idGenerator: () => "run-error",
      now: () => new Date("2026-06-09T12:00:00.000Z")
    });

    await expect(service.analyzeCall({ callId: "CALL1" })).rejects.toMatchObject({
      code: "CALL_RECORDING_NOT_FOUND"
    } satisfies Partial<CallAnalysisServiceError>);
    expect(repository.failCallAnalysisRun).toHaveBeenCalledWith({
      runId: "run-error",
      failedAt: "2026-06-09T12:00:00.000Z",
      status: "error",
      errorCode: "CALL_RECORDING_NOT_FOUND",
      errorMessage: "Call recording is not available for analysis."
    });
  });

  it("downloads recordings with an abort signal and rejects files above the configured byte cap", async () => {
    const repository = createRepository();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({
        "content-length": "12",
        "content-type": "audio/mpeg"
      }),
      arrayBuffer: async () => Buffer.from("mp3-bytes").buffer
    } as Response);
    const provider = {
      analyzeCall: vi.fn().mockResolvedValue(providerResult)
    };
    const service = createCallAnalysisService({
      repository,
      client: {
        listCallRecordingActivitiesByIds: vi.fn().mockResolvedValue([
          {
            ID: "A1",
            OWNER_TYPE_ID: "2",
            OWNER_ID: "23841",
            PROVIDER_ID: "VOXIMPLANT_CALL",
            FILES: [{ id: 338028, name: "call.mp3" }],
            STORAGE_ELEMENT_IDS: []
          }
        ]),
        getDiskFile: vi.fn().mockResolvedValue({
          ID: "338028",
          DOWNLOAD_URL: "https://bitrix.example/disk/download/call.mp3"
        })
      },
      provider,
      fetch: fetchMock,
      idGenerator: () => "run-download",
      now: () => new Date("2026-06-09T12:00:00.000Z")
    });

    await service.analyzeCall({ callId: "CALL1" });
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);

    const tooLargeRepository = createRepository();
    const tooLargeFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({
        "content-length": String(60 * 1024 * 1024),
        "content-type": "audio/mpeg"
      }),
      arrayBuffer: async () => Buffer.from("mp3-bytes").buffer
    } as Response);
    const tooLargeService = createCallAnalysisService({
      repository: tooLargeRepository,
      client: {
        listCallRecordingActivitiesByIds: vi.fn().mockResolvedValue([
          {
            ID: "A1",
            OWNER_TYPE_ID: "2",
            OWNER_ID: "23841",
            PROVIDER_ID: "VOXIMPLANT_CALL",
            FILES: [{ id: 338028, name: "call.mp3" }],
            STORAGE_ELEMENT_IDS: []
          }
        ]),
        getDiskFile: vi.fn().mockResolvedValue({
          ID: "338028",
          DOWNLOAD_URL: "https://bitrix.example/disk/download/call.mp3"
        })
      },
      provider: {
        analyzeCall: vi.fn()
      },
      fetch: tooLargeFetch,
      idGenerator: () => "run-too-large",
      now: () => new Date("2026-06-09T12:00:00.000Z")
    });

    await expect(
      tooLargeService.analyzeCall({ callId: "CALL1" })
    ).rejects.toMatchObject({
      code: "CALL_RECORDING_TOO_LARGE"
    } satisfies Partial<CallAnalysisServiceError>);

    const streamingProvider = {
      analyzeCall: vi.fn()
    };
    const streamingService = createCallAnalysisService({
      repository: createRepository(),
      client: {
        listCallRecordingActivitiesByIds: vi.fn().mockResolvedValue([
          {
            ID: "A1",
            OWNER_TYPE_ID: "2",
            OWNER_ID: "23841",
            PROVIDER_ID: "VOXIMPLANT_CALL",
            FILES: [{ id: 338028, name: "call.mp3" }],
            STORAGE_ELEMENT_IDS: []
          }
        ]),
        getDiskFile: vi.fn().mockResolvedValue({
          ID: "338028",
          DOWNLOAD_URL: "https://bitrix.example/disk/download/call.mp3"
        })
      },
      provider: streamingProvider,
      fetch: vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({
          "content-type": "audio/mpeg"
        }),
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array([1, 2, 3]));
            controller.enqueue(new Uint8Array([4, 5, 6]));
            controller.close();
          }
        })
      } as Response),
      maxRecordingBytes: 5,
      idGenerator: () => "run-stream-too-large",
      now: () => new Date("2026-06-09T12:00:00.000Z")
    });

    await expect(
      streamingService.analyzeCall({ callId: "CALL1" })
    ).rejects.toMatchObject({
      code: "CALL_RECORDING_TOO_LARGE"
    } satisfies Partial<CallAnalysisServiceError>);
    expect(streamingProvider.analyzeCall).not.toHaveBeenCalled();
  });
});
