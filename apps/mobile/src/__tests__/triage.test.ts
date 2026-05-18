import { runTriage, type TriageDeps } from '../lib/triage';
import type { StoredSpecies, QueuedEncounter } from '../lib/db';

const species: StoredSpecies = {
  id: '00000000-0000-4000-8000-000000000001',
  scientificName: 'Bitis arietans',
  commonNames: { en: 'Puff adder', tw: 'Ɔwɔ kɛseɛ', fr: 'Vipère heurtante' },
  venomous: 'deadly',
  antivenomName: 'SAIMR Polyvalent',
};

function makeDeps(overrides: Partial<TriageDeps> = {}): TriageDeps {
  return {
    classify: jest.fn(async () => [
      { scientificName: 'Bitis arietans', confidence: 0.87 },
      { scientificName: 'Bitis gabonica', confidence: 0.08 },
      { scientificName: '', confidence: 0.02 },
    ]),
    getSpecies: jest.fn(async (name: string) =>
      name === 'Bitis arietans' ? species : null,
    ),
    getTriage: jest.fn(() => ({
      summary: 'Bite from a venomous snake.',
      immediate: [
        { id: 'i1', category: 'immediate_response', severity: 'critical', title: 'Stay calm', body: 'Keep the patient still.' },
      ],
      doNot: [
        { id: 'd1', category: 'do_not', severity: 'critical', title: 'No tourniquet', body: 'Do not apply a tourniquet.' },
      ],
      transport: [],
      language: 'en',
      fellBackTo: null,
      verificationStatus: 'authored_by_project_lead_needs_clinical_review',
    })),
    generate: jest.fn(async ({ summary, goldSteps }) => ({
      summary,
      steps: goldSteps
        .filter((s) => s.category !== 'do_not')
        .map((s) => ({ title: s.title, body: s.body })),
      doNot: goldSteps.filter((s) => s.category === 'do_not').map((s) => s.body),
      latencyMs: 42,
      fallback: false,
    })),
    enqueue: jest.fn(async (_e: Omit<QueuedEncounter, 'syncedAt'>) => {}),
    now: () => new Date('2026-04-08T12:00:00.000Z'),
    newId: () => '11111111-1111-4111-8111-111111111111',
    ...overrides,
  };
}

test('happy path: identified species → first aid → encounter enqueued', async () => {
  const deps = makeDeps();
  const out = await runTriage(
    {
      imagePath: 'file:///tmp/snake.jpg',
      language: 'en',
      wasBite: true,
      location: { latitude: 5.6042, longitude: -0.1872 },
      country: 'GH',
      district: 'Greater Accra',
      deviceId: 'device-hash-abcdefg',
    },
    deps,
  );
  expect(out.species?.scientificName).toBe('Bitis arietans');
  expect(out.generation.fallback).toBe(false);
  expect(out.generation.steps.length).toBeGreaterThan(0);
  expect(deps.enqueue).toHaveBeenCalledTimes(1);
  expect(out.encounter.speciesGuess).toBe('Bitis arietans');
  expect(out.encounter.wasBite).toBe(true);
});

test('unknown species is treated as potentially deadly', async () => {
  const deps = makeDeps({
    classify: async () => [{ scientificName: '', confidence: 0.3 }],
  });
  const out = await runTriage(
    {
      imagePath: 'x',
      language: 'en',
      wasBite: true,
      location: null,
      country: 'GH',
      district: null,
      deviceId: 'd',
    },
    deps,
  );
  expect(out.species).toBeNull();
  expect(out.encounter.speciesGuess).toBeNull();
  // Conservative default 'deadly' should have been passed to getTriage.
  expect(deps.getTriage).toHaveBeenCalledWith(
    expect.objectContaining({ venomous: 'deadly' }),
  );
});

test('generation failure falls back to verified gold steps', async () => {
  const deps = makeDeps({
    generate: jest.fn(async () => {
      throw new Error('gemma crashed');
    }),
  });
  const out = await runTriage(
    {
      imagePath: 'x',
      language: 'en',
      wasBite: true,
      location: null,
      country: 'GH',
      district: null,
      deviceId: 'd',
    },
    deps,
  );
  expect(out.generation.fallback).toBe(true);
  expect(out.generation.steps.length).toBeGreaterThan(0);
  expect(deps.enqueue).toHaveBeenCalled();
});

test('no location produces 0,0 coordinates in the encounter', async () => {
  const deps = makeDeps();
  const out = await runTriage(
    {
      imagePath: 'x',
      language: 'en',
      wasBite: false,
      location: null,
      country: 'GH',
      district: null,
      deviceId: 'd',
    },
    deps,
  );
  expect(out.encounter.latitude).toBe(0);
  expect(out.encounter.longitude).toBe(0);
});
