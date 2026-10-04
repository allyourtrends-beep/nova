const SERVER_INFO = {
  name: "nova-etsy",
  version: "2.2.0"
};

const TOOLS = [
  {
    name: "get_etsy_drafts",
    title: "Get Etsy Drafts",
    description: "Get draft listings from the connected Etsy shop.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },

  {
    name: "get_etsy_setup",
    title: "Get Etsy Shop Setup",
    description:
      "Get Etsy shop ID, shipping profiles and processing/readiness profiles.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },

  {
    name: "create_etsy_draft",
    title: "Create Etsy Draft",
    description:
      "Create a physical Etsy listing as a draft. Use SEO-optimized title, description and up to 13 tags. Never publish automatically.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        price: { type: "number" },
        quantity: { type: "integer", minimum: 1 },
        taxonomy_id: { type: "integer" },
        shipping_profile_id: { type: "integer" },
        readiness_state_id: { type: "integer" },
        who_made: { type: "string", default: "i_did" },
        when_made: { type: "string", default: "made_to_order" },
        tags: {
          type: "array",
          maxItems: 13,
          items: { type: "string" }
        },
        materials: {
          type: "array",
          items: { type: "string" }
        },
        section_id: { type: "integer" },
        return_policy_id: { type: "integer" }
      },
      required: [
        "title",
        "description",
        "price",
        "quantity",
        "taxonomy_id",
        "shipping_profile_id",
        "readiness_state_id"
      ],
      additionalProperties: false
    }
  },

  {
    name: "update_etsy_listing",
    title: "Update Etsy Listing",
    description:
      "Update an existing Etsy listing including SEO, price, profiles, section and return policy.",
    inputSchema: {
      type: "object",
      properties: {
        listing_id: { type: "integer" },
        title: { type: "string" },
        description: { type: "string" },
        price: { type: "number" },
        quantity: { type: "integer" },
        taxonomy_id: { type: "integer" },
        shipping_profile_id: { type: "integer" },
        readiness_state_id: { type: "integer" },
        who_made: { type: "string" },
        when_made: { type: "string" },
        tags: {
          type: "array",
          maxItems: 13,
          items: { type: "string" }
        },
        materials: {
          type: "array",
          items: { type: "string" }
        },
        section_id: { type: "integer" },
        return_policy_id: { type: "integer" }
      },
      required: ["listing_id"],
      additionalProperties: false
    }
  },

  {
    name: "get_etsy_inventory",
    title: "Get Etsy Inventory",
    description:
      "Get inventory and variation information for an Etsy listing.",
    inputSchema: {
      type: "object",
      properties: {
        listing_id: { type: "integer" }
      },
      required: ["listing_id"],
      additionalProperties: false
    }
  },

  {
    name: "update_etsy_inventory",
    title: "Update Etsy Inventory",
    description:
      "Update Etsy listing inventory, SKUs, prices, quantities and variations.",
    inputSchema: {
      type: "object",
      properties: {
        listing_id: { type: "integer" },
        products: {
          type: "array",
          items: { type: "object" }
        },
        price_on_property: {
          type: "array",
          items: { type: "integer" }
        },
        quantity_on_property: {
          type: "array",
          items: { type: "integer" }
        },
        sku_on_property: {
          type: "array",
          items: { type: "integer" }
        }
      },
      required: ["listing_id", "products"],
      additionalProperties: false
    }
  },

  {
    name: "get_etsy_media",
    title: "Get Etsy Listing Media",
    description:
      "Get the current images and videos attached to an Etsy listing.",
    inputSchema: {
      type: "object",
      properties: {
        listing_id: { type: "integer" }
      },
      required: ["listing_id"],
      additionalProperties: false
    }
  },

  {
    name: "store_media_in_blob",
    title: "Store Media in Nova Blob",
    description:
      "Download an image or video from a public HTTPS source URL and store it in Nova Blob.",
    inputSchema: {
      type: "object",
      properties: {
        source_url: { type: "string" },
        filename: { type: "string" },
        folder: { type: "string" }
      },
      required: ["source_url"],
      additionalProperties: false
    }
  },

  {
    name: "upload_etsy_image",
    title: "Upload Etsy Image",
    description:
      "Upload an image to an Etsy listing from a public HTTPS media URL.",
    inputSchema: {
      type: "object",
      properties: {
        listing_id: { type: "integer" },
        media_url: { type: "string" },
        rank: { type: "integer", minimum: 1 }
      },
      required: ["listing_id", "media_url"],
      additionalProperties: false
    }
  },

  {
    name: "upload_etsy_video",
    title: "Upload Etsy Video",
    description:
      "Upload a product video to an Etsy listing from a public HTTPS media URL.",
    inputSchema: {
      type: "object",
      properties: {
        listing_id: { type: "integer" },
        media_url: { type: "string" }
      },
      required: ["listing_id", "media_url"],
      additionalProperties: false
    }
  },

  {
    name: "get_etsy_personalization",
    title: "Get Etsy Personalization",
    description:
      "Get personalization questions configured for an Etsy listing.",
    inputSchema: {
      type: "object",
      properties: {
        listing_id: { type: "integer" }
      },
      required: ["listing_id"],
      additionalProperties: false
    }
  },

  {
    name: "update_etsy_personalization",
    title: "Update Etsy Personalization",
    description:
      "Create or replace personalization questions for an Etsy listing. Supports up to 5 questions.",
    inputSchema: {
      type: "object",
      properties: {
        listing_id: { type: "integer" },
        personalization_questions: {
          type: "array",
          minItems: 1,
          maxItems: 5,
          items: { type: "object" }
        }
      },
      required: ["listing_id", "personalization_questions"],
      additionalProperties: false
    }
  },

  {
    name: "delete_etsy_personalization",
    title: "Delete Etsy Personalization",
    description:
      "Delete all personalization questions from an Etsy listing. Only use after explicit user approval.",
    inputSchema: {
      type: "object",
      properties: {
        listing_id: { type: "integer" },
        confirm_delete: { type: "boolean" }
      },
      required: ["listing_id", "confirm_delete"],
      additionalProperties: false
    }
  },

  {
    name: "publish_etsy_listing",
    title: "Publish Etsy Listing",
    description:
      "Publish an Etsy draft listing. ONLY use this when the user explicitly asks to publish the listing.",
    inputSchema: {
      type: "object",
      properties: {
        listing_id: { type: "integer" },
        confirm_publish: {
          type: "boolean",
          description:
            "Must be true. Only set after explicit user approval to publish."
        }
      },
      required: ["listing_id", "confirm_publish"],
      additionalProperties: false
    }
  }
];

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

  const response = await fetch(
    `${baseUrl}${path}`,
    options
  );

  const raw = await response.text();

  return {
    ok: response.ok,
    status: response.status,
    raw
  };
}

