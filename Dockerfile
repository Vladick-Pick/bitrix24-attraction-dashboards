FROM node:24-bookworm-slim AS build

WORKDIR /app

ENV PYTHON=/usr/bin/python3

RUN apt-get update && apt-get install -y --no-install-recommends \
    g++ \
    make \
    python3 \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/proto/package.json apps/proto/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json

RUN pnpm install --frozen-lockfile

ARG SOURCE_REVISION=unknown

COPY . .

RUN printf '%s\n' "$SOURCE_REVISION" > /app/.build-revision

RUN pnpm --filter @bitrix24-reporting/contracts build \
  && pnpm --filter @bitrix24-reporting/web build \
  && pnpm --filter @bitrix24-reporting/api build \
  && pnpm prune --prod

FROM node:24-bookworm-slim AS runner

ARG SOURCE_REVISION=unknown

LABEL org.opencontainers.image.revision=$SOURCE_REVISION

ENV NODE_ENV=production \
  AUTH_MODE=password \
  API_HOST=0.0.0.0 \
  API_PORT=8787 \
  DATABASE_URL=file:/app/data/bitrix24-reporting.db \
  WEB_STATIC_DIR=/app/apps/web/dist \
  TRUST_PROXY=loopback

WORKDIR /app

RUN groupadd --system --gid 10001 app \
  && useradd --system --uid 10001 --gid app --home-dir /app --shell /usr/sbin/nologin app \
  && mkdir -p /app/data \
  && chown -R app:app /app

COPY --from=build --chown=app:app /app /app

USER app

EXPOSE 8787

CMD ["node", "--conditions=production", "apps/api/dist/index.js"]
