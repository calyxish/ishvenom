# @ishvenom/api

Express 5 + Prisma + Neon (Postgres 16 + PostGIS 3).

## Quick start

```bash
pnpm install
cp .env.example .env
# Fill in DATABASE_URL with your Neon connection string
pnpm prisma:generate
pnpm prisma:migrate
pnpm dev
```

The API boots on `http://localhost:4000`. Smoke test:

```bash
curl http://localhost:4000/api/v1/health
# → {"ok":true,"version":"0.1.0","uptime":3}
```

## Architecture
- **Strict TypeScript**, no `any`.
- **Zod everywhere** — env vars, request bodies, and responses are all validated.
- **Shared types** come from `@ishvenom/shared-types`.
- **PostGIS workaround** — see `.claude/skills/postgis-prisma.md` for the `Unsupported` + `$queryRaw` pattern.

## Scripts
- `pnpm dev` — tsx watch mode
- `pnpm build` — compile to `dist/`
- `pnpm start` — run compiled
- `pnpm test` — Vitest + Supertest
- `pnpm prisma:studio` — visual DB browser

## Testing
Vitest + Supertest. See `src/routes/health.test.ts` for the pattern.
