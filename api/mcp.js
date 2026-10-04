const SERVER_INFO = {
  name: "nova-etsy",
  version: "1.1.0"
};

const TOOL = {
  name: "get_etsy_drafts",
  title: "Get Etsy Drafts",
  description: "Get draft listings from the owner's connected Etsy shop.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false
  }
};

function jsonRpc(res, id, result) {
  return res.status(200).json({
    jsonrpc: "2.0",
    id,
    result
  });
}

function jsonRpcError(res, id, code, message) {
  return res.status(200).json({
    jsonrpc: "2.0",
    id: id ?? null,
    error: {
      code,
      message
    }
  });
}

export default async function handler(req, res) {
  // MCP endpoint
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    return res.status(405).json({
      error: "Use POST for MCP requests."
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32600,
        message: "POST required"
      }
    });
  }

  const body = req.body || {};
  const { method, id } = body;

  // --------------------------------------------------
  // Modern MCP discovery
  // --------------------------------------------------
  if (method === "server/discover") {
    return jsonRpc(res, id, {
      protocolVersion: "2026-07-28",
      serverInfo: SERVER_INFO,
      capabilities: {
        tools: {}
      }
    });
  }

  // --------------------------------------------------
  // Legacy / handshake MCP compatibility
  // --------------------------------------------------
  if (method === "initialize") {
    return jsonRpc(res, id, {
      protocolVersion: "2025-06-18",
      capabilities: {
        tools: {
          listChanged: false
        }
      },
      serverInfo: SERVER_INFO
    });
  }

  // Client initialization notification.
  // Notifications do not receive JSON-RPC responses.
  if (method === "notifications/initialized") {
    return res.status(202).end();
  }

  // --------------------------------------------------
  // Tool discovery
  // --------------------------------------------------
  if (method === "tools/list") {
    return jsonRpc(res, id, {
      tools: [TOOL]
    });
  }

  // --------------------------------------------------
  // Tool execution
  // --------------------------------------------------
  if (method === "tools/call") {
    const toolName = body.params?.name;

    if (toolName !== "get_etsy_drafts") {
      return jsonRpcError(
        res,
        id,
        -32601,
        `Unknown tool: ${toolName || "undefined"}`
      );
    }

    try {
      const baseUrl =
        process.env.NOVA_BASE_URL ||
        `https://${req.headers.host}`;

      const response = await fetch(
        `${baseUrl}/api/etsy/drafts`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${process.env.NOVA_API_KEY}`,
            Accept: "application/json"
          }
        }
      );

      const raw = await response.text();

      if (!response.ok) {
        return jsonRpc(res, id, {
          content: [
            {
              type: "text",
              text:
                `Etsy drafts request failed (${response.status}). ` +
                raw
            }
          ],
          isError: true
        });
      }

      let data;

      try {
        data = JSON.parse(raw);
      } catch {
        data = raw;
      }

      return jsonRpc(res, id, {
        content: [
          {
            type: "text",
            text:
              typeof data === "string"
                ? data
                : JSON.stringify(data, null, 2)
          }
        ],
        isError: false
      });
    } catch (error) {
      return jsonRpc(res, id, {
        content: [
          {
            type: "text",
            text: `Nova Etsy error: ${
              error?.message || String(error)
            }`
          }
        ],
        isError: true
      });
    }
  }

  // --------------------------------------------------
  // Basic MCP utility
  // --------------------------------------------------
  if (method === "ping") {
    return jsonRpc(res, id, {});
  }

  return jsonRpcError(
    res,
    id,
    -32601,
    `Method not found: ${method || "undefined"}`
  );
}
