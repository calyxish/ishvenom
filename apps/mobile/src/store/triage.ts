/**
 * Triage store — the in-memory state of a single identify flow.
 * Wiped on navigation away from /result.
 */
import { create } from 'zustand';
import type { TriageOutput } from '../lib/triage';

export interface TriageState {
  lastResult: TriageOutput | null;
  capturedImagePath: string | null;
  wasBite: boolean;
  running: boolean;
  error: string | null;
  setImage: (path: string | null) => void;
  setWasBite: (b: boolean) => void;
  setRunning: (b: boolean) => void;
  setResult: (r: TriageOutput) => void;
  setError: (e: string | null) => void;
  reset: () => void;
}

export const useTriage = create<TriageState>((set) => ({
  lastResult: null,
  capturedImagePath: null,
  wasBite: false,
  running: false,
  error: null,
  setImage: (path) => set({ capturedImagePath: path }),
  setWasBite: (b) => set({ wasBite: b }),
  setRunning: (b) => set({ running: b }),
  setResult: (r) => set({ lastResult: r, running: false, error: null }),
  setError: (e) => set({ error: e, running: false }),
  reset: () =>
    set({
      lastResult: null,
      capturedImagePath: null,
      wasBite: false,
      running: false,
      error: null,
    }),
}));
