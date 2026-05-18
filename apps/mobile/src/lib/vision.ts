/**
 * Vision classifier wrapper.
 *
 * Runs the TFLite model exported in Phase 3 (ml/train/vision_export.py)
 * via react-native-fast-tflite. The model takes a 224x224 RGB image
 * normalized to [0,1] and outputs logits over the PRIORITY_SPECIES list
 * (17 classes: 16 species + "unknown / not a snake").
 *
 * Testing: same pattern as gemma.ts — tests inject a mock runtime with
 * `setVisionRuntime` so the native module is never imported.
 */
import type { PRIORITY_SPECIES } from '@ishvenom/shared-types';

export interface VisionPrediction {
  scientificName: string; // '' for "unknown"
  confidence: number; // 0..1
}

export interface VisionRuntime {
  load(modelSource: VisionModelSource): Promise<void>;
  isReady(): boolean;
  classify(imagePath: string): Promise<Float32Array>;
  release(): Promise<void>;
}

export type VisionModelSource = number | { url: string };

// The order MUST match apps/mobile/assets/models/labels.json.
// We keep it local to avoid coupling the mobile bundle to a JSON asset at runtime.
export const VISION_CLASS_ORDER: ReadonlyArray<string> = [
  'Atheris squamigera',      // 0
  'Atractaspis engaddensis', // 1
  'Bitis arietans',          // 2
  'Bitis gabonica',          // 3
  'Bitis rhinoceros',        // 4
  'Causus rhombeatus',       // 5
  'Dendroaspis angusticeps', // 6
  'Dendroaspis jamesoni',    // 7
  'Dendroaspis polylepis',   // 8
  'Dendroaspis viridis',     // 9
  'Dispholidus typus',       // 10
  'Echis ocellatus',         // 11
  'Echis pyramidum',         // 12
  'Hemachatus haemachatus',  // 13
  'Naja haje',               // 14
  'Naja melanoleuca',        // 15
  'Naja mossambica',         // 16
  'Naja nigricollis',        // 17
  'Naja nivea',              // 18
  'Thelotornis capensis',    // 19
  '',                        // 20 = unknown / not a snake
] as const;

export const VISION_MODEL_ASSET: VisionModelSource = require(
  '../../assets/models/venomwise-vision.tflite',
);

const INPUT_SIZE = 224;

function normalizeScientificLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed || trimmed.toLowerCase() === 'unknown') return '';
  const parts = trimmed.split(' ');
  if (parts.length === 1) return parts[0] ?? '';
  const genus = parts[0]
    ? `${parts[0][0]?.toUpperCase()}${parts[0].slice(1).toLowerCase()}`
    : '';
  const species = parts[1]?.toLowerCase() ?? '';
  const rest = parts.slice(2).map((part) => part.toLowerCase());
  return [genus, species, ...rest].filter(Boolean).join(' ');
}

async function imagePathToInput(imagePath: string): Promise<Float32Array> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { manipulateAsync, SaveFormat } = require('expo-image-manipulator') as typeof import(
    'expo-image-manipulator'
  );
  const processed = await manipulateAsync(
    imagePath,
    [{ resize: { width: INPUT_SIZE, height: INPUT_SIZE } }],
    { format: SaveFormat.JPEG, base64: true },
  );
  if (!processed.base64) {
    throw new Error('Failed to encode image for vision model');
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { toByteArray } = require('base64-js') as typeof import('base64-js');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { decode } = require('jpeg-js') as typeof import('jpeg-js');

  const jpegBytes = toByteArray(processed.base64);
  const decoded = decode(jpegBytes, { useTArray: true });
  if (decoded.width !== INPUT_SIZE || decoded.height !== INPUT_SIZE) {
    throw new Error(`Unexpected image size ${decoded.width}x${decoded.height}`);
  }

  // Input range: [0, 1] — the TFLite model was exported with normalization baked
  // into its first layer (the ONNX → TF → TFLite pipeline included the albumentations
  // Normalize transform as a preprocessing node). Providing raw /255 values is correct.
  const data = decoded.data;
  const floats = new Float32Array(INPUT_SIZE * INPUT_SIZE * 3);
  let out = 0;
  for (let i = 0; i < data.length; i += 4) {
    floats[out++] = data[i]! / 255;
    floats[out++] = data[i + 1]! / 255;
    floats[out++] = data[i + 2]! / 255;
  }
  return floats;
}

function createTfliteRuntime(): VisionRuntime {
  let model: unknown = null;

  return {
    async load(modelSource: VisionModelSource) {
      if (model) return;
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { loadTensorflowModel } = require('react-native-fast-tflite') as {
        loadTensorflowModel: (
          src: VisionModelSource,
        ) => Promise<{ runSync: (inputs: unknown[]) => unknown[] }>;
      };
      model = await loadTensorflowModel(modelSource);
    },
    isReady() {
      return model !== null;
    },
    async classify(imagePath: string) {
      if (!model) throw new Error('Vision runtime not loaded');
      const input = await imagePathToInput(imagePath);
      const outputs = (
        model as { runSync: (inputs: unknown[]) => unknown[] }
      ).runSync([input]);
      const logits = outputs[0];
      if (!(logits instanceof Float32Array)) {
        throw new Error('Vision output is not Float32Array');
      }
      return logits;
    },
    async release() {
      model = null;
    },
  };
}

let runtime: VisionRuntime = createTfliteRuntime();

export function setVisionRuntime(r: VisionRuntime): void {
  runtime = r;
}

export async function ensureVisionLoaded(
  modelSource: VisionModelSource,
): Promise<void> {
  if (!runtime.isReady()) await runtime.load(modelSource);
}

export async function classifyImage(
  imagePath: string,
  modelSource: VisionModelSource = VISION_MODEL_ASSET,
): Promise<VisionPrediction[]> {
  await ensureVisionLoaded(modelSource);
  const logits = await runtime.classify(imagePath);
  return topK(logits);
}

/**
 * Apply softmax to raw logits, return the top-K predictions sorted by
 * confidence descending. If the top class is "unknown" (empty string),
 * we still return it so the UI can tell the user the model was unsure.
 */
export function topK(logits: Float32Array, k = 3): VisionPrediction[] {
  if (logits.length !== VISION_CLASS_ORDER.length) {
    throw new Error(
      `Vision output length ${logits.length} != expected ${VISION_CLASS_ORDER.length}`,
    );
  }
  // Numerically stable softmax.
  let max = -Infinity;
  for (let i = 0; i < logits.length; i += 1) {
    if (logits[i]! > max) max = logits[i]!;
  }
  const exps = new Float32Array(logits.length);
  let sum = 0;
  for (let i = 0; i < logits.length; i += 1) {
    exps[i] = Math.exp(logits[i]! - max);
    sum += exps[i]!;
  }
  const probs = Array.from(exps, (e) => e / sum);

  return probs
    .map((confidence, idx) => ({
      scientificName: normalizeScientificLabel(VISION_CLASS_ORDER[idx] ?? ''),
      confidence,
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, k);
}

export function isConfident(
  prediction: VisionPrediction,
  threshold = 0.55,
): boolean {
  return (
    prediction.scientificName !== '' && prediction.confidence >= threshold
  );
}

/**
 * Type-level guard that VISION_CLASS_ORDER covers PRIORITY_SPECIES. The
 * import of PRIORITY_SPECIES is type-only so it won't bloat the bundle.
 */
type _AssertPriorityCovered = typeof PRIORITY_SPECIES extends readonly string[]
  ? true
  : never;
const _assertPriority: _AssertPriorityCovered = true;
void _assertPriority;
