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
      `Etsy token yenilenemedi: ${JSON.stringify(data)}`
    );
  }

  await redis.set("etsy_access_token", data.access_token);

  if (data.refresh_token) {
    await redis.set("etsy_refresh_token", data.refresh_token);
  }

  return data.access_token;
}

async function requestEtsy(
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

async function getShopId(redis, accessToken) {
  const result = await requestEtsy(
    redis,
    accessToken,
    `${ETSY_BASE}/users/me`
  );

  if (!result.data?.shop_id) {
    throw new Error("Etsy Shop ID bulunamadı");
  }

  return {
    shopId: result.data.shop_id,
    accessToken: result.accessToken
  };
}

function cleanTags(tags) {
  if (!Array.isArray(tags)) return undefined;

  return tags
    .map((tag) => String(tag).trim())
    .filter(Boolean)
    .slice(0, 13);
}

export default async function handler(req, res) {
  if (!authorized(req)) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized"
    });
  }

  if (!["POST", "PATCH"].includes(req.method)) {
    return res.status(405).json({
      ok: false,
      error: "POST or PATCH required"
    });
  }

  try {
    const redis = Redis.fromEnv();

    let accessToken =
      await redis.get("etsy_access_token");

    if (!accessToken) {
      accessToken = await refreshToken(redis);
    }

    const shop = await getShopId(
      redis,
      accessToken
    );

    const shopId = shop.shopId;
    accessToken = shop.accessToken;

    const body = req.body || {};
    const action = body.action || "create";

    // ==================================================
    // CREATE DRAFT LISTING
    // ==================================================
    if (action === "create") {
      const required = [
        "title",
        "description",
        "price",
        "quantity",
        "taxonomy_id",
        "shipping_profile_id",
        "readiness_state_id"
      ];

      const missing = required.filter(
        (key) =>
          body[key] === undefined ||
          body[key] === null ||
          body[key] === ""
      );

      if (missing.length) {
        return res.status(400).json({
          ok: false,
          error: "Missing required fields",
          missing
        });
      }

      const payload = {
        quantity: Number(body.quantity),
        title: String(body.title),
        description: String(body.description),
        price: Number(body.price),
        who_made: body.who_made || "i_did",
        when_made: body.when_made || "made_to_order",
        taxonomy_id: Number(body.taxonomy_id),
        shipping_profile_id:
          Number(body.shipping_profile_id),
        readiness_state_id:
          Number(body.readiness_state_id),
        type: "physical"
      };

      const tags = cleanTags(body.tags);

      if (tags?.length) {
        payload.tags = tags;
      }

      if (Array.isArray(body.materials)) {
        payload.materials =
          body.materials
            .map(String)
            .map((x) => x.trim())
            .filter(Boolean);
      }

      if (body.shop_section_id) {
        payload.shop_section_id =
          Number(body.shop_section_id);
      }

      if (body.return_policy_id) {
        payload.return_policy_id =
          Number(body.return_policy_id);
      }

      if (
        typeof body.is_personalizable === "boolean"
      ) {
        payload.is_personalizable =
          body.is_personalizable;
      }

      const result = await requestEtsy(
        redis,
        accessToken,
        `${ETSY_BASE}/shops/${shopId}/listings`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );

      return res.status(201).json({
        ok: true,
        action: "created_draft",
        shop_id: shopId,
        listing: result.data
      });
    }

    // ==================================================
    // UPDATE LISTING
    // ==================================================
    if (action === "update") {
      if (!body.listing_id) {
        return res.status(400).json({
          ok: false,
          error: "listing_id required"
        });
      }

      const allowed = [
        "title",
        "description",
        "price",
        "quantity",
        "taxonomy_id",
        "shipping_profile_id",
        "readiness_state_id",
        "who_made",
        "when_made",
        "materials",
        "shop_section_id",
        "return_policy_id",
        "is_personalizable"
      ];

      const payload = {};

      for (const key of allowed) {
        if (body[key] !== undefined) {
          payload[key] = body[key];
        }
      }

      if (body.tags !== undefined) {
        payload.tags = cleanTags(body.tags);
      }

      const result = await requestEtsy(
        redis,
        accessToken,
        `${ETSY_BASE}/shops/${shopId}/listings/${Number(
          body.listing_id
        )}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );

      return res.status(200).json({
        ok: true,
        action: "updated",
        listing: result.data
      });
    }

    // ==================================================
    // PUBLISH LISTING
    // ==================================================
    if (action === "publish") {
      if (!body.listing_id) {
        return res.status(400).json({
          ok: false,
          error: "listing_id required"
        });
      }

      if (body.confirm_publish !== true) {
        return res.status(400).json({
          ok: false,
          error:
            "Publishing requires confirm_publish=true"
        });
      }

      const result = await requestEtsy(
        redis,
        accessToken,
        `${ETSY_BASE}/shops/${shopId}/listings/${Number(
          body.listing_id
        )}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            state: "active"
          })
        }
      );

      return res.status(200).json({
        ok: true,
        action: "published",
        listing: result.data
      });
    }

    return res.status(400).json({
      ok: false,
      error: `Unknown action: ${action}`
    });

  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
}
