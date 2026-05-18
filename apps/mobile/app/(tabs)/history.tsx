/**
 * History — scrollable log of all encounters recorded on this device.
 *
 * Shows: photo thumbnail, species, confidence, bite/sighting badge,
 * date, location, sync status pill.
 *
 * Pull-to-refresh flushes the unsynced queue to the backend first,
 * then reloads from local SQLite so sync pills update immediately.
 * All reads are local — the screen works fully offline.
 */
import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Network from 'expo-network';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  listRecentEncounters,
  listUnsyncedEncounters,
  markEncountersSynced,
  type QueuedEncounter,
} from '../../src/lib/db';
import { getEncounterThumbUri } from '../../src/lib/imageStore';
import { flush } from '../../src/lib/sync';
import { apiClient } from '../../src/lib/apiClient';
import { useSession } from '../../src/store/session';
import { useTheme } from '../../src/hooks/useTheme';

// ─── Thumbnail ────────────────────────────────────────────────────────────────

function Thumb({
  encounterId,
  imagePath,
}: {
  encounterId: string;
  imagePath: string | null;
}) {
  const { colors } = useTheme();
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    if (imagePath) {
      void getEncounterThumbUri(encounterId).then((u) => setUri(u ?? imagePath));
    }
  }, [encounterId, imagePath]);

  if (!uri) {
    return (
      <View style={[styles.thumbPlaceholder, { backgroundColor: colors.bgSurfaceHover }]}>
        <MaterialCommunityIcons name="camera-off-outline" size={20} color={colors.textMuted} />
      </View>
    );
  }
  return <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  );
}

