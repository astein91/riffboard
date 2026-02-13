import { useState, useEffect } from 'react';
import { useProjectStore } from '../stores/project';

export function ProjectPicker() {
  const { projects, loading, fetchProjects, createProject, setActiveProject } = useProjectStore();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => { fetchProjects(); }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    await createProject(name.trim());
    setName('');
    setCreating(false);
  };

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 40,
    }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Riffboard</h1>
      <p style={{ color: '#888', marginBottom: 40, fontSize: 15 }}>Describe an app. Watch it appear.</p>
      {loading ? <p style={{ color: '#666' }}>Loading...</p> : (
        <>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 12, width: '100%', maxWidth: 720, marginBottom: 24,
          }}>
            {projects.map(p => (
              <button key={p.id} onClick={() => setActiveProject(p)} style={{
                background: '#151515', border: '1px solid #222', borderRadius: 8,
                padding: 20, textAlign: 'left', cursor: 'pointer', color: '#e5e5e5',
              }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{p.name}</div>
                <div style={{ fontSize: 13, color: '#666' }}>{p.description || 'No description'}</div>
              </button>
            ))}
          </div>
          {creating ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <input autoFocus value={name} onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder="Project name..."
                style={{
                  background: '#151515', border: '1px solid #333', borderRadius: 6,
                  padding: '8px 12px', color: '#e5e5e5', outline: 'none', width: 240,
                }} />
              <button onClick={handleCreate} style={{
                background: '#fff', color: '#000', border: 'none', borderRadius: 6,
                padding: '8px 16px', cursor: 'pointer', fontWeight: 500,
              }}>Create</button>
              <button onClick={() => setCreating(false)} style={{
                background: 'none', border: '1px solid #333', borderRadius: 6,
                padding: '8px 12px', cursor: 'pointer', color: '#888',
              }}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setCreating(true)} style={{
              background: '#fff', color: '#000', border: 'none', borderRadius: 8,
              padding: '10px 24px', cursor: 'pointer', fontWeight: 600, fontSize: 15,
            }}>+ New Project</button>
          )}
        </>
      )}
    </div>
  );
}
