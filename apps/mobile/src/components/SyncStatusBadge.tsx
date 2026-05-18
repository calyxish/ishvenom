/**
 * SyncStatusBadge — live sync state pill for the home header.
 * Reads from the session store which the home screen keeps updated.
 */
import { View, Text, StyleSheet } from 'react-native';
import { useSession } from '../store/session';
import { useTheme } from '../hooks/useTheme';

export function SyncStatusBadge() {
  const { colors } = useTheme();
  const unsyncedCount = useSession((s) => s.unsyncedCount);
  const syncInFlight = useSession((s) => s.syncInFlight);
  const lastSyncAt = useSession((s) => s.lastSyncAt);

  let label: string;
  let color: string;

  if (syncInFlight) {
    label = 'Syncing…';
    color = colors.warning;
  } else if (unsyncedCount > 0) {
    label = `${unsyncedCount} pending`;
    color = colors.danger;
  } else if (lastSyncAt) {
    label = 'All synced';
    color = colors.success;
  } else {
    label = 'Offline';
    color = colors.textMuted;
  }

  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  text: { fontSize: 12, fontWeight: '700' },
});
