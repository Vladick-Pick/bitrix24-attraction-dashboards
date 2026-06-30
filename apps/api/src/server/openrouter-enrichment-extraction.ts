import { z } from "zod";

import {
  CALL_ENRICHMENT_ALL_FIELD_CODES,
  CALL_ENRICHMENT_CONTACT_FIELD_CODES,
  CALL_ENRICHMENT_DEAL_FIELD_CODES,
  CALL_ENRICHMENT_FIELDS,
  type CallEnrichmentEntityType,
  type CallEnrichmentFieldDescriptor,
  getCallEnrichmentFieldByCode
} from "./call-enrichment-fields.js";

type FetchLike = typeof fetch;

export interface ExtractCallEnrichmentInput {
  callId: string;
  fullTranscriptText: string;
  transcriptByRoles: unknown[];
  analysisSummary?: string | null;
  dealId: string;
  contactId: string;
}

export interface UnresolvedEnrichmentReference {
  kind: "unresolved_reference";
  label: string;
}

export interface CallEnrichmentCandidate {
  entity: CallEnrichmentEntityType;
  fieldCode: string;
  fieldTitle: string;
  proposedValue: unknown;
  rawMention: string;
  evidenceSnippet: string;
  confidence: number;
  explicitness: "explicit" | "inferred";
  overwriteRisk: "low" | "medium" | "high";
}

export interface OpenRouterEnrichmentExtractionResult {
  callId: string;
  model: string;
  promptVersion: string;
  analyzedAt: string;
  candidates: CallEnrichmentCandidate[];
  rawExtraction: Record<string, unknown>;
  usage: {
    totalTokens: number | null;
  };
}

export interface OpenRouterEnrichmentExtractionProviderConfig {
  apiKey: string;
  model?: string;
  promptVersion?: string;
  endpointUrl?: string;
  fetch?: FetchLike;
  now?: () => Date;
  appReferer?: string;
  appTitle?: string;
  minConfidence?: number;
  timeoutMs?: number;
}

const DEFAULT_OPENROUTER_MODEL = "google/gemini-2.5-flash";
const DEFAULT_PROMPT_VERSION = "enrichment-extraction-v1";
const OPENROUTER_CHAT_COMPLETIONS_URL =
  "https://openrouter.ai/api/v1/chat/completions";
const MAX_OPENROUTER_ERROR_DETAIL_LENGTH = 500;
const DEFAULT_MIN_CONFIDENCE = 0.55;
const MAX_EVIDENCE_SNIPPET_LENGTH = 500;
const DEFAULT_OPENROUTER_TIMEOUT_MS = 60_000;

const rawCandidateSchema = z.object({
  entity: z.enum(["contact", "deal"]),
  fieldCode: z.string(),
  fieldTitle: z.string(),
  proposedValue: z.string(),
  rawMention: z.string(),
  evidenceSnippet: z.string(),
  confidence: z.number().min(0).max(1),
  explicitness: z.enum(["explicit", "inferred"]),
  overwriteRisk: z.enum(["low", "medium", "high"])
});

const extractionResponseSchema = z.object({
  candidates: z.array(rawCandidateSchema)
});

type RawEnrichmentCandidate = z.infer<typeof rawCandidateSchema>;

export const CALL_ENRICHMENT_EXTRACTION_FIELD_CODE_ENUM = [
  ...CALL_ENRICHMENT_ALL_FIELD_CODES
] as const;

export const CALL_ENRICHMENT_EXTRACTION_CONTACT_FIELD_CODE_ENUM = [
  ...CALL_ENRICHMENT_CONTACT_FIELD_CODES
] as const;

export const CALL_ENRICHMENT_EXTRACTION_DEAL_FIELD_CODE_ENUM = [
  ...CALL_ENRICHMENT_DEAL_FIELD_CODES
] as const;

