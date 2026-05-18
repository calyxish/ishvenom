/**
 * Auth primitives: password hashing, session token generation, session lookup.
 *
 * We deliberately do NOT pull in Lucia here — the whole dashboard auth
 * surface is three endpoints (register/login/logout), and rolling a small
 * argon2 + opaque-token session model is both simpler and easier to audit.
 *
 * Session tokens are 32 random bytes, base64url-encoded. The token itself
 * never hits the database — we store a SHA-256 hash of it so a DB leak
 * cannot be replayed as live sessions.
 */
import { hash, verify } from '@node-rs/argon2';
import { createHash, randomBytes } from 'node:crypto';

// Tunables. Argon2id defaults roughly match OWASP 2024 cheatsheet.
const ARGON2_OPTS = {
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

const SESSION_BYTES = 32;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export async function hashPassword(plain: string): Promise<string> {
  if (plain.length < 12) {
    throw new Error('Password must be at least 12 characters');
  }
  return hash(plain, ARGON2_OPTS);
}

export async function verifyPassword(
  plain: string,
  storedHash: string,
): Promise<boolean> {
  try {
    return await verify(storedHash, plain);
  } catch {
    return false;
  }
}

export interface GeneratedSession {
  token: string; // opaque token returned to the client (never stored as-is)
  id: string; // SHA-256 of the token, stored in DB
  expiresAt: Date;
}

export function generateSession(now: Date = new Date()): GeneratedSession {
  const token = randomBytes(SESSION_BYTES).toString('base64url');
  const id = hashToken(token);
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  return { token, id, expiresAt };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function isSessionExpired(
  session: { expiresAt: Date },
  now: Date = new Date(),
): boolean {
  return session.expiresAt.getTime() <= now.getTime();
}

/**
 * Extract a bearer token from an Authorization header. Returns null if
 * the header is missing, malformed, or not of scheme `Bearer`.
 */
export function parseBearer(headerValue: string | undefined): string | null {
  if (!headerValue) return null;
  const parts = headerValue.split(' ');
  if (parts.length !== 2) return null;
  const scheme = parts[0];
  const rawToken = parts[1];
  if (!scheme || !rawToken) return null;
  if (scheme.toLowerCase() !== 'bearer') return null;
  const token = rawToken.trim();
  if (!token) return null;
  return token;
}
