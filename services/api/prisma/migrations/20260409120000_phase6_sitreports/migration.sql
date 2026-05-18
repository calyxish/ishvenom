-- Phase 6 — situation reports.
--
-- A sit_report row is created as soon as a health officer clicks
-- "Generate" on the dashboard. The RunPod call runs asynchronously
-- and a second UPDATE flips the row from pending → ready | failed.
--
-- We keep the row even on failure so:
--   1. the dashboard has a permanent audit trail of what was requested,
--   2. we can retry by re-POSTing with the same scope, and
--   3. billing reconciliation is possible against RunPod's own logs.
--
-- `markdown` and `structured` are both nullable because neither is
-- populated until the worker returns.

CREATE TABLE IF NOT EXISTS "sit_reports" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "created_by_user_id" UUID NOT NULL
        REFERENCES "users"("id") ON DELETE RESTRICT,

    -- Scope fields (flattened for efficient filtering).
    "scope_country" CHAR(2) NOT NULL,
    "scope_district" TEXT,
    "scope_since" TIMESTAMPTZ NOT NULL,
    "scope_until" TIMESTAMPTZ NOT NULL,

    "status" TEXT NOT NULL
        CHECK ("status" IN ('pending', 'generating', 'ready', 'failed')),
    "model" TEXT NOT NULL,

    "markdown" TEXT,
    "structured" JSONB,
    "error" TEXT,

    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "latency_ms" INTEGER,

    CONSTRAINT "sit_reports_valid_window"
        CHECK ("scope_until" > "scope_since")
);

CREATE INDEX IF NOT EXISTS "idx_sit_reports_created_at"
    ON "sit_reports" ("created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_sit_reports_country_district"
    ON "sit_reports" ("scope_country", "scope_district");

CREATE INDEX IF NOT EXISTS "idx_sit_reports_status"
    ON "sit_reports" ("status")
    WHERE "status" IN ('pending', 'generating');

-- Trigger to keep updated_at honest.
CREATE OR REPLACE FUNCTION "sit_reports_touch_updated_at"()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updated_at" := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_sit_reports_touch" ON "sit_reports";
CREATE TRIGGER "trg_sit_reports_touch"
    BEFORE UPDATE ON "sit_reports"
    FOR EACH ROW
    EXECUTE FUNCTION "sit_reports_touch_updated_at"();
