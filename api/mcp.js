import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const SERVER_INFO = {
  name: "nova-etsy",
  version: "3.0.0"
};

async function callNovaApi(req, path, { method = "GET", body } = {}) {
  const baseUrl =
    process.env.NOVA_BASE_URL ||
    `https://${req.headers.host}`;

  const options = {
    method,
    headers: {
      Authorization: `Bearer ${process.env.NOVA_API_KEY}`,
      Accept: "application/json"
    }
  };

  if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${baseUrl}${path}`, options);
  const raw = await response.text();

  return {
    ok: response.ok,
    status: response.status,
    raw
  };
}

function resultToMcp(result) {
  return {
    content: [
      {
        type: "text",
        text: result.raw || `HTTP ${result.status}`
      }
    ],
    isError: !result.ok
  };
}

function blocked(text) {
  return {
    content: [{ type: "text", text }],
    isError: true
  };
}

function createNovaServer(req) {
  const server = new McpServer(
    SERVER_INFO,
    {
      instructions:
        "Nova Etsy manages the connected Etsy shop. Prefer reading current Etsy state before modifying listings. Never publish a listing or delete personalization without explicit user approval."
    }
  );

  server.registerTool(
    "get_etsy_drafts",
    {
      title: "Get Etsy Drafts",
      description: "Get draft listings from the connected Etsy shop.",
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async () => {
      return resultToMcp(
        await callNovaApi(req, "/api/etsy/drafts")
      );
    }
  );

  server.registerTool(
    "get_etsy_setup",
    {
      title: "Get Etsy Shop Setup",
      description:
        "Get Etsy shop ID, shipping profiles and processing/readiness profiles.",
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async () => {
      return resultToMcp(
        await callNovaApi(req, "/api/etsy/setup")
      );
    }
  );

  server.registerTool(
    "create_etsy_draft",
    {
      title: "Create Etsy Draft",
      description:
        "Create a physical Etsy listing as a draft. Never publish automatically.",
      inputSchema: {
        title: z.string(),
        description: z.string(),
        price: z.number(),
        quantity: z.number().int().min(1),
        taxonomy_id: z.number().int(),
        shipping_profile_id: z.number().int(),
        readiness_state_id: z.number().int(),
        who_made: z.string().optional(),
        when_made: z.string().optional(),
        tags: z.array(z.string()).max(13).optional(),
        materials: z.array(z.string()).optional(),
        section_id: z.number().int().optional(),
        return_policy_id: z.number().int().optional()
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async (args) => {
      return resultToMcp(
        await callNovaApi(req, "/api/etsy/listing", {
          method: "POST",
          body: {
            action: "create",
            who_made: args.who_made || "i_did",
            when_made: args.when_made || "made_to_order",
            ...args
          }
        })
      );
    }
  );

  server.registerTool(
    "update_etsy_listing",
    {
      title: "Update Etsy Listing",
      description:
        "Update an existing Etsy listing including SEO, price, profiles, section and return policy.",
      inputSchema: {
        listing_id: z.number().int(),
        title: z.string().optional(),
        description: z.string().optional(),
        price: z.number().optional(),
        quantity: z.number().int().optional(),
        taxonomy_id: z.number().int().optional(),
        shipping_profile_id: z.number().int().optional(),
        readiness_state_id: z.number().int().optional(),
        who_made: z.string().optional(),
        when_made: z.string().optional(),
        tags: z.array(z.string()).max(13).optional(),
        materials: z.array(z.string()).optional(),
        section_id: z.number().int().optional(),
        return_policy_id: z.number().int().optional()
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async (args) => {
      return resultToMcp(
        await callNovaApi(req, "/api/etsy/listing", {
          method: "PATCH",
          body: {
            action: "update",
            ...args
          }
        })
      );
    }
  );

  server.registerTool(
    "get_etsy_inventory",
    {
      title: "Get Etsy Inventory",
      description:
        "Get inventory and variation information for an Etsy listing.",
      inputSchema: {
        listing_id: z.number().int()
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async ({ listing_id }) => {
      return resultToMcp(
        await callNovaApi(
          req,
          `/api/etsy/inventory?listing_id=${encodeURIComponent(listing_id)}`
        )
      );
    }
  );

  server.registerTool(
    "update_etsy_inventory",
    {
      title: "Update Etsy Inventory",
      description:
        "Update Etsy listing inventory, SKUs, prices, quantities and variations.",
      inputSchema: {
        listing_id: z.number().int(),
        products: z.array(z.record(z.any())),
        price_on_property: z.array(z.number().int()).optional(),
        quantity_on_property: z.array(z.number().int()).optional(),
        sku_on_property: z.array(z.number().int()).optional()
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async (args) => {
      return resultToMcp(
        await callNovaApi(req, "/api/etsy/inventory", {
          method: "PUT",
          body: args
        })
      );
    }
  );

  server.registerTool(
    "get_etsy_media",
    {
      title: "Get Etsy Listing Media",
      description:
        "Get the current images and videos attached to an Etsy listing.",
      inputSchema: {
        listing_id: z.number().int()
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async ({ listing_id }) => {
      return resultToMcp(
        await callNovaApi(
          req,
          `/api/etsy/media?listing_id=${encodeURIComponent(listing_id)}`
        )
      );
    }
  );

  server.registerTool(
    "store_media_in_blob",
    {
      title: "Store Media in Nova Blob",
      description:
        "Download an image or video from a public HTTPS source URL and store it in Nova Blob.",
      inputSchema: {
        source_url: z.string().url(),
        filename: z.string().optional(),
        folder: z.string().optional()
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true
      }
    },
    async (args) => {
      return resultToMcp(
        await callNovaApi(req, "/api/etsy/blob", {
          method: "POST",
          body: {
            source_url: args.source_url,
            filename: args.filename,
            folder: args.folder || "etsy"
          }
        })
      );
    }
  );

  server.registerTool(
    "upload_etsy_image",
    {
      title: "Upload Etsy Image",
      description:
        "Upload an image to an Etsy listing from a public HTTPS media URL.",
      inputSchema: {
        listing_id: z.number().int(),
        media_url: z.string().url(),
        rank: z.number().int().min(1).optional()
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true
      }
    },
    async (args) => {
      return resultToMcp(
        await callNovaApi(req, "/api/etsy/media", {
          method: "POST",
          body: {
            listing_id: args.listing_id,
            media_type: "image",
            media_url: args.media_url,
            rank: args.rank
          }
        })
      );
    }
  );

  server.registerTool(
    "upload_etsy_video",
    {
      title: "Upload Etsy Video",
      description:
        "Upload a product video to an Etsy listing from a public HTTPS media URL.",
      inputSchema: {
        listing_id: z.number().int(),
        media_url: z.string().url()
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true
      }
    },
    async (args) => {
      return resultToMcp(
        await callNovaApi(req, "/api/etsy/media", {
          method: "POST",
          body: {
            listing_id: args.listing_id,
            media_type: "video",
            media_url: args.media_url
          }
        })
      );
    }
  );

  server.registerTool(
    "get_etsy_personalization",
    {
      title: "Get Etsy Personalization",
      description:
        "Get personalization questions configured for an Etsy listing.",
      inputSchema: {
        listing_id: z.number().int()
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async ({ listing_id }) => {
      return resultToMcp(
        await callNovaApi(
          req,
          `/api/etsy/personalization?listing_id=${encodeURIComponent(
            listing_id
          )}`
        )
      );
    }
  );

  server.registerTool(
    "update_etsy_personalization",
    {
      title: "Update Etsy Personalization",
      description:
        "Create or replace personalization questions for an Etsy listing. Supports up to 5 questions.",
      inputSchema: {
        listing_id: z.number().int(),
        personalization_questions: z
          .array(z.record(z.any()))
          .min(1)
          .max(5)
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async (args) => {
      return resultToMcp(
        await callNovaApi(req, "/api/etsy/personalization", {
          method: "POST",
          body: args
        })
      );
    }
  );

  server.registerTool(
    "delete_etsy_personalization",
    {
      title: "Delete Etsy Personalization",
      description:
        "Delete all personalization questions from an Etsy listing. Requires explicit user approval.",
      inputSchema: {
        listing_id: z.number().int(),
        confirm_delete: z.boolean()
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: false
      }
    },
    async (args) => {
      if (args.confirm_delete !== true) {
        return blocked(
          "Deleting personalization blocked: explicit confirmation is required."
        );
      }

      return resultToMcp(
        await callNovaApi(req, "/api/etsy/personalization", {
          method: "DELETE",
          body: {
            listing_id: args.listing_id,
            confirm_delete: true
          }
        })
      );
    }
  );

  server.registerTool(
    "publish_etsy_listing",
    {
      title: "Publish Etsy Listing",
      description:
        "Publish an Etsy draft listing. ONLY use after explicit user approval.",
      inputSchema: {
        listing_id: z.number().int(),
        confirm_publish: z.boolean()
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async (args) => {
      if (args.confirm_publish !== true) {
        return blocked(
          "Publishing blocked: explicit confirmation is required."
        );
      }

      return resultToMcp(
        await callNovaApi(req, "/api/etsy/listing", {
          method: "PATCH",
          body: {
            action: "publish",
            listing_id: args.listing_id,
            confirm_publish: true
          }
        })
      );
    }
  );

  return server;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, GET, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "content-type, mcp-session-id, mcp-protocol-version"
  );
  res.setHeader(
    "Access-Control-Expose-Headers",
    "Mcp-Session-Id"
  );

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (!["POST", "GET", "DELETE"].includes(req.method)) {
    return res.status(405).end("Method Not Allowed");
  }

  const server = createNovaServer(req);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });

  res.on("close", () => {
    transport.close();
    server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Nova Etsy MCP error:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        error: "Nova Etsy MCP internal error"
      });
    }
  }
}
