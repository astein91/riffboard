import { useEffect } from 'react';
import { ClerkProvider, SignedIn, SignedOut, SignIn, useAuth } from '@clerk/clerk-react';
import { useProjectStore } from './stores/project';
import { usePrototypeStore } from './stores/prototype';
import { useIdeasStore } from './stores/ideas';
import { setGetTokenFn } from './lib/auth-fetch';
import { ProjectPicker } from './components/ProjectPicker';
import { Header } from './components/Header';
import { ChatPanel } from './components/ChatPanel';
import { PrototypeViewer } from './components/PrototypeViewer';
import { IdeasPanel } from './components/IdeasPanel';
import { SettingsPanel } from './components/SettingsPanel';

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

function TokenProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  useEffect(() => {
    setGetTokenFn(getToken);
  }, [getToken]);
  return <>{children}</>;
}

function AuthenticatedApp() {
  const activeProject = useProjectStore(s => s.activeProject);
  const fetchFiles = usePrototypeStore(s => s.fetchFiles);
  const loadHistory = useIdeasStore(s => s.loadHistory);

  useEffect(() => {
    if (activeProject) {
      fetchFiles(activeProject.id);
      loadHistory(activeProject.id);
    }
  }, [activeProject?.id]);

  if (!activeProject) return (
    <>
      <ProjectPicker />
      <SettingsPanel />
    </>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <ChatPanel />
        <PrototypeViewer />
        <IdeasPanel />
      </div>
      <SettingsPanel />
    </div>
  );
}

export default function App() {
  return (
    <ClerkProvider publishableKey={CLERK_KEY}>
      <SignedOut>
        <div style={{
          height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#0a0a0a',
        }}>
          <SignIn />
        </div>
      </SignedOut>
      <SignedIn>
        <TokenProvider>
          <AuthenticatedApp />
        </TokenProvider>
      </SignedIn>
    </ClerkProvider>
  );
}
