import { useState, useRef, useCallback } from 'react';

export function ChatInput({ onSend, disabled }: { onSend: (text: string) => void; disabled?: boolean }) {
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
    if (ref.current) ref.current.style.height = 'auto';
  }, [text, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleInput = () => {
    const el = ref.current;
    if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 160) + 'px'; }
  };

  return (
    <div style={{ padding: 12, borderTop: '1px solid #1a1a1a', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
      <textarea ref={ref} value={text} onChange={e => { setText(e.target.value); handleInput(); }}
        onKeyDown={handleKeyDown} placeholder="Describe what to build..." disabled={disabled} rows={1}
        style={{
          flex: 1, resize: 'none', background: '#151515', border: '1px solid #222',
          borderRadius: 8, padding: '10px 12px', color: '#e5e5e5', outline: 'none',
          fontSize: 14, lineHeight: '1.5',
        }} />
      <button onClick={handleSend} disabled={disabled || !text.trim()} style={{
        background: text.trim() ? '#fff' : '#333', color: text.trim() ? '#000' : '#666',
        border: 'none', borderRadius: 8, padding: '10px 16px', cursor: 'pointer',
        fontWeight: 500, fontSize: 14, flexShrink: 0, opacity: disabled ? 0.5 : 1,
      }}>Send</button>
    </div>
  );
}
