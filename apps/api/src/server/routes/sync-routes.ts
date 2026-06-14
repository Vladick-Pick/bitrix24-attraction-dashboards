import type express from "express";

import type { ApiRouteHandler } from "./route-handler.js";

export interface SyncRouteHandlers {
  syncAttraction: ApiRouteHandler;
  syncModule: ApiRouteHandler;
}

export function registerSyncRoutes(
  app: express.Express,
  handlers: SyncRouteHandlers
) {
  app.post("/api/sync", handlers.syncAttraction);
  app.post("/api/modules/:moduleId/sync", handlers.syncModule);
}
