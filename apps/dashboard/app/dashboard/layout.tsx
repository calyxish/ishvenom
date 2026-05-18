'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getToken, logout } from '@/lib/api';

const NAV = [
  { href: '/dashboard',                  label: 'Overview' },
  { href: '/dashboard/map',              label: 'Incident map' },
  { href: '/dashboard/species',          label: 'Species' },
  { href: '/dashboard/outbreaks',        label: 'Outbreak alerts' },
  { href: '/dashboard/sit-reports',      label: 'Sit reports' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router   = useRouter();
  const [ready, setReady] = useState(false);

  // Client-side auth guard: bounce unauthenticated users to /login before
  // anything in the dashboard renders. Prevents a flash of protected UI.
  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
    } else {
      setReady(true);
    }
  }, [router]);

  async function onSignOut() {
    try {
      await logout();
    } finally {
      router.push('/login');
    }
  }

  if (!ready) return null;

  return (
    <div className="min-h-screen flex bg-ish-bg text-ish-text">
      {/* ── Sidebar ── */}
      <aside className="w-56 shrink-0 border-r border-ish-border bg-ish-surface flex flex-col p-4">
        {/* Logo */}
        <div className="mb-8 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt="IshVenom"
            width={40}
            height={40}
            className="shrink-0 rounded-full"
          />
          <div>
            <span className="text-lg font-bold tracking-tight text-ish-text">
              IshVenom
            </span>
            <p className="text-xs text-ish-text-muted mt-0.5">
              Snakebite Surveillance
            </p>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 space-y-0.5">
          {NAV.map((item) => {
            const active =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'block px-3 py-2 rounded-xl text-sm font-medium transition-colors',
                  active
                    ? 'bg-ish-accent/15 text-ish-accent'
                    : 'text-ish-text-secondary hover:bg-ish-surface-hover hover:text-ish-text',
                ].join(' ')}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer: sign out + version */}
        <div className="mt-6 pt-4 border-t border-ish-border space-y-3">
          <button
            type="button"
            onClick={onSignOut}
            className="block w-full text-left px-3 py-2 rounded-xl text-sm font-medium text-ish-text-secondary hover:bg-ish-surface-hover hover:text-ish-text transition-colors"
          >
            Sign out
          </button>
          <p className="text-[11px] text-ish-text-muted leading-relaxed px-3">
            IshVenom v1 · Gemma 4 Hackathon
          </p>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
