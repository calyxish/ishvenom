/**
 * First-aid corpus loader + retrieval.
 *
 * Loads the 6-language gold instruction bundles (assets/firstaid/*.json)
 * that were authored in Phase 2. Each bundle is one JSON document with
 * exactly 30 instructions spanning six categories:
 *   prevention | identification | immediate_response | do_not | transport | special_case
 *
 * Public API:
 *   - loadCorpus(language)           — returns the whole bundle, with fallback to English
 *                                      for languages whose verification_status is still "stub".
 *   - getTriageInstructions(...)     — picks the minimal set of steps to show in an
 *                                      emergency, ordered by severity + category.
 *   - summaryFor(...)                — one-sentence summary for the species card.
 */
import type { Language } from '@ishvenom/shared-types';

import en from '../../assets/firstaid/instructions.en.json';
import fr from '../../assets/firstaid/instructions.fr.json';
import ar from '../../assets/firstaid/instructions.ar.json';
import ha from '../../assets/firstaid/instructions.ha.json';
import sw from '../../assets/firstaid/instructions.sw.json';
import tw from '../../assets/firstaid/instructions.tw.json';

export type InstructionCategory =
  | 'prevention'
  | 'identification'
  | 'immediate_response'
  | 'do_not'
  | 'transport'
  | 'special_case';

export type InstructionSeverity = 'general' | 'moderate' | 'severe' | 'critical';

export interface Instruction {
  id: string;
  category: InstructionCategory;
  severity: InstructionSeverity;
  title: string;
  body: string;
}

export interface InstructionBundle {
  language: Language;
  version: string;
  source?: string;
  verification_status:
    | 'stub_needs_full_human_translation'
    | 'draft_needs_native_speaker_and_clinical_review'
    | 'authored_by_project_lead_needs_clinical_review'
    | 'native_speaker_reviewed_needs_clinical_review'
    | 'fully_verified';
  medical_reviewer?: string | null;
  last_reviewed_at?: string | null;
  instructions: Instruction[];
}

const BUNDLES: Record<Language, InstructionBundle> = {
  en: en as unknown as InstructionBundle,
  fr: fr as unknown as InstructionBundle,
  ar: ar as unknown as InstructionBundle,
  ha: ha as unknown as InstructionBundle,
  sw: sw as unknown as InstructionBundle,
  tw: tw as unknown as InstructionBundle,
};

/**
 * If a non-English bundle is still a stub, we fall back to English so
 * the user gets medically correct content instead of placeholder text.
 * The UI surfaces this fallback with a banner so nothing is hidden.
 */
export function loadCorpus(language: Language): {
  bundle: InstructionBundle;
  fellBackTo: Language | null;
} {
  const primary = BUNDLES[language];
  if (
    !primary ||
    primary.verification_status === 'stub_needs_full_human_translation'
  ) {
    return { bundle: BUNDLES.en, fellBackTo: 'en' };
  }
  return { bundle: primary, fellBackTo: null };
}

const SEVERITY_ORDER: Record<InstructionSeverity, number> = {
  critical: 0,
  severe: 1,
  moderate: 2,
  general: 3,
};

const CATEGORY_ORDER: Record<InstructionCategory, number> = {
  immediate_response: 0,
  do_not: 1,
  transport: 2,
  identification: 3,
  special_case: 4,
  prevention: 5,
};

export interface TriageSelection {
  summary: string;
  immediate: Instruction[];
  doNot: Instruction[];
  transport: Instruction[];
  language: Language;
  fellBackTo: Language | null;
  verificationStatus: InstructionBundle['verification_status'];
}

export function getTriageInstructions(params: {
  language: Language;
  wasBite: boolean;
  venomous: 'non_venomous' | 'mildly_venomous' | 'deadly';
}): TriageSelection {
  const { bundle, fellBackTo } = loadCorpus(params.language);
  const all = bundle.instructions;

  const targetSeverity: InstructionSeverity = params.wasBite
    ? params.venomous === 'deadly'
      ? 'critical'
      : params.venomous === 'mildly_venomous'
        ? 'severe'
        : 'moderate'
    : 'general';

  const sorted = [...all].sort((a, b) => {
    const sa = SEVERITY_ORDER[a.severity];
    const sb = SEVERITY_ORDER[b.severity];
    if (sa !== sb) return sa - sb;
    return CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
  });

  const pickByCategory = (cat: InstructionCategory, n: number) =>
    sorted
      .filter((i) => i.category === cat)
      .filter(
        (i) =>
          SEVERITY_ORDER[i.severity] <= SEVERITY_ORDER[targetSeverity] + 1,
      )
      .slice(0, n);

  return {
    summary: summaryFor(params),
    immediate: pickByCategory('immediate_response', 5),
    doNot: pickByCategory('do_not', 5),
    transport: pickByCategory('transport', 3),
    language: params.language,
    fellBackTo,
    verificationStatus: bundle.verification_status,
  };
}

export function summaryFor(params: {
  wasBite: boolean;
  venomous: 'non_venomous' | 'mildly_venomous' | 'deadly';
}): string {
  if (!params.wasBite) {
    return params.venomous === 'deadly'
      ? 'Venomous snake sighted. Keep distance and move calmly away.'
      : 'Snake sighted. Keep distance and do not attempt to catch or kill it.';
  }
  if (params.venomous === 'deadly') {
    return 'Bite from a venomous snake. Treat as a medical emergency. Get to a health facility with antivenom immediately.';
  }
  if (params.venomous === 'mildly_venomous') {
    return 'Bite from a mildly venomous snake. Watch for symptoms and seek medical review within hours.';
  }
  return 'Bite from a non-venomous snake. Clean the wound and watch for infection.';
}

export function allSupportedLanguages(): Language[] {
  return (Object.keys(BUNDLES) as Language[]).sort();
}

export function verificationStatusOf(language: Language): InstructionBundle['verification_status'] {
  return BUNDLES[language]?.verification_status ?? 'stub_needs_full_human_translation';
}
