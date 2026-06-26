import { randomUUID, timingSafeEqual } from "node:crypto";

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type express from "express";

import {
  createAttractionMcpServer,
  type AttractionMcpGateway
} from "./mcp-server.js";

interface McpHttpSession {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
}

export interface RegisterAttractionMcpHttpRouteInput {
  path?: string;
  accessToken: string;
  gateway: AttractionMcpGateway;
}

function readBearerToken(value: string | undefined) {
  const prefix = "Bearer ";
  if (!value?.startsWith(prefix)) {
    return null;
  }

  return value.slice(prefix.length).trim() || null;
}

function tokensEqual(input: string | null, expected: string) {
  if (!input) {
    return false;
  }

  const inputBuffer = Buffer.from(input);
  const expectedBuffer = Buffer.from(expected);
  return (
    inputBuffer.length === expectedBuffer.length &&
    timingSafeEqual(inputBuffer, expectedBuffer)
  );
}

function unauthorized(response: express.Response) {
  response.status(401).json({
    error: {
      code: "UNAUTHORIZED"
    }
  });
}

function sessionNotFound(response: express.Response) {
  response.status(404).json({
    jsonrpc: "2.0",
    error: {
      code: -32001,
      message: "Session not found"
    },
    id: null
  });
}

export function registerAttractionMcpHttpRoute(
  app: express.Express,
  input: RegisterAttractionMcpHttpRouteInput
) {
  const routePath = input.path ?? "/api/mcp";
  const sessions = new Map<string, McpHttpSession>();

  app.all(routePath, async (request, response, next) => {
    const bearerToken = readBearerToken(request.header("Authorization"));
    if (!tokensEqual(bearerToken, input.accessToken)) {
      unauthorized(response);
      return;
    }

    try {
      const sessionId = request.header("Mcp-Session-Id")?.trim();
      let session = sessionId ? sessions.get(sessionId) : undefined;

      if (!session && !sessionId && request.method === "POST") {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: randomUUID,
          onsessioninitialized: (initializedSessionId) => {
            sessions.set(initializedSessionId, session as McpHttpSession);
          }
        });
        const server = createAttractionMcpServer(input.gateway);
        session = { server, transport };
        transport.onclose = () => {
          const initializedSessionId = transport.sessionId;
          if (initializedSessionId) {
            sessions.delete(initializedSessionId);
          }
        };
        await server.connect(transport as Parameters<McpServer["connect"]>[0]);
      }

      if (!session) {
        sessionNotFound(response);
        return;
      }

      await session.transport.handleRequest(request, response, request.body);
    } catch (error) {
      next(error);
    }
  });
}
