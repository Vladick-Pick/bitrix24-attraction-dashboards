import type express from "express";

import type {
  AuthenticatedModule,
  AuthenticatedSession,
  ModulePermission
} from "../auth.js";
import type { PaperclipIssueClient } from "../paperclip-client.js";
import type {
  PlatformCommentRepository,
  ProtoCommentRepository
} from "../repository-roles.js";
import type {
  DashboardCommentContext,
  DashboardCommentRecord,
  ProtoCommentAnchor,
  ProtoCommentRecord
} from "../sqlite-repository.js";
import type { CommentRouteHandlers } from "./comment-routes.js";

interface DashboardPaperclipReadyReport {
  id: string;
  body: string;
  authorAgentId: string | null;
  authorUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

type DashboardPaperclipThreadEntryKind =
  | "development_report"
  | "dashboard_rework"
  | "board_note"
  | "system_note";

interface DashboardPaperclipThreadEntry extends DashboardPaperclipReadyReport {
  kind: DashboardPaperclipThreadEntryKind;
}

export type DashboardCommentView = DashboardCommentRecord & {
  paperclipReadyReport?: DashboardPaperclipReadyReport | null;
  paperclipThread?: DashboardPaperclipThreadEntry[];
};

type ParsedProtoComment = Omit<
  ProtoCommentRecord,
  "status" | "archivedAt" | "anchor"
> & {
  status: "open" | "archived";
  archivedAt?: string | null | undefined;
  anchor?: ProtoCommentAnchor | undefined;
};

interface ProtoCommentsBody {
  comments: ParsedProtoComment[];
}

interface CreateCommentBody {
  sceneId: string;
  x: number;
  y: number;
  text: string;
  anchor?: ProtoCommentAnchor | undefined;
  context?: DashboardCommentContext | undefined;
}

interface UpdateCommentBody {
  text?: string | undefined;
  context?: DashboardCommentContext | undefined;
}

interface ReworkCommentBody {
  text: string;
}

interface ModuleAccess {
  session: AuthenticatedSession;
  module: AuthenticatedModule;
}

export interface CreateCommentRouteHandlersInput {
  comments?: PlatformCommentRepository;
  protoComments?: ProtoCommentRepository;
  paperclip?: PaperclipIssueClient;
  parseProtoCommentsBody(body: unknown): ProtoCommentsBody;
  parseCreateCommentBody(body: unknown): CreateCommentBody;
  parseUpdateCommentBody(body: unknown): UpdateCommentBody;
  parseReworkCommentBody(body: unknown): ReworkCommentBody;
  requireModuleAccess(
    response: express.Response,
    permission?: ModulePermission,
    moduleId?: string
  ): ModuleAccess | null;
  deliverCommentToPaperclip(
    comment: DashboardCommentRecord,
    module: AuthenticatedModule
  ): Promise<DashboardCommentRecord | null | undefined>;
  refreshOpenDashboardComments(
    comments: DashboardCommentRecord[]
  ): Promise<DashboardCommentView[]>;
  addDashboardReworkComment(input: {
    paperclip: PaperclipIssueClient;
    issueId: string;
    body: string;
  }): Promise<void>;
  buildPaperclipReworkComment(input: {
    module: AuthenticatedModule;
    authorLogin: string;
    comment: DashboardCommentRecord;
    text: string;
  }): string;
  createId(): string;
  now(): string;
}

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

export function createCommentRouteHandlers({
  comments,
  protoComments,
  paperclip,
  parseProtoCommentsBody,
  parseCreateCommentBody,
  parseUpdateCommentBody,
  parseReworkCommentBody,
  requireModuleAccess,
  deliverCommentToPaperclip,
  refreshOpenDashboardComments,
  addDashboardReworkComment,
  buildPaperclipReworkComment,
  createId,
  now
}: CreateCommentRouteHandlersInput): CommentRouteHandlers {
  return {
    getProtoComments: async (_request, response, next) => {
      if (!protoComments) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }

      try {
        response.json(await protoComments.getProtoComments());
      } catch (error) {
        next(error);
      }
    },
    replaceProtoComments: async (request, response, next) => {
      if (!protoComments) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }

      try {
        const payload = parseProtoCommentsBody(request.body);
        response.json(
          await protoComments.replaceProtoComments({
            comments: payload.comments.map((comment) => ({
              id: comment.id,
              sceneId: comment.sceneId,
              x: comment.x,
              y: comment.y,
              text: comment.text,
              status: comment.status,
              archivedAt: comment.archivedAt ?? null,
              createdAt: comment.createdAt,
              updatedAt: comment.updatedAt,
              ...(comment.anchor ? { anchor: comment.anchor } : {})
            })),
            updatedAt: now()
          })
        );
      } catch (error) {
        next(error);
      }
    },
    listComments: async (request, response, next) => {
      if (!comments) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }

