# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

# ── deps: install all packages (layer-cached against lockfile) ───────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/api/package.json ./services/api/
COPY packages/shared-types/package.json ./packages/shared-types/
RUN pnpm install --frozen-lockfile

# ── build: compile shared-types + API ────────────────────────────────────────
FROM base AS build
# Copy per-package node_modules — pnpm workspace packages each get their own
# node_modules directory with symlinks into the root .pnpm store.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared-types/node_modules ./packages/shared-types/node_modules
COPY --from=deps /app/services/api/node_modules ./services/api/node_modules
COPY . .
RUN pnpm --filter @ishvenom/shared-types build
RUN pnpm --filter @ishvenom/api prisma:generate
RUN pnpm --filter @ishvenom/api build

# ── runtime ───────────────────────────────────────────────────────────────────
# We preserve the full monorepo directory layout here for two reasons:
#
# 1. pnpm workspace symlinks in services/api/node_modules/* point to
#    ../../node_modules/.pnpm/* — the root node_modules must sit at the same
#    relative path or Node's ESM resolver can't find express, zod, etc.
#
# 2. `prisma generate` writes the query-engine binary and the generated
#    PrismaClient into node_modules/.prisma/client/. pnpm deploy re-installs
#    @prisma/client fresh (no generated files), breaking ESM named exports.
#    Keeping root node_modules intact avoids this entirely.
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=build /app/services/api/dist ./services/api/dist
COPY --from=build /app/services/api/node_modules ./services/api/node_modules
COPY --from=build /app/services/api/package.json ./services/api/package.json
COPY --from=build /app/services/api/prisma ./services/api/prisma
WORKDIR /app/services/api
EXPOSE 4000
USER node
CMD ["node", "dist/index.js"]
