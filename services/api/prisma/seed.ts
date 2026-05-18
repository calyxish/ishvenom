/**
 * Seed script — realistic demo data for Kaggle judges / hackathon demo.
 * Run with:  npx tsx prisma/seed.ts
 *
 * Populates:
 *   - 1 demo user account (for judges / reviewers)
 *   - 12 African snake species (mix of deadly / mildly venomous / non-venomous)
 *   - 8 antivenom centres across West + East Africa
 *   - ~400 encounters spread across the last 90 days in GH, NG, KE, TZ
 */

import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';

const prisma = new PrismaClient();

// ─── species ─────────────────────────────────────────────────────────────────

const SPECIES = [
  {
    scientificName: 'Naja melanoleuca',
    commonNames: { en: 'Forest cobra', fr: 'Cobra forestier', sw: 'Kobra ya msitu' },
    venomous: 'deadly',
    antivenomName: 'Fav-Afrique',
    description: {
      en: 'Large, aggressive cobra found in West and Central African forests. Highly neurotoxic venom.',
    },
  },
  {
    scientificName: 'Bitis arietans',
    commonNames: { en: 'Puff adder', fr: 'Vipère heurtante', ha: 'Gizo-gizo', sw: 'Kipindi' },
    venomous: 'deadly',
    antivenomName: 'Fav-Afrique',
    description: {
      en: 'Responsible for more snakebite fatalities in Africa than any other species. Cytotoxic venom causing severe tissue destruction.',
    },
  },
  {
    scientificName: 'Dendroaspis polylepis',
    commonNames: { en: 'Black mamba', fr: 'Mamba noir', sw: 'Mamba mweusi' },
    venomous: 'deadly',
    antivenomName: 'SAIMR Polyvalent Antivenom',
    description: {
      en: 'Africa\'s longest venomous snake and fastest land snake. Rapidly fatal without antivenom.',
    },
  },
  {
    scientificName: 'Echis ocellatus',
    commonNames: { en: 'West African carpet viper', fr: 'Vipère des pyramides', ha: 'Echis' },
    venomous: 'deadly',
    antivenomName: 'EchiTAb-Plus-ICP',
    description: {
      en: 'Causes the majority of snakebite deaths and disability in West Africa\'s savannah belt.',
    },
  },
  {
    scientificName: 'Naja nigricollis',
    commonNames: { en: 'Spitting cobra', fr: 'Cobra cracheur', ha: 'Maciji mai tofi' },
    venomous: 'deadly',
    antivenomName: 'Fav-Afrique',
    description: {
      en: 'Can spit venom accurately up to 2.5 m, targeting eyes. Causes blindness if not washed immediately.',
    },
  },
  {
    scientificName: 'Bitis gabonica',
    commonNames: { en: 'Gaboon viper', fr: 'Vipère du Gabon', sw: 'Vipera ya Gabon' },
    venomous: 'deadly',
    antivenomName: 'Fav-Afrique',
    description: {
      en: 'Largest viper in Africa with the longest fangs. Enormous venom yield.',
    },
  },
  {
    scientificName: 'Cerastes cerastes',
    commonNames: { en: 'Saharan horned viper', fr: 'Vipère à cornes', ar: 'أفعى القرون' },
    venomous: 'deadly',
    antivenomName: 'AVP Pasteur',
    description: {
      en: 'Desert species common in North Africa. Distinctive horn-like scales above eyes.',
    },
  },
  {
    scientificName: 'Dispholidus typus',
    commonNames: { en: 'Boomslang', fr: 'Boomslang', sw: 'Nyoka wa mti' },
    venomous: 'deadly',
    antivenomName: 'SAIMR Boomslang Antivenom',
    description: {
      en: 'Rear-fanged tree snake. Haemotoxic venom; bites are rare but potentially fatal.',
    },
  },
  {
    scientificName: 'Causus rhombeatus',
    commonNames: { en: 'Rhombic night adder', fr: 'Vipère nuit', sw: 'Nyoka wa usiku' },
    venomous: 'mildly_venomous',
    antivenomName: null,
    description: {
      en: 'Common small viper. Painful bite but rarely life-threatening in healthy adults.',
    },
  },
  {
    scientificName: 'Psammophis sibilans',
    commonNames: { en: 'Hissing sand snake', fr: 'Couleuvre des sables', sw: 'Nyoka wa mchanga' },
    venomous: 'mildly_venomous',
    antivenomName: null,
    description: {
      en: 'Rear-fanged. Mild venom; bites only occur if the snake is held for a prolonged time.',
    },
  },
  {
    scientificName: 'Lamprophis fuliginosus',
    commonNames: { en: 'African house snake', fr: 'Serpent des maisons', tw: 'Ɔwia fie fi' },
    venomous: 'non_venomous',
    antivenomName: null,
    description: {
      en: 'Harmless constrictor found near human dwellings. Beneficial — eats rodents.',
    },
  },
  {
    scientificName: 'Python sebae',
    commonNames: { en: 'African rock python', fr: 'Python de Seba', sw: 'Chatu' },
    venomous: 'non_venomous',
    antivenomName: null,
    description: {
      en: 'Africa\'s largest snake. Non-venomous but can inflict severe bites. Culturally significant.',
    },
  },
];

