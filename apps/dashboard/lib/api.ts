/**
 * Typed fetch client for the IshVenom API.
 *
 * Auth wall removed for demo/judge access — requests are unauthenticated.
 * Token helpers kept as stubs so callers don't break.
 */

const TOKEN_KEY = 'ishvenom:token';

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4000/api/v1';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  opts: { auth?: boolean } = { auth: true },
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');

  if (opts.auth) {
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (res.status === 401) {
    // Auth wall removed — surface as a regular error, no redirect.
    throw new ApiError(401, 'unauthorized', 'Unauthorized');
  }

  const body = (await res.json().catch(() => ({}))) as unknown;

  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string } })
      .error;
    throw new ApiError(
      res.status,
      err?.code ?? 'unknown',
      err?.message ?? `HTTP ${res.status}`,
    );
  }
  return body as T;
}

// ── Auth ─────────────────────────────────────────────────────────────
export interface LoginResponse {
  token: string;
  expiresAt: string;
  user: { id: string; email: string; role: string };
}

export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const body = await request<LoginResponse>(
    '/auth/login',
    { method: 'POST', body: JSON.stringify({ email, password }) },
    { auth: false },
  );
  setToken(body.token);
  return body;
}

export async function logout(): Promise<void> {
  try {
    await request('/auth/logout', { method: 'POST' });
  } finally {
    clearToken();
  }
}

export async function me(): Promise<{
  user: { id: string; email: string; role: string };
}> {
  return request('/auth/me', { method: 'GET' });
}

// ── Stats ────────────────────────────────────────────────────────────
export interface DistrictStat {
  country: string;
  district: string | null;
  encounterCount: number;
  biteCount: number;
  topSpecies: string | null;
}

export async function getDistricts(params?: {
  species?: string;
}): Promise<{ districts: DistrictStat[] }> {
  const q = new URLSearchParams();
  if (params?.species) q.set('species', params.species);
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return request(`/stats/districts${suffix}`);
}

export interface OutbreakRow {
  country: string;
  district: string | null;
  speciesGuess: string | null;
  recentCount: number;
  baselineAvg: number;
  ratio: number;
}

export async function getOutbreaks(
  threshold: number = 1.5,
): Promise<{ threshold: number; outbreaks: OutbreakRow[] }> {
  return request(`/stats/outbreaks?threshold=${threshold}`);
}

export interface TimeseriesPoint {
  day: string;
  encounters: number;
  bites: number;
}

export async function getTimeseries(
  days: number = 30,
): Promise<{ days: number; series: TimeseriesPoint[] }> {
  return request(`/stats/timeseries?days=${days}`);
}

// ── Species ──────────────────────────────────────────────────────────
export interface SpeciesRow {
  id: string;
  scientificName: string;
  commonNames: Record<string, string>;
  venomous: string;
  antivenomName: string | null;
}

export async function getSpecies(): Promise<{ species: SpeciesRow[] }> {
  return request('/species', { method: 'GET' }, { auth: false });
}
