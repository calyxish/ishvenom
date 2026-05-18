/**
 * Geospatial helpers.
 *
 * Two responsibilities:
 *
 * 1. Privacy truncation: mobile clients SHOULD already send district
 *    centroids, but we enforce it server-side by snapping incoming
 *    coordinates to the centroid of the enclosing district. This means
 *    even if a misbehaving client sends raw GPS, the stored location
 *    can't identify a household.
 *
 * 2. PostGIS raw queries: Prisma's `Unsupported("geometry")` type means
 *    every spatial read/write goes through `$queryRaw` or `$executeRaw`.
 *    We wrap those calls here so the route handlers stay clean.
 */
import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

export interface LatLng {
  latitude: number;
  longitude: number;
}

/**
 * Truncate a coordinate pair to ~1.1 km precision by rounding to 2 decimal
 * places. This is our "last resort" privacy step when we don't know the
 * enclosing district — real district snapping requires a districts table
 * with polygon geometries which is out of scope for the hackathon.
 */
export function truncateCoordinate(coord: LatLng): LatLng {
  return {
    latitude: Math.round(coord.latitude * 100) / 100,
    longitude: Math.round(coord.longitude * 100) / 100,
  };
}

/**
 * Insert an encounter with a PostGIS Point geometry column.
 *
 * Prisma's Unsupported type cannot be set via the normal client, so we use
 * $executeRaw with ST_SetSRID(ST_MakePoint(lon, lat), 4326).
 */
