import type express from "express";

import type { ApiRouteHandler } from "./route-handler.js";

export interface CommentRouteHandlers {
  getProtoComments: ApiRouteHandler;
  replaceProtoComments: ApiRouteHandler;
  listComments: ApiRouteHandler;
  createComment: ApiRouteHandler;
  updateComment: ApiRouteHandler;
  archiveComment: ApiRouteHandler;
  reworkComment: ApiRouteHandler;
  retryComment: ApiRouteHandler;
  listCommentNotifications: ApiRouteHandler;
}

const commentCollectionPaths = ["/api/comments", "/api/modules/:moduleId/comments"];
const commentMemberPaths = [
  "/api/comments/:id",
  "/api/modules/:moduleId/comments/:id"
];
const commentArchivePaths = [
  "/api/comments/:id/archive",
  "/api/modules/:moduleId/comments/:id/archive"
];
const commentReworkPaths = [
  "/api/comments/:id/rework",
  "/api/modules/:moduleId/comments/:id/rework"
];
const commentRetryPaths = [
  "/api/comments/:id/retry",
  "/api/modules/:moduleId/comments/:id/retry"
];
const commentNotificationPaths = [
  "/api/comment-notifications",
  "/api/modules/:moduleId/comment-notifications"
];

export function registerCommentRoutes(
  app: express.Express,
  handlers: CommentRouteHandlers
) {
  app.get("/api/proto-comments", handlers.getProtoComments);
  app.post("/api/proto-comments", handlers.replaceProtoComments);
  app.get(commentCollectionPaths, handlers.listComments);
  app.post(commentCollectionPaths, handlers.createComment);
  app.patch(commentMemberPaths, handlers.updateComment);
  app.post(commentArchivePaths, handlers.archiveComment);
  app.post(commentReworkPaths, handlers.reworkComment);
  app.post(commentRetryPaths, handlers.retryComment);
  app.get(commentNotificationPaths, handlers.listCommentNotifications);
}
