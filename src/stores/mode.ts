import { create } from 'zustand';
import { useTranscriptStore } from './transcript';

export type AppMode = 'chat' | 'riff';

interface ModeState {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  toggleMode: () => void;
}

export const useModeStore = create<ModeState>((set, get) => ({
  mode: 'chat',

  setMode: (mode) => {
    const prev = get().mode;
    set({ mode });

    const { micStatus, startMic, stopMic } = useTranscriptStore.getState();

    if (mode === 'riff' && prev !== 'riff') {
      // Start mic when entering riff mode
      if (micStatus === 'off') startMic();
    } else if (mode === 'chat' && prev !== 'chat') {
      // Stop mic when entering chat mode
      if (micStatus === 'on' || micStatus === 'requesting') stopMic();
    }
  },

  toggleMode: () => {
    const next = get().mode === 'chat' ? 'riff' : 'chat';
    get().setMode(next);
  },
}));
