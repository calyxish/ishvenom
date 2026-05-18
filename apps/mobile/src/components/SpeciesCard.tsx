import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { StoredSpecies } from '../lib/db';
import type { Language } from '@ishvenom/shared-types';
import { useTheme } from '../hooks/useTheme';

interface Props {
  species: StoredSpecies | null;
  confidence: number | null;
  language: Language;
}

const VENOMOUS_LABEL: Record<StoredSpecies['venomous'], string> = {
  deadly: 'DEADLY',
  mildly_venomous: 'MILD VENOM',
  non_venomous: 'NON-VENOMOUS',
};

export function SpeciesCard({ species, confidence, language }: Props) {
  const { colors } = useTheme();


  if (!species) {
    return (
      <View style={[styles.card, { backgroundColor: colors.bgSurface, borderColor: colors.accentPrimary }]}>
        <Text style={[styles.badge, { backgroundColor: colors.accentPrimary, color: colors.textPrimary }]}>
          UNKNOWN
        </Text>
        <Text style={[styles.common, { color: colors.textPrimary }]}>Unknown snake</Text>
        <Text style={[styles.sci, { color: colors.textSecondary }]}>
          Treat as potentially dangerous until a clinician can confirm.
        </Text>
      </View>
    );
  }

  const common =
    species.commonNames[language] ?? species.commonNames.en ?? species.scientificName;

  return (
    <View style={[styles.card, { backgroundColor: colors.bgSurface, borderColor: colors.accentPrimary }]}>
      <Text style={[styles.badge, { backgroundColor: colors.accentPrimary, color: colors.textPrimary }]}>
        {VENOMOUS_LABEL[species.venomous]}
      </Text>
      <Text style={[styles.common, { color: colors.textPrimary }]}>{common}</Text>
      <Text style={[styles.sci, { color: colors.textSecondary }]}>{species.scientificName}</Text>
      {confidence != null && (
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          Confidence: {(confidence * 100).toFixed(0)}%
        </Text>
      )}
      {species.antivenomName && (
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          Antivenom: {species.antivenomName}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 2,
    padding: 20,
    marginBottom: 16,
  },
  badge: {
    alignSelf: 'flex-start',
    fontWeight: '800',
    fontSize: 11,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
  },
  common: { fontSize: 24, fontWeight: '800' },
  sci: { fontStyle: 'italic', fontSize: 14, marginTop: 2 },
  meta: { fontSize: 13, marginTop: 6 },
});