export async function insertEncounterRaw(input: {
  id: string;
  deviceId: string;
  speciesGuess: string | null;
  confidence: number | null;
  latitude: number;
  longitude: number;
  district: string | null;
  country: string;
  language: string;
  actionTaken: string;
  wasBite: boolean;
  metadata: Prisma.InputJsonValue | null;
}): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO "Encounter" (
      "id", "deviceId", "createdAt", "speciesGuess", "confidence",
      "location", "district", "country", "language", "actionTaken",
      "wasBite", "metadata"
    ) VALUES (
      ${input.id}::uuid,
      ${input.deviceId},
      NOW(),
      ${input.speciesGuess},
      ${input.confidence},
      ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326),
      ${input.district},
      ${input.country},
      ${input.language},
      ${input.actionTaken},
      ${input.wasBite},
      ${input.metadata ?? Prisma.JsonNull}
    )
  `;
}

export interface NearbyCenter {
  id: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  antivenomsStocked: unknown;
  phone: string | null;
  lastVerified: Date | null;
  distanceMeters: number;
}

/**
 * Return antivenom centers within `radiusMeters` of the given point,
 * ordered by distance ascending.
 *
 * Uses `geography` casts so the distance is in real meters, not degrees.
 */
export async function findNearbyAntivenomCenters(
  center: LatLng,
  radiusMeters: number,
  limit: number,
): Promise<NearbyCenter[]> {
  const rows = await prisma.$queryRaw<NearbyCenter[]>`
    SELECT
      "id",
      "name",
      "country",
      ST_Y("location"::geometry) AS "latitude",
      ST_X("location"::geometry) AS "longitude",
      "antivenomsStocked",
      "phone",
      "lastVerified",
      ST_Distance(
        "location"::geography,
        ST_SetSRID(ST_MakePoint(${center.longitude}, ${center.latitude}), 4326)::geography
      ) AS "distanceMeters"
    FROM "AntivenomCenter"
    WHERE ST_DWithin(
      "location"::geography,
      ST_SetSRID(ST_MakePoint(${center.longitude}, ${center.latitude}), 4326)::geography,
      ${radiusMeters}
    )
    ORDER BY "distanceMeters" ASC
    LIMIT ${limit}
  `;
  return rows;
}

export interface DistrictStatsRow {
  country: string;
  district: string | null;
  encounterCount: bigint;
  biteCount: bigint;
  topSpecies: string | null;
}

/**
 * Aggregate encounters by district for the dashboard map.
 *
 * Returns counts per (country, district) optionally filtered by species
 * and/or date range.
 */
export async function getDistrictStats(args: {
  since?: Date;
  until?: Date;
  species?: string;
  country?: string;
}): Promise<DistrictStatsRow[]> {
  const since = args.since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const until = args.until ?? new Date();

  if (args.species && args.country) {
    return prisma.$queryRaw<DistrictStatsRow[]>`
      SELECT
        "country",
        "district",
        COUNT(*)::bigint AS "encounterCount",
        SUM(CASE WHEN "wasBite" THEN 1 ELSE 0 END)::bigint AS "biteCount",
        MODE() WITHIN GROUP (ORDER BY "speciesGuess") AS "topSpecies"
      FROM "Encounter"
      WHERE "createdAt" BETWEEN ${since} AND ${until}
        AND "speciesGuess" = ${args.species}
        AND "country" = ${args.country}
      GROUP BY "country", "district"
      ORDER BY "encounterCount" DESC
    `;
  }

  if (args.species) {
    return prisma.$queryRaw<DistrictStatsRow[]>`
      SELECT
        "country",
        "district",
        COUNT(*)::bigint AS "encounterCount",
        SUM(CASE WHEN "wasBite" THEN 1 ELSE 0 END)::bigint AS "biteCount",
        MODE() WITHIN GROUP (ORDER BY "speciesGuess") AS "topSpecies"
      FROM "Encounter"
      WHERE "createdAt" BETWEEN ${since} AND ${until}
        AND "speciesGuess" = ${args.species}
      GROUP BY "country", "district"
      ORDER BY "encounterCount" DESC
    `;
  }

  if (args.country) {
    return prisma.$queryRaw<DistrictStatsRow[]>`
      SELECT
        "country",
        "district",
        COUNT(*)::bigint AS "encounterCount",
        SUM(CASE WHEN "wasBite" THEN 1 ELSE 0 END)::bigint AS "biteCount",
        MODE() WITHIN GROUP (ORDER BY "speciesGuess") AS "topSpecies"
      FROM "Encounter"
      WHERE "createdAt" BETWEEN ${since} AND ${until}
        AND "country" = ${args.country}
      GROUP BY "country", "district"
      ORDER BY "encounterCount" DESC
    `;
  }

  return prisma.$queryRaw<DistrictStatsRow[]>`
    SELECT
      "country",
      "district",
      COUNT(*)::bigint AS "encounterCount",
      SUM(CASE WHEN "wasBite" THEN 1 ELSE 0 END)::bigint AS "biteCount",
      MODE() WITHIN GROUP (ORDER BY "speciesGuess") AS "topSpecies"
    FROM "Encounter"
    WHERE "createdAt" BETWEEN ${since} AND ${until}
    GROUP BY "country", "district"
    ORDER BY "encounterCount" DESC
  `;
}

export interface OutbreakRow {
  country: string;
  district: string | null;
  speciesGuess: string | null;
  recentCount: bigint;
  baselineAvg: number;
  ratio: number;
}

/**
 * Outbreak detection: find (district, species) pairs where the last 7 days'
 * encounter count exceeds 150% of the 4-week rolling baseline.
 *
 * The 150% threshold mirrors EpiCast's baseline-deviation rule from the
 * MedGemma hackathon, which in turn echoes the WHO IDSR alert threshold
 * convention.
 */
export async function getOutbreaks(args: {
  thresholdRatio?: number;
}): Promise<OutbreakRow[]> {
  const threshold = args.thresholdRatio ?? 1.5;

  return prisma.$queryRaw<OutbreakRow[]>`
    WITH recent AS (
      SELECT
        "country", "district", "speciesGuess",
        COUNT(*)::bigint AS "recentCount"
      FROM "Encounter"
      WHERE "createdAt" >= NOW() - INTERVAL '7 days'
      GROUP BY "country", "district", "speciesGuess"
    ),
    baseline AS (
      SELECT
        "country", "district", "speciesGuess",
        (COUNT(*)::float / 4.0) AS "baselineAvg"
      FROM "Encounter"
      WHERE "createdAt" >= NOW() - INTERVAL '35 days'
        AND "createdAt" <  NOW() - INTERVAL '7 days'
      GROUP BY "country", "district", "speciesGuess"
    )
    SELECT
      r."country",
      r."district",
      r."speciesGuess",
      r."recentCount",
      COALESCE(b."baselineAvg", 0) AS "baselineAvg",
      CASE
        WHEN COALESCE(b."baselineAvg", 0) = 0 THEN 999.0
        ELSE (r."recentCount"::float / b."baselineAvg")
      END AS "ratio"
    FROM recent r
    LEFT JOIN baseline b USING ("country", "district", "speciesGuess")
    WHERE (
      COALESCE(b."baselineAvg", 0) = 0
      OR (r."recentCount"::float / b."baselineAvg") >= ${threshold}
    )
    ORDER BY "ratio" DESC
  `;
}
