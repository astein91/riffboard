import { create } from 'zustand';
import { useIdeasStore } from './ideas';
import { useConversationStore } from './conversation';

export interface SuggestedIdea {
  id: string;
  title: string;
  description: string;
  confidence: number;
  timestamp: number;
}

interface DistillerState {
  suggestions: SuggestedIdea[];
  accumulatedTranscript: string;
  distilling: boolean;
  appendTranscript: (text: string) => void;
  runDistill: () => Promise<void>;
  promoteSuggestion: (id: string, projectId: string) => void;
  dismissSuggestion: (id: string) => void;
  clearAll: () => void;
}

const MAX_TRANSCRIPT_CHARS = 8000;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export const useDistillerStore = create<DistillerState>((set, get) => ({
  suggestions: [],
  accumulatedTranscript: '',
  distilling: false,

  appendTranscript: (text) => {
    set(s => {
      let next = s.accumulatedTranscript + ' ' + text;
      if (next.length > MAX_TRANSCRIPT_CHARS) {
        next = next.slice(next.length - MAX_TRANSCRIPT_CHARS);
      }
      return { accumulatedTranscript: next.trimStart() };
    });

    // Debounce distill call by 3s
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      get().runDistill();
    }, 3000);
  },

  runDistill: async () => {
    const { accumulatedTranscript, suggestions } = get();
    if (!accumulatedTranscript.trim()) return;

    set({ distilling: true });
    try {
      const res = await fetch('/api/distill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: accumulatedTranscript,
          existingSuggestions: suggestions.map(s => ({ title: s.title, description: s.description })),
        }),
      });

      if (!res.ok) {
        console.warn(`Distill API error ${res.status}`);
        set({ distilling: false });
        return;
      }

      const data = await res.json() as { ideas: { id?: string; title: string; description: string; confidence: number }[] };
      const now = Date.now();

      set(s => {
        const updated = [...s.suggestions];

        for (const idea of data.ideas) {
          const existingIdx = updated.findIndex(x => x.title === idea.title);
          if (existingIdx !== -1) {
            // Refine existing suggestion
            updated[existingIdx] = { ...updated[existingIdx], description: idea.description, confidence: idea.confidence };
          } else {
            // New suggestion
            updated.push({
              id: idea.id ?? crypto.randomUUID(),
              title: idea.title,
              description: idea.description,
              confidence: idea.confidence,
              timestamp: now,
            });
          }
        }

        return { suggestions: updated, distilling: false };
      });
    } catch (err) {
      console.warn('Distill failed:', err);
      set({ distilling: false });
    }
  },

  promoteSuggestion: (id, projectId) => {
    const suggestion = get().suggestions.find(s => s.id === id);
    if (!suggestion) return;

    set(s => ({ suggestions: s.suggestions.filter(x => x.id !== id) }));

    const text = `${suggestion.title}: ${suggestion.description}`;
    useIdeasStore.getState().addIdea(text, projectId);
  },

  dismissSuggestion: (id) => {
    set(s => ({ suggestions: s.suggestions.filter(x => x.id !== id) }));
  },

  clearAll: () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    set({ suggestions: [], accumulatedTranscript: '', distilling: false });
  },
}));
