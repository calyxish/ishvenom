import { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../src/hooks/useTheme';
import { useSession } from '../../src/store/session';
import { LanguageSelector } from '../../src/components/LanguageSelector';
import i18n from '../../src/i18n';
import type { Language } from '@ishvenom/shared-types';

export default function LanguageScreen() {
  const { colors } = useTheme();
  const sessionLang = useSession((s) => s.language);
  const setLanguage = useSession((s) => s.setLanguage);
  const [selected, setSelected] = useState<Language>(sessionLang);

  function handleChange(lang: Language) {
    setSelected(lang);
    setLanguage(lang);          // persists to AsyncStorage + updates Zustand
    void i18n.changeLanguage(lang); // swaps text strings live
    // RTL layout is handled by the direction prop on the root View in
    // _layout.tsx — it reacts to language in the store automatically.
    // No reload needed.
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <View style={styles.inner}>
        <View style={styles.content}>
          <Text style={[styles.heading, { color: colors.textPrimary }]}>
            Choose your language
          </Text>
          <Text style={[styles.subLabel, { color: colors.textSecondary }]}>
            The app will switch as you select
          </Text>

          <LanguageSelector current={selected} onChange={handleChange} />
        </View>

        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.btn,
              { backgroundColor: pressed ? colors.accentPrimaryHover : colors.accentPrimary },
            ]}
            onPress={() => router.push('/onboarding/info')}
          >
            <Text style={[styles.btnText, { color: colors.textPrimary }]}>Continue</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, padding: 32, justifyContent: 'space-between' },
  content: { flex: 1, gap: 8 },
  heading: { fontSize: 28, fontWeight: '800', marginBottom: 4 },
  subLabel: { fontSize: 14, marginBottom: 16 },
  footer: { paddingTop: 20 },
  btn: {
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
  },
  btnText: { fontSize: 18, fontWeight: '700' },
});
