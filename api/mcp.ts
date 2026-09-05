import type { IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createGetNoteServer } from "../src/index.js";

function bearerToken(req: IncomingMessage): string | undefined {
  const header = req.headers.authorization;
  return header?.startsWith("Bearer ") ? header.slice(7) : undefined;
}

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
) {
  const expectedToken = process.env.MCP_ACCESS_TOKEN;
  if (!expectedToken) {
    res.statusCode = 503;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "MCP_ACCESS_TOKEN is not configured" }));
    return;
  }

  if (bearerToken(req) !== expectedToken) {
    res.statusCode = 401;
    res.setHeader("www-authenticate", "Bearer");
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  if (req.method !== "POST" && req.method !== "GET" && req.method !== "DELETE") {
    res.statusCode = 405;
    res.setHeader("allow", "GET, POST, DELETE");
    res.end();
    return;
  }

  const server = createGetNoteServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on("close", () => {
    void transport.close();
    void server.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}
