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

async function getRemoteFile(url) {
  if (!/^https:\/\/.+/i.test(url)) {
    throw new Error(
      "media_url must be a public HTTPS URL"
    );
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Medya indirilemedi: HTTP ${response.status}`
    );
  }

  const buffer = await response.arrayBuffer();

  const contentType =
    response.headers.get("content-type") ||
    "application/octet-stream";

  return {
    buffer,
    contentType
  };
}

function extensionFromType(type, mediaType) {
  const clean = String(type)
    .split(";")[0]
    .trim()
    .toLowerCase();

  const map = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/quicktime": "mov"
  };

  return map[clean] || (mediaType === "video" ? "mp4" : "jpg");
}

async function uploadMedia({
  redis,
  accessToken,
  listingId,
  mediaType,
  mediaUrl,
  rank
}) {
  const remote = await getRemoteFile(mediaUrl);

  const ext = extensionFromType(
    remote.contentType,
    mediaType
  );

  const filename =
    mediaType === "video"
      ? `nova-etsy-video.${ext}`
      : `nova-etsy-image-${Date.now()}.${ext}`;

  const blob = new Blob(
    [remote.buffer],
    {
      type: remote.contentType
    }
  );

  const form = new FormData();

  if (mediaType === "video") {
    form.append("video", blob, filename);
  } else {
    form.append("image", blob, filename);

    if (rank !== undefined && rank !== null) {
      form.append("rank", String(Number(rank)));
    }
  }

  const endpoint =
    mediaType === "video"
      ? `${ETSY_BASE}/shops/listings/${listingId}/videos`
      : `${ETSY_BASE}/shops/listings/${listingId}/images`;

  return etsyRequest(
    redis,
    accessToken,
    endpoint,
    {
      method: "POST",
      body: form
    }
  );
}

export default async function handler(req, res) {
  if (!authorized(req)) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized"
    });
  }

  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({
      ok: false,
      error: "GET or POST required"
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

    // ==========================================
    // READ LISTING MEDIA
    // ==========================================

    if (req.method === "GET") {
      const images = await etsyRequest(
        redis,
        accessToken,
        `${ETSY_BASE}/listings/${Number(
          listingId
        )}/images`
      );

      accessToken = images.accessToken;

      let videos = {
        data: {
          count: 0,
          results: []
        }
      };

      try {
        videos = await etsyRequest(
          redis,
          accessToken,
          `${ETSY_BASE}/listings/${Number(
            listingId
          )}/videos`
        );
      } catch {
        // Bazı listing/video durumlarında Etsy boş
        // sonuç yerine hata döndürebilir.
      }

      return res.status(200).json({
        ok: true,
        listing_id: Number(listingId),
        images: images.data,
        videos: videos.data
      });
    }

    // ==========================================
    // UPLOAD IMAGE OR VIDEO
    // ==========================================

    const mediaType =
      String(body.media_type || "")
        .trim()
        .toLowerCase();

    if (!["image", "video"].includes(mediaType)) {
      return res.status(400).json({
        ok: false,
        error:
          'media_type must be "image" or "video"'
      });
    }

    if (!body.media_url) {
      return res.status(400).json({
        ok: false,
        error: "media_url required"
      });
    }

    const result = await uploadMedia({
      redis,
      accessToken,
      listingId: Number(listingId),
      mediaType,
      mediaUrl: String(body.media_url),
      rank: body.rank
    });

    return res.status(200).json({
      ok: true,
      action:
        mediaType === "video"
          ? "video_uploaded"
          : "image_uploaded",
      listing_id: Number(listingId),
      media: result.data
    });

  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
}
