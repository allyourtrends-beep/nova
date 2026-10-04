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

    // Önce bağlı Etsy hesabının shop_id bilgisini al
    const meResponse = await fetch(
      "https://openapi.etsy.com/v3/application/users/me",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "x-api-key": `${process.env.ETSY_CLIENT_ID}:${process.env.ETSY_CLIENT_SECRET}`
        }
      }
    );

    const me = await meResponse.json();

    if (!meResponse.ok) {
      return res.status(meResponse.status).json({
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

    // Mağazadaki draft listingleri getir
    const listingsResponse = await fetch(
      `https://openapi.etsy.com/v3/application/shops/${shopId}/listings?state=draft&limit=100`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "x-api-key": `${process.env.ETSY_CLIENT_ID}:${process.env.ETSY_CLIENT_SECRET}`
        }
      }
    );

    const listings = await listingsResponse.json();

    if (!listingsResponse.ok) {
      return res.status(listingsResponse.status).json({
        ok: false,
        step: "draft-listings",
        etsy: listings
      });
    }

    return res.status(200).json({
      ok: true,
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