// ─── antivenom centres ────────────────────────────────────────────────────────

const CENTERS = [
  {
    name: 'Korle-Bu Teaching Hospital',
    country: 'GH',
    lat: 5.5405,
    lng: -0.2309,
    antivenomsStocked: ['Fav-Afrique', 'EchiTAb-Plus-ICP'],
    phone: '+233-30-2665401',
  },
  {
    name: 'Komfo Anokye Teaching Hospital',
    country: 'GH',
    lat: 6.6933,
    lng: -1.6217,
    antivenomsStocked: ['Fav-Afrique', 'EchiTAb-Plus-ICP'],
    phone: '+233-32-2022301',
  },
  {
    name: 'Lagos University Teaching Hospital',
    country: 'NG',
    lat: 6.5158,
    lng: 3.3653,
    antivenomsStocked: ['EchiTAb-Plus-ICP', 'Fav-Afrique'],
    phone: '+234-1-7919530',
  },
  {
    name: 'Aminu Kano Teaching Hospital',
    country: 'NG',
    lat: 12.0022,
    lng: 8.5920,
    antivenomsStocked: ['EchiTAb-Plus-ICP'],
    phone: '+234-64-660510',
  },
  {
    name: 'Kenyatta National Hospital',
    country: 'KE',
    lat: -1.3007,
    lng: 36.8076,
    antivenomsStocked: ['SAIMR Polyvalent Antivenom', 'Fav-Afrique'],
    phone: '+254-20-2726300',
  },
  {
    name: 'Moi Teaching and Referral Hospital',
    country: 'KE',
    lat: 0.5143,
    lng: 35.2698,
    antivenomsStocked: ['SAIMR Polyvalent Antivenom'],
    phone: '+254-53-2033471',
  },
  {
    name: 'Muhimbili National Hospital',
    country: 'TZ',
    lat: -6.8003,
    lng: 39.2657,
    antivenomsStocked: ['SAIMR Polyvalent Antivenom', 'Fav-Afrique'],
    phone: '+255-22-2150610',
  },
  {
    name: 'Bugando Medical Centre',
    country: 'TZ',
    lat: -2.5167,
    lng: 32.9,
    antivenomsStocked: ['SAIMR Polyvalent Antivenom'],
    phone: '+255-28-2500799',
  },
];

// ─── encounter generation helpers ─────────────────────────────────────────────

// Country → district → [lat_center, lng_center, radius_deg]
const DISTRICTS: Record<string, Array<[string, number, number, number]>> = {
  GH: [
    ['Greater Accra', 5.6037, -0.187, 0.4],
    ['Ashanti', 6.7, -1.62, 0.6],
    ['Northern', 9.4, -0.85, 0.8],
    ['Brong-Ahafo', 7.9, -2.05, 0.7],
    ['Western', 5.1, -2.05, 0.5],
  ],
  NG: [
    ['Lagos', 6.52, 3.38, 0.3],
    ['Kano', 12.0, 8.59, 0.6],
    ['Kaduna', 10.52, 7.44, 0.6],
    ['Benue', 7.73, 8.52, 0.8],
    ['Niger', 9.93, 5.6, 0.9],
  ],
  KE: [
    ['Nairobi', -1.29, 36.82, 0.3],
    ['Mombasa', -4.05, 39.67, 0.3],
    ['Kisumu', -0.10, 34.75, 0.5],
    ['Nakuru', -0.31, 36.08, 0.5],
    ['Turkana', 3.1, 35.6, 1.2],
  ],
  TZ: [
    ['Dar es Salaam', -6.79, 39.21, 0.4],
    ['Mwanza', -2.52, 32.9, 0.5],
    ['Arusha', -3.39, 36.68, 0.6],
    ['Dodoma', -6.17, 35.74, 0.5],
    ['Mbeya', -8.91, 33.46, 0.6],
  ],
};

const SPECIES_NAMES = SPECIES.map((s) => s.scientificName);
const ACTIONS = ['first_aid', 'seek_medical', 'photo_only', 'identified_only'];
const LANGUAGES: Record<string, string[]> = {
  GH: ['en', 'tw'],
  NG: ['en', 'ha'],
  KE: ['en', 'sw'],
  TZ: ['sw', 'en'],
};

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

function randPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/** Generate a random date in the last `days` days, weighted toward recent dates. */
function randDate(days: number): Date {
  const msAgo = Math.pow(Math.random(), 1.4) * days * 86400 * 1000;
  return new Date(Date.now() - msAgo);
}

type EncounterInsert = {
  deviceId: string;
  createdAt: Date;
  speciesGuess: string;
  confidence: number;
  lat: number;
  lng: number;
  district: string;
  country: string;
  language: string;
  actionTaken: string;
  wasBite: boolean;
};

