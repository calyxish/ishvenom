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

# ── deploy: resolve all .pnpm symlinks into a standalone directory ────────────
# `pnpm deploy` bundles production deps + workspace package content into
# /deploy with no symlinks — the runtime image needs no .pnpm store.
FROM base AS deploy
COPY --from=build /app .
RUN pnpm --filter @ishvenom/api deploy --prod /deploy

# ── runtime: minimal production image ────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# node_modules from pnpm deploy — real packages, no symlinks
COPY --from=deploy /deploy/node_modules ./node_modules
COPY --from=deploy /deploy/package.json ./
# compiled API dist
COPY --from=build /app/services/api/dist ./dist
# Prisma schema + migrations needed at runtime for migrate deploy + queries
COPY --from=build /app/services/api/prisma ./prisma
EXPOSE 4000
USER node
CMD ["node", "dist/index.js"]
