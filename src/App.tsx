import { useEffect } from 'react';
import { useProjectStore } from './stores/project';
import { usePrototypeStore } from './stores/prototype';
import { useIdeasStore } from './stores/ideas';
import { ProjectPicker } from './components/ProjectPicker';
import { Header } from './components/Header';
import { ChatPanel } from './components/ChatPanel';
import { PrototypeViewer } from './components/PrototypeViewer';
import { IdeasPanel } from './components/IdeasPanel';

export default function App() {
  const activeProject = useProjectStore(s => s.activeProject);
  const fetchFiles = usePrototypeStore(s => s.fetchFiles);
  const loadHistory = useIdeasStore(s => s.loadHistory);

  useEffect(() => {
    if (activeProject) {
      fetchFiles(activeProject.id);
      loadHistory(activeProject.id);
    }
  }, [activeProject?.id]);

  if (!activeProject) return <ProjectPicker />;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <ChatPanel />
        <PrototypeViewer />
        <IdeasPanel />
      </div>
    </div>
  );
}
