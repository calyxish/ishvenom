import { useState, useEffect, useCallback } from 'react';
import { resolveInferenceMode } from '../lib/gemmaLearn';

export interface InferenceModeResult {
  mode: 'cloud' | 'on-device';
  forced: boolean;
  toggle: () => void;
}

export function useInferenceMode(): InferenceModeResult {
  const [networkMode, setNetworkMode] = useState<'cloud' | 'on-device'>(
    Boolean(process.env.EXPO_PUBLIC_GOOGLE_AI_KEY) ? 'cloud' : 'on-device',
  );
  const [forced, setForced] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const m = await resolveInferenceMode();
      if (!cancelled) setNetworkMode(m);
    };
    void check();
    const id = setInterval(() => void check(), 5_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const toggle = useCallback(() => {
    if (!forced && networkMode === 'cloud') {
      // User is online with cloud available — let them force local
      setForced(true);
    } else if (forced) {
      // Clear the override, go back to auto
      setForced(false);
    }
    // Offline + not forced → tap is a no-op (already on local, no cloud to switch to)
  }, [forced, networkMode]);

  return {
    mode: forced ? 'on-device' : networkMode,
    forced,
    toggle,
  };
}
