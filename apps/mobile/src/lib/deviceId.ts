/**
 * deviceId — a stable, anonymized identifier for this install.
 *
 * Privacy contract:
 *   - Generated once on first launch, persisted in expo-secure-store.
 *   - The raw identifier is a random 256-bit value — it is NOT derived
 *     from IMEI, MAC, advertising ID, or any other hardware fingerprint.
 *   - We expose it only as a SHA-256 hex digest so even the client code
 *     never handles the raw entropy directly after first write.
 *   - Cleared on "forget me" in Settings → regenerates on next launch.
 *
 * The backend (Phase 5 /api/v1/encounters) treats this field as opaque
 * and never attempts to correlate across devices.
 */
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const KEY = 'ishvenom.deviceSeed.v1';

let cached: string | null = null;

async function randomHex(bytes: number): Promise<string> {
  const buf = await Crypto.getRandomBytesAsync(bytes);
  let out = '';
  for (let i = 0; i < buf.length; i += 1) {
    out += buf[i]!.toString(16).padStart(2, '0');
  }
  return out;
}

export async function getDeviceId(): Promise<string> {
  if (cached) return cached;

  let seed = await SecureStore.getItemAsync(KEY);
  if (!seed) {
    seed = await randomHex(32);
    await SecureStore.setItemAsync(KEY, seed, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    });
  }

  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    seed,
  );
  cached = digest;
  return digest;
}

export async function resetDeviceId(): Promise<void> {
  cached = null;
  await SecureStore.deleteItemAsync(KEY);
}
