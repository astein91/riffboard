import { useProjectStore } from '../stores/project';
import { useConversationStore } from '../stores/conversation';
import { useModeStore, type AppMode } from '../stores/mode';
import { useDistillerStore } from '../stores/distiller';

export function Header() {
  const project = useProjectStore(s => s.activeProject);
  const setActiveProject = useProjectStore(s => s.setActiveProject);
  const clearMessages = useConversationStore(s => s.clearMessages);
  const mode = useModeStore(s => s.mode);
  const setMode = useModeStore(s => s.setMode);
  const clearAll = useDistillerStore(s => s.clearAll);

  const handleBack = () => {
    clearMessages();
    setActiveProject(null);
  };

  const handleModeChange = (next: AppMode) => {
    if (next === mode) return;
    if (mode === 'riff' && next === 'chat') {
      // Clear accumulated transcript when leaving riff mode, keep suggestions visible
      clearAll();
    }
    setMode(next);
  };

  const toggleStyle = (isActive: boolean): React.CSSProperties => ({
    background: isActive ? '#222' : 'transparent',
    color: isActive ? '#fff' : '#555',
    border: 'none',
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    borderRadius: 4,
    transition: 'all 0.15s',
  });

  return (
    <header style={{
      height: 48, padding: '0 16px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', borderBottom: '1px solid #1a1a1a',
      background: '#0f0f0f', flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={handleBack} style={{
          background: 'none', border: 'none', color: '#888', cursor: 'pointer',
          fontSize: 13, padding: '4px 8px', borderRadius: 4,
        }}>← Projects</button>
        <span style={{ color: '#333' }}>|</span>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{project?.name}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          display: 'flex', background: '#111', border: '1px solid #262626',
          borderRadius: 6, overflow: 'hidden',
        }}>
          <button onClick={() => handleModeChange('chat')} style={toggleStyle(mode === 'chat')}>
            Chat
          </button>
          <button onClick={() => handleModeChange('riff')} style={toggleStyle(mode === 'riff')}>
            Riff
          </button>
        </div>
        <div
          style={{
            width: 8, height: 8, borderRadius: '50%',
            background: mode === 'riff' ? '#f59e0b' : '#22c55e',
            animation: mode === 'riff' ? 'pulse 1.5s ease-in-out infinite' : 'none',
          }}
          title={mode === 'riff' ? 'Riff mode' : 'Connected'}
        />
      </div>
    </header>
  );
}