export const CALL_ENRICHMENT_EXTRACTION_RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    candidates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          entity: {
            type: "string",
            enum: ["contact", "deal"]
          },
          fieldCode: {
            type: "string",
            enum: CALL_ENRICHMENT_EXTRACTION_FIELD_CODE_ENUM
          },
          fieldTitle: {
            type: "string"
          },
          proposedValue: {
            type: "string"
          },
          rawMention: {
            type: "string"
          },
          evidenceSnippet: {
            type: "string"
          },
          confidence: {
            type: "number",
            minimum: 0,
            maximum: 1
          },
          explicitness: {
            type: "string",
            enum: ["explicit", "inferred"]
          },
          overwriteRisk: {
            type: "string",
            enum: ["low", "medium", "high"]
          }
        },
        required: [
          "entity",
          "fieldCode",
          "fieldTitle",
          "proposedValue",
          "rawMention",
          "evidenceSnippet",
          "confidence",
          "explicitness",
          "overwriteRisk"
        ]
      }
    }
  },
  required: ["candidates"]
} as const;

export class OpenRouterEnrichmentExtractionProvider {
  private readonly model: string;
  private readonly promptVersion: string;
  private readonly endpointUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly now: () => Date;
  private readonly minConfidence: number;
  private readonly timeoutMs: number;

  constructor(private readonly config: OpenRouterEnrichmentExtractionProviderConfig) {
    this.model = config.model ?? DEFAULT_OPENROUTER_MODEL;
    this.promptVersion = config.promptVersion ?? DEFAULT_PROMPT_VERSION;
    this.endpointUrl = config.endpointUrl ?? OPENROUTER_CHAT_COMPLETIONS_URL;
    this.fetchImpl = config.fetch ?? fetch;
    this.now = config.now ?? (() => new Date());
    this.minConfidence = config.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_OPENROUTER_TIMEOUT_MS;
  }

  async extractCallEnrichment(
    input: ExtractCallEnrichmentInput
  ): Promise<OpenRouterEnrichmentExtractionResult> {
    if (!this.config.apiKey.trim()) {
      throw new Error("OpenRouter API key is not configured.");
    }

    const timeoutError = new Error("OpenRouter enrichment extraction timed out.");
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
        `OpenRouter enrichment extraction failed: ${response.status} ${response.statusText}${errorDetail ? ` - ${errorDetail}` : ""}`
      );
    }

    const payload = parseJsonObject(responseText, "OpenRouter response");
    const messageContent = extractMessageContent(payload);
    const rawExtraction = toJsonRecord(
      parseJsonObject(messageContent, "OpenRouter message content")
    );
    const parsedExtraction = extractionResponseSchema.parse(rawExtraction);

    return {
      callId: input.callId,
      model: this.model,
      promptVersion: this.promptVersion,
      analyzedAt: this.now().toISOString(),
      candidates: parsedExtraction.candidates.flatMap((candidate) => {
        const normalized = normalizeCandidate(candidate, this.minConfidence);
        return normalized ? [normalized] : [];
      }),
      rawExtraction,
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

  private buildRequest(input: ExtractCallEnrichmentInput) {
    return {
      model: this.model,
      stream: false,
      temperature: 0,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "call_enrichment_extraction",
          strict: true,
          schema: CALL_ENRICHMENT_EXTRACTION_RESPONSE_JSON_SCHEMA
        }
      },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: buildExtractionPrompt({
                ...input,
                promptVersion: this.promptVersion
              })
            }
          ]
        }
      ]
    };
  }
}

function normalizeCandidate(
  candidate: RawEnrichmentCandidate,
  minConfidence: number
): CallEnrichmentCandidate | null {
  if (candidate.confidence < minConfidence) {
    return null;
  }

  const descriptor = getCallEnrichmentFieldByCode(candidate.fieldCode);
  if (!descriptor) {
    throw new Error(`Forbidden call enrichment field: ${candidate.fieldCode}`);
  }

  const proposedValue = normalizeProposedValue(
    descriptor,
    candidate.proposedValue
  );
  const rawMention = normalizeNonEmptyString(candidate.rawMention);
  const evidenceSnippet = normalizeNonEmptyString(candidate.evidenceSnippet);

  if (proposedValue === null || !rawMention || !evidenceSnippet) {
    return null;
  }

  return {
    entity: descriptor.entityType,
    fieldCode: descriptor.bitrixFieldCode,
    fieldTitle: descriptor.title,
    proposedValue,
    rawMention,
    evidenceSnippet: truncateDiagnosticText(
      evidenceSnippet,
      MAX_EVIDENCE_SNIPPET_LENGTH
    ),
    confidence: candidate.confidence,
    explicitness: candidate.explicitness,
    overwriteRisk: candidate.overwriteRisk
  };
}