      const access = requireModuleAccess(response, undefined, requestModuleId(request));
      if (!access) {
        response.status(403).json(createErrorResponse("FORBIDDEN"));
        return;
      }

      try {
        const store = await comments.getDashboardComments(access.module.id);
        response.json({
          ...store,
          comments: await refreshOpenDashboardComments(store.comments)
        });
      } catch (error) {
        next(error);
      }
    },
    createComment: async (request, response, next) => {
      if (!comments) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }

      const access = requireModuleAccess(
        response,
        "comments:create",
        requestModuleId(request)
      );
      if (!access) {
        response.status(403).json(createErrorResponse("FORBIDDEN"));
        return;
      }

      try {
        const payload = parseCreateCommentBody(request.body);
        const timestamp = now();
        const created = await comments.createDashboardComment({
          id: createId(),
          moduleId: access.module.id,
          authorUserId: access.session.user.id,
          authorLogin: access.session.user.login,
          sceneId: payload.sceneId,
          x: payload.x,
          y: payload.y,
          text: payload.text,
          status: "open",
          archivedAt: null,
          createdAt: timestamp,
          updatedAt: timestamp,
          ...(payload.anchor ? { anchor: payload.anchor } : {}),
          ...(payload.context ? { context: payload.context } : {}),
          paperclipIssueId: null,
          paperclipIssueIdentifier: null,
          paperclipStatus: "queued",
          paperclipSyncStatus: "queued",
          paperclipError: null,
          paperclipLastSyncedAt: null,
          paperclipRetryCount: 0
        });
        const delivered = await deliverCommentToPaperclip(created, access.module);
        response.status(201).json({ comment: delivered ?? created });
      } catch (error) {
        next(error);
      }
    },
    updateComment: async (request, response, next) => {
      if (!comments) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }

      const access = requireModuleAccess(
        response,
        "comments:update",
        requestModuleId(request)
      );
      if (!access) {
        response.status(403).json(createErrorResponse("FORBIDDEN"));
        return;
      }

      try {
        const existing = await comments.getDashboardCommentById(
          requestRouteParam(request, "id")
        );
        if (!existing || existing.moduleId !== access.module.id) {
          response.status(404).json(createErrorResponse("NOT_FOUND"));
          return;
        }
        if (
          existing.authorUserId !== access.session.user.id &&
          access.module.role !== "leader"
        ) {
          response.status(403).json(createErrorResponse("FORBIDDEN"));
          return;
        }

        const payload = parseUpdateCommentBody(request.body);
        const comment = await comments.updateDashboardComment({
          id: existing.id,
          ...(payload.text ? { text: payload.text } : {}),
          ...(payload.context ? { context: payload.context } : {}),
          updatedAt: now()
        });
        response.json({ comment });
      } catch (error) {
        next(error);
      }
    },
    archiveComment: async (request, response, next) => {
      if (!comments) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }

      const access = requireModuleAccess(
        response,
        "comments:archive",
        requestModuleId(request)
      );
      if (!access) {
        response.status(403).json(createErrorResponse("FORBIDDEN"));
        return;
      }

      try {
        const existing = await comments.getDashboardCommentById(
          requestRouteParam(request, "id")
        );
        if (!existing || existing.moduleId !== access.module.id) {
          response.status(404).json(createErrorResponse("NOT_FOUND"));
          return;
        }
        const timestamp = now();
        const comment = await comments.archiveDashboardComment({
          id: existing.id,
          archivedAt: timestamp,
          updatedAt: timestamp
        });
        response.json({ comment });
      } catch (error) {
        next(error);
      }
    },
    reworkComment: async (request, response, next) => {
      if (!comments) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }

      const access = requireModuleAccess(
        response,
        "comments:update",
        requestModuleId(request)
      );
      if (!access) {
        response.status(403).json(createErrorResponse("FORBIDDEN"));
        return;
      }

      try {
        const existing = await comments.getDashboardCommentById(
          requestRouteParam(request, "id")
        );
        if (!existing || existing.moduleId !== access.module.id) {
          response.status(404).json(createErrorResponse("NOT_FOUND"));
          return;
        }
        if (
          existing.authorUserId !== access.session.user.id &&
          access.module.role !== "leader"
        ) {
          response.status(403).json(createErrorResponse("FORBIDDEN"));
          return;
        }
        if (!existing.paperclipIssueId) {
          response.status(409).json(createErrorResponse("PAPERCLIP_ISSUE_NOT_LINKED"));
          return;
        }
        if (!paperclip) {
          const failed = await comments.updateDashboardCommentPaperclip({
            id: existing.id,
            paperclipStatus: "failed",
            paperclipSyncStatus: "failed",
            paperclipError: "Paperclip integration is not configured.",
            paperclipLastSyncedAt: now(),
            incrementRetryCount: true
          });
          response.status(503).json({
            ...createErrorResponse("PAPERCLIP_NOT_CONFIGURED"),
            comment: failed ?? existing
          });
          return;
        }

        const payload = parseReworkCommentBody(request.body);
        await comments.updateDashboardCommentPaperclip({
          id: existing.id,
          paperclipStatus: "in_work",
          paperclipSyncStatus: "syncing",
          paperclipError: null
        });

        try {
          await addDashboardReworkComment({
            paperclip,
            issueId: existing.paperclipIssueId,
            body: buildPaperclipReworkComment({
              module: access.module,
              authorLogin: access.session.user.login,
              comment: existing,
              text: payload.text
            })
          });

          const synced = await comments.updateDashboardCommentPaperclip({
            id: existing.id,
            paperclipStatus: "in_work",
            paperclipSyncStatus: "sent",
            paperclipError: null,
            paperclipLastSyncedAt: now()
          });
          response.json({ comment: synced ?? existing });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Paperclip issue comment failed.";
          const failed = await comments.updateDashboardCommentPaperclip({
            id: existing.id,
            paperclipStatus: "failed",
            paperclipSyncStatus: "failed",
            paperclipError: message,
            paperclipLastSyncedAt: now(),
            incrementRetryCount: true
          });
          response.status(502).json({
            ...createErrorResponse("PAPERCLIP_REWORK_FAILED"),
            comment: failed ?? existing
          });
        }
      } catch (error) {
        next(error);
      }
    },
    retryComment: async (request, response, next) => {
      if (!comments) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }

      const access = requireModuleAccess(
        response,
        "comments:create",
        requestModuleId(request)
      );
      if (!access) {
        response.status(403).json(createErrorResponse("FORBIDDEN"));
        return;
      }

      try {
        const existing = await comments.getDashboardCommentById(
          requestRouteParam(request, "id")
        );
        if (!existing || existing.moduleId !== access.module.id) {
          response.status(404).json(createErrorResponse("NOT_FOUND"));
          return;
        }
        if (
          existing.authorUserId !== access.session.user.id &&
          access.module.role !== "leader"
        ) {
          response.status(403).json(createErrorResponse("FORBIDDEN"));
          return;
        }
        if (existing.paperclipIssueId) {
          response.status(409).json({
            ...createErrorResponse("PAPERCLIP_ISSUE_ALREADY_LINKED"),
            comment: existing
          });
          return;
        }
        const delivered = await deliverCommentToPaperclip(existing, access.module);
        response.json({ comment: delivered ?? existing });
      } catch (error) {
        next(error);
      }
    },
    listCommentNotifications: async (request, response, next) => {
      if (!comments) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }

      const access = requireModuleAccess(response, undefined, requestModuleId(request));
      if (!access) {
        response.status(403).json(createErrorResponse("FORBIDDEN"));
        return;
      }

      try {
        const store = await comments.getDashboardComments(access.module.id);
        const refreshedComments = await refreshOpenDashboardComments(store.comments);
        response.json({
          notifications: refreshedComments
            .filter((comment): comment is DashboardCommentView => Boolean(comment))
            .filter((comment) => (comment.status ?? "open") === "open")
            .map((comment) => ({
              id: comment.id,
              sceneId: comment.sceneId,
              text: comment.text,
              status: comment.paperclipStatus,
              paperclipSyncStatus: comment.paperclipSyncStatus,
              paperclipIssueIdentifier: comment.paperclipIssueIdentifier,
              paperclipError: comment.paperclipError,
              paperclipReadyReport: comment.paperclipReadyReport ?? null,
              paperclipThread: comment.paperclipThread ?? [],
              updatedAt: comment.updatedAt
            }))
        });
      } catch (error) {
        next(error);
      }
    }
  };
}
