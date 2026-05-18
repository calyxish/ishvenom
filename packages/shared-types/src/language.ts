import { z } from 'zod';

/**
 * IshVenom supports 6 Tier-1 languages covering ~700M Africans
 * across the three highest snakebite-mortality regions.
 */
export const LanguageSchema = z.enum(['en', 'fr', 'ar', 'ha', 'sw', 'tw']);
export type Language = z.infer<typeof LanguageSchema>;

export const LANGUAGE_METADATA: Record<
  Language,
  { name: string; nativeName: string; rtl: boolean; regions: readonly string[] }
> = {
  en: { name: 'English', nativeName: 'English', rtl: false, regions: ['Anglophone Africa'] },
  fr: {
    name: 'French',
    nativeName: 'Français',
    rtl: false,
    regions: ['Francophone West/Central Africa'],
  },
  ar: {
    name: 'Arabic',
    nativeName: 'العربية',
    rtl: true,
    regions: ['Sudan', 'Chad', 'Mauritania', 'Egypt', 'Sahel'],
  },
  ha: {
    name: 'Hausa',
    nativeName: 'Hausa',
    rtl: false,
    regions: ['Northern Nigeria', 'Niger', 'Cameroon'],
  },
  sw: {
    name: 'Swahili',
    nativeName: 'Kiswahili',
    rtl: false,
    regions: ['Kenya', 'Tanzania', 'Uganda', 'DRC'],
  },
  tw: { name: 'Twi', nativeName: 'Twi', rtl: false, regions: ['Ghana'] },
};
