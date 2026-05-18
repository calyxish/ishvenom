# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/api/package.json ./services/api/
COPY packages/shared-types/package.json ./packages/shared-types/
RUN pnpm install --frozen-lockfile

FROM base AS build
# Copy root node_modules AND workspace package node_modules from deps.
# pnpm creates per-package node_modules with symlinks into the .pnpm store —
# copying only the root is not enough for workspace builds.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared-types/node_modules ./packages/shared-types/node_modules
COPY . .
RUN pnpm --filter @ishvenom/shared-types build
RUN pnpm --filter @ishvenom/api prisma:generate
RUN pnpm --filter @ishvenom/api build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/services/api/dist ./dist
COPY --from=build /app/services/api/package.json ./
COPY --from=build /app/services/api/node_modules ./node_modules
# shared-types is a workspace package imported at runtime — copy its compiled dist
# so the symlink in node_modules/@ishvenom/shared-types resolves correctly.
COPY --from=build /app/packages/shared-types/dist ./packages/shared-types/dist
EXPOSE 4000
USER node
CMD ["node", "dist/index.js"]