function formatRelative(iso: string | null): string {
  if (!iso) return '';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'Synced just now';
  if (diff < 3600) return `Synced ${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `Synced ${Math.floor(diff / 3600)}h ago`;
  return `Synced ${Math.floor(diff / 86400)}d ago`;
}

function confidenceLabel(c: number | null): string {
  if (c === null) return '';
  return `${Math.round(c * 100)}% confidence`;
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function EncounterRow({ item }: { item: QueuedEncounter }) {
  const { colors } = useTheme();
  const isBite = item.wasBite;
  const isSynced = item.syncedAt !== null;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.bgSurface, borderColor: colors.borderDefault },
      ]}
    >
      {isBite && <View style={[styles.biteStripe, { backgroundColor: colors.danger }]} />}

      <Thumb encounterId={item.id} imagePath={item.imagePath} />

      <View style={styles.cardBody}>
        <View style={styles.topRow}>
          <Text
            style={[styles.species, { color: colors.textPrimary }]}
            numberOfLines={1}
          >
            {item.speciesGuess ? item.speciesGuess.replace(/_/g, ' ') : 'Unknown snake'}
          </Text>
          <View
            style={[
              styles.badge,
              { backgroundColor: isBite ? colors.dangerSurface : colors.successSurface },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                { color: isBite ? colors.danger : colors.success },
              ]}
            >
              {isBite ? 'BITE' : 'SIGHTING'}
            </Text>
          </View>
        </View>

        {item.confidence !== null && (
          <Text style={[styles.confidence, { color: colors.accentSecondary }]}>
            {confidenceLabel(item.confidence)}
          </Text>
        )}

        <Text style={[styles.meta, { color: colors.textSecondary }]}>
          {formatDate(item.createdAt)}
        </Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {[item.district, item.country].filter(Boolean).join(', ')}
        </Text>
      </View>

      <View style={styles.syncCol}>
        <View
          style={[
            styles.syncPill,
            { borderColor: isSynced ? colors.success : colors.warning },
          ]}
        >
          <View
            style={[
              styles.syncDot,
              { backgroundColor: isSynced ? colors.success : colors.warning },
            ]}
          />
          <Text
            style={[
              styles.syncText,
              { color: isSynced ? colors.success : colors.warning },
            ]}
          >
            {isSynced ? 'Synced' : 'Pending'}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const { colors } = useTheme();
  const [rows, setRows] = useState<QueuedEncounter[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const lastSyncAt = useSession((s) => s.lastSyncAt);
  const setLastSyncAt = useSession((s) => s.setLastSyncAt);
  const setUnsyncedCount = useSession((s) => s.setUnsyncedCount);

  const loadLocal = useCallback(async () => {
    try {
      const data = await listRecentEncounters(100);
      setRows(data);
      const unsynced = data.filter((r) => r.syncedAt === null).length;
      setUnsyncedCount(unsynced);
    } catch {
      setRows([]);
    }
  }, [setUnsyncedCount]);

  const syncToBackend = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const net = await Network.getNetworkStateAsync();
      if (!net.isConnected) {
        setSyncError('No connection — showing local data');
        return;
      }
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
      setSyncError('Sync failed — data saved locally');
    } finally {
      setSyncing(false);
    }
  }, [setLastSyncAt]);

  useEffect(() => { void loadLocal(); }, [loadLocal]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncToBackend();
    await loadLocal();
    setRefreshing(false);
  }, [syncToBackend, loadLocal]);

  const unsyncedCount = rows.filter((r) => r.syncedAt === null).length;

  // ── Header ──────────────────────────────────────────────────────────────────
  const HeaderComponent = (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>History</Text>
        {syncing && (
          <ActivityIndicator size="small" color={colors.accentPrimary} />
        )}
      </View>

      {/* Status line — only shows meaningful info, no redundant empty-state copy */}
      {rows.length > 0 && (
        <View style={styles.statusRow}>
          <Text style={[styles.statusText, { color: colors.textMuted }]}>
            {rows.length} encounter{rows.length === 1 ? '' : 's'}
          </Text>
          {unsyncedCount > 0 ? (
            <View style={[styles.pendingChip, { backgroundColor: colors.warningSurface }]}>
              <View style={[styles.pendingDot, { backgroundColor: colors.warning }]} />
              <Text style={[styles.pendingText, { color: colors.warning }]}>
                {unsyncedCount} pending
              </Text>
            </View>
          ) : lastSyncAt ? (
            <Text style={[styles.statusText, { color: colors.success }]}>
              {formatRelative(lastSyncAt)}
            </Text>
          ) : null}
        </View>
      )}

      {syncError !== null && (
        <Text style={[styles.errorText, { color: colors.warning }]}>{syncError}</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { void onRefresh(); }}
            tintColor={colors.accentPrimary}
            colors={[colors.accentPrimary]}
          />
        }
        ListHeaderComponent={HeaderComponent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons
              name="clock-outline"
              size={48}
              color={colors.borderDefault}
            />
            <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
              No encounters yet
            </Text>
            <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
              Encounters you record with the Identify tab will appear here.
            </Text>
          </View>
        }
        renderItem={({ item }) => <EncounterRow item={item} />}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, gap: 10, paddingBottom: 32 },

  header: { marginBottom: 12 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: { fontSize: 28, fontWeight: '800' },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  statusText: { fontSize: 13 },
  pendingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  pendingDot: { width: 6, height: 6, borderRadius: 3 },
  pendingText: { fontSize: 11, fontWeight: '600' },
  errorText: { fontSize: 12, marginTop: 4 },

  card: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
  },
  biteStripe: { width: 4, alignSelf: 'stretch' },
  thumb: { width: 72, height: 72 },
  thumbPlaceholder: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 2 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  species: { flex: 1, fontSize: 14, fontWeight: '700' },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  confidence: { fontSize: 11, fontWeight: '600' },
  meta: { fontSize: 11 },

  syncCol: { paddingRight: 12 },
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
    borderWidth: 1,
  },
  syncDot: { width: 6, height: 6, borderRadius: 3 },
  syncText: { fontSize: 10, fontWeight: '600' },

  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptyBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
