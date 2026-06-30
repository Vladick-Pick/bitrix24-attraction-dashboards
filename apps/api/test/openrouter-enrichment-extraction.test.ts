import { describe, expect, it, vi } from "vitest";

import {
  CALL_ENRICHMENT_ALL_FIELD_CODES,
  CALL_ENRICHMENT_CONTACT_FIELD_CODES,
  CALL_ENRICHMENT_DEAL_FIELD_CODES
} from "../src/server/call-enrichment-fields";
import {
  CALL_ENRICHMENT_EXTRACTION_CONTACT_FIELD_CODE_ENUM,
  CALL_ENRICHMENT_EXTRACTION_DEAL_FIELD_CODE_ENUM,
  CALL_ENRICHMENT_EXTRACTION_FIELD_CODE_ENUM,
  CALL_ENRICHMENT_EXTRACTION_RESPONSE_JSON_SCHEMA,
  OpenRouterEnrichmentExtractionProvider
} from "../src/server/openrouter-enrichment-extraction";

function createJsonResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => JSON.stringify(payload)
  } as Response;
}

function createOpenRouterPayload(content: unknown) {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify(content)
        }
      }
    ],
    usage: {
      total_tokens: 321
    }
  };
}

function createInput() {
  return {
    callId: "CALL1",
    fullTranscriptText:
      "Клиент: Оборот бизнеса 500-1000 млн рублей. Запускаем проект Nova.",
    transcriptByRoles: [
      {
        role: "client",
        start: 1,
        end: 8,
        text: "Оборот бизнеса 500-1000 млн рублей."
      }
    ],
    analysisSummary: "Клиент рассказал о бизнесе и проектах.",
    dealId: "23841",
    contactId: "901"
  };
}

