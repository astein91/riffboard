import { create } from 'zustand';
import { authFetch } from '../lib/auth-fetch';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface SendMessageResult {
  content: string;
  files?: Record<string, string>;
  validationErrors?: Array<{ file: string; line: number; column: number; message: string }>;
}

interface ConversationStore {
  messages: Message[];
  sessionId: string | null;
  sending: boolean;
  addUserMessage: (text: string) => void;
  addSystemMessage: (text: string) => void;
  sendMessage: (text: string, projectId: string) => Promise<SendMessageResult>;
  clearMessages: () => void;
}

export const useConversationStore = create<ConversationStore>((set, get) => ({
  messages: [],
  sessionId: null,
  sending: false,

  addUserMessage: (text) => {
    const msg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    set(s => ({ messages: [...s.messages, msg] }));
  },

  addSystemMessage: (text) => {
    const msg: Message = {
      id: crypto.randomUUID(),
      role: 'system',
      content: text,
      timestamp: Date.now(),
    };
    set(s => ({ messages: [...s.messages, msg] }));
  },

  sendMessage: async (text, projectId) => {
    set({ sending: true });
    try {
      const transcript = get().messages.slice(-10).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const res = await authFetch(`/api/projects/${projectId}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          sessionId: get().sessionId,
          transcript,
        }),
      });
      const data = await res.json();

      if (data.sessionId) set({ sessionId: data.sessionId });

      const content = data.error
        ? `Error: ${data.error}${data.hint ? `\n${data.hint}` : ''}`
        : data.response;

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content,
        timestamp: Date.now(),
      };
      set(s => ({ messages: [...s.messages, assistantMsg], sending: false }));

      if (data.error) throw new Error(content);
      return {
        content,
        files: data.files,
        validationErrors: data.validationErrors,
      };
    } catch (err) {
      set({ sending: false });
      if (err instanceof Error && err.message.startsWith('Error:')) throw err;
      const msg = err instanceof Error ? err.message : 'Failed to get response';
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${msg}`,
        timestamp: Date.now(),
      };
      set(s => ({ messages: [...s.messages, errorMsg] }));
      throw err;
    }
  },

  clearMessages: () => set({ messages: [], sessionId: null }),
}));
