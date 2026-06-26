import { z } from "zod";

type FetchLike = typeof fetch;

export type CallAudioFormat = "mp3" | "wav" | "m4a" | "aac" | "ogg" | "flac";

export interface AnalyzeCallInput {
  callId: string;
  audio: Buffer;
  audioFormat: CallAudioFormat;
}

export interface OpenRouterCallAnalysisProviderConfig {
  apiKey: string;
  model?: string;
  promptVersion?: string;
  endpointUrl?: string;
  fetch?: FetchLike;
  now?: () => Date;
  appReferer?: string;
  appTitle?: string;
}

const DEFAULT_OPENROUTER_MODEL = "google/gemini-3.5-flash";
const DEFAULT_PROMPT_VERSION = "calls-v2";
const OPENROUTER_CHAT_COMPLETIONS_URL =
  "https://openrouter.ai/api/v1/chat/completions";
const MAX_OPENROUTER_ERROR_DETAIL_LENGTH = 500;

const emotionalBackgroundSchema = z.object({
  managerTone: z.string(),
  clientTone: z.string(),
  frictionSignals: z.array(z.string()),
  confidence: z.number().min(0).max(1)
});

const scoredCriterionSchema = z.object({
  score: z.number().min(0).max(100),
  rationale: z.string(),
  evidenceQuotes: z.array(z.string())
});

const callAnalysisResponseSchema = z.object({
  transcriptByRoles: z.array(
    z.object({
      role: z.enum(["manager", "client", "unknown"]),
      start: z.number().min(0),
      end: z.number().min(0),
      text: z.string()
    })
  ),
  fullTranscriptText: z.string(),
  aiEvaluation: z.object({
    score: z.number().min(0).max(100),
    callClassification: z.object({
      type: z.enum([
        "primary_sales",
        "qualification",
        "follow_up",
        "scheduling",
        "inbound",
        "failed_or_no_conversation",
        "unknown"
      ]),
      confidence: z.number().min(0).max(1),
      reason: z.string()
    }),
    rubricApplicability: z.object({
      level: z.enum(["high", "medium", "low", "none"]),
      reason: z.string()
    }),
    communicationScore: scoredCriterionSchema,
    narrativeScore: scoredCriterionSchema.extend({
      applicableNarratives: z.array(z.string()),
      missedNarratives: z.array(z.string())
    }),
    callTypeInterpretation: z.string(),
    summary: z.string(),
    strengths: z.array(z.string()),
    risks: z.array(z.string()),
    nextStepQuality: z.enum(["good", "ok", "weak", "missing", "unknown"]),
    suggestedNextStep: z.string(),
    emotionalBackground: emotionalBackgroundSchema,
    evidenceQuotes: z.array(z.string()),
    confidence: z.number().min(0).max(1)
  })
});

export type CallAnalysisResponse = z.infer<typeof callAnalysisResponseSchema>;

export const CALL_ANALYSIS_RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    transcriptByRoles: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          role: {
            type: "string",
            enum: ["manager", "client", "unknown"]
          },
          start: {
            type: "number",
            minimum: 0
          },
          end: {
            type: "number",
            minimum: 0
          },
          text: {
            type: "string"
          }
        },
        required: ["role", "start", "end", "text"]
      }
    },
    fullTranscriptText: {
      type: "string"
    },
    aiEvaluation: {
      type: "object",
      additionalProperties: false,
      properties: {
        score: {
          type: "number",
          minimum: 0,
          maximum: 100
        },
        callClassification: {
          type: "object",
          additionalProperties: false,
          properties: {
            type: {
              type: "string",
              enum: [
                "primary_sales",
                "qualification",
                "follow_up",
                "scheduling",
                "inbound",
                "failed_or_no_conversation",
                "unknown"
              ]
            },
            confidence: {
              type: "number",
              minimum: 0,
              maximum: 1
            },
            reason: {
              type: "string"
            }
          },
          required: ["type", "confidence", "reason"]
        },
        rubricApplicability: {
          type: "object",
          additionalProperties: false,
          properties: {
            level: {
              type: "string",
              enum: ["high", "medium", "low", "none"]
            },
            reason: {
              type: "string"
            }
          },
          required: ["level", "reason"]
        },
        communicationScore: {
          type: "object",
          additionalProperties: false,
          properties: {
            score: {
              type: "number",
              minimum: 0,
              maximum: 100
            },
            rationale: {
              type: "string"
            },
            evidenceQuotes: {
              type: "array",
              items: {
                type: "string"
              }
            }
          },
          required: ["score", "rationale", "evidenceQuotes"]
        },
        narrativeScore: {
          type: "object",
          additionalProperties: false,
          properties: {
            score: {
              type: "number",
              minimum: 0,
              maximum: 100
            },
            rationale: {
              type: "string"
            },
            evidenceQuotes: {
              type: "array",
              items: {
                type: "string"
              }
            },
            applicableNarratives: {
              type: "array",
              items: {
                type: "string"
              }
            },
            missedNarratives: {
              type: "array",
              items: {
                type: "string"
              }
            }
          },
          required: [
            "score",
            "rationale",
            "evidenceQuotes",
            "applicableNarratives",
            "missedNarratives"
          ]
        },
        callTypeInterpretation: {
          type: "string"
        },
        summary: {
          type: "string"
        },
        strengths: {
          type: "array",
          items: {
            type: "string"
          }
        },
        risks: {
          type: "array",
          items: {
            type: "string"
          }
        },
        nextStepQuality: {
          type: "string",
          enum: ["good", "ok", "weak", "missing", "unknown"]
        },
        suggestedNextStep: {
          type: "string"
        },
        emotionalBackground: {
          type: "object",
          additionalProperties: false,
          properties: {
            managerTone: {
              type: "string"
            },
            clientTone: {
              type: "string"
            },
            frictionSignals: {
              type: "array",
              items: {
                type: "string"
              }
            },
            confidence: {
              type: "number",
              minimum: 0,
              maximum: 1
            }
          },
          required: [
            "managerTone",
            "clientTone",
            "frictionSignals",
            "confidence"
          ]
        },
        evidenceQuotes: {
          type: "array",
          items: {
            type: "string"
          }
        },
        confidence: {
          type: "number",
          minimum: 0,
          maximum: 1
        }
      },
      required: [
        "score",
        "callClassification",
        "rubricApplicability",
        "communicationScore",
        "narrativeScore",
        "callTypeInterpretation",
        "summary",
        "strengths",
        "risks",
        "nextStepQuality",
        "suggestedNextStep",
        "emotionalBackground",
        "evidenceQuotes",
        "confidence"
      ]
    }
  },
  required: ["transcriptByRoles", "fullTranscriptText", "aiEvaluation"]
} as const;

