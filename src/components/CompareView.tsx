import { SandpackProvider, SandpackPreview } from '@codesandbox/sandpack-react';
import { authFetch } from '../lib/auth-fetch';
import { useCompareStore } from '../stores/compare';
import { useBranchStore } from '../stores/branch';
import { useProjectStore } from '../stores/project';
import { useConversationStore } from '../stores/conversation';

function toSandpackFiles(files: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [p, content] of Object.entries(files)) {
    result['/' + p.replace(/^prototype\//, '')] = content;
  }
  return result;
}

function ComparePane({ side }: { side: 'left' | 'right' }) {
  const branches = useBranchStore(s => s.branches);
  const projectId = useProjectStore(s => s.activeProject?.id);
  const selectedBranch = useCompareStore(s => side === 'left' ? s.leftBranch : s.rightBranch);
  const files = useCompareStore(s => side === 'left' ? s.leftFiles : s.rightFiles);
  const setBranch = useCompareStore(s => side === 'left' ? s.setLeftBranch : s.setRightBranch);

  const sandpackFiles = toSandpackFiles(files);
  const hasFiles = Object.keys(sandpackFiles).length > 0;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '6px 8px', borderBottom: '1px solid #1a1a1a', flexShrink: 0 }}>
        <select
          value={selectedBranch ?? ''}
          onChange={e => {
            if (projectId && e.target.value) {
              setBranch(projectId, e.target.value);
            }
          }}
          style={{
            background: '#111',
            color: '#ccc',
            border: '1px solid #2a2a4a',
            borderRadius: 4,
            padding: '4px 8px',
            fontSize: 12,
            width: '100%',
          }}
        >
          <option value="">Select branch...</option>
          {branches.map(b => (
            <option key={b.name} value={b.name}>{b.displayName}</option>
          ))}
        </select>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {hasFiles ? (
          <SandpackProvider template="static" files={sandpackFiles} theme="dark">
            <SandpackPreview
              showNavigator={false}
              showOpenInCodeSandbox={false}
              showRefreshButton={false}
            />
          </SandpackProvider>
        ) : (
          <div style={{
            height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#444', fontSize: 13,
          }}>
            {selectedBranch ? 'Loading...' : 'Choose a branch'}
          </div>
        )}
      </div>
    </div>
  );
}

function CompareActions() {
  const projectId = useProjectStore(s => s.activeProject?.id);
  const leftBranch = useCompareStore(s => s.leftBranch);
  const rightBranch = useCompareStore(s => s.rightBranch);
  const exitCompare = useCompareStore(s => s.exit);
  const switchBranch = useBranchStore(s => s.switchBranch);
  const deleteBranch = useBranchStore(s => s.deleteBranch);
  const forkFromSha = useBranchStore(s => s.forkFromSha);
  const currentBranch = useBranchStore(s => s.currentBranch);

  const btnStyle: React.CSSProperties = {
    background: '#1a1a2a',
    border: '1px solid #2a2a4a',
    color: '#ccc',
    padding: '6px 14px',
    borderRadius: 6,
    fontSize: 12,
    cursor: 'pointer',
  };

  const handleKeep = async (branch: string | null, otherBranch: string | null) => {
    if (!branch || !projectId) return;
    if (branch !== currentBranch) {
      await switchBranch(projectId, branch);
    }
    if (otherBranch && otherBranch !== 'main' && confirm(`Delete branch "${otherBranch}"?`)) {
      await deleteBranch(projectId, otherBranch);
    }
    exitCompare();
  };

  const handleRemix = async () => {
    if (!projectId) return;
    const name = prompt('Branch name for remix:', 'remix');
    if (!name) return;
    const log = await (await authFetch(`/api/git/${projectId}/log`)).json() as Array<{ sha: string }>;
    if (log.length > 0) {
      await forkFromSha(projectId, log[0].sha, name);
      useConversationStore.getState().addSystemMessage(
        'Remixing! Describe what to combine from both branches.'
      );
    }
    exitCompare();
  };

  return (
    <div style={{
      display: 'flex', gap: 8, justifyContent: 'center', padding: '8px 12px',
      borderTop: '1px solid #1a1a1a', flexShrink: 0,
    }}>
      <button
        onClick={() => handleKeep(leftBranch, rightBranch)}
        disabled={!leftBranch}
        style={{ ...btnStyle, opacity: leftBranch ? 1 : 0.4 }}
      >Keep Left</button>
      <button onClick={handleRemix} style={{ ...btnStyle, color: '#818cf8' }}>
        Remix
      </button>
      <button
        onClick={() => handleKeep(rightBranch, leftBranch)}
        disabled={!rightBranch}
        style={{ ...btnStyle, opacity: rightBranch ? 1 : 0.4 }}
      >Keep Right</button>
    </div>
  );
}

export function CompareView() {
  const exitCompare = useCompareStore(s => s.exit);

  return (
    <div style={{ flex: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 12px', borderBottom: '1px solid #1a1a1a',
        background: '#0d0d0d', flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Compare Mode
        </span>
        <button
          onClick={exitCompare}
          style={{
            background: 'none', border: '1px solid #333', color: '#888',
            padding: '3px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
          }}
        >Exit</button>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <ComparePane side="left" />
        <div style={{ width: 1, background: '#2a2a4a', flexShrink: 0 }} />
        <ComparePane side="right" />
      </div>

      <CompareActions />
    </div>
  );
}
