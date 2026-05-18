'use client';

/**
 * Read IshVenom design tokens at runtime from CSS variables.
 *
 * MapLibre + Recharts both take colors as plain hex/rgb strings via JS,
 * not Tailwind class names — so we can't just slap `bg-ish-accent` on a
 * marker. Instead we read the computed value of the CSS variable from
 * <html>, which gives us the correct color for whichever theme is active.
 *
 * Returned values update when the theme changes (we subscribe to
 * resolvedTheme from next-themes and re-read on every flip).
 */
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

export interface ThemeTokens {
  bg: string;
  surface: string;
  surfaceHover: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  accentSecondary: string;
  danger: string;
  dangerSurface: string;
  warning: string;
  warningSurface: string;
  success: string;
  successSurface: string;
}

// Hex fallbacks for SSR / before hydration — dark-mode values so server-
// rendered chart markup doesn't flash a different palette.
const FALLBACK: ThemeTokens = {
  bg:               '#080C12',
  surface:          '#0F172A',
  surfaceHover:     '#1E293B',
  border:           '#1E293B',
  text:             '#F0F9FF',
  textSecondary:    '#94A3B8',
  textMuted:        '#64748B',
  accent:           '#0EA5E9',
  accentHover:      '#0284C7',
  accentSecondary:  '#7DD3FC',
  danger:           '#EF4444',
  dangerSurface:    '#2D1214',
  warning:          '#F59E0B',
  warningSurface:   '#2D2206',
  success:          '#10B981',
  successSurface:   '#0D2818',
};

function read(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

export function useThemeTokens(): ThemeTokens {
  const { resolvedTheme } = useTheme();
  const [tokens, setTokens] = useState<ThemeTokens>(FALLBACK);

  useEffect(() => {
    setTokens({
      bg:               read('--ish-bg',               FALLBACK.bg),
      surface:          read('--ish-surface',          FALLBACK.surface),
      surfaceHover:     read('--ish-surface-hover',    FALLBACK.surfaceHover),
      border:           read('--ish-border',           FALLBACK.border),
      text:             read('--ish-text',             FALLBACK.text),
      textSecondary:    read('--ish-text-secondary',   FALLBACK.textSecondary),
      textMuted:        read('--ish-text-muted',       FALLBACK.textMuted),
      accent:           read('--ish-accent',           FALLBACK.accent),
      accentHover:      read('--ish-accent-hover',     FALLBACK.accentHover),
      accentSecondary:  read('--ish-accent-secondary', FALLBACK.accentSecondary),
      danger:           read('--ish-danger',           FALLBACK.danger),
      dangerSurface:    read('--ish-danger-surface',   FALLBACK.dangerSurface),
      warning:          read('--ish-warning',          FALLBACK.warning),
      warningSurface:   read('--ish-warning-surface',  FALLBACK.warningSurface),
      success:          read('--ish-success',          FALLBACK.success),
      successSurface:   read('--ish-success-surface', FALLBACK.successSurface),
    });
  }, [resolvedTheme]);

  return tokens;
}
