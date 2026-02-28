import { create } from 'zustand';
import { authFetch } from '../lib/auth-fetch';
import { useConversationStore } from './conversation';
import { useDistillerStore } from './distiller';
import { usePrototypeStore } from './prototype';
import { useIdeasStore } from './ideas';

export interface BranchInfo {
  name: string;
  displayName: string;
  createdAt?: string;
  fromSha?: string;
  fromBranch?: string;
  description?: string;
}

interface BranchStore {
  branches: BranchInfo[];
  currentBranch: string;
  loading: boolean;
  switching: boolean;

  fetchBranches: (projectId: string) => Promise<void>;
  switchBranch: (projectId: string, branchName: string) => Promise<void>;
  forkFromSha: (projectId: string, sha: string, name: string, description?: string) => Promise<void>;
  deleteBranch: (projectId: string, branchName: string) => Promise<void>;
}

export const useBranchStore = create<BranchStore>((set) => ({
  branches: [],
  currentBranch: 'main',
  loading: false,
  switching: false,

  fetchBranches: async (projectId) => {
    set({ loading: true });
    try {
      const res = await authFetch(`/api/git/${projectId}/branches`);
      const data = await res.json() as { current: string; branches: BranchInfo[] };
      set({ branches: data.branches, currentBranch: data.current, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  switchBranch: async (projectId, branchName) => {
    set({ switching: true });
    try {
      const res = await authFetch(`/api/git/${projectId}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch: branchName }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Checkout failed');
      }

      useConversationStore.getState().clearMessages();
      useDistillerStore.getState().clearAll();
      await usePrototypeStore.getState().fetchFiles(projectId);
      await useIdeasStore.getState().loadHistory(projectId);

      // Refresh branch list
      const brRes = await authFetch(`/api/git/${projectId}/branches`);
      const brData = await brRes.json() as { current: string; branches: BranchInfo[] };
      set({ branches: brData.branches, currentBranch: brData.current, switching: false });
    } catch {
      set({ switching: false });
    }
  },

  forkFromSha: async (projectId, sha, name, description) => {
    set({ switching: true });
    try {
      const res = await authFetch(`/api/git/${projectId}/fork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sha, name, description }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Fork failed');
      }

      useConversationStore.getState().clearMessages();
      useDistillerStore.getState().clearAll();
      await usePrototypeStore.getState().fetchFiles(projectId);
      await useIdeasStore.getState().loadHistory(projectId);

      // Refresh branch list
      const brRes = await authFetch(`/api/git/${projectId}/branches`);
      const brData = await brRes.json() as { current: string; branches: BranchInfo[] };
      set({ branches: brData.branches, currentBranch: brData.current, switching: false });
    } catch {
      set({ switching: false });
    }
  },

  deleteBranch: async (projectId, branchName) => {
    try {
      const res = await authFetch(`/api/git/${projectId}/branch/${branchName}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Delete failed');
      }

      // Refresh branch list
      const brRes = await authFetch(`/api/git/${projectId}/branches`);
      const brData = await brRes.json() as { current: string; branches: BranchInfo[] };
      set({ branches: brData.branches, currentBranch: brData.current });
    } catch {
      // silently fail
    }
  },
}));
