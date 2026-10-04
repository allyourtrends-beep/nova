import { Redis } from "@upstash/redis";

const ETSY_BASE = "https://openapi.etsy.com/v3/application";

const API_KEY = () =>
  `${process.env.ETSY_CLIENT_ID}:${process.env.ETSY_CLIENT_SECRET}`;

function authorized(req) {
  return (
    process.env.NOVA_API_KEY &&
    req.headers.authorization === `Bearer ${process.env.NOVA_API_KEY}`
  );
}

async function refreshToken(redis) {
  const refreshToken = await redis.get("etsy_refresh_token");

  if (!refreshToken) {
    throw new Error("Etsy refresh token bulunamadı");
  }

  const response = await fetch(
    "https://api.etsy.com/v3/public/oauth/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: process.env.ETSY_CLIENT_ID,
        refresh_token: refreshToken
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Token yenilenemedi: ${JSON.stringify(data)}`
    );
  }

  await redis.set("etsy_access_token", data.access_token);

  if (data.refresh_token) {
    await redis.set(
      "etsy_refresh_token",
      data.refresh_token
    );
  }

  return data.access_token;
}

async function etsyRequest(
  redis,
  accessToken,
  url,
  options = {}
) {
  const send = (token) =>
    fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "x-api-key": API_KEY(),
        Accept: "application/json",
        ...(options.headers || {})
      }
    });

  let response = await send(accessToken);

  if (response.status === 401) {
    accessToken = await refreshToken(redis);
    response = await send(accessToken);
  }

  const raw = await response.text();

  let data;

  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = raw;
  }

  if (!response.ok) {
    throw new Error(
      `Etsy ${response.status}: ${
        typeof data === "string"
          ? data
          : JSON.stringify(data)
      }`
    );
  }

  return {
    data,
    accessToken
  };
}

function normalizeOffering(offering = {}) {
  const result = {
    quantity: Math.max(
      0,
      Number(offering.quantity ?? 0)
    ),
    is_enabled:
      offering.is_enabled === undefined
        ? true
        : Boolean(offering.is_enabled)
  };

  if (
    offering.price !== undefined &&
    offering.price !== null
  ) {
    result.price = Number(offering.price);
  }

  return result;
}

function normalizeProducts(products) {
  if (!Array.isArray(products) || !products.length) {
    throw new Error(
      "products must be a non-empty array"
    );
  }

  return products.map((product) => {
    if (
      !Array.isArray(product.property_values) ||
      !product.property_values.length
    ) {
      throw new Error(
        "Each product requires property_values"
      );
    }

    if (
      !Array.isArray(product.offerings) ||
      !product.offerings.length
    ) {
      throw new Error(
        "Each product requires at least one offering"
      );
    }

    return {
      sku:
        product.sku === undefined ||
        product.sku === null
          ? ""
          : String(product.sku),

      property_values:
        product.property_values.map((property) => {
          const item = {
            property_id: Number(property.property_id),
            property_name: String(
              property.property_name || ""
            ),
            values: Array.isArray(property.values)
              ? property.values.map(String)
              : []
          };

          if (
            Array.isArray(property.value_ids) &&
            property.value_ids.length
          ) {
            item.value_ids =
              property.value_ids.map(Number);
          }

          if (property.scale_id !== undefined) {
            item.scale_id = Number(property.scale_id);
          }

          return item;
        }),

      offerings:
        product.offerings.map(normalizeOffering)
    };
  });
}

export default async function handler(req, res) {
  if (!authorized(req)) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized"
    });
  }

  if (!["GET", "POST", "PUT"].includes(req.method)) {
    return res.status(405).json({
      ok: false,
      error: "GET, POST or PUT required"
    });
  }

  try {
    const redis = Redis.fromEnv();

    let accessToken =
      await redis.get("etsy_access_token");

    if (!accessToken) {
      accessToken = await refreshToken(redis);
    }

    const body = req.body || {};

    const listingId =
      body.listing_id ||
      req.query?.listing_id;

    if (!listingId) {
      return res.status(400).json({
        ok: false,
        error: "listing_id required"
      });
    }

    const url =
      `${ETSY_BASE}/listings/` +
      `${Number(listingId)}/inventory`;

    // ==========================================
    // READ CURRENT INVENTORY / VARIATIONS
    // ==========================================
    if (req.method === "GET") {
      const result = await etsyRequest(
        redis,
        accessToken,
        url
      );

      return res.status(200).json({
        ok: true,
        listing_id: Number(listingId),
        inventory: result.data
      });
    }

    // ==========================================
    // WRITE INVENTORY / VARIATIONS
    // ==========================================
    const products =
      normalizeProducts(body.products);

    const payload = {
      products,

      price_on_property:
        Array.isArray(body.price_on_property)
          ? body.price_on_property.map(Number)
          : [],

      quantity_on_property:
        Array.isArray(body.quantity_on_property)
          ? body.quantity_on_property.map(Number)
          : [],

      sku_on_property:
        Array.isArray(body.sku_on_property)
          ? body.sku_on_property.map(Number)
          : []
    };

    const result = await etsyRequest(
      redis,
      accessToken,
      url,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    return res.status(200).json({
      ok: true,
      action: "inventory_updated",
      listing_id: Number(listingId),
      inventory: result.data
    });

  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
}  
