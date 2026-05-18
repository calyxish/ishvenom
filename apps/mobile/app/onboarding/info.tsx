import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../src/hooks/useTheme';
import { useSession } from '../../src/store/session';

const COUNTRIES: { label: string; code: string }[] = [
  { label: 'Ghana', code: 'GH' },
  { label: 'Nigeria', code: 'NG' },
  { label: 'Senegal', code: 'SN' },
  { label: 'Burkina Faso', code: 'BF' },
  { label: "Cote d'Ivoire", code: 'CI' },
  { label: 'Sudan', code: 'SD' },
  { label: 'Kenya', code: 'KE' },
  { label: 'Tanzania', code: 'TZ' },
  { label: 'Uganda', code: 'UG' },
  { label: 'Chad', code: 'TD' },
  { label: 'Mauritania', code: 'MR' },
  { label: 'Egypt', code: 'EG' },
  { label: 'Other', code: 'XX' },
];

export default function InfoScreen() {
  const { colors } = useTheme();
  const setName = useSession((s) => s.setName);
  const setCountry = useSession((s) => s.setCountry);
  const markOnboarded = useSession((s) => s.markOnboarded);
  const sessionCountry = useSession((s) => s.country);

  const [name, setNameLocal] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(sessionCountry);

  function handleStart() {
    if (name.trim()) setName(name.trim());
    setCountry(selectedCountry);
    markOnboarded();
    // Go to optional offline model prompt before entering main app
    router.replace('/onboarding/model');
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.inner}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.heading, { color: colors.textPrimary }]}>Almost there</Text>
          <Text style={[styles.subLabel, { color: colors.textSecondary }]}>
            This info stays on your device and is never synced.
          </Text>

          {/* Name input */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Your name (optional)
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: colors.borderDefault,
                  color: colors.textPrimary,
                  backgroundColor: colors.bgSurface,
                },
              ]}
              placeholder="e.g. Kwame"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setNameLocal}
              autoCapitalize="words"
              returnKeyType="done"
            />
          </View>

          {/* Country picker */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Your country</Text>
            <View style={[styles.countryList, { borderColor: colors.borderDefault }]}>
              {COUNTRIES.map((c, idx) => {
                const isSelected = c.code === selectedCountry;
                const isLast = idx === COUNTRIES.length - 1;
                return (
                  <Pressable
                    key={c.code}
                    onPress={() => setSelectedCountry(c.code)}
                    style={({ pressed }) => [
                      styles.countryRow,
                      !isLast && {
                        borderBottomWidth: 1,
                        borderBottomColor: colors.borderDefault,
                      },
                      pressed && { backgroundColor: colors.bgSurfaceHover },
                      { backgroundColor: isSelected ? colors.bgSurfaceHover : colors.bgSurface },
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text
                      style={[
                        styles.countryLabel,
                        { color: isSelected ? colors.accentPrimary : colors.textPrimary },
                      ]}
                    >
                      {c.label}
                    </Text>
                    {isSelected && (
                      <MaterialCommunityIcons
                        name="check"
                        size={20}
                        color={colors.accentPrimary}
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* CTA */}
          <Pressable
            style={({ pressed }) => [
              styles.btn,
              { backgroundColor: pressed ? colors.accentPrimaryHover : colors.accentPrimary },
            ]}
            onPress={handleStart}
          >
            <Text style={[styles.btnText, { color: colors.textPrimary }]}>
              Start using IshVenom
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { padding: 32, gap: 24 },
  heading: { fontSize: 28, fontWeight: '800' },
  subLabel: { fontSize: 14, lineHeight: 20, marginTop: -16 },
  fieldGroup: { gap: 8 },
  label: { fontSize: 14, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  countryList: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  countryLabel: { fontSize: 16 },
  btn: {
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
    marginTop: 8,
  },
  btnText: { fontSize: 18, fontWeight: '700' },
});
