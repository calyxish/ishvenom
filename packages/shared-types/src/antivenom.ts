import { z } from 'zod';

export const AntivenomCenterSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  country: z.string().length(2),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  antivenomsStocked: z.array(z.string()),
  phone: z.string().nullable().optional(),
  lastVerified: z.string().datetime().nullable().optional(),
  distanceMeters: z.number().nonnegative().optional(),
});
export type AntivenomCenter = z.infer<typeof AntivenomCenterSchema>;
