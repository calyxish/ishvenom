/**
 * Home — landing screen.
 *
 * On mount:
 *   1. Loads all local encounters to populate accurate stats.
 *   2. Fires a background sync (flush → POST /api/v1/encounters) if online.
 *   3. Reloads after sync so sync pills and counts update.
 *
 * Pull-to-refresh repeats the same cycle manually.
 */
import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import * as Network from 'expo-network';
import { SyncStatusBadge } from '../../src/components/SyncStatusBadge';
import { useTheme } from '../../src/hooks/useTheme';

const LOGO = require('../../assets/logo.svg') as number;
import {
  listRecentEncounters,
  listUnsyncedEncounters,
  markEncountersSynced,
  type QueuedEncounter,
} from '../../src/lib/db';
import { flush } from '../../src/lib/sync';
import { apiClient } from '../../src/lib/apiClient';
import { useSession } from '../../src/store/session';

// ─── Safety tips (one shown per day, cycles through the list) ─────────────────

const TIPS = [
  'Never handle a snake with bare hands, even if you believe it is dead.',
  'Most bites happen near the home. Wear shoes when working in grass or the garden.',
  'Keep your compound clear of wood piles and debris where snakes shelter.',
  'If you see a snake, stand still and back away slowly. Do not run or strike at it.',
  'Shake out boots and clothing left outdoors before putting them on.',
  'Never reach into holes, crevices, or thick vegetation without checking first.',
  'After dark, carry a torch. Many venomous snakes are active at night.',
];

function dailyTip(): string {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000,
  );
  return TIPS[dayOfYear % TIPS.length] ?? TIPS[0]!;
}

// ─── Greeting ─────────────────────────────────────────────────────────────────

