export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      jsonrpc: "2.0",
      error: {
        code: -32600,
        message: "POST required"
      },
      id: null
    });
  }

  const body = req.body || {};
  const { method, id } = body;

  // MCP handshake
  if (method === "initialize") {
    return res.status(200).json({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2025-06-18",
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: "nova-etsy",
          version: "1.0.0"
        }
      }
    });
  }

  // List available tools
  if (method === "tools/list") {
    return res.status(200).json({
      jsonrpc: "2.0",
      id,
      result: {
        tools: [
          {
            name: "get_etsy_drafts",
            description: "Get draft listings from the connected Etsy shop.",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false
            }
          }
        ]
      }
    });
  }

  // Run tool
  if (method === "tools/call") {
    const toolName = body.params?.name;

    if (toolName !== "get_etsy_drafts") {
      return res.status(200).json({
        jsonrpc: "2.0",
        id,
        error: {
          code: -32601,
          message: "Unknown tool"
        }
      });
    }

    const baseUrl = `https://${req.headers.host}`;

    const response = await fetch(
      `${baseUrl}/api/etsy/drafts`,
      {
        headers: {
          Authorization: `Bearer ${process.env.NOVA_API_KEY}`
        }
      }
    );

    const data = await response.json();

    return res.status(200).json({
      jsonrpc: "2.0",
      id,
      result: {
        content: [
          {
            type: "text",
            text: JSON.stringify(data)
          }
        ]
      }
    });
  }

  return res.status(200).json({
    jsonrpc: "2.0",
    id: id ?? null,
    result: {}
  });
}
