import { useState, useEffect, useCallback } from 'react';
import { resolveInferenceMode } from '../lib/gemmaLearn';

export interface VisionModeResult {
  mode: 'cloud' | 'on-device';
  forced: boolean;
  toggle: () => void;
}

export function useVisionMode(): VisionModeResult {
  const [networkMode, setNetworkMode] = useState<'cloud' | 'on-device'>('on-device');
  const [forced, setForced] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const resolved = await resolveInferenceMode();
      if (!cancelled) setNetworkMode(resolved);
    }
    void check();
    const id = setInterval(() => { void check(); }, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const toggle = useCallback(() => {
    if (!forced && networkMode === 'cloud') {
      setForced(true);
    } else if (forced) {
      setForced(false);
    }
    // no-op when offline — nothing to switch to
  }, [forced, networkMode]);

  const mode = forced ? 'on-device' : networkMode;
  return { mode, forced, toggle };
}
