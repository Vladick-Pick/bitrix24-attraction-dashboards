import type express from "express";

import type { ApiRouteHandler } from "./route-handler.js";

export interface ModuleAdminRouteHandlers {
  listModuleUsers: ApiRouteHandler;
  createModuleUser: ApiRouteHandler;
  updateModuleUser: ApiRouteHandler;
  deleteModuleUser: ApiRouteHandler;
}

const moduleUsersCollectionPaths = [
  "/api/admin/module-users",
  "/api/modules/:moduleId/admin/module-users"
];
const moduleUsersMemberPaths = [
  "/api/admin/module-users/:id",
  "/api/modules/:moduleId/admin/module-users/:id"
];

export function registerModuleAdminRoutes(
  app: express.Express,
  handlers: ModuleAdminRouteHandlers
) {
  app.get(moduleUsersCollectionPaths, handlers.listModuleUsers);
  app.post(moduleUsersCollectionPaths, handlers.createModuleUser);
  app.patch(moduleUsersMemberPaths, handlers.updateModuleUser);
  app.delete(moduleUsersMemberPaths, handlers.deleteModuleUser);
}
