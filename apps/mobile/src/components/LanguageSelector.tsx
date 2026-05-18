/**
 * LanguageSelector — 2-column grid of language cards.
 *
 * Used in:
 *   - Onboarding Step 2 (language selection)
 *   - Settings screen (replacing the old LanguagePicker)
 *
 * Selecting a card calls onChange immediately so the caller can trigger
 * i18next.changeLanguage() and the user sees the UI switch as a live preview.
 */
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LANGUAGE_METADATA, type Language } from '@ishvenom/shared-types';
import { useTheme } from '../hooks/useTheme';

const LANGUAGES = Object.keys(LANGUAGE_METADATA) as Language[];

interface Props {
  current: Language;
  onChange: (lang: Language) => void;
}

export function LanguageSelector({ current, onChange }: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.grid}>
      {LANGUAGES.map((lang) => {
        const meta = LANGUAGE_METADATA[lang];
        const selected = lang === current;

        return (
          <Pressable
            key={lang}
            onPress={() => onChange(lang)}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: pressed ? colors.bgSurfaceHover : colors.bgSurface,
                borderColor: selected ? colors.accentPrimary : colors.borderDefault,
                borderWidth: selected ? 2 : 1,
              },
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${meta.nativeName} — ${meta.name}`}
          >
            <Text style={[styles.nativeName, { color: colors.textPrimary }]}>
              {meta.nativeName}
            </Text>
            <Text style={[styles.englishName, { color: colors.textSecondary }]}>
              {meta.name}
            </Text>
            <Text style={[styles.region, { color: colors.textMuted }]} numberOfLines={1}>
              {meta.regions[0]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    // Each card takes exactly half the grid width minus half the gap
    width: '47%',
    borderRadius: 16,
    padding: 16,
    gap: 4,
  },
  nativeName: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
  },
  englishName: {
    fontSize: 13,
    fontWeight: '500',
  },
  region: {
    fontSize: 11,
    marginTop: 4,
  },
});
