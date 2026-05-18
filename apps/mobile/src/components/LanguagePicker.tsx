import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LANGUAGE_METADATA, type Language } from '@ishvenom/shared-types';
import { allSupportedLanguages, verificationStatusOf } from '../lib/firstAid';

interface Props {
  current: Language;
  onChange: (lang: Language) => void;
}

export function LanguagePicker({ current, onChange }: Props) {
  const langs = allSupportedLanguages();
  return (
    <View>
      {langs.map((l) => {
        const meta = LANGUAGE_METADATA[l];
        const status = verificationStatusOf(l);
        const isStub = status === 'stub_needs_full_human_translation';
        const selected = l === current;
        return (
          <Pressable
            key={l}
            onPress={() => onChange(l)}
            style={[styles.row, selected && styles.rowSelected]}
          >
            <Text style={styles.native}>{meta.nativeName}</Text>
            <Text style={styles.name}>{meta.name}</Text>
            {isStub ? <Text style={styles.stub}>English fallback</Text> : null}
            {selected ? <Text style={styles.check}>✓</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#111827',
    borderRadius: 12,
    marginBottom: 8,
  },
  rowSelected: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#ef4444' },
  native: { color: '#fff', fontSize: 18, fontWeight: '700', minWidth: 110 },
  name: { color: '#94a3b8', fontSize: 14, flex: 1 },
  stub: { color: '#fbbf24', fontSize: 11, marginRight: 8 },
  check: { color: '#ef4444', fontSize: 20, fontWeight: '800' },
});
