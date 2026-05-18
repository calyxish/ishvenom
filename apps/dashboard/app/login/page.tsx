'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login, ApiError } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('demo@ishvenom.app');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.status === 401
            ? 'Email or password is incorrect'
            : err.message
          : 'Could not reach the server — please try again';
      setError(msg);
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ish-bg px-4">
      <div className="w-full max-w-sm border border-ish-border bg-ish-surface rounded-2xl p-8">
        {/* ── Logo + heading ───────────────────────────────────── */}
        <div className="flex flex-col items-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt="IshVenom"
            width={64}
            height={64}
            className="mb-3 rounded-full"
          />
          <h1 className="text-xl font-bold text-ish-text">Sign in</h1>
          <p className="text-sm text-ish-text-secondary mt-1">
            IshVenom Snakebite Surveillance
          </p>
        </div>

        {/* ── Error banner ─────────────────────────────────────── */}
        {error && (
          <div
            role="alert"
            className="mb-4 text-sm text-ish-danger bg-ish-danger-surface border border-ish-danger rounded-xl px-4 py-3"
          >
            {error}
          </div>
        )}

        {/* ── Form ─────────────────────────────────────────────── */}
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-xs uppercase tracking-wide font-medium text-ish-text-muted mb-1.5"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-ish-bg border border-ish-border rounded-xl px-3 py-2.5 text-sm text-ish-text placeholder:text-ish-text-muted focus:outline-none focus:ring-2 focus:ring-ish-accent focus:border-transparent"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs uppercase tracking-wide font-medium text-ish-text-muted mb-1.5"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-ish-bg border border-ish-border rounded-xl px-3 py-2.5 text-sm text-ish-text placeholder:text-ish-text-muted focus:outline-none focus:ring-2 focus:ring-ish-accent focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-ish-accent text-white font-medium rounded-xl px-4 py-2.5 text-sm hover:bg-ish-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {/* ── Judge hint ───────────────────────────────────────── */}
        <div className="mt-6 pt-5 border-t border-ish-border">
          <p className="text-xs text-ish-text-muted leading-relaxed">
            <span className="font-medium text-ish-text-secondary">
              Hackathon judges:
            </span>{' '}
            sign in with{' '}
            <code className="text-ish-accent">demo@ishvenom.app</code> /{' '}
            <code className="text-ish-accent">IshVenom2026!</code>
          </p>
        </div>
      </div>
    </div>
  );
}
