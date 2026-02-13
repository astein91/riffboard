import type { Message } from '../stores/conversation';

export function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
        <div style={{
          maxWidth: '90%', padding: '6px 12px', borderRadius: 8, fontSize: 12,
          lineHeight: '1.4', background: '#1a1a2e', color: '#888',
          fontStyle: 'italic', textAlign: 'center',
        }}>{message.content}</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
      <div style={{
        maxWidth: '85%', padding: '10px 14px', borderRadius: 12, fontSize: 14,
        lineHeight: '1.5', background: isUser ? '#1d3557' : '#151515',
        color: isUser ? '#e5e5e5' : '#ccc', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>{message.content}</div>
    </div>
  );
}
