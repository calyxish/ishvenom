import { ScrollView, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useSession } from '../src/store/session';
import { getTriageInstructions } from '../src/lib/firstAid';
import { FirstAidSteps } from '../src/components/FirstAidSteps';

/**
 * Emergency screen: skips the camera entirely and shows worst-case
 * first-aid steps in the user's language. This is what you tap when
 * someone has just been bitten and you don't have time to photograph.
 */
export default function EmergencyScreen() {
  const { t } = useTranslation();
  const language = useSession((s) => s.language);
  const selection = getTriageInstructions({
    language,
    wasBite: true,
    venomous: 'deadly',
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t('emergency.title')}</Text>
        <Text style={styles.sub}>{t('emergency.subtitle')}</Text>
        <FirstAidSteps
          generation={{
            summary: selection.summary,
            steps: selection.immediate.map((s) => ({ title: s.title, body: s.body })),
            doNot: selection.doNot.map((s) => s.body),
            latencyMs: 0,
            fallback: true,
          }}
          fellBackToEnglish={selection.fellBackTo === 'en'}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1020' },
  scroll: { padding: 20 },
  title: { color: '#fff', fontSize: 28, fontWeight: '800', marginBottom: 4 },
  sub: { color: '#94a3b8', fontSize: 14, marginBottom: 20 },
});
