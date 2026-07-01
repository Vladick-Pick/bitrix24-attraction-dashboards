import { timingSafeEqual } from "node:crypto";

import type {
  CallAnalysisQueueCallType,
  CallAnalysisQueueResponse,
  CallAnalysisQueueStatus,
  UnitEconomicsEventParticipantMode
} from "@bitrix24-reporting/contracts";
import type express from "express";
import { z } from "zod";

import { CallAnalysisServiceError } from "../call-analysis-service.js";
import type {
  QueueAutomaticCallAnalysisInput,
  QueueAutomaticCallAnalysisResult
} from "../call-enrichment-orchestrator.js";
import { safeErrorMessage } from "../safe-error-message.js";
import type { AttractionCallRouteHandlers } from "./attraction-routes.js";

export interface CallAnalysisQueueRequest {
  periodDays?: number;
  range?: {
    from: string;
    to: string;
  };
  compareRanges?: Array<{
    from: string;
    to: string;
  }>;
  filters?: {
    managerIds?: string[];
    sourceKeys?: string[];
  };
  eventParticipantMode?: UnitEconomicsEventParticipantMode;
  stageIds?: string[];
  callTypes?: CallAnalysisQueueCallType[];
  analysisStatuses?: CallAnalysisQueueStatus[];
}

export interface AttractionCallRouteService {
  getCallAnalysisQueue(
    input: CallAnalysisQueueRequest
  ): Promise<CallAnalysisQueueResponse>;
  getCallAnalysisResult?(callId: string): Promise<unknown | null>;
}

export interface CallAnalysisRunner {
  analyzeCall(input: {
    callId: string;
    triggerMode?: "manual" | "automatic";
  }): Promise<unknown>;
  queueAutomaticCallAnalysis?(
    input: QueueAutomaticCallAnalysisInput
  ): Promise<QueueAutomaticCallAnalysisResult>;
  getCallAnalysisResult?(callId: string): Promise<unknown>;
}

export interface CreateAttractionCallRouteHandlersInput {
  service: AttractionCallRouteService;
  callAnalysis?: CallAnalysisRunner;
  parseCallAnalysisQueueRequest(query: unknown): CallAnalysisQueueRequest;
  scopeCallAnalysisQueueRequest?(
    request: express.Request,
    response: express.Response,
    input: CallAnalysisQueueRequest
  ): Promise<CallAnalysisQueueRequest>;
  denyIfMissingCallAnalysisAccess?(
    request: express.Request,
    response: express.Response,
    callId: string
  ): Promise<boolean>;
  denyIfMissingAttractionAccess(response: express.Response): boolean;
  callEnrichmentIntake?: {
    enabled?: boolean;
    secret?: string;
  };
}

const callAnalysisCallIdSchema = z.string().trim().min(1).max(200);
const optionalCallEventStringSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .nullable()
  .optional();
const callEventPayloadSchema = z
  .object({
    callId: z.string().trim().min(1).max(200),
    activityId: optionalCallEventStringSchema,
    dealId: optionalCallEventStringSchema,
    contactId: optionalCallEventStringSchema,
    managerId: optionalCallEventStringSchema,
    durationSeconds: z.coerce
      .number()
      .int()
      .nonnegative()
      .max(24 * 60 * 60)
      .nullable()
      .optional(),
    occurredAt: z
      .string()
      .trim()
      .datetime({ offset: true })
      .max(80)
      .nullable()
      .optional()
  })
  .strict();
const bitrixCallEventNameSchema = z.string().trim().min(1).max(80);
const bitrixCallEventCallIdSchema = z.preprocess(
  normalizeBitrixStringValue,
  z.string().min(1).max(200)
);
const optionalBitrixCallEventStringSchema = z.preprocess(
  normalizeBitrixStringValue,
  z.string().min(1).max(200).optional()
);
const optionalBitrixCallEventDurationSchema = z.preprocess(
  normalizeBitrixOptionalValue,
  z.coerce
    .number()
    .int()
    .nonnegative()
    .max(24 * 60 * 60)
    .optional()
);
const optionalBitrixCallEventDateTimeSchema = z.preprocess(
  normalizeBitrixStringValue,
  z.string().datetime({ offset: true }).max(80).optional()
);
const bitrixCallEventPayloadSchema = z
  .object({
    event: bitrixCallEventNameSchema,
    data: z
      .object({
        CALL_ID: bitrixCallEventCallIdSchema,
        CRM_ACTIVITY_ID: optionalBitrixCallEventStringSchema,
        PORTAL_USER_ID: optionalBitrixCallEventStringSchema,
        USER_ID: optionalBitrixCallEventStringSchema,
        CALL_DURATION: optionalBitrixCallEventDurationSchema,
        CALL_START_DATE: optionalBitrixCallEventDateTimeSchema
      })
      .passthrough()
  })
  .passthrough();

