const SERVER_INFO = {
  name: "nova-etsy",
  version: "1.2.0"
};

const DRAFTS_TOOL = {
  name: "get_etsy_drafts",
  title: "Get Etsy Drafts",
  description: "Get draft listings from the owner's connected Etsy shop.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false
  }
};

const SETUP_TOOL = {
  name: "get_etsy_setup",
  title: "Get Etsy Shop Setup",
  description:
    "Get the connected Etsy shop ID, shipping profiles and processing/readiness profiles required for creating physical Etsy listings.",
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

async function callNovaApi(req, path) {
  const baseUrl =
    process.env.NOVA_BASE_URL ||
    `https://${req.headers.host}`;

  const response = await fetch(`${baseUrl}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${process.env.NOVA_API_KEY}`,
      Accept: "application/json"
    }
  });

  const raw = await response.text();

  return {
    ok: response.ok,
    status: response.status,
    raw
  };
}

export default async function handler(req, res) {
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

  // Modern MCP discovery
  if (method === "server/discover") {
    return jsonRpc(res, id, {
      protocolVersion: "2026-07-28",
      serverInfo: SERVER_INFO,
      capabilities: {
        tools: {}
      }
    });
  }

  // MCP initialization
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

  // Initialization notification
  if (method === "notifications/initialized") {
    return res.status(202).end();
  }

  // List tools
  if (method === "tools/list") {
    return jsonRpc(res, id, {
      tools: [
        DRAFTS_TOOL,
        SETUP_TOOL
      ]
    });
  }

  // Call tools
  if (method === "tools/call") {
    const toolName = body.params?.name;

    // -----------------------------------------
    // GET ETSY DRAFTS
    // -----------------------------------------
    if (toolName === "get_etsy_drafts") {
      try {
        const result = await callNovaApi(
          req,
          "/api/etsy/drafts"
        );

        return jsonRpc(res, id, {
          content: [
            {
              type: "text",
              text: result.raw
            }
          ],
          isError: !result.ok
        });

      } catch (error) {
        return jsonRpc(res, id, {
          content: [
            {
              type: "text",
              text: `Nova Etsy drafts error: ${
                error?.message || String(error)
              }`
            }
          ],
          isError: true
        });
      }
    }

    // -----------------------------------------
    // GET ETSY SHOP SETUP
    // -----------------------------------------
    if (toolName === "get_etsy_setup") {
      try {
        const result = await callNovaApi(
          req,
          "/api/etsy/setup"
        );

        return jsonRpc(res, id, {
          content: [
            {
              type: "text",
              text: result.raw
            }
          ],
          isError: !result.ok
        });

      } catch (error) {
        return jsonRpc(res, id, {
          content: [
            {
              type: "text",
              text: `Nova Etsy setup error: ${
                error?.message || String(error)
              }`
            }
          ],
          isError: true
        });
      }
    }

    return jsonRpcError(
      res,
      id,
      -32601,
      `Unknown tool: ${toolName || "undefined"}`
    );
  }

  // MCP ping
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
