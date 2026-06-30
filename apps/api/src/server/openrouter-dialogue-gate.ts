import { z } from "zod";

import type { CallAudioFormat } from "./openrouter-call-analysis.js";

type FetchLike = typeof fetch;

export type DialogueEvidenceType =
  | "human_dialogue"
  | "voicemail"
  | "robot"
  | "silence"
  | "short_failed_call"
  | "operator_no_answer"
  | "other";

export interface DialogueGateInput {
  callId: string;
  audio: Buffer;
  audioFormat: CallAudioFormat;
  metadata?: {
    durationSeconds?: number | null;
    callFailedCode?: string | null;
  };
}

export interface OpenRouterDialogueGateProviderConfig {
  apiKey: string;
  model?: string;
  promptVersion?: string;
  endpointUrl?: string;
  fetch?: FetchLike;
  now?: () => Date;
  appReferer?: string;
  appTitle?: string;
  timeoutMs?: number;
}

const DEFAULT_DIALOGUE_GATE_MODEL = "google/gemini-2.5-flash-lite";
const DEFAULT_PROMPT_VERSION = "dialogue-gate-v1";
const OPENROUTER_CHAT_COMPLETIONS_URL =
  "https://openrouter.ai/api/v1/chat/completions";
const MAX_OPENROUTER_ERROR_DETAIL_LENGTH = 500;
const DEFAULT_OPENROUTER_TIMEOUT_MS = 60_000;

const dialogueGateResponseSchema = z.object({
  hasDialogue: z.boolean(),
  evidenceType: z.enum([
    "human_dialogue",
    "voicemail",
    "robot",
    "silence",
    "short_failed_call",
    "operator_no_answer",
    "other"
  ]),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
  evidenceSnippet: z.string()
});

export type DialogueGateDecision = z.infer<typeof dialogueGateResponseSchema>;

export const DIALOGUE_GATE_RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    hasDialogue: {
      type: "boolean"
    },
    evidenceType: {
      type: "string",
      enum: [
        "human_dialogue",
        "voicemail",
        "robot",
        "silence",
        "short_failed_call",
        "operator_no_answer",
        "other"
      ]
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1
    },
    reason: {
      type: "string"
    },
    evidenceSnippet: {
      type: "string"
    }
  },
  required: [
    "hasDialogue",
    "evidenceType",
    "confidence",
    "reason",
    "evidenceSnippet"
  ]
} as const;

export interface DialogueGateResult {
  callId: string;
  model: string;
  promptVersion: string;
  analyzedAt: string;
  gate: DialogueGateDecision;
  rawGate: Record<string, unknown>;
  usage: {
    totalTokens: number | null;
  };
}

export class OpenRouterDialogueGateProvider {
  private readonly model: string;
  private readonly promptVersion: string;
  private readonly endpointUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly now: () => Date;
  private readonly timeoutMs: number;

  constructor(private readonly config: OpenRouterDialogueGateProviderConfig) {
    this.model = config.model ?? DEFAULT_DIALOGUE_GATE_MODEL;
    this.promptVersion = config.promptVersion ?? DEFAULT_PROMPT_VERSION;
    this.endpointUrl = config.endpointUrl ?? OPENROUTER_CHAT_COMPLETIONS_URL;
    this.fetchImpl = config.fetch ?? fetch;
    this.now = config.now ?? (() => new Date());
    this.timeoutMs = config.timeoutMs ?? DEFAULT_OPENROUTER_TIMEOUT_MS;
  }

  async analyzeDialogue(input: DialogueGateInput): Promise<DialogueGateResult> {
    if (!this.config.apiKey.trim()) {
      throw new Error("OpenRouter API key is not configured.");
    }

    const timeoutError = new Error("OpenRouter dialogue gate timed out.");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(timeoutError), this.timeoutMs);
    let response: Response;
    let responseText: string;
    try {
      response = await this.fetchImpl(this.endpointUrl, {
        method: "POST",
        headers: this.buildHeaders(),
        body: JSON.stringify(this.buildRequest(input)),
        signal: controller.signal
      });
      responseText = await response.text();
    } catch (error) {
      if (controller.signal.aborted) {
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errorDetail = summarizeOpenRouterErrorBody(responseText);
      throw new Error(
        `OpenRouter dialogue gate failed: ${response.status} ${response.statusText}${errorDetail ? ` - ${errorDetail}` : ""}`
      );
    }

    const payload = parseJsonObject(responseText, "OpenRouter response");
    const messageContent = extractMessageContent(payload);
    const rawGate = toJsonRecord(
      parseJsonObject(messageContent, "OpenRouter message content")
    );
    const gate = dialogueGateResponseSchema.parse(rawGate);

    return {
      callId: input.callId,
      model: this.model,
      promptVersion: this.promptVersion,
      analyzedAt: this.now().toISOString(),
      gate,
      rawGate,
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

  private buildRequest(input: DialogueGateInput) {
    return {
      model: this.model,
      stream: false,
      temperature: 0,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "dialogue_gate",
          strict: true,
          schema: DIALOGUE_GATE_RESPONSE_JSON_SCHEMA
        }
      },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: buildDialogueGatePrompt({
                promptVersion: this.promptVersion,
                metadata: input.metadata
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

function buildDialogueGatePrompt(input: {
  promptVersion: string;
  metadata?: DialogueGateInput["metadata"];
}) {
  const metadataLines = [
    `durationSeconds: ${input.metadata?.durationSeconds ?? "unknown"}`,
    `callFailedCode: ${input.metadata?.callFailedCode ?? "none"}`
  ];

  return [
    "Определи только одно: был ли в аудио живой двусторонний разговор менеджера и клиента.",
    "Верни только JSON по заданной schema.",
    "Не оценивай качество продаж, скрипт, next step, нарративы или эмоции.",
    "Не извлекай поля сделки, контакта, участника или компании.",
    "hasDialogue=true ставь только если есть содержательные реплики обеих сторон или явные признаки реального обмена.",
    "hasDialogue=false для voicemail, робота, тишины, короткого неуспешного звонка, одностороннего сообщения оператора и фразы 'не удалось дозвониться', даже если durationSeconds больше 30.",
    "evidenceSnippet должен быть коротким фрагментом, который объясняет решение.",
    ...metadataLines,
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