type NormalizedCallEventPayload =
  | {
      action: "queue";
      callEvent: QueueAutomaticCallAnalysisInput;
    }
  | {
      action: "skip";
      callId: string;
      reason: "UNSUPPORTED_BITRIX_CALL_EVENT";
    };

function createErrorResponse(code: string, details?: unknown) {
  return {
    error: code,
    code,
    ...(details === undefined ? {} : { details })
  };
}

function requestRouteParam(request: express.Request, name: string) {
  const value = request.params[name];
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function requestModuleId(request: express.Request) {
  return requestRouteParam(request, "moduleId").trim() || "attraction";
}

function isSameSecret(left: string | undefined, right: string) {
  if (!left) {
    return false;
  }

  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function payloadApplicationToken(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("auth" in payload)) {
    return undefined;
  }
  const auth = (payload as { auth?: unknown }).auth;
  if (!auth || typeof auth !== "object" || !("application_token" in auth)) {
    return undefined;
  }
  const token = (auth as { application_token?: unknown }).application_token;
  if (typeof token !== "string") {
    return undefined;
  }
  return token.trim() || undefined;
}

function hasMatchingCallEventSecret(
  request: express.Request,
  configuredSecret: string
) {
  const headerSecret = request.header("X-Bitrix-Call-Event-Secret")?.trim();
  return [headerSecret, payloadApplicationToken(request.body)].some((secret) =>
    isSameSecret(secret, configuredSecret)
  );
}

function normalizeBitrixStringValue(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeBitrixOptionalValue(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "string" && value.trim().length === 0) {
    return undefined;
  }
  return value;
}

function isBitrixCallWebhookPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("event" in payload)) {
    return false;
  }
  const event = (payload as { event?: unknown }).event;
  return (
    typeof event === "string" &&
    event.trim().toUpperCase().startsWith("ONVOXIMPLANTCALL")
  );
}

function normalizeCallEventPayload(payload: unknown): NormalizedCallEventPayload {
  if (isBitrixCallWebhookPayload(payload)) {
    const parsed = bitrixCallEventPayloadSchema.parse(payload);
    const event = parsed.event.toUpperCase();
    if (event !== "ONVOXIMPLANTCALLEND") {
      return {
        action: "skip",
        callId: parsed.data.CALL_ID,
        reason: "UNSUPPORTED_BITRIX_CALL_EVENT"
      };
    }

    return {
      action: "queue",
      callEvent: {
        callId: parsed.data.CALL_ID,
        activityId: parsed.data.CRM_ACTIVITY_ID ?? null,
        dealId: null,
        contactId: null,
        managerId: parsed.data.PORTAL_USER_ID ?? parsed.data.USER_ID ?? null,
        durationSeconds: parsed.data.CALL_DURATION ?? null,
        occurredAt: parsed.data.CALL_START_DATE ?? null
      }
    };
  }

  const parsed = callEventPayloadSchema.parse(payload);
  return {
    action: "queue",
    callEvent: {
      callId: parsed.callId,
      activityId: parsed.activityId ?? null,
      dealId: parsed.dealId ?? null,
      contactId: parsed.contactId ?? null,
      managerId: parsed.managerId ?? null,
      durationSeconds: parsed.durationSeconds ?? null,
      occurredAt: parsed.occurredAt ?? null
    }
  };
}

