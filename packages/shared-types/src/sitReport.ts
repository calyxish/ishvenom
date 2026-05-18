import { z } from 'zod';

/**
 * A SituationReport is a Gemma-4-31B-generated synthesis of encounters
 * over a specific window + district scope, for district health officers
 * and WHO NTD reviewers.
 *
 * Generation lifecycle:
 *   pending   — queued, RunPod worker has not replied yet
 *   generating — handler acknowledged, tokens are being produced
 *   ready     — markdown body + structured fields committed to DB
 *   failed    — cloud unreachable or model output failed schema check
 *
 * The structured `summary` / `hotspots` fields are populated from the
 * JSON tail of the Gemma response so the dashboard can render charts
 * without re-parsing the markdown.
 */
export const SitReportStatusSchema = z.enum([
  'pending',
  'generating',
  'ready',
  'failed',
]);
export type SitReportStatus = z.infer<typeof SitReportStatusSchema>;

export const SitReportScopeSchema = z.object({
  country: z.string().length(2),
  district: z.string().nullable(),
  since: z.string().datetime(),
  until: z.string().datetime(),
});
export type SitReportScope = z.infer<typeof SitReportScopeSchema>;

export const SitReportHotspotSchema = z.object({
  district: z.string(),
  encounterCount: z.number().int().nonnegative(),
  biteCount: z.number().int().nonnegative(),
  topSpecies: z.string().nullable(),
  baselineRatio: z.number().nonnegative(),
});
export type SitReportHotspot = z.infer<typeof SitReportHotspotSchema>;

export const SitReportStructuredSchema = z.object({
  totalEncounters: z.number().int().nonnegative(),
  totalBites: z.number().int().nonnegative(),
  hotspots: z.array(SitReportHotspotSchema).max(20),
  recommendations: z.array(z.string()).max(10),
});
export type SitReportStructured = z.infer<typeof SitReportStructuredSchema>;

export const SitReportSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdByUserId: z.string().uuid(),
  status: SitReportStatusSchema,
  scope: SitReportScopeSchema,
  model: z.string(), // e.g. "google/gemma-4-31b-it"
  markdown: z.string().nullable(),
  structured: SitReportStructuredSchema.nullable(),
  error: z.string().nullable(),
  promptTokens: z.number().int().nonnegative().nullable(),
  completionTokens: z.number().int().nonnegative().nullable(),
  latencyMs: z.number().int().nonnegative().nullable(),
});
export type SitReport = z.infer<typeof SitReportSchema>;

export const SitReportCreateSchema = z.object({
  scope: SitReportScopeSchema,
  model: z.string().optional(),
});
export type SitReportCreate = z.infer<typeof SitReportCreateSchema>;

export const SitReportListResponseSchema = z.object({
  reports: z.array(SitReportSchema),
  total: z.number().int().nonnegative(),
});
export type SitReportListResponse = z.infer<typeof SitReportListResponseSchema>;
