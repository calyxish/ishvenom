/**
 * EmergencySection — inline emergency response block on the result screen.
 *
 * Rendered only when wasBite is true. Contains (top to bottom):
 *   1. Section divider
 *   2. Urgency banner + live bite timer (BiteTimer)
 *   3. Nearest antivenom clinic card
 *   4. Call / Get directions buttons (side-by-side)
 *   5. Send emergency SMS (full-width, hidden if SMS unavailable)
 *
 * All network calls are local SQLite — no internet needed.
 */
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Linking,
} from 'react-native';
import * as SMS from 'expo-sms';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { BiteTimer } from './BiteTimer';
import {
  calculateUrgency,
  buildEmergencySms,
  resolveNearestClinic,
  type VenomLevel,
  type ResolvedClinic,
} from '../lib/emergency';
import type { QueuedEncounter } from '../lib/db';

interface Props {
  encounter: QueuedEncounter;
  venomLevel: VenomLevel;
}

export function EmergencySection({ encounter, venomLevel }: Props) {
  const { colors } = useTheme();
  const [clinic, setClinic] = useState<ResolvedClinic | null>(null);
  const [clinicLoading, setClinicLoading] = useState(true);
  const [smsAvailable, setSmsAvailable] = useState(false);

  useEffect(() => {
    void resolveNearestClinic(encounter)
      .then(setClinic)
      .finally(() => setClinicLoading(false));
    void SMS.isAvailableAsync().then(setSmsAvailable);
  }, [encounter]);

  const urgency = calculateUrgency(venomLevel);

  const hasPhone = Boolean(clinic?.phone);

  async function handleCall() {
    if (!clinic?.phone) return;
    await Linking.openURL(`tel:${clinic.phone}`);
  }

  async function handleDirections() {
    if (!clinic) return;
    await Linking.openURL(
      `https://maps.google.com/maps?daddr=${clinic.latitude},${clinic.longitude}`,
    );
  }

  async function handleSms() {
    if (!smsAvailable) return;
    const body = buildEmergencySms(encounter);
    const recipients = clinic?.phone ? [clinic.phone] : [];
    await SMS.sendSMSAsync(recipients, body);
  }

  return (
    <View>
      {/* Section divider */}
      <View style={[styles.divider, { borderColor: colors.borderDefault }]} />

      {/* Urgency banner */}
      <View
        style={[
          styles.urgencyBanner,
          { backgroundColor: colors.bgSurface, borderColor: colors.accentPrimary },
        ]}
      >
        <Text style={[styles.urgencyLabel, { color: colors.textPrimary }]}>
          {urgency.label}
        </Text>
        <BiteTimer createdAt={encounter.createdAt} />
      </View>

      {/* Clinic card */}
      <View
        style={[
          styles.clinicCard,
          {
            backgroundColor: colors.bgSurface,
            borderColor: colors.borderDefault,
          },
        ]}
      >
        <View style={[styles.clinicAccent, { backgroundColor: colors.accentPrimary }]} />
        <View style={styles.clinicBody}>
          {clinicLoading ? (
            <ActivityIndicator color={colors.accentPrimary} />
          ) : clinic ? (
            <>
              <Text style={[styles.clinicName, { color: colors.textPrimary }]}>
                {clinic.name}
              </Text>
              {clinic.formattedDistance !== null && (
                <Text style={[styles.clinicMeta, { color: colors.textSecondary }]}>
                  {clinic.formattedDistance}
                </Text>
              )}
              {clinic.phone && (
                <Text style={[styles.clinicMeta, { color: colors.textSecondary }]}>
                  {clinic.phone}
                </Text>
              )}
            </>
          ) : (
            <Text style={[styles.clinicName, { color: colors.textSecondary }]}>
              No antivenom center found nearby — seek any medical facility
            </Text>
          )}
        </View>
      </View>

      {/* Call + Directions buttons */}
      <View style={styles.actionRow}>
        <Pressable
          style={({ pressed }) => [
            styles.actionBtn,
            styles.actionBtnPrimary,
            {
              backgroundColor: hasPhone
                ? pressed
                  ? colors.accentPrimaryHover
                  : colors.accentPrimary
                : colors.bgSurface,
              borderColor: hasPhone ? colors.accentPrimary : colors.borderDefault,
              opacity: hasPhone ? 1 : 0.5,
            },
          ]}
          disabled={!hasPhone}
          onPress={() => { void handleCall(); }}
        >
          <MaterialCommunityIcons
            name="phone"
            size={20}
            color={hasPhone ? colors.textPrimary : colors.textMuted}
          />
          <Text
            style={[
              styles.actionBtnText,
              { color: hasPhone ? colors.textPrimary : colors.textMuted },
            ]}
          >
            Call clinic
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.actionBtn,
            {
              backgroundColor: pressed ? colors.bgSurfaceHover : colors.bgSurface,
              borderColor: colors.borderDefault,
            },
          ]}
          disabled={!clinic}
          onPress={() => { void handleDirections(); }}
        >
          <MaterialCommunityIcons
            name="map-marker"
            size={20}
            color={clinic ? colors.textPrimary : colors.textMuted}
          />
          <Text
            style={[
              styles.actionBtnText,
              { color: clinic ? colors.textPrimary : colors.textMuted },
            ]}
          >
            Get directions
          </Text>
        </Pressable>
      </View>

      {/* Emergency SMS — hidden on Wi-Fi-only tablets */}
      {smsAvailable && (
        <Pressable
          style={({ pressed }) => [
            styles.smsBtn,
            { backgroundColor: pressed ? colors.accentPrimaryHover : colors.accentPrimary },
          ]}
          onPress={() => { void handleSms(); }}
        >
          <MaterialCommunityIcons name="message-text" size={20} color={colors.textPrimary} />
          <Text style={[styles.smsBtnText, { color: colors.textPrimary }]}>
            Send emergency SMS
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  divider: {
    borderTopWidth: 1,
    marginVertical: 20,
  },
  urgencyBanner: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  urgencyLabel: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  clinicCard: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  clinicAccent: {
    width: 4,
  },
  clinicBody: {
    flex: 1,
    padding: 16,
    gap: 4,
  },
  clinicName: {
    fontSize: 15,
    fontWeight: '700',
  },
  clinicMeta: {
    fontSize: 13,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  actionBtnPrimary: {
    // background/border set dynamically
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  smsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 52,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  smsBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
