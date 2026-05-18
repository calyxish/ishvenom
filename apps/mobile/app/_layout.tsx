import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getDeviceId } from '../src/lib/deviceId';
import { useSession, loadPersistedSession } from '../src/store/session';
import { seedAntivenomCenters, seedSpecies } from '../src/lib/seedData';
import { useTheme } from '../src/hooks/useTheme';
import i18n from '../src/i18n';

export default function RootLayout() {
  const setDeviceId = useSession((s) => s.setDeviceId);
  const language = useSession((s) => s.language);
  const { colors, isDark } = useTheme();

  useEffect(() => {
    void (async () => {
      // Hydrate store from AsyncStorage; sets sessionLoaded: true when done.
      // app/index.tsx reads sessionLoaded and waits before redirecting.
      await loadPersistedSession();

      // Re-apply the persisted language to i18n — it initialises from the
      // device locale on every cold start so we must sync it here.
      const storedLang = useSession.getState().language;
      if (i18n.language !== storedLang) {
        void i18n.changeLanguage(storedLang);
      }

      // No syncRtlForLanguage here — the direction style prop on the root
      // View handles RTL reactively without any app reload.

      const id = await getDeviceId();
      setDeviceId(id);

      // Seed bundled species + antivenom centers into SQLite (no-op if already seeded).
      void seedSpecies();
      void seedAntivenomCenters();
    })();
  }, [setDeviceId]);

  return (
    <SafeAreaProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {/*
        Root direction wrapper — subscribes to `language` from the session
        store. When the user switches to Arabic, language becomes 'ar',
        this component re-renders, and direction flips to 'rtl' instantly
        across every screen, card, and component in the navigation tree.
        Switching back to any LTR language flips it back the same way.
      */}
      <View style={{ flex: 1, direction: language === 'ar' ? 'rtl' : 'ltr' }}>
        <Stack screenOptions={{ headerShown: false }}>
          {/* Onboarding — shown on first launch only */}
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />

          {/* Model download — shown when GGUF not yet on device */}
          <Stack.Screen name="model-download" options={{ headerShown: false }} />

          {/* Main app — tab bar lives inside (tabs)/_layout.tsx */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

          {/* Full-screen modals that push over the tab bar */}
          <Stack.Screen
            name="result"
            options={{
              headerShown: true,
              title: 'Result',
              presentation: 'modal',
              headerStyle: { backgroundColor: colors.bgPrimary },
              headerTintColor: colors.textPrimary,
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="emergency"
            options={{
              headerShown: true,
              title: 'Emergency First Aid',
              presentation: 'modal',
              headerStyle: { backgroundColor: colors.bgPrimary },
              headerTintColor: colors.textPrimary,
              headerShadowVisible: false,
            }}
          />
        </Stack>
      </View>
    </SafeAreaProvider>
  );
}
