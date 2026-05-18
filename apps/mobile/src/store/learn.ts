/**
 * Zustand store for the Learn chat session.
 *
 * Messages live only in memory — cleared on app restart.
 * We intentionally do not persist chat history:
 *   - Keeps device storage usage minimal on target hardware
 *   - Avoids surfacing old snake conversations to new users sharing a device
 *   - Aligns with the privacy contract (no user data persisted beyond session)
 */
import { create } from 'zustand';
import type { ChatMessage } from '../lib/gemmaLearn';

interface LearnState {
  messages: ChatMessage[];
  thinking: boolean;
  error: string | null;

  addMessage: (msg: ChatMessage) => void;
  setThinking: (v: boolean) => void;
  setError: (e: string | null) => void;
  clearChat: () => void;
}

export const useLearn = create<LearnState>((set) => ({
  messages: [],
  thinking: false,
  error: null,

  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg] })),

  setThinking: (v) => set({ thinking: v }),
  setError: (e) => set({ error: e }),
  clearChat: () => set({ messages: [], error: null }),
}));
