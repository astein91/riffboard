import { useRef, useEffect } from 'react';
import { useConversationStore } from '../stores/conversation';
import { useProjectStore } from '../stores/project';
import { useIdeasStore } from '../stores/ideas';
import { useModeStore } from '../stores/mode';
import { useDistillerStore } from '../stores/distiller';
import { useTranscriptStore } from '../stores/transcript';
import { useSettingsStore, hasAiKey } from '../stores/settings';
import { ChatInput } from './ChatInput';
import { ChatMessage } from './ChatMessage';
import { TranscriptOverlay } from './TranscriptOverlay';

export function ChatPanel() {
  const messages = useConversationStore(s => s.messages);
  const sending = useConversationStore(s => s.sending);
  const project = useProjectStore(s => s.activeProject);
  const addIdea = useIdeasStore(s => s.addIdea);
  const mode = useModeStore(s => s.mode);
  const appendTranscript = useDistillerStore(s => s.appendTranscript);
  const micStatus = useTranscriptStore(s => s.micStatus);
  const configured = useSettingsStore(s => s.configured);
  const loadKeys = useSettingsStore(s => s.loadKeys);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load key config on mount so the input gate works
  useEffect(() => { loadKeys(); }, [loadKeys]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // In riff mode, voice transcript goes to distiller for idea extraction
  // In chat mode, voice transcript goes directly to idea queue (legacy behavior kept if mic was on)
  useEffect(() => {
    const handleFlush = (e: Event) => {
      const { text } = (e as CustomEvent).detail;
      if (!text || !project) return;

      if (useModeStore.getState().mode === 'riff') {
        appendTranscript(text);
      } else {
        addIdea(text, project.id);
      }
    };
    window.addEventListener("transcript:flush", handleFlush);
    return () => window.removeEventListener("transcript:flush", handleFlush);
  }, [project, addIdea, appendTranscript]);

  const handleSend = (text: string) => {
    if (!project) return;
    addIdea(text, project.id);
  };

  const isRiff = mode === 'riff';

  return (
    <div style={{
      flex: 1, minWidth: 280, maxWidth: 420, display: 'flex', flexDirection: 'column',
      borderRight: '1px solid #1a1a1a', background: '#0a0a0a',
    }}>
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {isRiff ? (
          /* Riff mode: voice-driven, show transcript overlay inline */
          <>
            {micStatus !== 'on' && (
              <div style={{ textAlign: 'center', paddingTop: 80, color: '#444' }}>
                <p style={{ fontSize: 18, marginBottom: 8 }}>Riff mode</p>
                <p style={{ fontSize: 13 }}>Talk freely — ideas are extracted automatically.</p>
              </div>
            )}
            {micStatus === 'on' && (
              <TranscriptOverlay />
            )}
          </>
        ) : (
          /* Chat mode: text-driven */
          <>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', paddingTop: 80, color: '#444' }}>
                <p style={{ fontSize: 18, marginBottom: 8 }}>What do you want to build?</p>
                <p style={{ fontSize: 13 }}>Describe your app and watch it appear.</p>
              </div>
            )}
            {messages.map(msg => <ChatMessage key={msg.id} message={msg} />)}
            {sending && (
              <div style={{
                padding: '12px 16px', background: '#111', borderRadius: 12,
                marginBottom: 8, color: '#888', fontSize: 14,
              }}>Thinking...</div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Chat mode: text input. Riff mode: no text input needed. */}
      {!isRiff && <ChatInput onSend={handleSend} hasKey={hasAiKey(configured)} />}
    </div>
  );
}
