import { create } from 'zustand';
import { authFetch } from '../lib/auth-fetch';
import { useConversationStore } from './conversation';
import { usePrototypeStore } from './prototype';
import { useHistoryStore } from './history';

export type IdeaStatus = 'queued' | 'active' | 'done' | 'error';

export interface Idea {
  id: string;
  text: string;
  status: IdeaStatus;
  timestamp: number;
  sha?: string;
  error?: string;
}

interface IdeasState {
  ideas: Idea[];
  processing: boolean;
  addIdea: (text: string, projectId: string) => void;
  removeIdea: (id: string) => void;
  reorderIdea: (id: string, direction: 'up' | 'down') => void;
  retryIdea: (id: string, projectId: string) => void;
  revertToIdea: (id: string, projectId: string) => Promise<void>;
  loadHistory: (projectId: string) => Promise<void>;
}

let processorRunning = false;

async function processQueue(projectId: string) {
  if (processorRunning) return;
  processorRunning = true;

  const { getState, setState } = useIdeasStore;

  while (true) {
    const next = getState().ideas.find(i => i.status === 'queued');
    if (!next) break;

    // Mark active
    setState(s => ({
      ideas: s.ideas.map(i => i.id === next.id ? { ...i, status: 'active' as const } : i),
    }));

    try {
      const result = await useConversationStore.getState().sendMessage(next.text, projectId);
      if (result.files) {
        usePrototypeStore.getState().setFiles(result.files, result.validationErrors);
      } else {
        await usePrototypeStore.getState().fetchFiles(projectId);
      }
      await useHistoryStore.getState().commitChanges(projectId, next.text.slice(0, 72));

      const latestCommit = useHistoryStore.getState().commits[0];
      setState(s => ({
        ideas: s.ideas.map(i =>
          i.id === next.id
            ? { ...i, status: 'done' as const, sha: latestCommit?.sha }
            : i
        ),
      }));
    } catch (err) {
      setState(s => ({
        ideas: s.ideas.map(i =>
          i.id === next.id
            ? { ...i, status: 'error' as const, error: err instanceof Error ? err.message : 'Unknown error' }
            : i
        ),
      }));

      // Rotate session after error so next idea gets a fresh context
      try {
        await authFetch(`/api/projects/${projectId}/session/rotate`, { method: 'POST' });
      } catch {
        // Best-effort — don't block queue processing
      }
    }
  }

  processorRunning = false;
}

export const useIdeasStore = create<IdeasState>((set, get) => ({
  ideas: [],
  processing: false,

  addIdea: (text, projectId) => {
    const idea: Idea = {
      id: crypto.randomUUID(),
      text,
      status: 'queued',
      timestamp: Date.now(),
    };

    useConversationStore.getState().addUserMessage(text);
    set(s => ({ ideas: [...s.ideas, idea] }));
    processQueue(projectId);
  },

  removeIdea: (id) => {
    set(s => ({
      ideas: s.ideas.filter(i => !(i.id === id && i.status === 'queued')),
    }));
  },

  reorderIdea: (id, direction) => {
    set(s => {
      const ideas = [...s.ideas];
      const queued = ideas.filter(i => i.status === 'queued');
      const rest = ideas.filter(i => i.status !== 'queued');

      const idx = queued.findIndex(i => i.id === id);
      if (idx === -1) return s;

      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= queued.length) return s;

      [queued[idx], queued[swapIdx]] = [queued[swapIdx], queued[idx]];
      return { ideas: [...rest, ...queued] };
    });
  },

  retryIdea: (id, projectId) => {
    set(s => ({
      ideas: s.ideas.map(i =>
        i.id === id && i.status === 'error'
          ? { ...i, status: 'queued' as const, error: undefined }
          : i
      ),
    }));
    processQueue(projectId);
  },

  revertToIdea: async (id, projectId) => {
    const idea = get().ideas.find(i => i.id === id);
    if (!idea?.sha) return;

    await useHistoryStore.getState().revertTo(projectId, idea.sha);
    await usePrototypeStore.getState().fetchFiles(projectId);

    // Dim ideas after the reverted-to point
    set(s => {
      const idx = s.ideas.findIndex(i => i.id === id);
      return {
        ideas: s.ideas.map((i, j) => {
          if (j > idx && i.status === 'done') {
            return { ...i, status: 'error' as const, error: 'Orphaned by revert' };
          }
          return i;
        }),
      };
    });
  },

  loadHistory: async (projectId) => {
    await useHistoryStore.getState().fetchHistory(projectId);
    const commits = useHistoryStore.getState().commits;

    const historyIdeas: Idea[] = commits.map(c => ({
      id: c.sha,
      text: c.message,
      status: 'done' as const,
      timestamp: c.timestamp,
      sha: c.sha,
    }));

    // Keep any queued/active ideas, replace done ideas with fresh git history
    set(s => ({
      ideas: [
        ...s.ideas.filter(i => i.status === 'queued' || i.status === 'active'),
        ...historyIdeas,
      ],
    }));
  },
}));