function greeting(name: string): string {
  const h = new Date().getHours();
  const salutation = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return name ? `${salutation}, ${name}` : salutation;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const name = useSession((s) => s.name);
  const setSyncInFlight = useSession((s) => s.setSyncInFlight);
  const setLastSyncAt = useSession((s) => s.setLastSyncAt);
  const setUnsyncedCount = useSession((s) => s.setUnsyncedCount);

  const [totalCount, setTotalCount] = useState(0);
  const [biteCount, setBiteCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [recent, setRecent] = useState<QueuedEncounter[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Load all encounters and push accurate counts into session store
  const loadLocal = useCallback(async () => {
    try {
      const rows = await listRecentEncounters(100);
      setTotalCount(rows.length);
      setBiteCount(rows.filter((r) => r.wasBite).length);
      const unsynced = rows.filter((r) => r.syncedAt === null).length;
      setPendingCount(unsynced);
      setUnsyncedCount(unsynced);
      setRecent(rows.slice(0, 3));
    } catch {
      // DB not ready on very first launch — silently skip
    }
  }, [setUnsyncedCount]);

  // Background sync: flush queue → update session store → reload
  const syncInBackground = useCallback(async () => {
    setSyncInFlight(true);
    try {
      const net = await Network.getNetworkStateAsync();
      if (!net.isConnected) return;

      const result = await flush({
        api: apiClient,
        listUnsynced: listUnsyncedEncounters,
        markSynced: markEncountersSynced,
        isOnline: async () => {
          const s = await Network.getNetworkStateAsync();
          return s.isConnected === true;
        },
      });

      if (!result.skipped && result.accepted > 0) {
        setLastSyncAt(new Date().toISOString());
      }
    } catch {
      // Sync failure is silent — data is safe in SQLite
    } finally {
      setSyncInFlight(false);
    }
  }, [setSyncInFlight, setLastSyncAt]);

  // On mount: load local first, then sync + reload
  useEffect(() => {
    void (async () => {
      await loadLocal();
      await syncInBackground();
      await loadLocal(); // refresh sync pills after upload
    })();
  }, [loadLocal, syncInBackground]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncInBackground();
    await loadLocal();
    setRefreshing(false);
  }, [syncInBackground, loadLocal]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { void onRefresh(); }}
            tintColor={colors.accentPrimary}
            colors={[colors.accentPrimary]}
          />
        }
      >
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Image source={LOGO} style={styles.brandLogo} contentFit="contain" />
            <View>
              <Text style={[styles.brand, { color: colors.textPrimary }]}>IshVenom</Text>
              <Text style={[styles.greet, { color: colors.textSecondary }]}>
                {greeting(name)}
              </Text>
            </View>
          </View>
          <SyncStatusBadge />
        </View>

        {/* ── Stats ────────────────────────────────────────────────────────── */}
        <View
          style={[
            styles.statsRow,
            { backgroundColor: colors.bgSurface, borderColor: colors.borderDefault },
          ]}
        >
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color: colors.accentSecondary }]}>
              {totalCount}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Encounters</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.borderDefault }]} />
          <View style={styles.stat}>
            <Text
              style={[
                styles.statNum,
                { color: pendingCount > 0 ? colors.warning : colors.accentSecondary },
              ]}
            >
              {pendingCount}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Pending</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.borderDefault }]} />
          <View style={styles.stat}>
            <Text
              style={[
                styles.statNum,
                { color: biteCount > 0 ? colors.danger : colors.accentSecondary },
              ]}
            >
              {biteCount}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Bites</Text>
          </View>
        </View>

        {/* ── Emergency CTA ────────────────────────────────────────────────── */}
        <Pressable
          style={({ pressed }) => [
            styles.emergencyBtn,
            {
              backgroundColor: pressed ? colors.danger : colors.dangerSurface,
              borderColor: colors.danger,
            },
          ]}
          onPress={() => router.push('/emergency')}
        >
          <Text style={[styles.emergencyTitle, { color: colors.danger }]}>
            {t('home.emergencyButton')}
          </Text>
          <Text style={[styles.emergencySub, { color: colors.textMuted }]}>
            Immediate first-aid steps — no camera needed
          </Text>
        </Pressable>

        {/* ── Identify CTA ─────────────────────────────────────────────────── */}
        <Pressable
          style={({ pressed }) => [
            styles.identifyBtn,
            {
              backgroundColor: pressed
                ? colors.accentPrimaryHover
                : colors.accentPrimary,
            },
          ]}
          onPress={() => router.push('/identify')}
        >
          <Text style={[styles.identifyText, { color: colors.textPrimary }]}>
            {t('home.identifyButton')}
          </Text>
        </Pressable>

        {/* ── Safety tip ───────────────────────────────────────────────────── */}
        <View
          style={[
            styles.tipCard,
            { backgroundColor: colors.bgSurface, borderColor: colors.borderDefault },
          ]}
        >
          <Text style={[styles.tipLabel, { color: colors.accentPrimary }]}>
            SAFETY TIP
          </Text>
          <Text style={[styles.tipText, { color: colors.textSecondary }]}>
            {dailyTip()}
          </Text>
        </View>

        {/* ── Recent encounters ─────────────────────────────────────────────── */}
        {recent.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
              RECENT ENCOUNTERS
            </Text>
            {recent.map((enc) => (
              <View
                key={enc.id}
                style={[
                  styles.encRow,
                  { backgroundColor: colors.bgSurface, borderColor: colors.borderDefault },
                ]}
              >
                {/* Bite stripe */}
                {enc.wasBite && (
                  <View style={[styles.encStripe, { backgroundColor: colors.danger }]} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.encSpecies, { color: colors.textPrimary }]}>
                    {enc.speciesGuess
                      ? enc.speciesGuess.replace(/_/g, ' ')
                      : 'Unknown snake'}
                  </Text>
                  <Text style={[styles.encMeta, { color: colors.textMuted }]}>
                    {enc.wasBite ? 'Bite' : 'Sighting'} ·{' '}
                    {new Date(enc.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                    {enc.district ? ` · ${enc.district}` : ''}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.encSync,
                    { color: enc.syncedAt ? colors.success : colors.warning },
                  ]}
                >
                  {enc.syncedAt ? '● synced' : '● pending'}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Disclaimer ────────────────────────────────────────────────────── */}
        <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
          {t('home.disclaimer')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandLogo: { width: 40, height: 40 },
  brand: { fontSize: 24, fontWeight: '800' },
  greet: { fontSize: 13, marginTop: 2 },

  statsRow: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  stat: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, marginHorizontal: 8 },

  emergencyBtn: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 12,
  },
  emergencyTitle: { fontSize: 18, fontWeight: '800' },
  emergencySub: { fontSize: 12, marginTop: 4 },

  identifyBtn: {
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  identifyText: { fontSize: 18, fontWeight: '700' },

  tipCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
    gap: 6,
  },
  tipLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  tipText: { fontSize: 13, lineHeight: 20 },

  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  encRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 8,
  },
  encStripe: { width: 4, alignSelf: 'stretch' },
  encSpecies: { fontSize: 14, fontWeight: '700', paddingLeft: 12, paddingTop: 12 },
  encMeta: { fontSize: 12, marginTop: 2, paddingLeft: 12, paddingBottom: 12 },
  encSync: { fontSize: 11, fontWeight: '700', paddingRight: 14 },

  disclaimer: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
});
