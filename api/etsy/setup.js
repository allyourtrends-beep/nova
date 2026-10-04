import { Redis } from "@upstash/redis";

const API_KEY = () =>
  `${process.env.ETSY_CLIENT_ID}:${process.env.ETSY_CLIENT_SECRET}`;

function isAuthorized(req) {
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
    throw new Error(`Token yenilenemedi: ${JSON.stringify(data)}`);
  }

  await redis.set("etsy_access_token", data.access_token);

  if (data.refresh_token) {
    await redis.set("etsy_refresh_token", data.refresh_token);
  }

  return data.access_token;
}

async function etsyFetch(url, redis, accessToken) {
  const request = async (token) =>
    fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "x-api-key": API_KEY(),
        Accept: "application/json"
      }
    });

  let response = await request(accessToken);

  if (response.status === 401) {
    accessToken = await refreshToken(redis);
    response = await request(accessToken);
  }

  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      `Etsy ${response.status}: ${
        typeof data === "string" ? data : JSON.stringify(data)
      }`
    );
  }

  return { data, accessToken };
}

export default async function handler(req, res) {
  if (!isAuthorized(req)) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized"
    });
  }

  try {
    const redis = Redis.fromEnv();

    let accessToken = await redis.get("etsy_access_token");

    if (!accessToken) {
      accessToken = await refreshToken(redis);
    }

    let result = await etsyFetch(
      "https://api.etsy.com/v3/application/users/me",
      redis,
      accessToken
    );

    accessToken = result.accessToken;

    const shopId = result.data.shop_id;

    if (!shopId) {
      throw new Error("Shop ID bulunamadı");
    }

    const [shipping, readiness] = await Promise.all([
      etsyFetch(
        `https://api.etsy.com/v3/application/shops/${shopId}/shipping-profiles`,
        redis,
        accessToken
      ),
      etsyFetch(
        `https://api.etsy.com/v3/application/shops/${shopId}/readiness-state-definitions`,
        redis,
        accessToken
      )
    ]);

    return res.status(200).json({
      ok: true,
      shop_id: shopId,
      shipping_profiles: shipping.data,
      readiness_profiles: readiness.data
    });

  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
}
