/**
 * Session store — language, device id, consent flags, sync bookkeeping.
 *
 * Persistence: manual AsyncStorage (no zustand/persist middleware) so we
 * control exactly which keys are written and can evolve the schema safely.
 *
 * Persisted keys (all under the "session." namespace):
 *   session.language        Language code
 *   session.country         ISO 3166-1 alpha-2
 *   session.hasOnboarded    "true" | "false"
 *   session.name            display name (optional, never synced)
 *   session.themeOverride   "dark" | "light" | null
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { Language } from '@ishvenom/shared-types';

// ─── AsyncStorage helpers ────────────────────────────────────────────────────

const KEYS = {
  language: 'session.language',
  country: 'session.country',
  hasOnboarded: 'session.hasOnboarded',
  name: 'session.name',
  themeOverride: 'session.themeOverride',
} as const;

async function persist(patch: Partial<PersistedFields>): Promise<void> {
  const pairs: [string, string][] = [];
  if (patch.language !== undefined) pairs.push([KEYS.language, patch.language]);
  if (patch.country !== undefined) pairs.push([KEYS.country, patch.country]);
  if (patch.hasOnboarded !== undefined)
    pairs.push([KEYS.hasOnboarded, String(patch.hasOnboarded)]);
  if (patch.name !== undefined) pairs.push([KEYS.name, patch.name]);
  if ('themeOverride' in patch)
    pairs.push([KEYS.themeOverride, patch.themeOverride ?? '']);
  if (pairs.length) await AsyncStorage.multiSet(pairs);
}

interface PersistedFields {
  language: Language;
  country: string;
  hasOnboarded: boolean;
  name: string;
  themeOverride: 'dark' | 'light' | null;
}

// ─── State interface ──────────────────────────────────────────────────────────

export interface SessionState {
  deviceId: string | null;
  language: Language;
  country: string;
  hasOnboarded: boolean;
  /** User display name — optional, never synced, local only */
  name: string;
  lastSyncAt: string | null;
  syncInFlight: boolean;
  unsyncedCount: number;
  /** null = follow device system preference */
  themeOverride: 'dark' | 'light' | null;
  /** True once loadPersistedSession() has resolved — used to gate the root redirect */
  sessionLoaded: boolean;
  // actions
  setDeviceId: (id: string) => void;
  setLanguage: (l: Language) => void;
  setCountry: (c: string) => void;
  setName: (n: string) => void;
  markOnboarded: () => void;
  setSyncInFlight: (b: boolean) => void;
  setLastSyncAt: (iso: string) => void;
  setUnsyncedCount: (n: number) => void;
  setThemeOverride: (t: 'dark' | 'light' | null) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useSession = create<SessionState>((set) => ({
  deviceId: null,
  language: 'en',
  country: 'GH',
  hasOnboarded: false,
  name: '',
  lastSyncAt: null,
  syncInFlight: false,
  unsyncedCount: 0,
  themeOverride: null,
  sessionLoaded: false,

  setDeviceId: (id) => set({ deviceId: id }),

  setLanguage: (l) => {
    set({ language: l });
    void persist({ language: l });
  },

  setCountry: (c) => {
    set({ country: c });
    void persist({ country: c });
  },

  setName: (n) => {
    set({ name: n });
    void persist({ name: n });
  },

  markOnboarded: () => {
    set({ hasOnboarded: true });
    void persist({ hasOnboarded: true });
  },

  setSyncInFlight: (b) => set({ syncInFlight: b }),
  setLastSyncAt: (iso) => set({ lastSyncAt: iso }),
  setUnsyncedCount: (n) => set({ unsyncedCount: n }),

  setThemeOverride: (t) => {
    set({ themeOverride: t });
    void persist({ themeOverride: t });
  },
}));

// ─── Hydration ────────────────────────────────────────────────────────────────

/**
 * Call once on app start (inside _layout.tsx useEffect) to hydrate the store
 * from AsyncStorage. Returns immediately with defaults if storage is empty.
 */
export async function loadPersistedSession(): Promise<void> {
  const results = await AsyncStorage.multiGet([
    KEYS.language,
    KEYS.country,
    KEYS.hasOnboarded,
    KEYS.name,
    KEYS.themeOverride,
  ]);

  const map = Object.fromEntries(results.map(([k, v]) => [k, v]));

  const patch: Partial<SessionState> = {};

  const lang = map[KEYS.language];
  if (lang === 'en' || lang === 'fr' || lang === 'ar' || lang === 'ha' || lang === 'sw' || lang === 'tw') {
    patch.language = lang;
  }

  const country = map[KEYS.country];
  if (country) patch.country = country;

  const onboarded = map[KEYS.hasOnboarded];
  if (onboarded === 'true') patch.hasOnboarded = true;

  const name = map[KEYS.name];
  if (name) patch.name = name;

  const theme = map[KEYS.themeOverride];
  if (theme === 'dark' || theme === 'light') patch.themeOverride = theme;
  // empty string means "was explicitly set to null (system default)" — leave as null

  // Always set sessionLoaded regardless of whether there was persisted data.
  useSession.setState({ ...patch, sessionLoaded: true });
}
