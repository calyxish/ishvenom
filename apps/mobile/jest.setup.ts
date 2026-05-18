// Phase 4 tests target pure-TS modules only (lib/geo, lib/sync,
// lib/firstAid, lib/triage, lib/rtl). Any native RN module touched
// transitively by those tests is stubbed here.

jest.mock(
  'expo-crypto',
  () => ({
    randomUUID: () => '00000000-0000-4000-8000-000000000000',
    getRandomBytesAsync: async (n: number) => new Uint8Array(n),
    digestStringAsync: async (_alg: string, s: string) => `sha256:${s}`,
    CryptoDigestAlgorithm: { SHA256: 'SHA256' },
  }),
  { virtual: true },
);

jest.mock(
  'expo-secure-store',
  () => {
    const store = new Map<string, string>();
    return {
      AFTER_FIRST_UNLOCK: 'after_first_unlock',
      getItemAsync: async (k: string) => store.get(k) ?? null,
      setItemAsync: async (k: string, v: string) => {
        store.set(k, v);
      },
      deleteItemAsync: async (k: string) => {
        store.delete(k);
      },
    };
  },
  { virtual: true },
);
