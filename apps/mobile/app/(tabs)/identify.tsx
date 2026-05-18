import { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSession } from '../../src/store/session';
import { useTriage } from '../../src/store/triage';
import { runTriage } from '../../src/lib/triage';
import { getTriageInstructions } from '../../src/lib/firstAid';
import { getSpeciesByScientificName, enqueueEncounter } from '../../src/lib/db';
import type { StoredSpecies, QueuedEncounter } from '../../src/lib/db';
import { generateFirstAid } from '../../src/lib/gemma';
import type { FirstAidGeneration } from '../../src/lib/gemma';
import { classifyImage } from '../../src/lib/vision';
import { saveEncounterPhoto, hashPhoto } from '../../src/lib/imageStore';
import { useTheme } from '../../src/hooks/useTheme';
import { useVisionMode } from '../../src/hooks/useVisionMode';
import { classifyAndTriage } from '../../src/lib/visionCloud';
import { isModelDownloaded } from '../../src/lib/modelDownload';

async function classifyPhoto(imagePath: string) {
  return classifyImage(imagePath);
}

// Steps shown in the progress overlay while triage runs
const PROGRESS_STEPS = [
  'Classifying image...',
  'Looking up species...',
  'Preparing first aid...',
  'Generating advice...',
] as const;

export default function IdentifyScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [capturing, setCapturing] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [torch, setTorch] = useState(false);
  const wasBite = useTriage((s) => s.wasBite);
  const setWasBite = useTriage((s) => s.setWasBite);
  const setResult = useTriage((s) => s.setResult);
  const setRunning = useTriage((s) => s.setRunning);
  const setError = useTriage((s) => s.setError);
  const running = useTriage((s) => s.running);
  const triageError = useTriage((s) => s.error);
  const language = useSession((s) => s.language);
  const country = useSession((s) => s.country);
  const deviceId = useSession((s) => s.deviceId);
  const { mode: visionMode, forced: visionForced, toggle: toggleVision } = useVisionMode();

  if (!permission) {
    return <View style={[styles.container, { backgroundColor: colors.bgPrimary }]} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <View style={styles.center}>
          <Text style={[styles.msg, { color: colors.textSecondary }]}>
            {t('identify.cameraPermission')}
          </Text>
          <Pressable
            style={[styles.btn, { backgroundColor: colors.accentPrimary }]}
            onPress={requestPermission}
          >
            <Text style={[styles.btnText, { color: colors.textPrimary }]}>
              {t('identify.grantAccess')}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  async function getLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      const p = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
      });
      return { latitude: p.coords.latitude, longitude: p.coords.longitude };
    } catch {
      return null;
    }
  }

  async function runWithPhoto(imageUri: string) {
    if (!deviceId) return;
    setCapturing(true);
    setRunning(true);
    setError(null);
    setProgressStep(0);

    try {
      const loc = await getLocation();

      // ── Cloud path: single Gemma 4 call for species ID + first aid ──────
      if (visionMode === 'cloud') {
        setProgressStep(0); // Classifying image...
        const triage = await classifyAndTriage(imageUri, language, wasBite);

        setProgressStep(1); // Looking up species...
        const id = randomUUID();
        const now = new Date().toISOString();

        // Save photo best-effort — triage must not fail if disk is full
        let savedImagePath: string | null = null;
        let savedImageHash: string | null = null;
        try {
          savedImagePath = await saveEncounterPhoto(imageUri, id);
          if (savedImagePath) savedImageHash = await hashPhoto(savedImagePath);
        } catch { /* silent */ }

        setProgressStep(2); // Preparing first aid...

        // Build a StoredSpecies-like object so SpeciesCard renders correctly
        const species: StoredSpecies | null = triage.scientificName
          ? {
              id: triage.scientificName,
              scientificName: triage.scientificName,
              commonNames: { en: triage.commonName, [language]: triage.commonName },
              venomous: triage.venomous,
              antivenomName: null,
            }
          : null;

        // Use real getTriageInstructions for fellBackTo + verificationStatus
        const selection = getTriageInstructions({
          language,
          wasBite,
          venomous: triage.venomous,
        });

        const locResolved = loc ?? { latitude: 0, longitude: 0 };
        const encounter: QueuedEncounter = {
          id,
          createdAt: now,
          deviceId,
          speciesGuess: triage.scientificName || null,
          confidence: triage.scientificName ? 0.9 : null,
          latitude: locResolved.latitude,
          longitude: locResolved.longitude,
          district: null,
          country,
          language,
          actionTaken: wasBite ? 'first_aid_given' : 'no_action',
          wasBite,
          imagePath: savedImagePath,
          imageHash: savedImageHash,
          syncedAt: null,
          metadata: { cloudTriage: true },
        };
        await enqueueEncounter(encounter);

        setProgressStep(3); // Generating advice...
        const generation: FirstAidGeneration = {
          summary: triage.summary,
          steps: triage.steps,
          doNot: triage.doNot,
          latencyMs: 0,
          fallback: false,
        };

        setResult({
          species,
          topPredictions: [{ scientificName: triage.scientificName, confidence: 0.9 }],
          selection,
          generation,
          encounter,
          wallClockMs: 0,
        });
        router.replace('/result');
        return;
      }

      // ── On-device path ───────────────────────────────────────────────────
      const modelReady = await isModelDownloaded();
      if (!modelReady) {
        setError(
          'On-device model not downloaded. Go to Settings → AI Model to download, or connect to the internet to use Gemma 4 cloud.',
        );
        return;
      }

      setProgressStep(0); // Classifying image...
      setProgressStep(1); // Looking up species...
      setProgressStep(2); // Preparing first aid...
      setProgressStep(3); // Generating advice...

      const output = await runTriage(
        {
          imagePath: imageUri,
          language,
          wasBite,
          location: loc,
          country,
          district: null,
          deviceId,
        },
        {
          classify: classifyPhoto,
          getSpecies: getSpeciesByScientificName,
          getTriage: getTriageInstructions,
          generate: generateFirstAid,
          enqueue: enqueueEncounter,
          savePhoto: saveEncounterPhoto,
          hashPhoto: hashPhoto,
        },
      );
      setResult(output);
      router.replace('/result');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'on_device_oom') {
        setError('Not enough memory to load the on-device model. Switch to Gemma 4 cloud mode in Settings.');
      } else if (msg === 'on_device_unavailable') {
        setError('On-device model unavailable. Download it from Settings → AI Model.');
      } else {
        setError(msg);
      }
    } finally {
      setCapturing(false);
      setRunning(false);
    }
  }

  async function onShutter() {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: true,
      });
      if (!photo) throw new Error('no_photo');
      await runWithPhoto(photo.uri);
    } catch (err) {
      setError((err as Error).message);
      setCapturing(false);
      setRunning(false);
    }
  }

  async function onPickFromGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });
    if (result.canceled || result.assets.length === 0) return;
    const uri = result.assets[0]?.uri;
    if (!uri) return;
    await runWithPhoto(uri);
  }

  function toggleFlash() {
    setTorch((prev) => !prev);
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      {/* Top bar: cloud/on-device badge (left) + torch toggle (right) */}
      <View style={[styles.topBar, { backgroundColor: colors.bgPrimary, borderBottomColor: colors.borderDefault }]}>
        <Pressable
          onPress={toggleVision}
          style={[
            styles.modeBadge,
            {
              backgroundColor: colors.bgSurface,
              borderColor: visionMode === 'cloud'
                ? colors.accentPrimary
                : visionForced ? colors.warning
                : colors.borderDefault,
            },
          ]}
        >
          <MaterialCommunityIcons
            name={visionMode === 'cloud' ? 'cloud-outline' : 'cellphone'}
            size={13}
            color={visionMode === 'cloud' ? colors.accentSecondary
              : visionForced ? colors.warning
              : colors.textMuted}
          />
          <Text style={[
            styles.modeBadgeText,
            {
              color: visionMode === 'cloud' ? colors.accentSecondary
                : visionForced ? colors.warning
                : colors.textMuted,
            },
          ]}>
            {visionMode === 'cloud' ? 'Gemma 4' : 'On-device'}
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.iconBtn,
            {
              backgroundColor: torch ? colors.accentPrimary : colors.bgSurface,
              borderColor: torch ? colors.accentPrimary : colors.borderDefault,
            },
          ]}
          onPress={toggleFlash}
        >
          <MaterialCommunityIcons
            name={torch ? 'flashlight' : 'flashlight-off'}
            size={20}
            color={torch ? colors.textPrimary : colors.textMuted}
          />
        </Pressable>
      </View>

      {/* Camera — fills all available space */}
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        enableTorch={torch}
      />

      {/* Progress overlay — shown while triage is running */}
      {capturing && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={colors.accentPrimary} />
          <Text style={[styles.overlayText, { color: colors.textPrimary }]}>
            {PROGRESS_STEPS[progressStep]}
          </Text>
        </View>
      )}

      {/* Bottom controls */}
      <View style={[styles.controls, { backgroundColor: colors.bgPrimary }]}>
        {/* Shutter row: gallery + shutter + bitten toggle */}
        <View style={styles.shutterRow}>
          <Pressable
            style={[
              styles.galleryBtn,
              {
                backgroundColor: colors.bgSurface,
                borderColor: colors.borderDefault,
              },
            ]}
            onPress={() => { void onPickFromGallery(); }}
            disabled={capturing || running}
          >
            <MaterialCommunityIcons
              name="image-multiple"
              size={24}
              color={capturing || running ? colors.textMuted : colors.textPrimary}
            />
          </Pressable>

          <Pressable
            style={[
              styles.shutter,
              { backgroundColor: colors.accentPrimary },
              (capturing || running) && styles.shutterDisabled,
            ]}
            onPress={() => { void onShutter(); }}
            disabled={capturing || running}
          >
            {capturing ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <Text style={[styles.shutterText, { color: colors.textPrimary }]}>
                {t('identify.capture')}
              </Text>
            )}
          </Pressable>

          {/* Bitten toggle */}
          <Pressable
            style={[
              styles.biteToggle,
              {
                backgroundColor: wasBite ? colors.accentPrimary : colors.bgSurface,
                borderColor: wasBite ? colors.accentPrimary : colors.borderDefault,
              },
            ]}
            onPress={() => setWasBite(!wasBite)}
          >
            <MaterialCommunityIcons
              name="needle"
              size={22}
              color={wasBite ? colors.textPrimary : colors.textMuted}
            />
            <Text style={[styles.biteToggleLabel, { color: wasBite ? colors.textPrimary : colors.textMuted }]}>
              Bitten
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Error overlay — after controls so it renders on top */}
      {!capturing && triageError && (
        <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.88)', zIndex: 999 }]}>
          <MaterialCommunityIcons name="alert-circle-outline" size={40} color={colors.danger} />
          <Text style={[styles.overlayText, { color: colors.danger, textAlign: 'center' }]}>
            {triageError}
          </Text>
          <Pressable
            style={[styles.retryBtn, { borderColor: colors.textMuted }]}
            onPress={() => setError(null)}
          >
            <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>Dismiss</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  camera: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    zIndex: 999,
  },
  overlayText: {
    fontSize: 16,
    fontWeight: '600',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: { gap: 0 },
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  galleryBtn: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  biteToggle: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  biteToggleLabel: { fontSize: 10, fontWeight: '700' },
  shutter: {
    flex: 1,
    minHeight: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  shutterDisabled: { opacity: 0.5 },
  shutterText: { fontWeight: '800', fontSize: 18 },
  retryBtn: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
    borderWidth: 1,
  },
  modeBadgeText: { fontSize: 11, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  msg: { textAlign: 'center', marginBottom: 16 },
  btn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  btnText: { fontWeight: '700' },
});
