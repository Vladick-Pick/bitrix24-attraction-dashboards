import { timingSafeEqual } from "node:crypto";

import type express from "express";
import { z } from "zod";

import type { TelegramEnrichmentApprovalService } from "../telegram-enrichment-approval.js";

export interface RegisterTelegramEnrichmentRoutesInput {
  enabled?: boolean;
  secret?: string;
  approvalService?: TelegramEnrichmentApprovalService;
}

const callbackBodySchema = z
  .object({
    callback_query: z
      .object({
        id: z.string().trim().min(1).max(200),
        data: z.string().trim().min(1).max(64),
        message: z
          .object({
            chat: z
              .object({
                id: z.union([z.string(), z.number()])
              })
              .passthrough()
          })
          .passthrough()
          .optional()
      })
      .passthrough()
  })
  .passthrough();

export function registerTelegramEnrichmentRoutes(
  app: express.Express,
  input: RegisterTelegramEnrichmentRoutesInput
) {
  app.post("/api/telegram/enrichment/callback", async (request, response, next) => {
    if (!input.enabled) {
      response.status(404).json(createErrorResponse("NOT_FOUND"));
      return;
    }

    const configuredSecret = input.secret?.trim();
    if (!configuredSecret || !input.approvalService) {
      response
        .status(503)
        .json(createErrorResponse("TELEGRAM_ENRICHMENT_NOT_CONFIGURED"));
      return;
    }

    const requestSecret = request
      .header("X-Telegram-Enrichment-Secret")
      ?.trim();
    if (!isSameSecret(requestSecret, configuredSecret)) {
      response.status(401).json(createErrorResponse("UNAUTHORIZED"));
      return;
    }

    try {
      const parsed = callbackBodySchema.parse(request.body);
      await input.approvalService.handleCallback({
        callbackQueryId: parsed.callback_query.id,
        data: parsed.callback_query.data,
        chatId:
          parsed.callback_query.message?.chat.id === undefined
            ? null
            : String(parsed.callback_query.message.chat.id)
      });
      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });
}

function createErrorResponse(code: string) {
  return {
    error: code,
    code
  };
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
