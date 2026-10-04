function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) {
      out[part.slice(0, i).trim()] =
        decodeURIComponent(part.slice(i + 1).trim());
    }
  }
  return out;
}

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));

export default async function handler(req, res) {
  const { code, state, error, error_description } = req.query || {};
  const cookies = parseCookies(req);

  if (error) {
    return res.status(400).send(
      `<h1>Etsy authorization failed</h1>
       <p>${esc(error_description || error)}</p>`
    );
  }

  if (!code) {
    return res.status(200).send(`
      <html>
        <body style="font-family:Arial;max-width:720px;margin:60px auto">
          <h1>Nova Listing Manager</h1>
          <p>Etsy OAuth callback endpoint is online.</p>
          <p><a href="/api/etsy/connect">Connect Etsy shop</a></p>
        </body>
      </html>
    `);
  }

  if (!state || !cookies.etsy_state || state !== cookies.etsy_state) {
    return res.status(400).send(
      "<h1>Security check failed</h1>"
    );
  }

  if (!cookies.etsy_pkce) {
    return res.status(400).send(
      "<h1>PKCE verifier missing</h1>"
    );
  }

  const clientId = process.env.ETSY_CLIENT_ID;
  const redirect = process.env.ETSY_REDIRECT_URI;

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    redirect_uri: redirect,
    code: String(code),
    code_verifier: cookies.etsy_pkce,
  });

  const response = await fetch(
    "https://api.etsy.com/v3/public/oauth/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    }
  );

  const data = await response.json().catch(() => ({}));

  res.setHeader("Set-Cookie", [
    "etsy_pkce=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
    "etsy_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
  ]);

  if (!response.ok) {
    return res.status(response.status).send(
      `<h1>Token exchange failed</h1>
       <p>${esc(data.error_description || data.error || "Unknown error")}</p>`
    );
  }

  return res.status(200).send(`
    <html>
      <body style="font-family:Arial;max-width:720px;margin:60px auto">
        <h1>✅ Etsy authorization successful</h1>
        <p>Nova Listing Manager successfully completed Etsy OAuth + PKCE.</p>
        <p>For security, your access and refresh tokens were not displayed or stored.</p>
      </body>
    </html>
  `);
}
