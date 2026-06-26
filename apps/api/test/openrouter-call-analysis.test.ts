import { describe, expect, it, vi } from "vitest";

import { OpenRouterCallAnalysisProvider } from "../src/server/openrouter-call-analysis";

function createJsonResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => JSON.stringify(payload)
  } as Response;
}

describe("OpenRouterCallAnalysisProvider", () => {
  it("sends a whole mp3 call recording as base64 audio with a strict JSON schema", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                transcriptByRoles: [
                  {
                    role: "manager",
                    start: 0,
                    end: 2.5,
                    text: "Здравствуйте, это Ольга."
                  }
                ],
                fullTranscriptText: "Здравствуйте, это Ольга.",
                aiEvaluation: {
                  score: 78,
                  callClassification: {
                    type: "primary_sales",
                    confidence: 0.8,
                    reason: "Менеджер начинает первичный разговор."
                  },
                  rubricApplicability: {
                    level: "high",
                    reason: "Первичный продающий звонок."
                  },
                  communicationScore: {
                    score: 74,
                    rationale: "Есть понятный вход, но следующий шаг слабый.",
                    evidenceQuotes: ["Здравствуйте, это Ольга."]
                  },
                  narrativeScore: {
                    score: 62,
                    rationale: "Нарративы клуба почти не раскрыты.",
                    evidenceQuotes: [],
                    applicableNarratives: ["primary_sales"],
                    missedNarratives: ["club_as_social_infrastructure"]
                  },
                  callTypeInterpretation: "Первичный звонок",
                  summary: "Менеджер обозначила повод звонка.",
                  strengths: ["Есть понятный вход в разговор."],
                  risks: ["Не зафиксирован следующий шаг."],
                  nextStepQuality: "weak",
                  suggestedNextStep: "Назначить следующий контакт.",
                  emotionalBackground: {
                    managerTone: "calm",
                    clientTone: "neutral",
                    frictionSignals: [],
                    confidence: 0.62
                  },
                  evidenceQuotes: ["Здравствуйте"],
                  confidence: 0.74,
                  providerOnlyDebug: {
                    finishReason: "stop"
                  }
                }
              })
            }
          }
        ],
        usage: {
          total_tokens: 1234
        }
      })
    );

    const provider = new OpenRouterCallAnalysisProvider({
      apiKey: "openrouter-key",
      model: "google/gemini-2.5-flash",
      promptVersion: "calls-v2",
      fetch: fetchMock,
      now: () => new Date("2026-06-09T12:00:00.000Z")
    });

    const result = await provider.analyzeCall({
      callId: "221736",
      audio: Buffer.from("mp3-bytes"),
      audioFormat: "mp3"
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
      model: "google/gemini-2.5-flash",
      stream: false,
      temperature: 0.1,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "call_analysis",
          strict: true
        }
      }
    });
    expect(body.response_format.json_schema.schema.required).toEqual([
      "transcriptByRoles",
      "fullTranscriptText",
      "aiEvaluation"
    ]);
    expect(body.response_format.json_schema.schema.properties.aiEvaluation.required).toEqual(
      expect.arrayContaining([
        "score",
        "callClassification",
        "rubricApplicability",
        "communicationScore",
        "narrativeScore"
      ])
    );
    const promptText = body.messages[0].content[0].text;
    expect(promptText).toContain("promptVersion: calls-v2");
    expect(promptText).toContain("communicationScore");
    expect(promptText).toContain("narrativeScore");
    expect(promptText).toContain("Club First не продается как календарь мероприятий");
    expect(promptText).toContain("CRM-атрибуты не генерируй");
    expect(promptText).not.toContain("attributes");
    expect(promptText).not.toContain("deal");
    expect(promptText).not.toContain("source");
    expect(promptText).not.toContain("stage");
    expect(promptText).not.toContain("145258");
    expect(promptText).not.toContain("Ромашова");
    expect(body.messages[0].content[1]).toEqual({
      type: "input_audio",
      input_audio: {
        data: Buffer.from("mp3-bytes").toString("base64"),
        format: "mp3"
      }
    });

    expect(result).toMatchObject({
      callId: "221736",
      model: "google/gemini-2.5-flash",
      promptVersion: "calls-v2",
      analyzedAt: "2026-06-09T12:00:00.000Z",
      usage: {
        totalTokens: 1234
      },
      analysis: {
        fullTranscriptText: "Здравствуйте, это Ольга.",
        aiEvaluation: {
          score: 78,
          nextStepQuality: "weak",
          communicationScore: {
            score: 74
          },
          narrativeScore: {
            score: 62
          }
        }
      },
      rawAnalysis: {
        aiEvaluation: {
          providerOnlyDebug: {
            finishReason: "stop"
          }
        }
      }
    });
  });

  it("includes safe OpenRouter error body details when the provider rejects the request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      statusText: "Payment Required",
      text: async () =>
        JSON.stringify({
          error: {
            message: "Insufficient credits. Please top up your OpenRouter balance."
          }
        })
    } as Response);

    const provider = new OpenRouterCallAnalysisProvider({
      apiKey: "openrouter-key",
      fetch: fetchMock
    });

    await expect(
      provider.analyzeCall({
        callId: "221736",
        audio: Buffer.from("mp3-bytes"),
        audioFormat: "mp3"
      })
    ).rejects.toThrow(
      /OpenRouter call analysis failed: 402 Payment Required.+Insufficient credits/
    );
  });

  it("accepts a JSON object wrapped in provider prose", async () => {
    const analysis = {
      transcriptByRoles: [
        {
          role: "manager",
          start: 0,
          end: 2,
          text: "Здравствуйте."
        }
      ],
      fullTranscriptText: "Здравствуйте.",
      aiEvaluation: {
        score: 70,
        callClassification: {
          type: "unknown",
          confidence: 0.4,
          reason: "Слишком короткий тестовый звонок."
        },
        rubricApplicability: {
          level: "none",
          reason: "Недостаточно данных для rubric."
        },
        communicationScore: {
          score: 50,
          rationale: "Только приветствие.",
          evidenceQuotes: ["Здравствуйте."]
        },
        narrativeScore: {
          score: 0,
          rationale: "Нарративы не применимы.",
          evidenceQuotes: [],
          applicableNarratives: [],
          missedNarratives: []
        },
        callTypeInterpretation: "Короткий тестовый звонок",
        summary: "Менеджер начал разговор.",
        strengths: [],
        risks: [],
        nextStepQuality: "unknown",
        suggestedNextStep: "",
        emotionalBackground: {
          managerTone: "neutral",
          clientTone: "unknown",
          frictionSignals: [],
          confidence: 0.3
        },
        evidenceQuotes: [],
        confidence: 0.5
      }
    };
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        choices: [
          {
            message: {
              content: `Конечно, вот структурированный JSON:\n${JSON.stringify(
                analysis
              )}\nГотово.`
            }
          }
        ]
      })
    );

    const provider = new OpenRouterCallAnalysisProvider({
      apiKey: "openrouter-key",
      fetch: fetchMock
    });

    await expect(
      provider.analyzeCall({
        callId: "221636",
        audio: Buffer.from("mp3-bytes"),
        audioFormat: "mp3"
      })
    ).resolves.toMatchObject({
      analysis: {
        fullTranscriptText: "Здравствуйте.",
        aiEvaluation: {
          score: 70
        }
      }
    });
  });
});
