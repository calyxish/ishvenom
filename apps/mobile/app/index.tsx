import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { useSession } from '../src/store/session';
import { useTheme } from '../src/hooks/useTheme';

/**
 * Root entry point.
 *
 * Wait for session hydration, then decide where to send the user:
 *   1. Onboarding — first launch ever (includes optional model download prompt)
 *   2. Main app — always, after onboarding is complete
 *
 * Model download is now voluntary: prompted at the end of onboarding
 * and always available in Settings. Cloud (Gemma 4) works without it.
 */
export default function Root() {
  const sessionLoaded = useSession((s) => s.sessionLoaded);
  const hasOnboarded = useSession((s) => s.hasOnboarded);
  const { colors } = useTheme();

  if (!sessionLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.bgPrimary }} />;
  }

  if (!hasOnboarded) return <Redirect href="/onboarding/" />;
  return <Redirect href="/(tabs)/" />;
}
