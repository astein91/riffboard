import { create } from 'zustand';
import { authFetch } from '../lib/auth-fetch';

export const AI_PROVIDERS = ['gemini', 'anthropic', 'openai', 'fireworks'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

interface SettingsStore {
  isOpen: boolean;
  keys: Record<string, string>;
  configured: string[];
  selectedModel: string;
  selectedProvider: string;
  loading: boolean;

  open: () => void;
  close: () => void;
  loadKeys: () => Promise<void>;
  setKey: (provider: string, key: string) => Promise<void>;
  clearKey: (provider: string) => Promise<void>;
  loadPreferences: () => Promise<void>;
  savePreferences: (model: string, provider: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  isOpen: false,
  keys: {},
  configured: [],
  selectedModel: '',
  selectedProvider: '',
  loading: false,

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),

  loadKeys: async () => {
    const res = await authFetch('/api/keys/list');
    const data = await res.json();
    set({ configured: data.configured ?? [], keys: data.keys ?? {} });
  },

  setKey: async (provider, key) => {
    set({ loading: true });
    await authFetch('/api/keys/set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: provider, key }),
    });
    // Reload to get masked value
    const res = await authFetch('/api/keys/list');
    const data = await res.json();
    set({ configured: data.configured ?? [], keys: data.keys ?? {}, loading: false });
  },

  clearKey: async (provider) => {
    set({ loading: true });
    await authFetch('/api/keys/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: provider }),
    });
    const res = await authFetch('/api/keys/list');
    const data = await res.json();
    set({ configured: data.configured ?? [], keys: data.keys ?? {}, loading: false });
  },

  loadPreferences: async () => {
    const res = await authFetch('/api/user/preferences');
    const data = await res.json();
    set({
      selectedModel: data.selectedModel ?? '',
      selectedProvider: data.selectedProvider ?? '',
    });
  },

  savePreferences: async (model, provider) => {
    set({ loading: true });
    await authFetch('/api/user/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedModel: model, selectedProvider: provider }),
    });
    set({ selectedModel: model, selectedProvider: provider, loading: false });
  },
}));

/** True if the user has at least one AI provider key configured */
export function hasAiKey(configured: string[]): boolean {
  return AI_PROVIDERS.some(p => configured.includes(p));
}
