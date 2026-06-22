# Production-Like Stand

This runbook starts a second isolated instance that looks and behaves like the
normal product surface while reading only generated local SQLite data.

## Runtime Shape

- Public URL: `https://<stand-subdomain>`
- Host app port: `127.0.0.1:8788`
- Compose project: `bitrix24-reporting-stand`
- Data directory: `/opt/bitrix24-reporting-stand/data`
- Container database paths stay unchanged under `/app/data`.
- Bitrix sync stays disabled. Do not configure a live Bitrix webhook here.

The browser and API responses must not contain stand/data-generation labels.
Keep all operator-only context in this runbook, shell history, and private
server notes.

## Environment

Create `.env.stand` on the server next to the repository:

```bash
NODE_ENV=production
AUTH_MODE=password
SESSION_SECRET=<64+ random chars>
SESSION_COOKIE_NAME=b24dash_session
SESSION_TTL_HOURS=12
APP_PUBLIC_URL=https://<stand-subdomain>
WEB_ORIGIN=https://<stand-subdomain>
TRUST_PROXY=loopback
API_HOST=0.0.0.0
API_PORT=8787
WEB_STATIC_DIR=/app/apps/web/dist
DATABASE_URL=file:/app/data/bitrix24-reporting.db
PLATFORM_DATABASE_URL=file:/app/data/bitrix24-reporting.db
ATTRACTION_DATABASE_URL=file:/app/data/bitrix24-attraction.db
LEADGEN_DATABASE_URL=file:/app/data/bitrix24-leadgen.db
JSON_BODY_LIMIT=256kb
REPORT_DEFAULT_PERIOD_DAYS=30
REPORT_WON_STAGE_IDS=C10:WON
ATTRACTION_AUTO_SYNC_ENABLED=false
ATTRACTION_AUTO_SYNC_INTERVAL_MINUTES=60
TELEGRAM_ACTIVITY_REPORT_ENABLED=false
BITRIX24_DEAL_CATEGORY_IDS=10
BITRIX24_LEADGEN_US_CATEGORY_ID=28
BITRIX24_LEADGEN_MANAGER_IDS=
BITRIX24_DEAL_QUALITY_FIELD=UF_CRM_1730380390
BITRIX24_DEAL_TARIFF_FIELD=UF_CRM_1643901145
BITRIX24_DEAL_BUSINESS_CLUB_FIELD=UF_CRM_1747682957
BITRIX24_DEAL_TARGET_GROUP_FIELD=
BITRIX24_DEAL_MEETING_TYPE_FIELD=UF_CRM_1669784114991
BITRIX24_DEAL_MEETING_DATE_FIELD=UF_CRM_1669784197394
BITRIX24_CONTACT_TARGET_GROUP_FIELD=UF_CRM_1712252375
BITRIX24_CONTACT_TARGET_GROUP_LEGACY_FIELD=UF_CRM_1691070302
BITRIX24_PORTAL_HOST=
BITRIX24_WEBHOOK_USER_ID=
BITRIX24_WEBHOOK_TOKEN=
OPENROUTER_API_KEY=
PAPERCLIP_API_URL=
PAPERCLIP_API_TOKEN=
PROTO_COMMENTS_ENABLED=false
```

Set strict permissions:

```bash
chmod 600 .env.stand
sudo install -d -o 10001 -g 10001 -m 700 /opt/bitrix24-reporting-stand/data
```

## Start

```bash
ENV_FILE=.env.stand \
STAND_API_PORT=8788 \
STAND_DATA_DIR=/opt/bitrix24-reporting-stand/data \
docker compose \
  -f docker-compose.stand.yml \
  -p bitrix24-reporting-stand \
  up -d --build
```

Create or reset an admin user:

```bash
printf '%s\n' '<temporary-strong-password>' \
  | ENV_FILE=.env.stand docker compose \
      -f docker-compose.stand.yml \
      -p bitrix24-reporting-stand \
      exec -T app \
      node --conditions=production apps/api/dist/tools/auth-users.js create admin --password-stdin
```

Seed the reporting database:

```bash
ENV_FILE=.env.stand docker compose \
  -f docker-compose.stand.yml \
  -p bitrix24-reporting-stand \
  exec -T app \
  node --conditions=production apps/api/dist/tools/stand-data.js
```

The seed is safe to rerun against the same stand database. If you need a clean
reset, stop the stand and recreate only `/opt/bitrix24-reporting-stand/data`;
never point this compose project at the production data directory.

## Reverse Proxy

Add a separate Caddy or nginx vhost for `<stand-subdomain>` that proxies to
`127.0.0.1:8788`. Keep the existing production vhost untouched.

## Verification

```bash
curl -i https://<stand-subdomain>/api/health
curl -i https://<stand-subdomain>/api/dashboard
curl -i http://127.0.0.1:8788/api/health
sudo ss -tulpn | grep 8788
```

Expected:

- `/api/health` returns `200`.
- `/api/dashboard` returns `401` before login.
- `8788` is bound only on localhost.
- No Bitrix sync runs are started from this instance.
