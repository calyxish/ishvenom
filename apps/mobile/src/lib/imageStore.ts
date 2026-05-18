/**
 * imageStore — permanent local storage for encounter photos.
 *
 * Privacy contract:
 *   - Photos NEVER leave the device. Only the SHA-256 hash syncs to the
 *     backend (for deduplication); the hash cannot be reversed to an image.
 *   - Files older than maxAgeDays are pruned automatically by cleanOldPhotos().
 *   - The camera temp file (photo.uri) is never used after this module copies
 *     it — the temp file is cleaned up by the OS.
 *
 * Directory layout inside FileSystem.documentDirectory:
 *   encounters/
 *     {encounterId}.jpg          — full-resolution image (~200–500 KB at q0.8)
 *     {encounterId}_thumb.jpg    — 80×80 thumbnail for history list
 *
 * Uses expo-file-system/legacy because the new OOP API (expo-file-system v19)
 * does not yet expose a stable async copy + directory listing surface that
 * works uniformly across Android and iOS. The legacy subpath is fully
 * supported in Expo SDK 54 and is not scheduled for removal.
 */
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as Crypto from 'expo-crypto';

const ENCOUNTERS_DIR = `${FileSystem.documentDirectory ?? ''}encounters/`;

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(ENCOUNTERS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(ENCOUNTERS_DIR, { intermediates: true });
  }
}

function fullPath(encounterId: string): string {
  return `${ENCOUNTERS_DIR}${encounterId}.jpg`;
}

function thumbPath(encounterId: string): string {
  return `${ENCOUNTERS_DIR}${encounterId}_thumb.jpg`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Copy a photo from the camera temp directory to permanent storage.
 * Returns the permanent file URI (suitable for Image source prop).
 * Safe to call multiple times — skips the copy if the file already exists.
 */
export async function saveEncounterPhoto(
  sourceUri: string,
  encounterId: string,
): Promise<string> {
  await ensureDir();
  const dest = fullPath(encounterId);
  const existing = await FileSystem.getInfoAsync(dest);
  if (!existing.exists) {
    await FileSystem.copyAsync({ from: sourceUri, to: dest });
  }
  return dest;
}

/**
 * Returns the permanent file URI if the photo exists on disk, null otherwise.
 * Use this before displaying an image so stale paths don't throw.
 */
export async function getEncounterPhotoUri(encounterId: string): Promise<string | null> {
  const path = fullPath(encounterId);
  const info = await FileSystem.getInfoAsync(path);
  return info.exists ? path : null;
}

/**
 * Generate an 80×80 JPEG thumbnail and save it alongside the full image.
 * Returns the thumbnail URI.
 */
export async function generateThumbnail(
  sourceUri: string,
  encounterId: string,
): Promise<string> {
  await ensureDir();
  const dest = thumbPath(encounterId);
  const existing = await FileSystem.getInfoAsync(dest);
  if (existing.exists) return dest;

  const result = await manipulateAsync(
    sourceUri,
    [{ resize: { width: 80, height: 80 } }],
    { format: SaveFormat.JPEG, compress: 0.7 },
  );
  await FileSystem.copyAsync({ from: result.uri, to: dest });
  return dest;
}

/**
 * Returns the thumbnail URI if it exists, null otherwise.
 */
export async function getEncounterThumbUri(encounterId: string): Promise<string | null> {
  const path = thumbPath(encounterId);
  const info = await FileSystem.getInfoAsync(path);
  return info.exists ? path : null;
}

/**
 * Compute the SHA-256 hex digest of a photo file.
 * This hash (not the photo itself) is what syncs to the backend for dedup.
 */
export async function hashPhoto(fileUri: string): Promise<string> {
  const b64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, b64);
}

/**
 * Delete photos (full + thumbnail) for encounters older than maxAgeDays.
 * Safe to call on every app start — silently skips files it cannot parse or
 * delete. Pass maxAgeDays = 0 to delete everything (used by "Forget device").
 */
export async function cleanOldPhotos(maxAgeDays = 90): Promise<void> {
  await ensureDir();
  let files: string[];
  try {
    files = await FileSystem.readDirectoryAsync(ENCOUNTERS_DIR);
  } catch {
    return; // directory missing or empty — nothing to do
  }

  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

  for (const file of files) {
    const path = `${ENCOUNTERS_DIR}${file}`;
    try {
      const info = await FileSystem.getInfoAsync(path);
      // modificationTime is in seconds since Unix epoch
      const modMs =
        info.exists && 'modificationTime' in info
          ? (info as { modificationTime: number }).modificationTime * 1000
          : 0;
      if (maxAgeDays === 0 || modMs < cutoff) {
        await FileSystem.deleteAsync(path, { idempotent: true });
      }
    } catch {
      // Silently skip files we cannot stat or delete
    }
  }
}
