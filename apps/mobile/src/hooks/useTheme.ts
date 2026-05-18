/**
 * useTheme — returns the active design-system token set.
 *
 * Resolution order for color scheme:
 *   1. User override stored in Zustand session (themeOverride)
 *   2. Device system preference (useColorScheme)
 *   3. Dark mode as safe default
 *
 * Usage:
 *   const { colors, isDark } = useTheme();
 *   <View style={{ backgroundColor: colors.bgPrimary }} />
 */
import { useColorScheme } from 'react-native';
import { useSession } from '../store/session';

export interface ColorTokens {
  bgPrimary: string;
  bgSurface: string;
  bgSurfaceHover: string;
  borderDefault: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accentPrimary: string;
  accentPrimaryHover: string;
  accentSecondary: string;
  danger: string;
  dangerSurface: string;
  warning: string;
  warningSurface: string;
  success: string;
  successSurface: string;
}

export interface Theme {
  colors: ColorTokens;
  isDark: boolean;
}

const darkTokens: ColorTokens = {
  bgPrimary: '#080C12',
  bgSurface: '#0F172A',
  bgSurfaceHover: '#1E293B',
  borderDefault: '#1E293B',
  textPrimary: '#F0F9FF',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  accentPrimary: '#0EA5E9',
  accentPrimaryHover: '#0284C7',
  accentSecondary: '#7DD3FC',
  danger: '#EF4444',
  dangerSurface: '#2D1214',
  warning: '#F59E0B',
  warningSurface: '#2D2206',
  success: '#10B981',
  successSurface: '#0D2818',
};

const lightTokens: ColorTokens = {
  bgPrimary: '#F8FAFC',
  bgSurface: '#FFFFFF',
  bgSurfaceHover: '#F1F5F9',
  borderDefault: '#E2E8F0',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  accentPrimary: '#0EA5E9',
  accentPrimaryHover: '#0284C7',
  accentSecondary: '#7DD3FC',
  danger: '#DC2626',
  dangerSurface: '#FEE2E2',
  warning: '#D97706',
  warningSurface: '#FEF3C7',
  success: '#059669',
  successSurface: '#D1FAE5',
};

export function useTheme(): Theme {
  const systemScheme = useColorScheme();
  const themeOverride = useSession((s) => s.themeOverride);
  const scheme = themeOverride ?? systemScheme ?? 'dark';
  const isDark = scheme === 'dark';
  return {
    colors: isDark ? darkTokens : lightTokens,
    isDark,
  };
}
