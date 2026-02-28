import { create } from 'zustand';
import { authFetch } from '../lib/auth-fetch';

interface CompareStore {
  active: boolean;
  leftBranch: string | null;
  rightBranch: string | null;
  leftFiles: Record<string, string>;
  rightFiles: Record<string, string>;
  loading: boolean;

  enter: () => void;
  exit: () => void;
  setLeftBranch: (projectId: string, branch: string) => Promise<void>;
  setRightBranch: (projectId: string, branch: string) => Promise<void>;
}

async function fetchBranchFiles(projectId: string, branch: string): Promise<Record<string, string>> {
  const res = await authFetch(`/api/git/${projectId}/branch/${branch}/files`);
  if (!res.ok) return {};
  return res.json() as Promise<Record<string, string>>;
}

export const useCompareStore = create<CompareStore>((set) => ({
  active: false,
  leftBranch: null,
  rightBranch: null,
  leftFiles: {},
  rightFiles: {},
  loading: false,

  enter: () => set({ active: true, leftBranch: null, rightBranch: null, leftFiles: {}, rightFiles: {} }),

  exit: () => set({ active: false, leftBranch: null, rightBranch: null, leftFiles: {}, rightFiles: {}, loading: false }),

  setLeftBranch: async (projectId, branch) => {
    set({ leftBranch: branch, loading: true });
    const files = await fetchBranchFiles(projectId, branch);
    set({ leftFiles: files, loading: false });
  },

  setRightBranch: async (projectId, branch) => {
    set({ rightBranch: branch, loading: true });
    const files = await fetchBranchFiles(projectId, branch);
    set({ rightFiles: files, loading: false });
  },
}));
