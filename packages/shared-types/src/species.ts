import { z } from 'zod';
import { LanguageSchema } from './language.js';

export const VenomousnessSchema = z.enum(['non_venomous', 'mildly_venomous', 'deadly']);
export type Venomousness = z.infer<typeof VenomousnessSchema>;

export const SpeciesSchema = z.object({
  id: z.string().uuid(),
  scientificName: z.string().min(1),
  commonNames: z.record(LanguageSchema, z.string()),
  venomous: VenomousnessSchema,
  antivenomName: z.string().nullable(),
  description: z.record(LanguageSchema, z.string()).optional(),
  imageUrl: z.string().url().optional(),
});
export type Species = z.infer<typeof SpeciesSchema>;

/**
 * The 20 most medically significant snake species in sub-Saharan Africa
 * (scientific names only — full catalogue is loaded from the database).
 */
export const PRIORITY_SPECIES: readonly string[] = [
  'Bitis arietans', // Puff adder
  'Bitis gabonica', // Gaboon viper
  'Echis ocellatus', // West African carpet viper
  'Echis pyramidum', // Saw-scaled viper
  'Naja nigricollis', // Black-necked spitting cobra
  'Naja haje', // Egyptian cobra
  'Naja melanoleuca', // Forest cobra
  'Naja mossambica', // Mozambique spitting cobra
  'Dendroaspis polylepis', // Black mamba
  'Dendroaspis viridis', // Western green mamba
  'Dendroaspis jamesoni', // Jameson's mamba
  'Dendroaspis angusticeps', // Eastern green mamba
  'Dispholidus typus', // Boomslang
  'Atractaspis engaddensis', // Burrowing asp
  'Causus rhombeatus', // Rhombic night adder
  'Bitis rhinoceros', // Rhinoceros viper
  'Atheris squamigera', // Variable bush viper
  'Thelotornis capensis', // Twig snake
  'Hemachatus haemachatus', // Rinkhals
  'Naja nivea', // Cape cobra
] as const;