function toolResult(res, id, result) {
  return jsonRpc(res, id, {
    content: [
      {
        type: "text",
        text: result.raw
      }
    ],
    isError: !result.ok
  });
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

  if (method === "server/discover") {
    return jsonRpc(res, id, {
      protocolVersion: "2026-07-28",
      serverInfo: SERVER_INFO,
      capabilities: {
        tools: {}
      }
    });
  }

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

  if (method === "notifications/initialized") {
    return res.status(202).end();
  }

  if (method === "tools/list") {
    return jsonRpc(res, id, {
      tools: TOOLS
    });
  }

  if (method === "tools/call") {
    const toolName = body.params?.name;
    const args = body.params?.arguments || {};

    try {
      if (toolName === "get_etsy_drafts") {
        const result = await callNovaApi(
          req,
          "/api/etsy/drafts"
        );
        return toolResult(res, id, result);
      }

      if (toolName === "get_etsy_setup") {
        const result = await callNovaApi(
          req,
          "/api/etsy/setup"
        );
        return toolResult(res, id, result);
      }

      if (toolName === "create_etsy_draft") {
        const result = await callNovaApi(
          req,
          "/api/etsy/listing",
          {
            method: "POST",
            body: {
              action: "create",
              ...args
            }
          }
        );
        return toolResult(res, id, result);
      }

      if (toolName === "update_etsy_listing") {
        const result = await callNovaApi(
          req,
          "/api/etsy/listing",
          {
            method: "PATCH",
            body: {
              action: "update",
              ...args
            }
          }
        );
        return toolResult(res, id, result);
      }

      if (toolName === "get_etsy_inventory") {
        const result = await callNovaApi(
          req,
          `/api/etsy/inventory?listing_id=${encodeURIComponent(
            args.listing_id
          )}`
        );
        return toolResult(res, id, result);
      }

      if (toolName === "update_etsy_inventory") {
        const result = await callNovaApi(
          req,
          "/api/etsy/inventory",
          {
            method: "PUT",
            body: args
          }
        );
        return toolResult(res, id, result);
      }

      if (toolName === "get_etsy_media") {
        const result = await callNovaApi(
          req,
          `/api/etsy/media?listing_id=${encodeURIComponent(
            args.listing_id
          )}`
        );
        return toolResult(res, id, result);
      }

      if (toolName === "store_media_in_blob") {
        const result = await callNovaApi(
          req,
          "/api/etsy/blob",
          {
            method: "POST",
            body: {
              source_url: args.source_url,
              filename: args.filename,
              folder: args.folder || "etsy"
            }
          }
        );
        return toolResult(res, id, result);
      }

      if (toolName === "upload_etsy_image") {
        const result = await callNovaApi(
          req,
          "/api/etsy/media",
          {
            method: "POST",
            body: {
              listing_id: args.listing_id,
              media_type: "image",
              media_url: args.media_url,
              rank: args.rank
            }
          }
        );
        return toolResult(res, id, result);
      }

      if (toolName === "upload_etsy_video") {
        const result = await callNovaApi(
          req,
          "/api/etsy/media",
          {
            method: "POST",
            body: {
              listing_id: args.listing_id,
              media_type: "video",
              media_url: args.media_url
            }
          }
        );
        return toolResult(res, id, result);
      }

      if (toolName === "get_etsy_personalization") {
        const result = await callNovaApi(
          req,
          `/api/etsy/personalization?listing_id=${encodeURIComponent(
            args.listing_id
          )}`
        );
        return toolResult(res, id, result);
      }

      if (toolName === "update_etsy_personalization") {
        const result = await callNovaApi(
          req,
          "/api/etsy/personalization",
          {
            method: "POST",
            body: {
              listing_id: args.listing_id,
              personalization_questions:
                args.personalization_questions
            }
          }
        );
        return toolResult(res, id, result);
      }

      if (toolName === "delete_etsy_personalization") {
        if (args.confirm_delete !== true) {
          return jsonRpc(res, id, {
            content: [
              {
                type: "text",
                text:
                  "Deleting personalization blocked: explicit confirmation is required."
              }
            ],
            isError: true
          });
        }

        const result = await callNovaApi(
          req,
          "/api/etsy/personalization",
          {
            method: "DELETE",
            body: {
              listing_id: args.listing_id,
              confirm_delete: true
            }
          }
        );

        return toolResult(res, id, result);
      }

      if (toolName === "publish_etsy_listing") {
        if (args.confirm_publish !== true) {
          return jsonRpc(res, id, {
            content: [
              {
                type: "text",
                text:
                  "Publishing blocked: explicit confirmation is required."
              }
            ],
            isError: true
          });
        }

        const result = await callNovaApi(
          req,
          "/api/etsy/listing",
          {
            method: "PATCH",
            body: {
              action: "publish",
              listing_id: args.listing_id,
              confirm_publish: true
            }
          }
        );

        return toolResult(res, id, result);
      }

      return jsonRpcError(
        res,
        id,
        -32601,
        `Unknown tool: ${toolName || "undefined"}`
      );
    } catch (error) {
      return jsonRpc(res, id, {
        content: [
          {
            type: "text",
            text:
              `Nova Etsy error: ${
                error?.message || String(error)
              }`
          }
        ],
        isError: true
      });
    }
  }

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