export interface OpenRouterCallAnalysisResult {
  callId: string;
  model: string;
  promptVersion: string;
  analyzedAt: string;
  analysis: CallAnalysisResponse;
  rawAnalysis: Record<string, unknown>;
  usage: {
    totalTokens: number | null;
  };
}

export class OpenRouterCallAnalysisProvider {
  private readonly model: string;
  private readonly promptVersion: string;
  private readonly endpointUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly now: () => Date;

  constructor(private readonly config: OpenRouterCallAnalysisProviderConfig) {
    this.model = config.model ?? DEFAULT_OPENROUTER_MODEL;
    this.promptVersion = config.promptVersion ?? DEFAULT_PROMPT_VERSION;
    this.endpointUrl = config.endpointUrl ?? OPENROUTER_CHAT_COMPLETIONS_URL;
    this.fetchImpl = config.fetch ?? fetch;
    this.now = config.now ?? (() => new Date());
  }

  async analyzeCall(input: AnalyzeCallInput): Promise<OpenRouterCallAnalysisResult> {
    if (!this.config.apiKey.trim()) {
      throw new Error("OpenRouter API key is not configured.");
    }

    const response = await this.fetchImpl(this.endpointUrl, {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify(this.buildRequest(input))
    });
    const responseText = await response.text();

    if (!response.ok) {
      const errorDetail = summarizeOpenRouterErrorBody(responseText);
      throw new Error(
        `OpenRouter call analysis failed: ${response.status} ${response.statusText}${errorDetail ? ` - ${errorDetail}` : ""}`
      );
    }

    const payload = parseJsonObject(responseText, "OpenRouter response");
    const messageContent = extractMessageContent(payload);
    const rawAnalysis = toJsonRecord(
      parseJsonObject(messageContent, "OpenRouter message content")
    );
    const parsedAnalysis = callAnalysisResponseSchema.parse(rawAnalysis);

    return {
      callId: input.callId,
      model: this.model,
      promptVersion: this.promptVersion,
      analyzedAt: this.now().toISOString(),
      analysis: parsedAnalysis,
      rawAnalysis,
      usage: {
        totalTokens: extractTotalTokens(payload)
      }
    };
  }

