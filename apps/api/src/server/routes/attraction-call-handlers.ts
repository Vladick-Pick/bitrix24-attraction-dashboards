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

export interface NormalizedCallEventInput {
  callId: string;
  activityId: string | null;
  dealId: string | null;
  contactId: string | null;
  managerId: string | null;
  durationSeconds: number | null;
  occurredAt: string | null;
}

export type AutomaticCallAnalysisQueueResult = {
  status: "queued" | "duplicate" | "skipped";
  callId: string;
  reason?: string;
};

export interface CallAnalysisRunner {
  analyzeCall(input: {
    callId: string;
    triggerMode?: "manual" | "automatic";
  }): Promise<unknown>;
  queueAutomaticCallAnalysis?(
    input: NormalizedCallEventInput
  ): Promise<AutomaticCallAnalysisQueueResult>;
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

function normalizeCallEventPayload(payload: unknown): NormalizedCallEventInput {
  const parsed = callEventPayloadSchema.parse(payload);
  return {
    callId: parsed.callId,
    activityId: parsed.activityId ?? null,
    dealId: parsed.dealId ?? null,
    contactId: parsed.contactId ?? null,
    managerId: parsed.managerId ?? null,
    durationSeconds: parsed.durationSeconds ?? null,
    occurredAt: parsed.occurredAt ?? null
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

      const eventSecret = request.header("X-Bitrix-Call-Event-Secret")?.trim();
      if (!isSameSecret(eventSecret, configuredSecret)) {
        response.status(401).json(createErrorResponse("UNAUTHORIZED"));
        return;
      }

      if (!callAnalysis?.queueAutomaticCallAnalysis) {
        response
          .status(503)
          .json(createErrorResponse("CALL_ENRICHMENT_NOT_CONFIGURED"));
        return;
      }

      try {
        const result = await callAnalysis.queueAutomaticCallAnalysis(
          normalizeCallEventPayload(request.body)
        );
        response.status(result.status === "duplicate" ? 200 : 202).json(result);
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
