import { Redis } from "@upstash/redis";

const API_KEY = () =>
  `${process.env.ETSY_CLIENT_ID}:${process.env.ETSY_CLIENT_SECRET}`;

function isAuthorized(req) {
  const auth = req.headers.authorization;

  if (!process.env.NOVA_API_KEY) {
    return false;
  }

  return auth === `Bearer ${process.env.NOVA_API_KEY}`;
}

async function refreshEtsyToken(redis) {
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
    throw new Error(`Token yenilenemedi: ${JSON.stringify(data)}`);
  }

  await redis.set("etsy_access_token", data.access_token);

  if (data.refresh_token) {
    await redis.set("etsy_refresh_token", data.refresh_token);
  }

  return data.access_token;
}

async function etsyFetch(url, redis, accessToken) {
  let response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "x-api-key": API_KEY()
    }
  });

  if (response.status === 401) {
    accessToken = await refreshEtsyToken(redis);

    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "x-api-key": API_KEY()
      }
    });
  }

  return { response, accessToken };
}

export default async function handler(req, res) {
  try {
    // Nova API güvenlik kontrolü
    if (!isAuthorized(req)) {
      return res.status(401).json({
        ok: false,
        error: "Unauthorized"
      });
    }

    const redis = Redis.fromEnv();

    let accessToken = await redis.get("etsy_access_token");

    if (!accessToken) {
      accessToken = await refreshEtsyToken(redis);
    }

    let result = await etsyFetch(
      "https://openapi.etsy.com/v3/application/users/me",
      redis,
      accessToken
    );

    accessToken = result.accessToken;

    const me = await result.response.json();

    if (!result.response.ok) {
      return res.status(result.response.status).json({
        ok: false,
        step: "users/me",
        etsy: me
      });
    }

    const shopId = me.shop_id;

    if (!shopId) {
      return res.status(500).json({
        ok: false,
        error: "Shop ID bulunamadı"
      });
    }

    result = await etsyFetch(
      `https://openapi.etsy.com/v3/application/shops/${shopId}/listings?state=draft&limit=100`,
      redis,
      accessToken
    );

    const listings = await result.response.json();

    if (!result.response.ok) {
      return res.status(result.response.status).json({
        ok: false,
        step: "draft-listings",
        etsy: listings
      });
    }

    return res.status(200).json({
      ok: true,
      token_auto_refresh: true,
      shop_id: shopId,
      draft_count: listings.count,
      drafts: listings.results
    });

  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
}
