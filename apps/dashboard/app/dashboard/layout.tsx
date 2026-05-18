'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getToken, getUserEmail, logout } from '@/lib/api';
import { ThemeToggle } from '@/components/ThemeToggle';

const NAV = [
  { href: '/dashboard',                  label: 'Overview' },
  { href: '/dashboard/map',              label: 'Incident map' },
  { href: '/dashboard/species',          label: 'Species' },
  { href: '/dashboard/outbreaks',        label: 'Outbreak alerts' },
  { href: '/dashboard/sit-reports',      label: 'Sit reports' },
];

const SIDEBAR_KEY = 'ishvenom:sidebar-open';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router   = useRouter();
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  // Sidebar state — defaults to open on desktop, closed on mobile, and
  // persists via localStorage so the user's preference is sticky.
  const [open, setOpen] = useState<boolean | null>(null);

  // Auth guard
  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    setEmail(getUserEmail());
    setReady(true);
  }, [router]);

  // Restore (or compute) sidebar state on mount
  useEffect(() => {
    const saved = window.localStorage.getItem(SIDEBAR_KEY);
    if (saved !== null) {
      setOpen(saved === 'true');
    } else {
      setOpen(window.matchMedia('(min-width: 768px)').matches);
    }
  }, []);

  // Persist sidebar state
  useEffect(() => {
    if (open === null) return;
    window.localStorage.setItem(SIDEBAR_KEY, String(open));
  }, [open]);

  // On mobile, close the drawer when the route changes (so tapping a nav
  // link collapses the menu). Desktop keeps it open.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.matchMedia('(min-width: 768px)').matches) {
      setOpen(false);
    }
  }, [pathname]);

  async function onSignOut() {
    try {
      await logout();
    } finally {
      router.push('/login');
    }
  }

  if (!ready || open === null) return null;

  const isOpen = open;

  return (
    <div className="min-h-screen bg-ish-bg text-ish-text">
      {/* ── Top bar (always visible) ─────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-30 h-14 bg-ish-surface border-b border-ish-border flex items-center px-3 md:px-4 gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={isOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isOpen}
          className="h-9 w-9 flex items-center justify-center rounded-xl text-ish-text-secondary hover:bg-ish-surface-hover hover:text-ish-text transition-colors"
        >
          {isOpen ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="3" y1="6"  x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>

        <div className="flex items-center gap-2 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt="IshVenom"
            width={28}
            height={28}
            className="rounded-full shrink-0"
          />
          <div className="min-w-0">
            <div className="font-bold text-ish-text text-sm leading-tight">
              IshVenom
            </div>
            <div className="text-[10px] text-ish-text-muted leading-tight hidden sm:block">
              Snakebite Surveillance
            </div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
        </div>
      </header>

      {/* ── Backdrop (mobile only when open) ──────────────────────── */}
      {isOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="md:hidden fixed top-14 inset-x-0 bottom-0 bg-black/60 z-30 cursor-default"
        />
      )}

      {/* ── Sidebar (slides in from left) ─────────────────────────── */}
      <aside
        className={[
          'fixed top-14 left-0 z-40 h-[calc(100vh-3.5rem)] w-72 bg-ish-surface border-r border-ish-border flex flex-col',
          'transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
        aria-hidden={!isOpen}
      >
        {/* Nav links */}
        <nav className="flex-1 p-4 space-y-0.5 overflow-y-auto">
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
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
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

        {/* Footer: signed-in card + sign out + version */}
        <div className="border-t border-ish-border p-3 space-y-2">
          {email && (
            <div className="px-3 py-2 rounded-xl bg-ish-bg border border-ish-border">
              <div className="text-[10px] uppercase tracking-wider text-ish-text-muted font-medium">
                Signed in
              </div>
              <div className="text-xs text-ish-text font-medium truncate mt-0.5">
                {email}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={onSignOut}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-ish-text-secondary hover:bg-ish-danger-surface hover:text-ish-danger transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Sign out</span>
          </button>

          <p className="text-[10px] text-ish-text-muted leading-relaxed px-3 pt-1">
            IshVenom v1 · Gemma 4 Hackathon
          </p>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────── */}
      <main
        className={[
          'pt-14 transition-[padding] duration-300 ease-in-out',
          // Desktop: reflow when sidebar is open so content doesn't sit behind it.
          // Mobile: sidebar is an overlay, no padding shift.
          isOpen ? 'md:pl-72' : 'md:pl-0',
        ].join(' ')}
      >
        {children}
      </main>
    </div>
  );
}
