import { Redis } from "@upstash/redis";

const API_KEY = () =>
  `${process.env.ETSY_CLIENT_ID}:${process.env.ETSY_CLIENT_SECRET}`;

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
    throw new Error(
      `Token yenilenemedi: ${JSON.stringify(data)}`
    );
  }

  await redis.set("etsy_access_token", data.access_token);

  if (data.refresh_token) {
    await redis.set("etsy_refresh_token", data.refresh_token);
  }

  return data.access_token;
}

async function getMe(accessToken) {
  return fetch(
    "https://openapi.etsy.com/v3/application/users/me",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "x-api-key": API_KEY()
      }
    }
  );
}

export default async function handler(req, res) {
  try {
    const redis = Redis.fromEnv();

    let accessToken = await redis.get("etsy_access_token");

    if (!accessToken) {
      accessToken = await refreshEtsyToken(redis);
    }

    let response = await getMe(accessToken);

    // Access token bittiyse otomatik yenile
    if (response.status === 401) {
      accessToken = await refreshEtsyToken(redis);
      response = await getMe(accessToken);
    }

    const data = await response.json();

    return res.status(response.status).json({
      ok: response.ok,
      token_auto_refresh: true,
      etsy: data
    });

  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
}