describe("OpenRouterEnrichmentExtractionProvider", () => {
  it("sends transcript text with a strict schema constrained to approved field codes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse(
        createOpenRouterPayload({
          candidates: []
        })
      )
    );
    const provider = new OpenRouterEnrichmentExtractionProvider({
      apiKey: "openrouter-key",
      model: "google/gemini-2.5-flash",
      promptVersion: "enrichment-extraction-v1",
      fetch: fetchMock,
      now: () => new Date("2026-06-09T12:00:00.000Z")
    });

    const result = await provider.extractCallEnrichment(createInput());

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
      temperature: 0,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "call_enrichment_extraction",
          strict: true
        }
      }
    });
    expect(body.response_format.json_schema.schema).toStrictEqual(
      CALL_ENRICHMENT_EXTRACTION_RESPONSE_JSON_SCHEMA
    );
    expect(
      body.response_format.json_schema.schema.properties.candidates.items.properties
        .fieldCode.enum
    ).toEqual(CALL_ENRICHMENT_ALL_FIELD_CODES);
    expect(CALL_ENRICHMENT_EXTRACTION_FIELD_CODE_ENUM).toEqual(
      CALL_ENRICHMENT_ALL_FIELD_CODES
    );
    expect(CALL_ENRICHMENT_EXTRACTION_CONTACT_FIELD_CODE_ENUM).toEqual(
      CALL_ENRICHMENT_CONTACT_FIELD_CODES
    );
    expect(CALL_ENRICHMENT_EXTRACTION_DEAL_FIELD_CODE_ENUM).toEqual(
      CALL_ENRICHMENT_DEAL_FIELD_CODES
    );
    expect(CALL_ENRICHMENT_CONTACT_FIELD_CODES).not.toContain(
      "UF_CRM_1766147164481"
    );
    expect(CALL_ENRICHMENT_DEAL_FIELD_CODES).toEqual([
      "UF_CRM_1766147164481",
      "UF_CRM_1766147207634"
    ]);

    const promptText = body.messages[0].content[0].text;
    expect(promptText).toContain("Верни только JSON по schema");
    expect(promptText).toContain("Не придумывай факты");
    expect(promptText).toContain("UF_CRM_1766147164481 = Ключевые проекты");
    expect(promptText).toContain(
      "UF_CRM_1766147207634 = Связи и знакомства внутри клуба"
    );
    expect(promptText).toContain("Все остальные approved fields являются contact fields");
    expect(promptText).toContain("Оборот бизнеса");
    expect(promptText).toContain("fullTranscriptText:");
    expect(promptText).toContain(createInput().fullTranscriptText);
    expect(result).toMatchObject({
      callId: "CALL1",
      model: "google/gemini-2.5-flash",
      promptVersion: "enrichment-extraction-v1",
      analyzedAt: "2026-06-09T12:00:00.000Z",
      candidates: [],
      usage: {
        totalTokens: 321
      }
    });
  });

  it("returns normalized contact candidates for business revenue and numeric fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse(
        createOpenRouterPayload({
          candidates: [
            {
              entity: "contact",
              fieldCode: "UF_CRM_1647946359",
              fieldTitle: "model title is ignored",
              proposedValue: "500-1000 млн рублей",
              rawMention: "оборот 500-1000 млн рублей",
              evidenceSnippet: "Оборот бизнеса 500-1000 млн рублей.",
              confidence: 0.91,
              explicitness: "explicit",
              overwriteRisk: "low"
            },
            {
              entity: "contact",
              fieldCode: "UF_CRM_1766136147",
              fieldTitle: "Возраст",
              proposedValue: "42 года",
              rawMention: "мне 42 года",
              evidenceSnippet: "Мне 42 года.",
              confidence: 0.8,
              explicitness: "explicit",
              overwriteRisk: "medium"
            },
            {
              entity: "contact",
              fieldCode: "UF_CRM_1766145168923",
              fieldTitle: "Опыт",
              proposedValue: "12,5 лет",
              rawMention: "12,5 лет опыта",
              evidenceSnippet: "У меня 12,5 лет опыта.",
              confidence: 0.76,
              explicitness: "explicit",
              overwriteRisk: "low"
            }
          ]
        })
      )
    );
    const provider = new OpenRouterEnrichmentExtractionProvider({
      apiKey: "openrouter-key",
      fetch: fetchMock
    });

    await expect(provider.extractCallEnrichment(createInput())).resolves.toMatchObject({
      candidates: [
        {
          entity: "contact",
          fieldCode: "UF_CRM_1647946359",
          fieldTitle: "Оборот бизнеса",
          proposedValue: "602",
          evidenceSnippet: "Оборот бизнеса 500-1000 млн рублей."
        },
        {
          entity: "contact",
          fieldCode: "UF_CRM_1766136147",
          proposedValue: 42
        },
        {
          entity: "contact",
          fieldCode: "UF_CRM_1766145168923",
          proposedValue: 12.5
        }
      ]
    });
  });

  it("returns normalized deal candidates and ignores model-provided entity/title", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse(
        createOpenRouterPayload({
          candidates: [
            {
              entity: "contact",
              fieldCode: "UF_CRM_1766147164481",
              fieldTitle: "wrong title",
              proposedValue: "Запуск проекта Nova",
              rawMention: "запускаем проект Nova",
              evidenceSnippet: "Запускаем проект Nova.",
              confidence: 0.88,
              explicitness: "explicit",
              overwriteRisk: "low"
            }
          ]
        })
      )
    );
    const provider = new OpenRouterEnrichmentExtractionProvider({
      apiKey: "openrouter-key",
      fetch: fetchMock
    });

    await expect(provider.extractCallEnrichment(createInput())).resolves.toMatchObject({
      candidates: [
        {
          entity: "deal",
          fieldCode: "UF_CRM_1766147164481",
          fieldTitle: "Ключевые проекты",
          proposedValue: "Запуск проекта Nova",
          rawMention: "запускаем проект Nova"
        }
      ]
    });
  });

  it("normalizes urls and unresolved reference fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse(
        createOpenRouterPayload({
          candidates: [
            {
              entity: "contact",
              fieldCode: "UF_CRM_1766147011846",
              fieldTitle: "Ссылки на упоминания",
              proposedValue: "https://example.com/profile",
              rawMention: "вот публикация https://example.com/profile",
              evidenceSnippet: "Публикация: https://example.com/profile",
              confidence: 0.86,
              explicitness: "explicit",
              overwriteRisk: "low"
            },
            {
              entity: "contact",
              fieldCode: "UF_CRM_1649418456",
              fieldTitle: "Город",
              proposedValue: " Москва ",
              rawMention: "живу в Москве",
              evidenceSnippet: "Я живу в Москве.",
              confidence: 0.72,
              explicitness: "explicit",
              overwriteRisk: "low"
            }
          ]
        })
      )
    );
    const provider = new OpenRouterEnrichmentExtractionProvider({
      apiKey: "openrouter-key",
      fetch: fetchMock
    });

    await expect(provider.extractCallEnrichment(createInput())).resolves.toMatchObject({
      candidates: [
        {
          fieldCode: "UF_CRM_1766147011846",
          proposedValue: "https://example.com/profile"
        },
        {
          fieldCode: "UF_CRM_1649418456",
          proposedValue: {
            kind: "unresolved_reference",
            label: "Москва"
          }
        }
      ]
    });
  });

  it("rejects unknown field codes from the model", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse(
        createOpenRouterPayload({
          candidates: [
            {
              entity: "contact",
              fieldCode: "UF_CRM_UNKNOWN",
              fieldTitle: "Unknown",
              proposedValue: "x",
              rawMention: "x",
              evidenceSnippet: "x",
              confidence: 0.9,
              explicitness: "explicit",
              overwriteRisk: "low"
            }
          ]
        })
      )
    );
    const provider = new OpenRouterEnrichmentExtractionProvider({
      apiKey: "openrouter-key",
      fetch: fetchMock
    });

    await expect(provider.extractCallEnrichment(createInput())).rejects.toThrow(
      /Forbidden call enrichment field: UF_CRM_UNKNOWN/
    );
  });

  it("filters low-confidence, empty and invalid candidates", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse(
        createOpenRouterPayload({
          candidates: [
            {
              entity: "contact",
              fieldCode: "UF_CRM_1643721389",
              fieldTitle: "Специфика",
              proposedValue: "производство",
              rawMention: "производство",
              evidenceSnippet: "занимаемся производством",
              confidence: 0.4,
              explicitness: "inferred",
              overwriteRisk: "high"
            },
            {
              entity: "contact",
              fieldCode: "UF_CRM_1643816950",
              fieldTitle: "Цели",
              proposedValue: "   ",
              rawMention: "цели",
              evidenceSnippet: "цели",
              confidence: 0.9,
              explicitness: "explicit",
              overwriteRisk: "low"
            },
            {
              entity: "contact",
              fieldCode: "UF_CRM_1766147011846",
              fieldTitle: "Ссылка",
              proposedValue: "not a url",
              rawMention: "not a url",
              evidenceSnippet: "not a url",
              confidence: 0.9,
              explicitness: "explicit",
              overwriteRisk: "low"
            }
          ]
        })
      )
    );
    const provider = new OpenRouterEnrichmentExtractionProvider({
      apiKey: "openrouter-key",
      fetch: fetchMock
    });

    await expect(provider.extractCallEnrichment(createInput())).resolves.toMatchObject({
      candidates: []
    });
  });

  it("includes safe OpenRouter error body details when extraction fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      statusText: "Payment Required",
      text: async () =>
        JSON.stringify({
          error: {
            message: "Insufficient credits."
          }
        })
    } as Response);
    const provider = new OpenRouterEnrichmentExtractionProvider({
      apiKey: "openrouter-key",
      fetch: fetchMock
    });

    await expect(provider.extractCallEnrichment(createInput())).rejects.toThrow(
      /OpenRouter enrichment extraction failed: 402 Payment Required.+Insufficient credits/
    );
  });

  it("aborts enrichment extraction requests after the configured timeout", async () => {
    const fetchMock = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        text: () =>
          new Promise<string>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new Error("aborted"));
            });
          })
      } as Response);
    });
    const provider = new OpenRouterEnrichmentExtractionProvider({
      apiKey: "openrouter-key",
      fetch: fetchMock,
      timeoutMs: 10
    });

    const result = provider.extractCallEnrichment(createInput());
    const earlyResult = await Promise.race([
      result
        .then(() => "resolved")
        .catch((error: unknown) =>
          error instanceof Error &&
          error.message === "OpenRouter enrichment extraction timed out."
            ? "provider_timeout"
            : "other_error"
        ),
      new Promise<"still_pending">((resolve) =>
        setTimeout(() => resolve("still_pending"), 25)
      )
    ]);
    await result.catch(() => undefined);

    expect(earlyResult).toBe("provider_timeout");
  });
});
