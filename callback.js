export default async function handler(req, res) {
  const { code, state, error, error_description } = req.query || {};

  if (error) {
    return res.status(400).send(
      `<h1>Etsy authorization failed</h1><p>${escapeHtml(error_description || error)}</p>`
    );
  }

  if (!code) {
    return res.status(200).send(`
      <h1>Nova Listing Manager</h1>
      <p>Etsy OAuth callback endpoint is online.</p>
      <p>The next step is to register this exact URL in the Etsy developer app.</p>
    `);
  }

  // Intentionally do not print or store authorization codes here.
  // Token exchange + secure storage will be enabled after the callback URL
  // is registered and the required environment variables are configured.
  return res.status(200).send(`
    <h1>Etsy returned successfully</h1>
    <p>The callback endpoint received the authorization response.</p>
    <p>No credentials were displayed or stored.</p>
  `);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
