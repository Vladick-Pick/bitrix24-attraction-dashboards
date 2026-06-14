import type express from "express";

import type { ApiRouteHandler } from "./route-handler.js";

export interface LeadgenRouteHandlers {
  notFound: ApiRouteHandler;
  getFunnelReport: ApiRouteHandler;
  getActivitiesWorkloadReport: ApiRouteHandler;
  getCallsWorkloadReport: ApiRouteHandler;
}

export function registerLeadgenRoutes(
  app: express.Express,
  handlers: LeadgenRouteHandlers
) {
  app.get("/api/modules/:moduleId/reports/funnel", handlers.getFunnelReport);
  app.get(
    "/api/modules/:moduleId/reports/activities-workload",
    handlers.getActivitiesWorkloadReport
  );
  app.get(
    "/api/modules/:moduleId/reports/calls-workload",
    handlers.getCallsWorkloadReport
  );
  app.get("/api/modules/leadgen/ontology", handlers.notFound);
  app.get("/api/modules/leadgen/ontology/sources/:sourceId", handlers.notFound);
}
