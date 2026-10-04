import { Redis } from "@upstash/redis";

export default async function handler(req, res) {
  try {
    const redis = Redis.fromEnv();

    const accessToken = await redis.get("etsy_access_token");

    if (!accessToken) {
      return res.status(401).json({
        ok: false,
        error: "Etsy access token bulunamadı"
      });
    }

    const response = await fetch(
      "https://openapi.etsy.com/v3/application/users/me",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "x-api-key": `${process.env.ETSY_CLIENT_ID}:${process.env.ETSY_CLIENT_SECRET}`
        }
      }
    );

    const data = await response.json();

    return res.status(response.status).json({
      ok: response.ok,
      etsy: data
    });

  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
}
