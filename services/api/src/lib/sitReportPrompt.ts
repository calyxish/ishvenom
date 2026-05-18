/**
 * Situation-report prompt builder.
 *
 * Pure, testable, no I/O. Takes aggregated encounter data already
 * computed by getDistrictStats / getOutbreaks (services/api/src/lib/geo.ts)
 * and returns a single fully-rendered prompt string to hand to the
 * cloud inference worker.
 *
 * Privacy floor
 * -------------
 * MIN_COHORT is enforced here, not on the cloud side. If a scope has
 * fewer than MIN_COHORT encounters, we refuse to generate and the
 * backend returns HTTP 422 with error code "cohort_too_small". This
 * prevents fingerprinting an individual incident as a narrative.
 *
 * Style contract
 * --------------
 * The prompt instructs Gemma to emit:
 *   1. A short markdown narrative (~250-400 words) aimed at a district
 *      health officer.
 *   2. A trailing ```json``` fence with the structured summary that
 *      matches SitReportStructuredSchema in shared-types.
 *
 * The backend's response parser extracts the JSON block, validates it
 * with Zod, and stores both the markdown body and the structured
 * fields. If the JSON is malformed, the markdown is still saved and
 * `structured` is left null — the dashboard gracefully degrades.
 */
import type { SitReportScope } from '@ishvenom/shared-types';

export const MIN_COHORT = 5;

export interface DistrictAggregate {
  country: string;
  district: string | null;
  encounterCount: number;
  biteCount: number;
  topSpecies: Array<{ scientificName: string; count: number }>;
  baselineRatio: number; // 1.0 = matches 4-week rolling baseline
}

export interface SitReportPromptInput {
  scope: SitReportScope;
  districtRows: DistrictAggregate[];
  nationalTotals: {
    encounters: number;
    bites: number;
  };
}

export class CohortTooSmallError extends Error {
  public readonly cohortSize: number;
  constructor(cohortSize: number) {
    super(`Cohort of ${cohortSize} is below minimum ${MIN_COHORT}`);
    this.name = 'CohortTooSmallError';
    this.cohortSize = cohortSize;
  }
}

export function assertCohortLargeEnough(input: SitReportPromptInput): void {
  if (input.nationalTotals.encounters < MIN_COHORT) {
    throw new CohortTooSmallError(input.nationalTotals.encounters);
  }
}

export function formatWindow(scope: SitReportScope): string {
  const since = new Date(scope.since);
  const until = new Date(scope.until);
  const days = Math.round(
    (until.getTime() - since.getTime()) / (1000 * 60 * 60 * 24),
  );
  return `${since.toISOString().slice(0, 10)} to ${until
    .toISOString()
    .slice(0, 10)} (${days} days)`;
}

export function renderDistrictTable(rows: DistrictAggregate[]): string {
  if (rows.length === 0) return '_No district-level data for this window._';
  const header = '| District | Encounters | Bites | Top species | Baseline |';
  const divider = '|---|---|---|---|---|';
  const body = rows
    .slice(0, 20)
    .map((r) => {
      const top = r.topSpecies[0]?.scientificName ?? '—';
      const baseline = `${(r.baselineRatio * 100).toFixed(0)}%`;
      return `| ${r.district ?? '(unknown)'} | ${r.encounterCount} | ${r.biteCount} | ${top} | ${baseline} |`;
    })
    .join('\n');
  return [header, divider, body].join('\n');
}

export function buildSitReportPrompt(input: SitReportPromptInput): string {
  assertCohortLargeEnough(input);

  const header = [
    '<start_of_turn>user',
    'You are preparing a district-level snakebite situation report for a',
    'public-health officer in West Africa. Ground every statement in the',
    'numbers below. Do NOT invent cases, district names, or species you',
    'were not given. If the data is thin, say so plainly.',
    '',
    `Country: ${input.scope.country}`,
    `District scope: ${input.scope.district ?? 'national (all districts)'}`,
    `Window: ${formatWindow(input.scope)}`,
    `Total encounters in window: ${input.nationalTotals.encounters}`,
    `Total bites in window: ${input.nationalTotals.bites}`,
    '',
    'Per-district breakdown:',
    renderDistrictTable(input.districtRows),
    '',
    'Produce two sections, in this exact order:',
    '',
    '1. A markdown narrative (~300 words) covering:',
    '   - overall situation in the window,',
    '   - the 1-3 districts of greatest concern and why,',
    '   - the most commonly reported species and what that implies',
    '     for antivenom logistics,',
    '   - 2-3 concrete recommendations for the coming week.',
    '',
    '2. A fenced JSON block (```json ... ```) matching this shape:',
    '',
    '```json',
    '{',
    '  "totalEncounters": <int>,',
    '  "totalBites": <int>,',
    '  "hotspots": [',
    '    {',
    '      "district": "<name>",',
    '      "encounterCount": <int>,',
    '      "biteCount": <int>,',
    '      "topSpecies": "<scientific name or null>",',
    '      "baselineRatio": <number, 1.0 = normal>',
    '    }',
    '  ],',
    '  "recommendations": ["...", "..."]',
    '}',
    '```',
    '',
    'Do not add commentary after the JSON block.',
    '<end_of_turn>',
    '<start_of_turn>model',
    '',
  ].join('\n');

  return header;
}
