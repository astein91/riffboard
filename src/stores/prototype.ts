import { create } from 'zustand';
import { useConversationStore } from './conversation';

export interface ValidationError {
  file: string;
  line: number;
  column: number;
  message: string;
}

interface PrototypeStore {
  files: Record<string, string>;
  loading: boolean;
  runtimeError: string | null;
  validationErrors: ValidationError[];
  autoFixInProgress: boolean;
  lastAutoFixTime: number;
  fetchFiles: (projectId: string) => Promise<void>;
  setFiles: (files: Record<string, string>, validationErrors?: ValidationError[]) => void;
  reportRuntimeError: (error: string, projectId: string) => Promise<void>;
  clearError: () => void;
}

const AUTO_FIX_COOLDOWN = 10_000; // 10 seconds

export const usePrototypeStore = create<PrototypeStore>((set, get) => ({
  files: {},
  loading: false,
  runtimeError: null,
  validationErrors: [],
  autoFixInProgress: false,
  lastAutoFixTime: 0,

  fetchFiles: async (projectId) => {
    set({ loading: true });
    try {
      const res = await fetch(`/api/projects/${projectId}/files`);
      const files = await res.json();
      set({ files, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  setFiles: (files, validationErrors) => {
    set({
      files,
      validationErrors: validationErrors ?? [],
      runtimeError: validationErrors?.length ? null : get().runtimeError,
      loading: false,
    });
  },

  reportRuntimeError: async (error, projectId) => {
    const state = get();

    // Guard: skip if already fixing or within cooldown
    if (state.autoFixInProgress) return;
    if (Date.now() - state.lastAutoFixTime < AUTO_FIX_COOLDOWN) return;

    set({ runtimeError: error, autoFixInProgress: true });

    try {
      const res = await fetch(`/api/projects/${projectId}/fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ errorMessage: error }),
      });
      const data = await res.json();

      if (data.files) {
        set({
          files: data.files,
          validationErrors: data.validationErrors ?? [],
          runtimeError: data.fixed ? null : error,
          autoFixInProgress: false,
          lastAutoFixTime: Date.now(),
        });

        const status = data.fixed ? 'Fixed runtime error automatically.' : 'Attempted auto-fix but issues remain.';
        useConversationStore.getState().addSystemMessage(`[Auto-fix] ${status}`);
      } else {
        set({ autoFixInProgress: false, lastAutoFixTime: Date.now() });
      }
    } catch {
      set({ autoFixInProgress: false, lastAutoFixTime: Date.now() });
      useConversationStore.getState().addSystemMessage('[Auto-fix] Failed to reach server.');
    }
  },

  clearError: () => {
    set({ runtimeError: null, validationErrors: [] });
  },
}));
