import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../src/hooks/useTheme';

// Logo mark — expo-image decodes SVG at runtime on both iOS and Android
const LOGO = require('../../assets/logo.svg') as number;

export default function WelcomeScreen() {
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <View style={styles.inner}>
        <View style={styles.hero}>
          <Image source={LOGO} style={styles.logo} contentFit="contain" />
          <Text style={[styles.appName, { color: colors.textPrimary }]}>IshVenom</Text>
          <Text style={[styles.tagline, { color: colors.accentSecondary }]}>
            Offline snakebite triage for Africa
          </Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            Identify venomous snakes, get first-aid guidance, and find the
            nearest clinic — all without internet or a GPU.
          </Text>
        </View>

        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.btn,
              { backgroundColor: pressed ? colors.accentPrimaryHover : colors.accentPrimary },
            ]}
            onPress={() => router.push('/onboarding/language')}
          >
            <Text style={[styles.btnText, { color: colors.textPrimary }]}>Get Started</Text>
          </Pressable>

          <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
            This app supports — it does not replace — professional medical care.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, padding: 32, justifyContent: 'space-between' },
  hero: { flex: 1, justifyContent: 'center', gap: 16 },
  logo: { width: 96, height: 96, marginBottom: 8 },
  appName: { fontSize: 48, fontWeight: '800', letterSpacing: -1 },
  tagline: { fontSize: 20, fontWeight: '600', lineHeight: 28 },
  body: { fontSize: 16, lineHeight: 24, marginTop: 8 },
  footer: { gap: 20 },
  btn: {
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
  },
  btnText: { fontSize: 18, fontWeight: '700' },
  disclaimer: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
