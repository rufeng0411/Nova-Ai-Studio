# Configure

Environment variables and Admin forms only — not an architecture guide.

Required: `SAAS_ADMIN_PASSWORD`. Keep `PILOTDECK_COMMUNITY_PERSONAL=1`, `DEV_SAAS_SQLITE=1`, and marketing/register flags at `0`.

Add model keys in Admin → platform service → models. Never commit `.env`.

Ports are probed; trust the launcher printout (Bridge often 3001, Vite often 5173).
