# Build context is the MONOREPO ROOT, not this directory — apps/api depends on
# packages/db and packages/types via npm workspaces.
#
# Railway service settings:
#   Root Directory: .   (repo root)
#   Dockerfile Path: apps/api/Dockerfile
#
# Local build/run for testing:
#   docker build -f apps/api/Dockerfile -t assessiq-api .
#   docker run --env-file apps/api/.env -p 3001:3001 assessiq-api

FROM node:24-slim AS base
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ─── deps ──────────────────────────────────────────────────────────────────
# Installing with only package.json files first lets Docker cache this layer
# until a dependency actually changes.
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/config/package.json packages/config/package.json
RUN npm ci

# ─── build ─────────────────────────────────────────────────────────────────
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.base.json turbo.json ./
COPY packages packages
COPY apps/api apps/api
RUN npx prisma generate --schema packages/db/prisma/schema.prisma
RUN npm run build --workspace=@assessiq/types
RUN npm run build --workspace=@assessiq/api

# ─── runner ────────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /app ./
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy --schema=/app/packages/db/prisma/schema.prisma && node dist/main.js"]
