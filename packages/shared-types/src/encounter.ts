import { z } from 'zod';
import { LanguageSchema } from './language.js';

/**
 * An Encounter is an anonymized record of a snake sighting or bite.
 * Uploaded from mobile to the backend when connectivity returns.
 *
 * Privacy: never includes user identity. GPS is truncated to district centroid.
 */
export const EncounterSchema = z.object({
  id: z.string().uuid(),
  deviceId: z.string().min(8), // anonymized device hash
  createdAt: z.string().datetime(),
  speciesGuess: z.string().nullable(), // scientific name
  confidence: z.number().min(0).max(1).nullable(),
  latitude: z.number().min(-90).max(90), // already-truncated district centroid
  longitude: z.number().min(-180).max(180),
  district: z.string().nullable(),
  country: z.string().length(2), // ISO 3166-1 alpha-2
  language: LanguageSchema,
  actionTaken: z
    .enum(['first_aid_given', 'clinic_referred', 'traditional_treatment', 'no_action', 'unknown'])
    .default('unknown'),
  wasBite: z.boolean(),
  metadata: z.record(z.unknown()).optional(),
});
export type Encounter = z.infer<typeof EncounterSchema>;

export const EncounterCreateSchema = EncounterSchema.omit({ id: true, createdAt: true });
export type EncounterCreate = z.infer<typeof EncounterCreateSchema>;

export const EncounterBatchSchema = z.object({
  encounters: z.array(EncounterCreateSchema).min(1).max(100),
});
export type EncounterBatch = z.infer<typeof EncounterBatchSchema>;