function generateEncounters(count: number): EncounterInsert[] {
  const encounters: EncounterInsert[] = [];
  const countries = Object.keys(DISTRICTS) as Array<keyof typeof DISTRICTS>;

  for (let i = 0; i < count; i++) {
    const country = randPick(countries);
    const [district, latC, lngC, r] = randPick(DISTRICTS[country]!);
    const species = randPick(SPECIES_NAMES);
    const wasBite = Math.random() < 0.28; // ~28% bite rate

    encounters.push({
      deviceId: `device-${randInt(1, 120).toString().padStart(3, '0')}`,
      createdAt: randDate(90),
      speciesGuess: species,
      confidence: rand(0.55, 0.99),
      lat: latC + rand(-r, r),
      lng: lngC + rand(-r, r),
      district,
      country,
      language: randPick(LANGUAGES[country] ?? ['en']),
      actionTaken: randPick(ACTIONS),
      wasBite,
    });
  }

  return encounters;
}

// ─── main ─────────────────────────────────────────────────────────────────────

// ─── demo credentials (judges / hackathon reviewers) ─────────────────────────
// These are intentionally public for the Gemma 4 Good Hackathon submission.
// Change before any production use outside the competition.
const DEMO_EMAIL    = 'demo@ishvenom.app';
const DEMO_PASSWORD = 'IshVenom2026!';

async function main() {
  console.log('Seeding IshVenom demo database…\n');

  // ── 0. Demo user ────────────────────────────────────────────────────────────
  console.log('  Upserting demo user…');
  const passwordHash = await hash(DEMO_PASSWORD);
  // Use raw SQL — schema.prisma declares role as enum UserRole but the
  // hand-written migration stores it as text, so the ORM client would fail.
  await prisma.$executeRaw`
    INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), ${DEMO_EMAIL}, ${passwordHash}, 'HEALTH_OFFICER', NOW(), NOW())
    ON CONFLICT ("email") DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash"
  `;
  console.log(`  + email:    ${DEMO_EMAIL}`);
  console.log(`  + password: ${DEMO_PASSWORD}`);
  console.log('  (credentials are public for hackathon judges)\n');

  // ── 1. Species ──────────────────────────────────────────────────────────────
  console.log('  Upserting species…');
  for (const s of SPECIES) {
    await prisma.species.upsert({
      where: { scientificName: s.scientificName },
      create: {
        scientificName: s.scientificName,
        commonNames: s.commonNames,
        venomous: s.venomous,
        antivenomName: s.antivenomName ?? null,
        description: s.description ?? null,
      },
      update: {
        commonNames: s.commonNames,
        venomous: s.venomous,
        antivenomName: s.antivenomName ?? null,
        description: s.description ?? null,
      },
    });
  }
  console.log(`  ✓ ${SPECIES.length} species`);

  // ── 2. Antivenom centres ────────────────────────────────────────────────────
  console.log('  Inserting antivenom centres…');
  // Delete existing to avoid duplicates on re-run
  await prisma.antivenomCenter.deleteMany({});
  for (const c of CENTERS) {
    await prisma.$executeRaw`
      INSERT INTO "AntivenomCenter"
        ("id", "name", "country", "location", "antivenomsStocked", "phone", "lastVerified", "createdAt")
      VALUES (
        gen_random_uuid(),
        ${c.name},
        ${c.country},
        ST_SetSRID(ST_MakePoint(${c.lng}, ${c.lat}), 4326),
        ${JSON.stringify(c.antivenomsStocked)}::jsonb,
        ${c.phone ?? null},
        NOW(),
        NOW()
      )
    `;
  }
  console.log(`  ✓ ${CENTERS.length} antivenom centres`);

  // ── 3. Encounters ───────────────────────────────────────────────────────────
  console.log('  Generating ~400 encounters…');
  await prisma.encounter.deleteMany({});
  const encounters = generateEncounters(420);

  for (const e of encounters) {
    await prisma.$executeRaw`
      INSERT INTO "Encounter"
        ("id", "deviceId", "createdAt", "speciesGuess", "confidence",
         "location", "district", "country", "language", "actionTaken", "wasBite")
      VALUES (
        gen_random_uuid(),
        ${e.deviceId},
        ${e.createdAt},
        ${e.speciesGuess},
        ${e.confidence},
        ST_SetSRID(ST_MakePoint(${e.lng}, ${e.lat}), 4326),
        ${e.district},
        ${e.country},
        ${e.language},
        ${e.actionTaken},
        ${e.wasBite}
      )
    `;
  }
  const bites = encounters.filter((e) => e.wasBite).length;
  console.log(`  ✓ ${encounters.length} encounters (${bites} bites)`);

  console.log('\n✅  Seed complete. Refresh the dashboard to see live data.\n');
}

main()
  .catch((err) => {
    console.error('❌  Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