export function createAttractionCallRouteHandlers({
  service,
  callAnalysis,
  parseCallAnalysisQueueRequest,
  scopeCallAnalysisQueueRequest,
  denyIfMissingCallAnalysisAccess,
  denyIfMissingAttractionAccess,
  callEnrichmentIntake
}: CreateAttractionCallRouteHandlersInput): AttractionCallRouteHandlers {
  return {
    receiveCallEvent: async (request, response, next) => {
      const moduleId = requestModuleId(request);
      if (moduleId !== "attraction") {
        next("route");
        return;
      }

      if (!callEnrichmentIntake?.enabled) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }

      const configuredSecret = callEnrichmentIntake.secret?.trim();
      if (!configuredSecret) {
        response
          .status(503)
          .json(createErrorResponse("CALL_ENRICHMENT_NOT_CONFIGURED"));
        return;
      }

      if (!hasMatchingCallEventSecret(request, configuredSecret)) {
        response.status(401).json(createErrorResponse("UNAUTHORIZED"));
        return;
      }

      if (!callAnalysis?.queueAutomaticCallAnalysis) {
        response
          .status(503)
          .json(createErrorResponse("CALL_ENRICHMENT_NOT_CONFIGURED"));
        return;
      }
      const queueAutomaticCallAnalysis = callAnalysis.queueAutomaticCallAnalysis;

      try {
        const normalizedCallEvent = normalizeCallEventPayload(request.body);
        if (normalizedCallEvent.action === "skip") {
          response.status(202).json({
            status: "skipped",
            callId: normalizedCallEvent.callId,
            reason: normalizedCallEvent.reason
          });
          return;
        }

        const callEvent = normalizedCallEvent.callEvent;
        void Promise.resolve()
          .then(() => queueAutomaticCallAnalysis(callEvent))
          .catch((error: unknown) => {
            console.error("call_enrichment.intake.failed", {
              callId: callEvent.callId,
              error: safeErrorMessage(error)
            });
          });
        response.status(202).json({
          status: "queued",
          callId: callEvent.callId
        });
      } catch (error) {
        next(error);
      }
    },
    listCallAnalysisQueue: async (request, response, next) => {
      const moduleId = requestModuleId(request);
      if (moduleId !== "attraction") {
        next("route");
        return;
      }

      if (denyIfMissingAttractionAccess(response)) {
        return;
      }

      try {
        const input = parseCallAnalysisQueueRequest(request.query);
        response.json(
          await service.getCallAnalysisQueue(
            scopeCallAnalysisQueueRequest
              ? await scopeCallAnalysisQueueRequest(request, response, input)
              : input
          )
        );
      } catch (error) {
        next(error);
      }
    },
    analyzeCall: async (request, response, next) => {
      const moduleId = requestModuleId(request);
      if (moduleId !== "attraction") {
        next("route");
        return;
      }

      if (denyIfMissingAttractionAccess(response)) {
        return;
      }

      if (!callAnalysis) {
        response.status(503).json(createErrorResponse("CALL_ANALYSIS_NOT_CONFIGURED"));
        return;
      }

      try {
        const callId = callAnalysisCallIdSchema.parse(
          requestRouteParam(request, "callId")
        );
        if (
          denyIfMissingCallAnalysisAccess &&
          (await denyIfMissingCallAnalysisAccess(request, response, callId))
        ) {
          return;
        }
        response.json(
          await callAnalysis.analyzeCall({
            callId,
            triggerMode: "manual"
          })
        );
      } catch (error) {
        if (error instanceof CallAnalysisServiceError) {
          response
            .status(error.statusCode)
            .json(createErrorResponse(error.code));
          return;
        }

        next(error);
      }
    },
    getCallAnalysis: async (request, response, next) => {
      const moduleId = requestModuleId(request);
      if (moduleId !== "attraction") {
        next("route");
        return;
      }

      if (denyIfMissingAttractionAccess(response)) {
        return;
      }

      const getCallAnalysisResult =
        callAnalysis?.getCallAnalysisResult ?? service.getCallAnalysisResult;

      if (!getCallAnalysisResult) {
        response.status(503).json(createErrorResponse("CALL_ANALYSIS_NOT_CONFIGURED"));
        return;
      }

      try {
        const callId = callAnalysisCallIdSchema.parse(
          requestRouteParam(request, "callId")
        );
        if (
          denyIfMissingCallAnalysisAccess &&
          (await denyIfMissingCallAnalysisAccess(request, response, callId))
        ) {
          return;
        }
        const result = await getCallAnalysisResult(callId);
        if (!result) {
          response.status(404).json(createErrorResponse("CALL_ANALYSIS_NOT_FOUND"));
          return;
        }

        response.json({
          status: "ready",
          result
        });
      } catch (error) {
        next(error);
      }
    }
  };
}
