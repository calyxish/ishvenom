import { ScrollView, View, Text, StyleSheet, Pressable, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import i18n from '../../src/i18n';
import { useSession } from '../../src/store/session';
import { LanguageSelector } from '../../src/components/LanguageSelector';
import { SyncStatusBadge } from '../../src/components/SyncStatusBadge';
import { useTheme } from '../../src/hooks/useTheme';
import type { Language } from '@ishvenom/shared-types';
import { resetDeviceId } from '../../src/lib/deviceId';
import { isModelDownloaded, deleteModel } from '../../src/lib/modelDownload';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const language = useSession((s) => s.language);
  const setLanguage = useSession((s) => s.setLanguage);
  const country = useSession((s) => s.country);
  const themeOverride = useSession((s) => s.themeOverride);
  const setThemeOverride = useSession((s) => s.setThemeOverride);
  const [modelDownloaded, setModelDownloaded] = useState<boolean | null>(null);

  useEffect(() => {
    isModelDownloaded().then(setModelDownloaded);
  }, []);

  async function handleDeleteModel() {
    await deleteModel();
    setModelDownloaded(false);
  }

  function onLanguageChange(l: Language) {
    setLanguage(l);             // persists + updates Zustand → root direction flips instantly
    void i18n.changeLanguage(l); // swaps all translated strings live
  }

  function onThemeToggle(value: boolean) {
    setThemeOverride(value ? 'dark' : 'light');
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <ScrollView contentContainerStyle={styles.scroll}>

        <Text style={[styles.section, { color: colors.accentSecondary }]}>
          {t('settings.language')}
        </Text>
        <LanguageSelector current={language} onChange={onLanguageChange} />

        <Text style={[styles.section, { color: colors.accentSecondary }]}>APPEARANCE</Text>
        <View style={[styles.card, { backgroundColor: colors.bgSurface, borderColor: colors.borderDefault }]}>
          <View style={styles.row}>
            <View>
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>Dark mode</Text>
              <Text style={[styles.rowSub, { color: colors.textMuted }]}>
                {themeOverride === null ? 'Following system setting' : isDark ? 'Forced dark' : 'Forced light'}
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={onThemeToggle}
              trackColor={{ false: colors.borderDefault, true: colors.accentPrimary }}
              thumbColor={colors.textPrimary}
            />
          </View>
          {themeOverride !== null && (
            <Pressable onPress={() => setThemeOverride(null)}>
              <Text style={[styles.resetLink, { color: colors.accentSecondary }]}>
                Reset to system default
              </Text>
            </Pressable>
          )}
        </View>

        <Text style={[styles.section, { color: colors.accentSecondary }]}>
          {t('settings.sync')}
        </Text>
        <SyncStatusBadge />
        <Text style={[styles.meta, { color: colors.textMuted }]}>Country: {country}</Text>

        <Text style={[styles.section, { color: colors.accentSecondary }]}>AI MODEL</Text>
        <View style={[styles.card, { backgroundColor: colors.bgSurface, borderColor: colors.borderDefault }]}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>On-device model</Text>
              <Text style={[styles.rowSub, { color: colors.textMuted }]}>
                Download once to use IshVenom offline
              </Text>
            </View>
            {modelDownloaded === null ? null : modelDownloaded ? (
              <View style={[styles.statusBadge, { backgroundColor: colors.successSurface ?? colors.bgSurface, borderColor: colors.success ?? colors.accentSecondary }]}>
                <MaterialCommunityIcons name="check-circle" size={14} color={colors.success ?? colors.accentSecondary} />
                <Text style={[styles.statusText, { color: colors.success ?? colors.accentSecondary }]}>Downloaded</Text>
              </View>
            ) : (
              <View style={[styles.statusBadge, { backgroundColor: colors.bgSurface, borderColor: colors.borderDefault }]}>
                <MaterialCommunityIcons name="download-outline" size={14} color={colors.textMuted} />
                <Text style={[styles.statusText, { color: colors.textMuted }]}>Not downloaded</Text>
              </View>
            )}
          </View>

          {modelDownloaded === false && (
            <Pressable
              style={[styles.modelBtn, { backgroundColor: colors.accentPrimary }]}
              onPress={() => router.push('/model-download')}
            >
              <Text style={[styles.modelBtnText, { color: colors.textPrimary }]}>Download now (~2.5 GB)</Text>
            </Pressable>
          )}

          {modelDownloaded === true && (
            <Pressable
              style={[styles.modelBtn, { backgroundColor: colors.dangerSurface, borderWidth: 1, borderColor: colors.danger }]}
              onPress={() => { void handleDeleteModel(); }}
            >
              <Text style={[styles.modelBtnText, { color: colors.danger }]}>Delete model</Text>
            </Pressable>
          )}
        </View>

        <Text style={[styles.section, { color: colors.accentSecondary }]}>
          {t('settings.privacy')}
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          {t('settings.privacyBody')}
        </Text>
        <Pressable
          style={[styles.dangerBtn, { backgroundColor: colors.dangerSurface, borderColor: colors.danger }]}
          onPress={() => { void resetDeviceId(); }}
        >
          <Text style={[styles.dangerText, { color: colors.danger }]}>
            {t('settings.forgetMe')}
          </Text>
        </Pressable>

        <Text style={[styles.section, { color: colors.accentSecondary }]}>
          {t('settings.about')}
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          IshVenom · Expo SDK 54 · Apache-2.0
        </Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          Offline snakebite triage for Africa. Powered by Gemma 4 E2B.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20 },
  section: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 8,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 2 },
  resetLink: { fontSize: 12, textDecorationLine: 'underline' },
  body: { fontSize: 14, lineHeight: 20 },
  meta: { fontSize: 12, marginTop: 8 },
  dangerBtn: {
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  dangerText: { fontWeight: '700' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusText: { fontSize: 11, fontWeight: '600' },
  modelBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modelBtnText: { fontSize: 14, fontWeight: '700' },
});
