# PostGIS with Prisma — patterns for IshVenom

See `.claude/skills/postgis-prisma.md` for the full canonical patterns (the skill
file is loaded automatically by Claude Code when it touches Prisma files).

## Quick reference

**Schema:**
```prisma
model Encounter {
  location Unsupported("geometry(Point, 4326)")
}
```

**Insert:**
```ts
await prisma.$executeRaw`
  INSERT INTO "Encounter" (..., location)
  VALUES (..., ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326))
`;
```

**Nearest-neighbour query:**
```ts
const nearest = await prisma.$queryRaw<AntivenomCenter[]>`
  SELECT id, name, country,
         ST_X(location::geometry) AS lng,
         ST_Y(location::geometry) AS lat,
         ST_Distance(location::geography, ST_MakePoint(${lng}, ${lat})::geography) AS distance_m
  FROM "AntivenomCenter"
  ORDER BY location::geography <-> ST_MakePoint(${lng}, ${lat})::geography
  LIMIT 5
`;
```

Always `::geography` for distance-in-meters. Always parse raw results with Zod.
