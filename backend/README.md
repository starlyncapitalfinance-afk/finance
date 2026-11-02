# Sri Finance JLG — Cloudflare sync server (Worker + D1)

Same concept as the ZYFM app: an offline-first client that syncs through a
tiny free Cloudflare Worker backed by a D1 (SQLite) database.

## One-time deploy (free Cloudflare account)

```bash
cd backend
npm i -g wrangler          # or: npx wrangler ...
wrangler login

# 1) create the database and paste its id into wrangler.toml
wrangler d1 create starlyn-capital-finance

# 2) create the tables
wrangler d1 execute starlyn-capital-finance --remote --file=./schema.sql

# 3) deploy the API
wrangler deploy
```

`wrangler deploy` prints your server URL, e.g.
`https://starlyn-capital-finance.<you>.workers.dev`.
Put that URL in `web/js/server-config.js` (DEFAULT_SERVER) before building the
web/APK, exactly like ZYFM's server-config.js.

## First run
Open the app → "Set up server" → enter the server URL, your name, a username
and password. The first account becomes **Admin**. Everyone else that an admin
creates is a normal user. From then on every device that signs in to the same
server URL shares the same live data (last-write-wins, offline-first).

## API (for reference)
`/api/setup` `/api/login` `/api/status` `/api/meta` `/api/push` `/api/pull` `/api/audit`
