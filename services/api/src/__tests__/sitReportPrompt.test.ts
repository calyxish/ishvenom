import {
  buildSitReportPrompt,
  assertCohortLargeEnough,
  CohortTooSmallError,
  formatWindow,
  renderDistrictTable,
  MIN_COHORT,
  type SitReportPromptInput,
} from '../lib/sitReportPrompt.js';

function mkInput(overrides: Partial<SitReportPromptInput> = {}): SitReportPromptInput {
  return {
    scope: {
      country: 'GH',
      district: null,
      since: '2026-03-01T00:00:00.000Z',
      until: '2026-03-31T00:00:00.000Z',
    },
    districtRows: [
      {
        country: 'GH',
        district: 'Upper East',
        encounterCount: 42,
        biteCount: 18,
        topSpecies: [{ scientificName: 'Echis ocellatus', count: 12 }],
        baselineRatio: 1.8,
      },
      {
        country: 'GH',
        district: 'Northern',
        encounterCount: 31,
        biteCount: 9,
        topSpecies: [{ scientificName: 'Naja nigricollis', count: 7 }],
        baselineRatio: 1.2,
      },
    ],
    nationalTotals: { encounters: 73, bites: 27 },
    ...overrides,
  };
}

describe('assertCohortLargeEnough', () => {
  test('allows cohorts at or above the floor', () => {
    expect(() =>
      assertCohortLargeEnough(mkInput({ nationalTotals: { encounters: MIN_COHORT, bites: 1 } })),
    ).not.toThrow();
  });

  test('throws CohortTooSmallError below the floor', () => {
    expect(() =>
      assertCohortLargeEnough(mkInput({ nationalTotals: { encounters: 2, bites: 1 } })),
    ).toThrow(CohortTooSmallError);
  });

  test('thrown error exposes the cohort size', () => {
    try {
      assertCohortLargeEnough(mkInput({ nationalTotals: { encounters: 0, bites: 0 } }));
      fail('should have thrown');
    } catch (err) {
      expect((err as CohortTooSmallError).cohortSize).toBe(0);
    }
  });
});

describe('formatWindow', () => {
  test('renders ISO dates and day count', () => {
    const s = formatWindow({
      country: 'GH',
      district: null,
      since: '2026-03-01T00:00:00.000Z',
      until: '2026-03-31T00:00:00.000Z',
    });
    expect(s).toContain('2026-03-01');
    expect(s).toContain('2026-03-31');
    expect(s).toContain('30 days');
  });
});

describe('renderDistrictTable', () => {
  test('returns a fallback when there are no rows', () => {
    expect(renderDistrictTable([])).toMatch(/no district-level data/i);
  });

  test('renders a markdown table with the expected columns', () => {
    const tbl = renderDistrictTable([
      {
        country: 'GH',
        district: 'Upper East',
        encounterCount: 42,
        biteCount: 18,
        topSpecies: [{ scientificName: 'Echis ocellatus', count: 12 }],
        baselineRatio: 1.8,
      },
    ]);
    expect(tbl).toContain('| District | Encounters | Bites | Top species | Baseline |');
    expect(tbl).toContain('Upper East');
    expect(tbl).toContain('Echis ocellatus');
    expect(tbl).toContain('180%');
  });

  test('caps at 20 rows', () => {
    const many = Array.from({ length: 50 }, (_, i) => ({
      country: 'GH',
      district: `D${i}`,
      encounterCount: 10,
      biteCount: 3,
      topSpecies: [],
      baselineRatio: 1,
    }));
    const rendered = renderDistrictTable(many);
    // header + divider + 20 rows = 22 lines
    expect(rendered.split('\n')).toHaveLength(22);
  });
});

describe('buildSitReportPrompt', () => {
  test('refuses small cohorts (privacy floor)', () => {
    expect(() =>
      buildSitReportPrompt(
        mkInput({ nationalTotals: { encounters: 1, bites: 0 } }),
      ),
    ).toThrow(CohortTooSmallError);
  });

  test('includes country, scope window, and district table', () => {
    const p = buildSitReportPrompt(mkInput());
    expect(p).toContain('Country: GH');
    expect(p).toContain('Total encounters in window: 73');
    expect(p).toContain('Upper East');
    expect(p).toContain('```json');
  });

  test('ends with the model-turn marker ready for vLLM', () => {
    const p = buildSitReportPrompt(mkInput());
    expect(p.trimEnd().endsWith('<start_of_turn>model')).toBe(true);
  });
});
