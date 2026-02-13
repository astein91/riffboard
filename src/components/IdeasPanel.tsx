import { useIdeasStore, type Idea } from '../stores/ideas';
import { useProjectStore } from '../stores/project';
import { useModeStore } from '../stores/mode';
import { useDistillerStore, type SuggestedIdea } from '../stores/distiller';

function SuggestionCard({ suggestion }: { suggestion: SuggestedIdea }) {
  const projectId = useProjectStore(s => s.activeProject?.id);
  const promoteSuggestion = useDistillerStore(s => s.promoteSuggestion);
  const dismissSuggestion = useDistillerStore(s => s.dismissSuggestion);

  return (
    <div style={{
      padding: '10px 12px',
      borderRadius: 8,
      marginBottom: 6,
      fontSize: 13,
      lineHeight: '1.4',
      background: '#1a1a2a',
      border: '1px solid #2a2a4a',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#e5e5e5', fontWeight: 600, marginBottom: 2 }}>{suggestion.title}</div>
          <div style={{ color: '#888', fontSize: 12 }}>{suggestion.description}</div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {projectId && (
            <button
              onClick={() => promoteSuggestion(suggestion.id, projectId)}
              style={{ ...smallBtnStyle, color: '#4ade80', fontWeight: 600, fontSize: 12 }}
              title="Implement this idea"
            >Go</button>
          )}
          <button
            onClick={() => dismissSuggestion(suggestion.id)}
            style={{ ...smallBtnStyle, color: '#666' }}
            title="Dismiss"
          >&#x2715;</button>
        </div>
      </div>
    </div>
  );
}

function IdeaCard({ idea }: { idea: Idea }) {
  const projectId = useProjectStore(s => s.activeProject?.id);
  const removeIdea = useIdeasStore(s => s.removeIdea);
  const reorderIdea = useIdeasStore(s => s.reorderIdea);
  const retryIdea = useIdeasStore(s => s.retryIdea);
  const revertToIdea = useIdeasStore(s => s.revertToIdea);

  const truncated = idea.text.length > 60 ? idea.text.slice(0, 57) + '...' : idea.text;
  const shortSha = idea.sha?.slice(0, 7);

  const baseStyle: React.CSSProperties = {
    padding: '10px 12px',
    borderRadius: 8,
    marginBottom: 6,
    fontSize: 13,
    lineHeight: '1.4',
    wordBreak: 'break-word',
  };

  if (idea.status === 'active') {
    return (
      <div style={{ ...baseStyle, background: '#1a2a1a', border: '1px solid #2a4a2a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', background: '#4ade80',
            display: 'inline-block', animation: 'pulse 1.5s ease-in-out infinite',
          }} />
          <span style={{ color: '#4ade80', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
            Implementing
          </span>
        </div>
        <div style={{ color: '#ccc' }}>{truncated}</div>
      </div>
    );
  }

  if (idea.status === 'queued') {
    return (
      <div style={{ ...baseStyle, background: '#1a1a1a', border: '1px solid #262626' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <span style={{ color: '#666', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
              Queued
            </span>
            <div style={{ color: '#999', marginTop: 2 }}>{truncated}</div>
          </div>
          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
            <button onClick={() => reorderIdea(idea.id, 'up')}
              style={smallBtnStyle} title="Move up">&#x25B2;</button>
            <button onClick={() => reorderIdea(idea.id, 'down')}
              style={smallBtnStyle} title="Move down">&#x25BC;</button>
            <button onClick={() => removeIdea(idea.id)}
              style={{ ...smallBtnStyle, color: '#f87171' }} title="Cancel">&#x2715;</button>
          </div>
        </div>
      </div>
    );
  }

  if (idea.status === 'error') {
    return (
      <div style={{ ...baseStyle, background: '#1a1212', border: '1px solid #4a2020' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <span style={{ color: '#f87171', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
              {idea.error === 'Orphaned by revert' ? 'Orphaned' : 'Error'}
            </span>
            <div style={{ color: '#999', marginTop: 2 }}>{truncated}</div>
          </div>
          {idea.error !== 'Orphaned by revert' && projectId && (
            <button onClick={() => retryIdea(idea.id, projectId)}
              style={{ ...smallBtnStyle, color: '#fbbf24' }} title="Retry">&#x21BA;</button>
          )}
          {idea.error === 'Orphaned by revert' && projectId && (
            <button onClick={() => retryIdea(idea.id, projectId)}
              style={{ ...smallBtnStyle, color: '#60a5fa' }} title="Re-queue">&#x21BA;</button>
          )}
        </div>
      </div>
    );
  }

  // Done
  return (
    <div style={{ ...baseStyle, background: '#111', border: '1px solid #1a1a1a' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#888' }}>{truncated}</div>
          {shortSha && (
            <span style={{
              display: 'inline-block', marginTop: 4, fontSize: 11, color: '#555',
              background: '#1a1a1a', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace',
            }}>{shortSha}</span>
          )}
        </div>
        {projectId && idea.sha && (
          <button
            onClick={() => {
              if (confirm('Revert to this point? Later ideas will be orphaned.')) {
                revertToIdea(idea.id, projectId);
              }
            }}
            style={{ ...smallBtnStyle, color: '#666', opacity: 0.5 }}
            title="Revert to this point"
          >&#x21A9;</button>
        )}
      </div>
    </div>
  );
}

const smallBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#666',
  cursor: 'pointer',
  fontSize: 12,
  padding: '2px 4px',
  lineHeight: 1,
};

export function IdeasPanel() {
  const ideas = useIdeasStore(s => s.ideas);
  const mode = useModeStore(s => s.mode);
  const suggestions = useDistillerStore(s => s.suggestions);
  const distilling = useDistillerStore(s => s.distilling);

  const queued = ideas.filter(i => i.status === 'queued');
  const active = ideas.filter(i => i.status === 'active');
  const errors = ideas.filter(i => i.status === 'error');
  const done = ideas.filter(i => i.status === 'done').sort((a, b) => b.timestamp - a.timestamp);

  const hasAny = ideas.length > 0;
  const hasSuggestions = suggestions.length > 0;

  return (
    <div style={{
      width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column',
      borderLeft: '1px solid #1a1a1a', background: '#0a0a0a',
    }}>
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid #1a1a1a',
        fontSize: 13, fontWeight: 600, color: '#888', textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        Ideas
        {queued.length > 0 && (
          <span style={{ marginLeft: 8, color: '#555', fontWeight: 400, fontSize: 12 }}>
            {queued.length} queued
          </span>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        {/* Suggestions section (riff mode) */}
        {(mode === 'riff' || hasSuggestions) && (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 11, color: '#7c7caa', textTransform: 'uppercase',
              letterSpacing: '0.05em', marginBottom: 6, paddingLeft: 4,
            }}>
              {distilling && (
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', background: '#818cf8',
                  display: 'inline-block', animation: 'pulse 1.5s ease-in-out infinite',
                }} />
              )}
              Suggestions
              {hasSuggestions && (
                <span style={{
                  background: '#2a2a4a', color: '#818cf8', fontSize: 10,
                  padding: '1px 5px', borderRadius: 8, fontWeight: 600,
                }}>{suggestions.length}</span>
              )}
            </div>
            {suggestions.map(s => <SuggestionCard key={s.id} suggestion={s} />)}
            {!hasSuggestions && mode === 'riff' && (
              <div style={{ color: '#444', fontSize: 12, paddingLeft: 4, marginBottom: 8 }}>
                Speak to generate ideas...
              </div>
            )}
            {(hasSuggestions || hasAny) && (
              <div style={{
                borderTop: '1px solid #1a1a1a', margin: '8px 0', paddingTop: 0,
              }} />
            )}
          </>
        )}

        {!hasAny && !hasSuggestions && mode !== 'riff' && (
          <div style={{ textAlign: 'center', paddingTop: 40, color: '#333', fontSize: 13 }}>
            Ideas will appear here as you chat.
          </div>
        )}

        {active.map(i => <IdeaCard key={i.id} idea={i} />)}
        {queued.map(i => <IdeaCard key={i.id} idea={i} />)}

        {(active.length > 0 || queued.length > 0) && done.length > 0 && (
          <div style={{
            borderTop: '1px solid #1a1a1a', margin: '8px 0', paddingTop: 8,
            fontSize: 11, color: '#444', textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>Completed</div>
        )}

        {errors.map(i => <IdeaCard key={i.id} idea={i} />)}
        {done.map(i => <IdeaCard key={i.id} idea={i} />)}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
