import { put } from "@vercel/blob";

function authorized(req) {
  return (
    process.env.NOVA_API_KEY &&
    req.headers.authorization === `Bearer ${process.env.NOVA_API_KEY}`
  );
}

function safeFileName(name = "nova-image.png") {
  return String(name)
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

function extensionFromType(contentType = "") {
  const type = contentType.toLowerCase();

  if (type.includes("jpeg")) return ".jpg";
  if (type.includes("png")) return ".png";
  if (type.includes("webp")) return ".webp";
  if (type.includes("gif")) return ".gif";
  if (type.includes("mp4")) return ".mp4";
  if (type.includes("quicktime")) return ".mov";

  return "";
}

export default async function handler(req, res) {
  if (!authorized(req)) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized"
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "POST required"
    });
  }

  try {
    const {
      source_url,
      filename,
      folder = "etsy"
    } = req.body || {};

    if (!source_url) {
      return res.status(400).json({
        ok: false,
        error: "source_url required"
      });
    }

    let source;

    try {
      source = new URL(source_url);
    } catch {
      return res.status(400).json({
        ok: false,
        error: "Invalid source_url"
      });
    }

    if (source.protocol !== "https:") {
      return res.status(400).json({
        ok: false,
        error: "source_url must use HTTPS"
      });
    }

    const response = await fetch(source.toString());

    if (!response.ok) {
      return res.status(400).json({
        ok: false,
        error:
          `Source download failed: ${response.status}`
      });
    }

    const contentType =
      response.headers.get("content-type") ||
      "application/octet-stream";

    const allowed =
      contentType.startsWith("image/") ||
      contentType.startsWith("video/");

    if (!allowed) {
      return res.status(400).json({
        ok: false,
        error:
          `Unsupported content type: ${contentType}`
      });
    }

    const arrayBuffer = await response.arrayBuffer();

    if (!arrayBuffer.byteLength) {
      return res.status(400).json({
        ok: false,
        error: "Downloaded file is empty"
      });
    }

    const MAX_BYTES = 25 * 1024 * 1024;

    if (arrayBuffer.byteLength > MAX_BYTES) {
      return res.status(413).json({
        ok: false,
        error: "File exceeds 25 MB limit"
      });
    }

    const ext = extensionFromType(contentType);

    let finalName = safeFileName(
      filename ||
        `nova-${Date.now()}${ext}`
    );

    if (
      ext &&
      !finalName
        .toLowerCase()
        .endsWith(ext.toLowerCase())
    ) {
      finalName += ext;
    }

    const safeFolder = String(folder)
      .replace(/[^a-zA-Z0-9/_-]/g, "-")
      .replace(/^\/+|\/+$/g, "")
      .slice(0, 100);

    const pathname =
      `${safeFolder || "etsy"}/${Date.now()}-${finalName}`;

    const blob = await put(
      pathname,
      new Blob([arrayBuffer], {
        type: contentType
      }),
      {
        access: "public",
        addRandomSuffix: true,
        contentType
      }
    );

    return res.status(201).json({
      ok: true,
      message: "Media stored in Nova Blob",
      media: {
        url: blob.url,
        download_url:
          blob.downloadUrl || blob.url,
        pathname: blob.pathname,
        content_type: contentType,
        size_bytes: arrayBuffer.byteLength
      }
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || String(error)
    });
  }
}
