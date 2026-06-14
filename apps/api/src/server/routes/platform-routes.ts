import type express from "express";

import type { ApiRouteHandler } from "./route-handler.js";

export interface PlatformPublicRouteHandlers {
  login: ApiRouteHandler;
}

export interface PlatformRouteHandlers {
  health: ApiRouteHandler;
  getCurrentUser: ApiRouteHandler;
  updateCurrentUser: ApiRouteHandler;
  changePassword: ApiRouteHandler;
  logout: ApiRouteHandler;
  listModuleCapabilities: ApiRouteHandler;
  getModuleCapabilities: ApiRouteHandler;
  getPlatformAccess: ApiRouteHandler;
  updatePlatformUserModuleMemberships: ApiRouteHandler;
}

export function registerPlatformPublicRoutes(
  app: express.Express,
  handlers: PlatformPublicRouteHandlers
) {
  app.post("/api/auth/login", handlers.login);
}

export function registerPlatformRoutes(
  app: express.Express,
  handlers: PlatformRouteHandlers
) {
  app.get("/api/health", handlers.health);
  app.get("/api/auth/me", handlers.getCurrentUser);
  app.patch("/api/auth/me", handlers.updateCurrentUser);
  app.post("/api/auth/change-password", handlers.changePassword);
  app.post("/api/auth/logout", handlers.logout);
  app.get("/api/modules/capabilities", handlers.listModuleCapabilities);
  app.get("/api/modules/:moduleId/capabilities", handlers.getModuleCapabilities);
  app.get("/api/admin/platform/access", handlers.getPlatformAccess);
  app.patch(
    "/api/admin/platform/users/:id/module-memberships",
    handlers.updatePlatformUserModuleMemberships
  );
}