  private buildHeaders() {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.apiKey}`,
      "Content-Type": "application/json"
    };

    if (this.config.appReferer) {
      headers["HTTP-Referer"] = this.config.appReferer;
    }

    if (this.config.appTitle) {
      headers["X-Title"] = this.config.appTitle;
    }

    return headers;
  }

  private buildRequest(input: AnalyzeCallInput) {
    return {
      model: this.model,
      stream: false,
      temperature: 0.1,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "call_analysis",
          strict: true,
          schema: CALL_ANALYSIS_RESPONSE_JSON_SCHEMA
        }
      },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: buildCallAnalysisPrompt({
                promptVersion: this.promptVersion
              })
            },
            {
              type: "input_audio",
              input_audio: {
                data: input.audio.toString("base64"),
                format: input.audioFormat
              }
            }
          ]
        }
      ]
    };
  }
}

function buildCallAnalysisPrompt(input: {
  promptVersion: string;
}) {
  return [
    "Проанализируй аудиозапись звонка менеджера привлечения.",
    "Верни только JSON по заданной schema.",
    "Разметь transcript по ролям manager/client/unknown с таймкодами в секундах.",
    "Сначала классифицируй тип разговора: primary_sales, qualification, follow_up, scheduling, inbound, failed_or_no_conversation или unknown.",
    "Оцени только содержание разговора: качество коммуникации, выявление запроса или боли, следующий шаг, соответствие применимым нарративам Club First и эмоциональный фон.",
    "CRM-атрибуты не генерируй: менеджер, сделка, источник, стадия, тип звонка, duration и timeline рассчитываются приложением отдельно.",
    "Если это follow_up, scheduling или технический входящий звонок, не штрафуй за отсутствие полного первичного sales-script; narrativeScore должен отражать низкую применимость rubric, а общий score должен опираться в основном на communicationScore и качество следующего шага.",
    "Если это primary_sales или qualification, обязательно проверь применимые нарративы Club First:",
    "- Club First не продается как календарь мероприятий; мероприятия являются инструментом доступа к среде.",
    "- Клуб раскрывается как социальная инфраструктура и деловая среда, а не просто нетворкинг.",
    "- Менеджер диагностирует задачу клиента до презентации: социальный капитал, снижение транзакционных издержек, доступ к качественному кругу, среда мышления, возвращение в российский бизнес-контекст.",
    "- Менеджер связывает ценность клуба с ситуацией клиента, а не пересказывает универсальную презентацию.",
    "- Квалификация объясняется уважительно: оборот, активы, управленческий опыт, экспертиза и потенциальная польза для среды.",
    "- Возражения про конфиденциальность, формат, цену, релевантность и 'мероприятия ради мероприятий' обрабатываются без давления.",
    "- Следующий шаг должен быть конкретным: дата, формат контакта, встреча, демо приложения, документы или ответственный follow-up.",
    "Для communicationScore оцени слушание, точность вопросов, адаптацию под клиента, управление разговором, эмпатию, ясность и следующий шаг.",
    "Для narrativeScore засчитывай только то, что подтверждено цитатой или явным фрагментом transcript; если evidence нет, критерий не засчитан.",
    "Эмоциональный фон является вероятностным сигналом, не фактом.",
    `promptVersion: ${input.promptVersion}`
  ].join("\n");
}

function parseJsonObject(value: string, label: string) {
  const normalized = stripJsonFence(value);
  try {
    return JSON.parse(normalized) as unknown;
  } catch (strictError) {
    const candidate = extractJsonObjectCandidate(normalized);
    if (candidate) {
      try {
        return JSON.parse(candidate) as unknown;
      } catch {
        // Keep the original strict parse error because it points at the raw response shape.
      }
    }

    throw new Error(`${label} is not valid JSON`, {
      cause: strictError
    });
  }
}

function summarizeOpenRouterErrorBody(responseText: string) {
  const trimmed = responseText.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const message = extractOpenRouterErrorMessage(parsed);
    if (message) {
      return truncateDiagnosticText(message, MAX_OPENROUTER_ERROR_DETAIL_LENGTH);
    }
  } catch {
    // Fall back to the raw body snippet below.
  }

  return truncateDiagnosticText(trimmed, MAX_OPENROUTER_ERROR_DETAIL_LENGTH);
}

function extractOpenRouterErrorMessage(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const topLevelMessage = (value as { message?: unknown }).message;
  if (typeof topLevelMessage === "string" && topLevelMessage.trim()) {
    return topLevelMessage;
  }

  const error = (value as { error?: unknown }).error;
  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (error && typeof error === "object") {
    const errorMessage = (error as { message?: unknown }).message;
    if (typeof errorMessage === "string" && errorMessage.trim()) {
      return errorMessage;
    }
  }

  return null;
}

function truncateDiagnosticText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}

function stripJsonFence(value: string) {
  const trimmed = value.trim();
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return match?.[1] ?? trimmed;
}

function extractJsonObjectCandidate(value: string) {
  const start = value.indexOf("{");
  if (start === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < value.length; index += 1) {
    const char = value[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = inString;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return value.slice(start, index + 1);
      }
    }
  }

  return null;
}

function extractMessageContent(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    throw new Error("OpenRouter response is not an object.");
  }

  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error("OpenRouter response does not include choices.");
  }

  const firstChoice = choices[0];
  const message =
    firstChoice && typeof firstChoice === "object"
      ? (firstChoice as { message?: unknown }).message
      : null;
  const content =
    message && typeof message === "object"
      ? (message as { content?: unknown }).content
      : null;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (
          part &&
          typeof part === "object" &&
          typeof (part as { text?: unknown }).text === "string"
        ) {
          return (part as { text: string }).text;
        }

        return "";
      })
      .join("");
  }

  throw new Error("OpenRouter response message content is empty.");
}

function extractTotalTokens(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const usage = (payload as { usage?: unknown }).usage;
  if (!usage || typeof usage !== "object") {
    return null;
  }

  const totalTokens = (usage as { total_tokens?: unknown }).total_tokens;
  return typeof totalTokens === "number" ? totalTokens : null;
}

function toJsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}
