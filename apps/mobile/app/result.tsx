import { ScrollView, View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTriage } from '../src/store/triage';
import { useSession } from '../src/store/session';
import { useTheme } from '../src/hooks/useTheme';
import { SpeciesCard } from '../src/components/SpeciesCard';
import { FirstAidSteps } from '../src/components/FirstAidSteps';
import { CapturedPhoto } from '../src/components/CapturedPhoto';
import { EmergencySection } from '../src/components/EmergencySection';

export default function ResultScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const result = useTriage((s) => s.lastResult);
  const language = useSession((s) => s.language);

  if (!result) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {t('result.empty')}
          </Text>
          <Pressable
            style={[styles.pill, { backgroundColor: colors.accentPrimary }]}
            onPress={() => router.replace('/(tabs)/identify')}
          >
            <MaterialCommunityIcons name="camera" size={15} color={colors.textPrimary} />
            <Text style={[styles.pillText, { color: colors.textPrimary }]}>
              {t('result.tryAgain')}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>

      {/* Sticky top nav — always visible, no scrolling needed */}
      <View style={[styles.topBar, { backgroundColor: colors.bgPrimary, borderBottomColor: colors.borderDefault }]}>
        <Pressable
          style={[styles.pill, { backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderDefault }]}
          onPress={() => router.replace('/(tabs)/')}
        >
          <MaterialCommunityIcons name="check" size={15} color={colors.textPrimary} />
          <Text style={[styles.pillText, { color: colors.textPrimary }]}>
            {t('result.done')}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.pill, { backgroundColor: colors.accentPrimary }]}
          onPress={() => router.replace('/(tabs)/identify')}
        >
          <MaterialCommunityIcons name="camera-outline" size={15} color={colors.textPrimary} />
          <Text style={[styles.pillText, { color: colors.textPrimary }]}>
            {t('result.identifyAnother')}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <CapturedPhoto
          imagePath={result.encounter.imagePath}
          encounterId={result.encounter.id}
        />

        <SpeciesCard
          species={result.species}
          confidence={result.topPredictions[0]?.confidence ?? null}
          language={language}
        />

        {result.encounter.wasBite && (
          <EmergencySection
            encounter={result.encounter}
            venomLevel={result.species?.venomous ?? null}
          />
        )}

        <FirstAidSteps
          generation={result.generation}
          fellBackToEnglish={result.selection.fellBackTo === 'en'}
        />
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  pillText: { fontSize: 13, fontWeight: '700' },
  scroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { marginBottom: 16 },
});
