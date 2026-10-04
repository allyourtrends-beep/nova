import crypto from "crypto";

const b64u = (b) =>
  b.toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

export default function handler(req, res) {
  const clientId = process.env.ETSY_CLIENT_ID;
  const redirect = process.env.ETSY_REDIRECT_URI;

  if (!clientId || !redirect) {
    return res.status(500).send("Missing Etsy environment variables.");
  }

  const verifier = b64u(crypto.randomBytes(48));
  const challenge = b64u(
    crypto.createHash("sha256").update(verifier).digest()
  );
  const state = b64u(crypto.randomBytes(24));

  const cookie =
    "Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600";

  res.setHeader("Set-Cookie", [
    `etsy_pkce=${encodeURIComponent(verifier)}; ${cookie}`,
    `etsy_state=${encodeURIComponent(state)}; ${cookie}`,
  ]);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirect,
    scope: "listings_r listings_w shops_r",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  res.redirect(
    302,
    `https://www.etsy.com/oauth/connect?${params.toString()}`
  );
}
