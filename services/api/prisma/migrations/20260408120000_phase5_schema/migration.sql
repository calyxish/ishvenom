-- IshVenom — Phase 5 schema migration
--
-- Prisma's Unsupported("geometry") cannot be materialised by `prisma migrate`
-- itself, so this migration file is hand-written SQL that the Prisma CLI
-- runs verbatim. `prisma db pull` will NOT reflect changes made here —
-- schema.prisma must be kept in sync by hand.
--
-- Run order:
--   1. Create the postgis extension.
--   2. Create the tables defined in schema.prisma (users, sessions, species,
--      antivenom centers, encounters).
--   3. Create geometry columns on antivenom_centers and encounters.
--   4. Create spatial indexes (GIST) for the ST_DWithin queries.
--   5. Create supporting btree indexes for the stats aggregations.

CREATE EXTENSION IF NOT EXISTS postgis;

-- ─── Users / sessions ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "User" (
    "id"           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    "email"        text         UNIQUE NOT NULL,
    "passwordHash" text         NOT NULL,
    "role"         text         NOT NULL DEFAULT 'HEALTH_OFFICER',
    "createdAt"    timestamptz  NOT NULL DEFAULT NOW(),
    "updatedAt"    timestamptz  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Session" (
    "id"        text        PRIMARY KEY,
    "userId"    uuid        NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "expiresAt" timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");

-- ─── Species catalogue ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Species" (
    "id"             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    "scientificName" text         UNIQUE NOT NULL,
    "commonNames"    jsonb        NOT NULL,
    "venomous"       text         NOT NULL,
    "antivenomName"  text,
    "description"    jsonb,
    "imageUrl"       text,
    "createdAt"      timestamptz  NOT NULL DEFAULT NOW(),
    "updatedAt"      timestamptz  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "Species_scientificName_idx"
    ON "Species"("scientificName");

-- ─── Antivenom centers (PostGIS Point) ───────────────────────────────
CREATE TABLE IF NOT EXISTS "AntivenomCenter" (
    "id"                uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
    "name"              text                    NOT NULL,
    "country"           char(2)                 NOT NULL,
    "location"          geometry(Point, 4326)   NOT NULL,
    "antivenomsStocked" jsonb                   NOT NULL,
    "phone"             text,
    "lastVerified"      timestamptz,
    "createdAt"         timestamptz             NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "AntivenomCenter_country_idx"
    ON "AntivenomCenter"("country");
CREATE INDEX IF NOT EXISTS "AntivenomCenter_location_gist"
    ON "AntivenomCenter" USING GIST ("location");

-- ─── Encounters (PostGIS Point) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Encounter" (
    "id"           uuid                   PRIMARY KEY DEFAULT gen_random_uuid(),
    "deviceId"     text                   NOT NULL,
    "createdAt"    timestamptz            NOT NULL DEFAULT NOW(),
    "speciesGuess" text,
    "confidence"   double precision,
    "location"     geometry(Point, 4326)  NOT NULL,
    "district"     text,
    "country"      char(2)                NOT NULL,
    "language"     char(2)                NOT NULL,
    "actionTaken"  text                   NOT NULL,
    "wasBite"      boolean                NOT NULL,
    "metadata"     jsonb
);
CREATE INDEX IF NOT EXISTS "Encounter_createdAt_idx"
    ON "Encounter"("createdAt");
CREATE INDEX IF NOT EXISTS "Encounter_country_district_idx"
    ON "Encounter"("country", "district");
CREATE INDEX IF NOT EXISTS "Encounter_speciesGuess_idx"
    ON "Encounter"("speciesGuess");
CREATE INDEX IF NOT EXISTS "Encounter_location_gist"
    ON "Encounter" USING GIST ("location");

-- ─── updatedAt triggers ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION "set_updated_at"()
RETURNS trigger AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "user_set_updated_at" ON "User";
CREATE TRIGGER "user_set_updated_at"
    BEFORE UPDATE ON "User"
    FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();

DROP TRIGGER IF EXISTS "species_set_updated_at" ON "Species";
CREATE TRIGGER "species_set_updated_at"
    BEFORE UPDATE ON "Species"
    FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
