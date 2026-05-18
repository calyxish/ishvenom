import {
  loadCorpus,
  getTriageInstructions,
  summaryFor,
  allSupportedLanguages,
  verificationStatusOf,
} from '../lib/firstAid';

describe('loadCorpus', () => {
  test('loads each of the 6 supported languages', () => {
    const langs = allSupportedLanguages();
    expect(langs.sort()).toEqual(['ar', 'en', 'fr', 'ha', 'sw', 'tw']);
    for (const l of langs) {
      const { bundle } = loadCorpus(l);
      expect(bundle.instructions.length).toBe(30);
    }
  });

  test('falls back to English when bundle is a stub', () => {
    for (const l of allSupportedLanguages()) {
      const status = verificationStatusOf(l);
      const { fellBackTo, bundle } = loadCorpus(l);
      if (status === 'stub_needs_full_human_translation') {
        expect(fellBackTo).toBe('en');
        expect(bundle.language).toBe('en');
      } else {
        expect(fellBackTo).toBeNull();
      }
    }
  });
});

describe('getTriageInstructions', () => {
  test('bite from a deadly species returns non-empty immediate + do_not', () => {
    const sel = getTriageInstructions({
      language: 'en',
      wasBite: true,
      venomous: 'deadly',
    });
    expect(sel.immediate.length).toBeGreaterThan(0);
    expect(sel.doNot.length).toBeGreaterThan(0);
    expect(sel.verificationStatus).not.toBe('stub_needs_full_human_translation');
  });

  test('non-bite sighting produces a calmer summary', () => {
    const sel = getTriageInstructions({
      language: 'en',
      wasBite: false,
      venomous: 'non_venomous',
    });
    expect(sel.summary.toLowerCase()).toContain('sight');
  });

  test('never returns more than 5 immediate steps and 5 do_not steps', () => {
    const sel = getTriageInstructions({
      language: 'en',
      wasBite: true,
      venomous: 'deadly',
    });
    expect(sel.immediate.length).toBeLessThanOrEqual(5);
    expect(sel.doNot.length).toBeLessThanOrEqual(5);
  });
});

describe('summaryFor', () => {
  test('produces distinct summaries for bite vs sighting', () => {
    const bite = summaryFor({ wasBite: true, venomous: 'deadly' });
    const sighting = summaryFor({ wasBite: false, venomous: 'deadly' });
    expect(bite).not.toBe(sighting);
  });
});
