/**
 * Hook: trigger a sync flush whenever the device comes online.
 * Keeps all the platform-specific plumbing (expo-network listeners)
 * out of the sync module itself.
 */
import { useEffect, useRef } from 'react';
import * as Network from 'expo-network';
import { flush } from '../lib/sync';
import type { SyncDeps } from '../lib/sync';
import { useSession } from '../store/session';

export function useSyncOnReconnect(deps: SyncDeps, intervalMs = 30_000): void {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const setInFlight = useSession((s) => s.setSyncInFlight);
  const setLastSyncAt = useSession((s) => s.setLastSyncAt);

  useEffect(() => {
    const tick = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        if (!state.isConnected || !state.isInternetReachable) return;
        setInFlight(true);
        const res = await flush(deps);
        if (!res.skipped) {
          setLastSyncAt(new Date().toISOString());
        }
      } catch {
        // swallow: the UI reflects unsynced count separately
      } finally {
        setInFlight(false);
      }
    };
    void tick();
    timer.current = setInterval(tick, intervalMs);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [deps, intervalMs, setInFlight, setLastSyncAt]);
}
