import { create } from 'zustand';
import { authFetch } from '../lib/auth-fetch';

interface Commit {
  sha: string;
  message: string;
  timestamp: number;
}

interface HistoryStore {
  commits: Commit[];
  loading: boolean;
  fetchHistory: (projectId: string) => Promise<void>;
  commitChanges: (projectId: string, message: string) => Promise<void>;
  revertTo: (projectId: string, sha: string) => Promise<void>;
}

export const useHistoryStore = create<HistoryStore>((set) => ({
  commits: [],
  loading: false,

  fetchHistory: async (projectId) => {
    const res = await authFetch(`/api/git/${projectId}/log`);
    const commits = await res.json();
    set({ commits });
  },

  commitChanges: async (projectId, message) => {
    await authFetch(`/api/git/${projectId}/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    const res = await authFetch(`/api/git/${projectId}/log`);
    const commits = await res.json();
    set({ commits });
  },

  revertTo: async (projectId, sha) => {
    await authFetch(`/api/git/${projectId}/revert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha }),
    });
    const res = await authFetch(`/api/git/${projectId}/log`);
    const commits = await res.json();
    set({ commits });
  },
}));
