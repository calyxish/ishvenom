/**
 * Onboarding — offline model prompt.
 *
 * Shown once after the user completes onboarding. Asks if they want to
 * download the on-device GGUF model for offline use. Skipping sends them
 * straight to the main app. The download option is always available later
 * in Settings → AI Model.
 */
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../src/hooks/useTheme';
import { MODEL_SIZE_GB } from '../../src/lib/modelDownload';

const BENEFITS = [
  { icon: 'signal-off', text: 'Works without internet — use it in the field' },
  { icon: 'lock-outline', text: 'Fully private — AI runs on your device' },
  { icon: 'lightning-bolt', text: 'No data costs after download' },
] as const;

export default function OnboardingModelScreen() {
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <View style={styles.inner}>
        <MaterialCommunityIcons
          name="cellphone-arrow-down"
          size={56}
          color={colors.accentPrimary}
        />

        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Enable Offline Mode?
        </Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          Download the AI model once (~{MODEL_SIZE_GB} GB) to use IshVenom
          without internet — even in remote areas with no signal.
        </Text>

        <View style={[styles.benefitsBox, { backgroundColor: colors.bgSurface, borderColor: colors.borderDefault }]}>
          {BENEFITS.map((b) => (
            <View key={b.icon} style={styles.benefitRow}>
              <MaterialCommunityIcons name={b.icon as never} size={18} color={colors.accentSecondary} />
              <Text style={[styles.benefitText, { color: colors.textSecondary }]}>{b.text}</Text>
            </View>
          ))}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: pressed ? colors.accentPrimaryHover : colors.accentPrimary },
          ]}
          onPress={() => router.replace('/model-download')}
        >
          <Text style={[styles.btnText, { color: colors.textPrimary }]}>
            Download now ({MODEL_SIZE_GB} GB)
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.skipBtn,
            {
              backgroundColor: pressed ? colors.bgSurfaceHover : colors.bgSurface,
              borderColor: colors.borderDefault,
            },
          ]}
          onPress={() => router.replace('/(tabs)/')}
        >
          <Text style={[styles.skipText, { color: colors.textSecondary }]}>
            Skip — use cloud mode for now
          </Text>
        </Pressable>

        <Text style={[styles.hint, { color: colors.textMuted }]}>
          You can download it anytime from Settings → AI Model
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 20,
  },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  sub: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
  benefitsBox: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  benefitText: { fontSize: 14, flex: 1 },
  btn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnText: { fontSize: 16, fontWeight: '700' },
  skipBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  skipText: { fontSize: 15, fontWeight: '500' },
  hint: { fontSize: 12, textAlign: 'center' },
});
