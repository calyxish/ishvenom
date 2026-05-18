import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import * as Network from 'expo-network';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../src/hooks/useTheme';
import {
  downloadModel,
  isModelDownloaded,
  MODEL_SIZE_GB,
} from '../src/lib/modelDownload';

type Stage = 'idle' | 'checking' | 'downloading' | 'done' | 'error';

export default function ModelDownloadScreen() {
  const { colors } = useTheme();
  const [stage, setStage] = useState<Stage>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  async function start() {
    setStage('checking');
    setErrorMsg('');

    const net = await Network.getNetworkStateAsync();
    if (!net.isConnected || !net.isInternetReachable) {
      setErrorMsg('No internet connection. Connect to WiFi and try again.');
      setStage('error');
      return;
    }

    setStage('downloading');
    try {
      await downloadModel((fraction) => setProgress(fraction));
      setStage('done');
      setTimeout(() => router.replace('/(tabs)/'), 800);
    } catch {
      setErrorMsg('Download failed. Check your connection and try again.');
      setStage('error');
    }
  }

  // If model already exists (e.g. back-navigation), skip straight through
  useEffect(() => {
    isModelDownloaded().then((ready) => {
      if (ready) router.replace('/');
    });
  }, []);

  const pct = Math.round(progress * 100);
  const downloading = stage === 'downloading';
  const done = stage === 'done';

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.bgPrimary }]}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <View style={styles.inner}>
        <MaterialCommunityIcons
          name="cellphone-arrow-down"
          size={56}
          color={colors.accentPrimary}
        />

        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Download AI model
        </Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          IshVenom needs a {MODEL_SIZE_GB} GB model file to work offline.
          Download it once over WiFi — it stays on your phone.
        </Text>

        <View
          style={[
            styles.infoBox,
            { backgroundColor: colors.bgSurface, borderColor: colors.borderDefault },
          ]}
        >
          <Row icon="wifi" color={colors.accentSecondary} text="Use WiFi — mobile data will cost you" colors={colors} />
          <Row icon="sd-card" color={colors.accentSecondary} text={`Need ~${MODEL_SIZE_GB + 0.5} GB free storage`} colors={colors} />
          <Row icon="lightning-bolt" color={colors.accentSecondary} text="Keep the screen on while downloading" colors={colors} />
        </View>

        {/* Progress bar */}
        {(downloading || done) && (
          <View style={styles.progressWrapper}>
            <View
              style={[styles.progressTrack, { backgroundColor: colors.bgSurface }]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: done ? colors.success : colors.accentPrimary,
                    width: `${done ? 100 : pct}%`,
                  },
                ]}
              />
            </View>
            <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
              {done ? 'Complete' : `${pct}%`}
            </Text>
          </View>
        )}

        {stage === 'error' && (
          <Text style={[styles.errorText, { color: colors.danger }]}>
            {errorMsg}
          </Text>
        )}

        <Pressable
          style={[
            styles.btn,
            {
              backgroundColor:
                downloading || done ? colors.bgSurface : colors.accentPrimary,
            },
          ]}
          onPress={start}
          disabled={downloading || done}
        >
          {stage === 'checking' ? (
            <ActivityIndicator size="small" color={colors.textPrimary} />
          ) : (
            <Text
              style={[
                styles.btnText,
                {
                  color:
                    downloading || done ? colors.textMuted : colors.textPrimary,
                },
              ]}
            >
              {downloading
                ? `Downloading… ${pct}%`
                : done
                ? 'Done'
                : stage === 'error'
                ? 'Try again'
                : 'Download now'}
            </Text>
          )}
        </Pressable>

        <Pressable
          style={[styles.skipBtn, { borderColor: colors.borderDefault, backgroundColor: colors.bgSurface }]}
          onPress={() => router.replace('/(tabs)/')}
          disabled={downloading}
        >
          <Text style={[styles.skipText, { color: colors.textMuted }]}>
            Skip — use cloud mode for now
          </Text>
        </Pressable>

        <Text style={[styles.hint, { color: colors.textMuted }]}>
          You can download it anytime from Settings → AI Model
        </Text>
      </View>
    </SafeAreaView>
  );
}

function Row({
  icon,
  color,
  text,
  colors,
}: {
  icon: string;
  color: string;
  text: string;
  colors: import('../src/hooks/useTheme').ColorTokens;
}) {
  return (
    <View style={styles.row}>
      <MaterialCommunityIcons name={icon as never} size={16} color={color} />
      <Text style={[styles.rowText, { color: colors.textSecondary }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 20,
  },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  sub: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  infoBox: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowText: { fontSize: 13, flex: 1 },
  progressWrapper: { width: '100%', gap: 6 },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },
  progressLabel: { fontSize: 12, textAlign: 'right' },
  errorText: { fontSize: 13, textAlign: 'center' },
  btn: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  btnText: { fontSize: 16, fontWeight: '700' },
  hint: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
  skipBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  skipText: { fontSize: 14, fontWeight: '500' },
});
