/**
 * CapturedPhoto — full-width photo display for the result screen.
 *
 * Shows the permanent local file saved by imageStore.ts.
 * If the path is null (no photo taken) or the file no longer exists,
 * the component renders nothing so the result screen degrades gracefully.
 */
import { useEffect, useState } from 'react';
import { Image, View, StyleSheet } from 'react-native';
import { getEncounterPhotoUri } from '../lib/imageStore';

interface Props {
  /** Permanent file URI from QueuedEncounter.imagePath, or null if unavailable. */
  imagePath: string | null;
  encounterId: string;
}

export function CapturedPhoto({ imagePath, encounterId }: Props) {
  const [uri, setUri] = useState<string | null>(imagePath);

  useEffect(() => {
    // If the stored path is present, verify it still exists on disk.
    // Resolves race conditions where cleanOldPhotos ran between screens.
    if (!imagePath) {
      void getEncounterPhotoUri(encounterId).then(setUri);
    }
  }, [imagePath, encounterId]);

  if (!uri) return null;

  return (
    <View style={styles.wrapper}>
      <Image source={{ uri }} style={styles.image} resizeMode="cover" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  image: {
    width: '100%',
    aspectRatio: 4 / 3,
  },
});