function normalizeProposedValue(
  descriptor: CallEnrichmentFieldDescriptor,
  value: string
): unknown | null {
  if (descriptor.valueKind === "integer") {
    return parseNumericCandidate(value, { integer: true });
  }

  if (descriptor.valueKind === "double") {
    return parseNumericCandidate(value, { integer: false });
  }

  if (descriptor.valueKind === "url") {
    return normalizeUrlCandidate(value);
  }

  if (
    descriptor.valueKind === "crm_multiple" ||
    descriptor.valueKind === "iblock_element"
  ) {
    const label = normalizeNonEmptyString(value);
    return label ? ({ kind: "unresolved_reference", label } as const) : null;
  }

  if (descriptor.valueKind === "enum" && descriptor.enumOptions?.length) {
    return normalizeEnumCandidate(descriptor, value);
  }

  return normalizeNonEmptyString(value);
}

function normalizeEnumCandidate(
  descriptor: CallEnrichmentFieldDescriptor,
  value: string
) {
  const rawValue = normalizeNonEmptyString(value);
  if (!rawValue || !descriptor.enumOptions?.length) {
    return null;
  }

  const comparableValue = normalizeComparableLabel(rawValue);
  const option = descriptor.enumOptions.find(
    (item) =>
      item.id === rawValue ||
      normalizeComparableLabel(item.label) === comparableValue
  );

  return option?.id ?? null;
}

function parseNumericCandidate(
  value: string,
  options: { integer: boolean }
) {
  const rawValue = normalizeNonEmptyString(value)?.replace(",", ".") ?? "";
  const match = /-?\d+(?:\.\d+)?/.exec(rawValue);
  if (!match) {
    return null;
  }

  const parsed = Number(match[0]);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  if (options.integer && !Number.isInteger(parsed)) {
    return null;
  }

  return parsed;
}

function normalizeUrlCandidate(value: string) {
  const rawValue = normalizeNonEmptyString(value);
  if (!rawValue) {
    return null;
  }

  try {
    const url = new URL(rawValue);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function normalizeNonEmptyString(value: unknown) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  return normalized ? normalized : null;
}

function normalizeComparableLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[–—−]/g, "-")
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildExtractionPrompt(input: ExtractCallEnrichmentInput & {
  promptVersion: string;
}) {
  return [
    "Извлеки из transcript только кандидаты для CRM-обогащения по заданной JSON schema.",
    "Верни только JSON по schema. Не добавляй поля вне schema.",
    "Не придумывай факты. Если факт не сказан участником или менеджером явно, лучше не возвращай candidate.",
    "explicitness=explicit ставь только когда участник или менеджер прямо произносит факт.",
    "Не выводи чувствительные личные факты из имени, тона, пола голоса, акцента или фоновых догадок.",
    "Если значение только подтверждает уже известный факт, все равно верни candidate: diff-layer решит, уведомлять ли менеджера.",
    "evidenceSnippet должен быть коротким фрагментом, не полным transcript.",
    "Deal fields: UF_CRM_1766147164481 = Ключевые проекты; UF_CRM_1766147207634 = Связи и знакомства внутри клуба.",
    "Все остальные approved fields являются contact fields.",
    "Approved fields:",
    ...CALL_ENRICHMENT_FIELDS.map(formatFieldPromptLine),
    `dealId: ${input.dealId}`,
    `contactId: ${input.contactId}`,
    `analysisSummary: ${input.analysisSummary ?? "none"}`,
    `transcriptByRolesJson: ${JSON.stringify(input.transcriptByRoles)}`,
    "fullTranscriptText:",
    input.fullTranscriptText,
    `promptVersion: ${input.promptVersion}`
  ].join("\n");
}

function formatFieldPromptLine(field: CallEnrichmentFieldDescriptor) {
  const options = field.enumOptions?.length
    ? ` options=${field.enumOptions.map((item) => `${item.id}:${item.label}`).join("|")}`
    : "";
  return `- ${field.entityType} ${field.bitrixFieldCode} ${field.title} kind=${field.valueKind}${options}`;
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
