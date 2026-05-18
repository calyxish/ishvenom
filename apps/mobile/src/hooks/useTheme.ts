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
  bgPrimary: '#0F0D15',
  bgSurface: '#1A1725',
  bgSurfaceHover: '#252236',
  borderDefault: '#2E2B3A',
  textPrimary: '#F5F3FF',
  textSecondary: '#A8A3B8',
  textMuted: '#6B6580',
  accentPrimary: '#7C5AFF',
  accentPrimaryHover: '#6B4AE0',
  accentSecondary: '#A88BFA',
  danger: '#EF4444',
  dangerSurface: '#2D1214',
  warning: '#F59E0B',
  warningSurface: '#2D2206',
  success: '#10B981',
  successSurface: '#0D2818',
};

const lightTokens: ColorTokens = {
  bgPrimary: '#FAFAFE',
  bgSurface: '#FFFFFF',
  bgSurfaceHover: '#F3F1F9',
  borderDefault: '#E4E1EE',
  textPrimary: '#1A1725',
  textSecondary: '#6B6580',
  textMuted: '#A8A3B8',
  accentPrimary: '#7C5AFF',
  accentPrimaryHover: '#6B4AE0',
  accentSecondary: '#A88BFA',
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
