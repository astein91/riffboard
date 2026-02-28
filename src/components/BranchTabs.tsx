import { useBranchStore } from '../stores/branch';
import { useCompareStore } from '../stores/compare';
import { useProjectStore } from '../stores/project';

export function BranchTabs() {
  const branches = useBranchStore(s => s.branches);
  const currentBranch = useBranchStore(s => s.currentBranch);
  const switching = useBranchStore(s => s.switching);
  const switchBranch = useBranchStore(s => s.switchBranch);
  const deleteBranch = useBranchStore(s => s.deleteBranch);
  const enterCompare = useCompareStore(s => s.enter);
  const projectId = useProjectStore(s => s.activeProject?.id);

  if (branches.length <= 1) return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      padding: '4px 8px',
      borderBottom: '1px solid #1a1a1a',
      background: '#0d0d0d',
      flexShrink: 0,
      overflow: 'auto',
    }}>
      {branches.map(b => {
        const isActive = b.name === currentBranch;
        const canDelete = !isActive && b.name !== 'main';

        return (
          <div key={b.name} style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
            <button
              onClick={() => {
                if (!isActive && projectId && !switching) {
                  switchBranch(projectId, b.name);
                }
              }}
              disabled={switching}
              style={{
                background: isActive ? '#1a1a2a' : 'transparent',
                border: isActive ? '1px solid #2a2a4a' : '1px solid transparent',
                color: isActive ? '#e5e5e5' : '#666',
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 12,
                cursor: switching ? 'wait' : isActive ? 'default' : 'pointer',
                fontWeight: isActive ? 600 : 400,
                whiteSpace: 'nowrap',
              }}
            >
              {b.displayName}
            </button>
            {canDelete && (
              <button
                onClick={() => {
                  if (projectId && confirm(`Delete branch "${b.name}"?`)) {
                    deleteBranch(projectId, b.name);
                  }
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#444',
                  cursor: 'pointer',
                  fontSize: 10,
                  padding: '2px 4px',
                  marginLeft: -4,
                  lineHeight: 1,
                }}
                title={`Delete ${b.name}`}
              >&#x2715;</button>
            )}
          </div>
        );
      })}

      {branches.length >= 2 && (
        <button
          onClick={() => enterCompare()}
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: '1px solid #2a2a4a',
            color: '#818cf8',
            padding: '4px 10px',
            borderRadius: 6,
            fontSize: 11,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Compare
        </button>
      )}
    </div>
  );
}
