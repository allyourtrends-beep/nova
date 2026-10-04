Nova Listing Manager - Etsy bridge starter

This first deployment only creates:
- /api
- /api/etsy/callback

It intentionally contains NO Etsy API key, shared secret, access token,
refresh token, or shop credentials.

After deployment, register:
https://YOUR-VERCEL-DOMAIN/api/etsy/callback
as the callback URL in the Etsy developer app.

OAuth token exchange and secure token storage should be configured only
after the callback URL is stable.
