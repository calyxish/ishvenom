import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { FirstAidGeneration } from '../lib/gemma';
import { useTheme } from '../hooks/useTheme';

interface Props {
  generation: FirstAidGeneration;
  fellBackToEnglish: boolean;
}

export function FirstAidSteps({ generation, fellBackToEnglish }: Props) {
  const { colors } = useTheme();

  return (
    <View>
      {(fellBackToEnglish || generation.fallback) && (
        <View style={[styles.notice, { backgroundColor: colors.bgSurface, borderColor: colors.accentPrimary }]}>
          <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
            {generation.fallback
              ? 'Showing verified steps directly (model output unavailable).'
              : 'Translation pending human review — showing English content.'}
          </Text>
        </View>
      )}

      {generation.summary ? (
        <Text style={[styles.summary, { color: colors.textSecondary }]}>
          {generation.summary}
        </Text>
      ) : null}

      <Text style={[styles.section, { color: colors.accentSecondary }]}>DO THIS NOW</Text>

      {generation.steps.map((s, i) => (
        <View key={`do-${i}`} style={[styles.step, { backgroundColor: colors.bgSurface }]}>
          <Text style={[styles.num, { color: colors.accentPrimary }]}>{i + 1}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{s.title}</Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>{s.body}</Text>
          </View>
        </View>
      ))}

      {generation.doNot.length > 0 && (
        <>
          <Text style={[styles.section, { color: colors.accentSecondary, marginTop: 20 }]}>
            DO NOT
          </Text>
          {generation.doNot.map((d, i) => (
            <View key={`no-${i}`} style={[styles.step, { backgroundColor: colors.bgSurface }]}>
              <Text style={[styles.num, { color: colors.accentPrimary }]}>{i + 1}</Text>
              <Text style={[styles.body, { flex: 1, color: colors.textSecondary }]}>{d}</Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    borderLeftWidth: 3,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  noticeText: { fontSize: 12 },
  summary: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  section: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  step: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  num: {
    fontSize: 20,
    fontWeight: '800',
    width: 28,
  },
  title: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  body: { fontSize: 14, lineHeight: 20 },
});
