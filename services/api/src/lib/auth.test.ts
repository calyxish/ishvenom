import { describe, expect, it } from 'vitest';
import {
  generateSession,
  hashPassword,
  hashToken,
  isSessionExpired,
  parseBearer,
  verifyPassword,
} from './auth.js';

describe('hashPassword + verifyPassword', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('correct-horse-battery');
    expect(hash).toContain('$argon2id$');
    expect(await verifyPassword('correct-horse-battery', hash)).toBe(true);
    expect(await verifyPassword('wrong-password-123', hash)).toBe(false);
  });

  it('rejects short passwords', async () => {
    await expect(hashPassword('short')).rejects.toThrow(/12 characters/);
  });

  it('verifyPassword returns false on malformed hash', async () => {
    expect(await verifyPassword('anything', 'not-a-real-hash')).toBe(false);
  });
});

describe('generateSession', () => {
  it('generates a token, its hashed id, and an expiry', () => {
    const s = generateSession();
    expect(s.token).toMatch(/^[A-Za-z0-9_-]+$/); // base64url
    expect(s.token.length).toBeGreaterThan(30);
    expect(s.id).toHaveLength(64); // sha256 hex
    expect(s.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('produces distinct tokens on each call', () => {
    const a = generateSession();
    const b = generateSession();
    expect(a.token).not.toEqual(b.token);
    expect(a.id).not.toEqual(b.id);
  });

  it('hashToken is deterministic and matches generateSession output', () => {
    const s = generateSession();
    expect(hashToken(s.token)).toEqual(s.id);
  });

  it('sets expiry ~30 days out', () => {
    const now = new Date('2026-04-08T00:00:00Z');
    const s = generateSession(now);
    const diffDays =
      (s.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(30, 5);
  });
});

describe('isSessionExpired', () => {
  it('returns true when expiresAt is in the past', () => {
    const past = new Date(Date.now() - 1000);
    expect(isSessionExpired({ expiresAt: past })).toBe(true);
  });

  it('returns false when expiresAt is in the future', () => {
    const future = new Date(Date.now() + 1000);
    expect(isSessionExpired({ expiresAt: future })).toBe(false);
  });

  it('treats exact-boundary as expired', () => {
    const now = new Date('2026-04-08T00:00:00Z');
    expect(isSessionExpired({ expiresAt: now }, now)).toBe(true);
  });
});

describe('parseBearer', () => {
  it('parses a well-formed Authorization header', () => {
    expect(parseBearer('Bearer abc123')).toBe('abc123');
    expect(parseBearer('bearer abc123')).toBe('abc123'); // case insensitive
  });

  it('returns null for missing/malformed headers', () => {
    expect(parseBearer(undefined)).toBeNull();
    expect(parseBearer('')).toBeNull();
    expect(parseBearer('Bearer')).toBeNull(); // no token
    expect(parseBearer('Token abc')).toBeNull(); // wrong scheme
    expect(parseBearer('Bearer abc def')).toBeNull(); // extra parts
    expect(parseBearer('Bearer  ')).toBeNull(); // whitespace-only token
  });
});
