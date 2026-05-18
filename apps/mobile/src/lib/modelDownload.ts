import * as FileSystem from 'expo-file-system/legacy';

export const MODEL_FILENAME = 'ishvenom-gemma-e2b-merged-q3_k_m.gguf';

function getModelDir(): string {
  const base = FileSystem.documentDirectory ?? 'file:///data/user/0/com.calyxish.ishvenom/files/';
  return `${base}models/`;
}

export function getLocalModelPath(): string {
  return `${getModelDir()}${MODEL_FILENAME}`;
}

// Evaluated lazily so FileSystem is fully initialised before access
export const LOCAL_MODEL_PATH = getLocalModelPath();
export const MODEL_DOWNLOAD_URL =
  'https://huggingface.co/CalyxIsh/ishvenom-gemma-e2b-merged-Q3_K_M-GGUF/resolve/main/' +
  MODEL_FILENAME;
export const MODEL_SIZE_GB = 2.5;

export async function isModelDownloaded(): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(getLocalModelPath());
  // Size check guards against a partial/corrupt download
  return info.exists && (info as { size?: number }).size !== undefined
    ? (info as { size: number }).size > 100_000_000
    : false;
}

export async function downloadModel(
  onProgress: (fraction: number) => void,
): Promise<void> {
  const modelDir = getModelDir();
  const modelPath = getLocalModelPath();
  await FileSystem.makeDirectoryAsync(modelDir, { intermediates: true });

  const dl = FileSystem.createDownloadResumable(
    MODEL_DOWNLOAD_URL,
    modelPath,
    {},
    ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
      if (totalBytesExpectedToWrite > 0) {
        onProgress(totalBytesWritten / totalBytesExpectedToWrite);
      }
    },
  );

  const result = await dl.downloadAsync();
  if (!result || result.status !== 200) {
    await FileSystem.deleteAsync(modelPath, { idempotent: true });
    throw new Error('download_failed');
  }
}

export async function deleteModel(): Promise<void> {
  await FileSystem.deleteAsync(getLocalModelPath(), { idempotent: true });
}
