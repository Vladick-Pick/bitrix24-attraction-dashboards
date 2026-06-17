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
  callTypes?: CallAnalysisQueueCallType[];
  analysisStatuses?: CallAnalysisQueueStatus[];
}

export interface AttractionCallRouteService {
  getCallAnalysisQueue(
    input: CallAnalysisQueueRequest
  ): Promise<CallAnalysisQueueResponse>;
}

export interface CallAnalysisRunner {
  analyzeCall(input: {
    callId: string;
    triggerMode?: "manual" | "automatic";
  }): Promise<unknown>;
  getCallAnalysisResult?(callId: string): Promise<unknown>;
}

export interface CreateAttractionCallRouteHandlersInput {
  service: AttractionCallRouteService;
  callAnalysis?: CallAnalysisRunner;
  parseCallAnalysisQueueRequest(query: unknown): CallAnalysisQueueRequest;
  denyIfMissingAttractionAccess(response: express.Response): boolean;
}

const callAnalysisCallIdSchema = z.string().trim().min(1).max(200);

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

export function createAttractionCallRouteHandlers({
  service,
  callAnalysis,
  parseCallAnalysisQueueRequest,
  denyIfMissingAttractionAccess
}: CreateAttractionCallRouteHandlersInput): AttractionCallRouteHandlers {
  return {
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
        response.json(
          await service.getCallAnalysisQueue(
            parseCallAnalysisQueueRequest(request.query)
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

      if (!callAnalysis?.getCallAnalysisResult) {
        response.status(503).json(createErrorResponse("CALL_ANALYSIS_NOT_CONFIGURED"));
        return;
      }

      try {
        const callId = callAnalysisCallIdSchema.parse(
          requestRouteParam(request, "callId")
        );
        const result = await callAnalysis.getCallAnalysisResult(callId);
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
