/**
 * Triage orchestrator — the single high-level call the Identify screen makes.
 *
 * Flow:
 *   1. Caller hands us a photo path + user context (language, bite? location).
 *   2. We ensure the vision model is loaded, classify the image, and take top-3.
 *   3. We look up the top species in local SQLite for venomousness + common name.
 *   4. We pull the gold first-aid steps for the user's language (with fallback).
 *   5. We ask Gemma to ADAPT the pre-written steps into the target language.
 *      (If Gemma fails or the output is malformed, we return the raw gold steps.)
 *   6. We build a QueuedEncounter and enqueue it. Sync happens separately.
 *
 * This module is pure glue — it takes the libs as injectable dependencies so
 * tests can drive it end-to-end without touching the filesystem or network.
 */
import { randomUUID } from 'expo-crypto';
import type { Language } from '@ishvenom/shared-types';
import type { LatLng } from './geo';
import type { QueuedEncounter, StoredSpecies } from './db';
import type { VisionPrediction } from './vision';
import type { FirstAidGeneration } from './gemma';
import type { TriageSelection } from './firstAid';

export interface TriageInput {
  imagePath: string;
  language: Language;
  wasBite: boolean;
  location: LatLng | null;
  country: string;
  district: string | null;
  deviceId: string;
}

export interface TriageOutput {
  species: StoredSpecies | null;
  topPredictions: VisionPrediction[];
  selection: TriageSelection;
  generation: FirstAidGeneration;
  encounter: QueuedEncounter;
  wallClockMs: number;
}

export interface TriageDeps {
  classify: (imagePath: string) => Promise<VisionPrediction[]>;
  getSpecies: (scientificName: string) => Promise<StoredSpecies | null>;
  getTriage: (params: {
    language: Language;
    wasBite: boolean;
    venomous: StoredSpecies['venomous'];
  }) => TriageSelection;
  generate: (params: {
    scientificName: string;
    commonName: string;
    venomous: StoredSpecies['venomous'];
    language: Language;
    goldSteps: Array<{
      title: string;
      body: string;
      severity: string;
      category: string;
    }>;
    summary: string;
  }) => Promise<FirstAidGeneration>;
  enqueue: (e: Omit<QueuedEncounter, 'syncedAt'>) => Promise<void>;
  /**
   * Optional — copy the camera temp file to permanent storage and return the
   * permanent URI. When omitted (e.g. in unit tests), imagePath stays null.
   */
  savePhoto?: (sourceUri: string, encounterId: string) => Promise<string>;
  /**
   * Optional — compute the SHA-256 hex digest of a local file URI.
   * When omitted, imageHash stays null.
   */
  hashPhoto?: (fileUri: string) => Promise<string>;
  now?: () => Date;
  newId?: () => string;
}

export async function runTriage(
  input: TriageInput,
  deps: TriageDeps,
): Promise<TriageOutput> {
  const started = Date.now();
  const now = deps.now ? deps.now() : new Date();
  const id = deps.newId ? deps.newId() : randomUUID();

  const topPredictions = await deps.classify(input.imagePath);
  const best = topPredictions[0];

  let species: StoredSpecies | null = null;
  if (best && best.scientificName !== '') {
    species = await deps.getSpecies(best.scientificName);
  }

  // Fall back to a conservative default: unknown species is treated as
  // potentially deadly so we don't under-warn the user.
  const venomous: StoredSpecies['venomous'] = species?.venomous ?? 'deadly';

  const selection = deps.getTriage({
    language: input.language,
    wasBite: input.wasBite,
    venomous,
  });

  const commonName =
    species?.commonNames[input.language] ??
    species?.commonNames.en ??
    species?.scientificName ??
    'Unknown snake';

  const goldSteps = [
    ...selection.immediate.map((s) => ({
      title: s.title,
      body: s.body,
      severity: s.severity,
      category: s.category,
    })),
    ...selection.doNot.map((s) => ({
      title: s.title,
      body: s.body,
      severity: s.severity,
      category: s.category,
    })),
    ...selection.transport.map((s) => ({
      title: s.title,
      body: s.body,
      severity: s.severity,
      category: s.category,
    })),
  ];

  let generation: FirstAidGeneration;
  try {
    generation = await deps.generate({
      scientificName: species?.scientificName ?? 'Unknown',
      commonName,
      venomous,
      language: input.language,
      goldSteps,
      summary: selection.summary,
    });
  } catch {
    // Hard fallback: never leave the user without instructions.
    generation = {
      summary: selection.summary,
      steps: selection.immediate.map((s) => ({ title: s.title, body: s.body })),
      doNot: selection.doNot.map((s) => s.body),
      latencyMs: 0,
      fallback: true,
    };
  }

  // Copy photo to permanent storage and compute its hash.
  // Both ops are best-effort: if they fail (e.g. disk full) we still
  // complete the triage — the user must not lose first-aid results over
  // a photo error.
  let imagePath: string | null = null;
  let imageHash: string | null = null;
  if (deps.savePhoto) {
    try {
      imagePath = await deps.savePhoto(input.imagePath, id);
      if (deps.hashPhoto && imagePath) {
        imageHash = await deps.hashPhoto(imagePath);
      }
    } catch {
      // Silent — imagePath and imageHash remain null
    }
  }

  const loc = input.location ?? { latitude: 0, longitude: 0 };
  const encounter: QueuedEncounter = {
    id,
    createdAt: now.toISOString(),
    deviceId: input.deviceId,
    speciesGuess: species?.scientificName ?? null,
    confidence: best?.confidence ?? null,
    latitude: loc.latitude,
    longitude: loc.longitude,
    district: input.district,
    country: input.country,
    language: input.language,
    actionTaken: input.wasBite ? 'first_aid_given' : 'no_action',
    wasBite: input.wasBite,
    imagePath,
    imageHash,
    syncedAt: null,
    metadata: {
      fellBackTo: selection.fellBackTo,
      verificationStatus: selection.verificationStatus,
      generationFallback: generation.fallback,
    },
  };
  await deps.enqueue(encounter);

  return {
    species,
    topPredictions,
    selection,
    generation,
    encounter,
    wallClockMs: Date.now() - started,
  };
}
