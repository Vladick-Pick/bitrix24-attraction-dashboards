import { describe, expect, it, vi } from "vitest";

import { OpenRouterDialogueGateProvider } from "../src/server/openrouter-dialogue-gate";

function createJsonResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => JSON.stringify(payload)
  } as Response;
}

function createGatePayload(input: {
  hasDialogue: boolean;
  evidenceType:
    | "human_dialogue"
    | "voicemail"
    | "robot"
    | "silence"
    | "short_failed_call"
    | "operator_no_answer"
    | "other";
  confidence?: number;
}) {
  return {
    hasDialogue: input.hasDialogue,
    evidenceType: input.evidenceType,
    confidence: input.confidence ?? 0.91,
    reason: input.hasDialogue
      ? "Есть ответы менеджера и клиента."
      : "Нет живого двустороннего разговора.",
    evidenceSnippet: input.hasDialogue
      ? "Менеджер: добрый день. Клиент: расскажите подробнее."
      : "Абонент не ответил."
  };
}

function createOpenRouterResponse(gate: ReturnType<typeof createGatePayload>) {
  return createJsonResponse({
    choices: [
      {
        message: {
          content: JSON.stringify(gate)
        }
      }
    ],
    usage: {
      total_tokens: 84
    }
  });
}

describe("OpenRouterDialogueGateProvider", () => {
  it("sends audio to OpenRouter with a strict dialogue-only JSON schema", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        createOpenRouterResponse(createGatePayload({ hasDialogue: true, evidenceType: "human_dialogue" }))
      );
    const provider = new OpenRouterDialogueGateProvider({
      apiKey: "openrouter-key",
      model: "google/gemini-2.5-flash-lite",
      promptVersion: "dialogue-gate-v1",
      fetch: fetchMock,
      now: () => new Date("2026-06-28T12:00:00.000Z")
    });

    const result = await provider.analyzeDialogue({
      callId: "CALL1",
      audio: Buffer.from("mp3-bytes"),
      audioFormat: "mp3",
      metadata: {
        durationSeconds: 42,
        callFailedCode: null
      }
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer openrouter-key",
      "Content-Type": "application/json"
    });

    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      model: "google/gemini-2.5-flash-lite",
      stream: false,
      temperature: 0,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "dialogue_gate",
          strict: true
        }
      }
    });
    expect(body.response_format.json_schema.schema.required).toEqual([
      "hasDialogue",
      "evidenceType",
      "confidence",
      "reason",
      "evidenceSnippet"
    ]);
    expect(body.response_format.json_schema.schema.properties.evidenceType.enum).toEqual([
      "human_dialogue",
      "voicemail",
      "robot",
      "silence",
      "short_failed_call",
      "operator_no_answer",
      "other"
    ]);

    const promptText = body.messages[0].content[0].text;
    expect(promptText).toContain("promptVersion: dialogue-gate-v1");
    expect(promptText).toContain("не удалось дозвониться");
    expect(promptText).toContain("durationSeconds: 42");
    expect(promptText).not.toContain("communicationScore");
    expect(promptText).not.toContain("narrativeScore");
    expect(promptText).not.toContain("CRM-поля");
    expect(body.messages[0].content[1]).toEqual({
      type: "input_audio",
      input_audio: {
        data: Buffer.from("mp3-bytes").toString("base64"),
        format: "mp3"
      }
    });

    expect(result).toMatchObject({
      callId: "CALL1",
      model: "google/gemini-2.5-flash-lite",
      promptVersion: "dialogue-gate-v1",
      analyzedAt: "2026-06-28T12:00:00.000Z",
      gate: {
        hasDialogue: true,
        evidenceType: "human_dialogue",
        confidence: 0.91
      },
      usage: {
        totalTokens: 84
      }
    });
  });

  it.each([
    "voicemail",
    "robot",
    "silence",
    "short_failed_call",
    "operator_no_answer"
  ] as const)("parses %s as a no-dialogue gate decision", async (evidenceType) => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        createOpenRouterResponse(createGatePayload({ hasDialogue: false, evidenceType }))
      );
    const provider = new OpenRouterDialogueGateProvider({
      apiKey: "openrouter-key",
      fetch: fetchMock
    });

    await expect(
      provider.analyzeDialogue({
        callId: "CALL1",
        audio: Buffer.from("mp3-bytes"),
        audioFormat: "mp3"
      })
    ).resolves.toMatchObject({
      gate: {
        hasDialogue: false,
        evidenceType
      }
    });
  });

  it("includes safe OpenRouter error body details when the gate request fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      text: async () =>
        JSON.stringify({
          error: {
            message: "Rate limit exceeded."
          }
        })
    } as Response);
    const provider = new OpenRouterDialogueGateProvider({
      apiKey: "openrouter-key",
      fetch: fetchMock
    });

    await expect(
      provider.analyzeDialogue({
        callId: "CALL1",
        audio: Buffer.from("mp3-bytes"),
        audioFormat: "mp3"
      })
    ).rejects.toThrow(/OpenRouter dialogue gate failed: 429 Too Many Requests.+Rate limit/);
  });
});
