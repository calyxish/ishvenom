'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getToken, logout } from '@/lib/api';
import { ThemeToggle } from '@/components/ThemeToggle';

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
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Client-side auth guard: bounce unauthenticated users to /login before
  // any dashboard UI renders. Prevents a flash of protected content.
  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
    } else {
      setReady(true);
    }
  }, [router]);

  // Close the drawer whenever the route changes so tapping a nav link
  // collapses the menu on mobile.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  async function onSignOut() {
    try {
      await logout();
    } finally {
      router.push('/login');
    }
  }

  if (!ready) return null;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-ish-bg text-ish-text">
      {/* ── Mobile top bar (visible < md) ── */}
      <header className="md:hidden flex items-center justify-between border-b border-ish-border bg-ish-surface px-4 h-14 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt="IshVenom"
            width={28}
            height={28}
            className="rounded-full"
          />
          <span className="font-bold text-ish-text">IshVenom</span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="h-9 w-9 flex items-center justify-center rounded-xl text-ish-text-secondary hover:bg-ish-surface-hover hover:text-ish-text transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── Mobile drawer backdrop ── */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setDrawerOpen(false)}
          aria-hidden
        />
      )}

      {/* ── Sidebar (always visible md+, drawer on mobile) ── */}
      <aside
        className={[
          'w-64 shrink-0 border-r border-ish-border bg-ish-surface flex flex-col p-4',
          // Desktop: always visible
          'hidden md:flex',
          // Mobile drawer: fixed, slides in
          drawerOpen
            ? 'flex fixed inset-y-0 left-0 z-50 w-72'
            : '',
        ].join(' ')}
      >
        {/* Logo */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
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
          {/* Close button — only visible inside the mobile drawer */}
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
            className="md:hidden h-9 w-9 flex items-center justify-center rounded-xl text-ish-text-secondary hover:bg-ish-surface-hover hover:text-ish-text transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
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

        {/* Footer: theme toggle (desktop only — mobile has it in the top bar),
            sign out + version */}
        <div className="mt-6 pt-4 border-t border-ish-border space-y-1">
          <div className="hidden md:flex items-center justify-between px-1 mb-1">
            <span className="text-xs text-ish-text-muted">Theme</span>
            <ThemeToggle />
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="block w-full text-left px-3 py-2 rounded-xl text-sm font-medium text-ish-text-secondary hover:bg-ish-surface-hover hover:text-ish-text transition-colors"
          >
            Sign out
          </button>
          <p className="text-[11px] text-ish-text-muted leading-relaxed px-3 pt-2">
            IshVenom v1 · Gemma 4 Hackathon
          </p>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
