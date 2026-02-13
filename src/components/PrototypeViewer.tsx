import { useEffect, useRef } from 'react';
import { SandpackProvider, SandpackPreview, useSandpack } from '@codesandbox/sandpack-react';
import { usePrototypeStore } from '../stores/prototype';
import { useProjectStore } from '../stores/project';

function SandpackErrorWatcher() {
  const { sandpack, listen } = useSandpack();
  const projectId = useProjectStore(s => s.activeProject?.id);
  const reportRuntimeError = usePrototypeStore(s => s.reportRuntimeError);
  const lastErrorRef = useRef<string | null>(null);
  const filesRef = useRef(sandpack.files);

  // Reset error tracking when files change
  useEffect(() => {
    if (filesRef.current !== sandpack.files) {
      filesRef.current = sandpack.files;
      lastErrorRef.current = null;
    }
  }, [sandpack.files]);

  // Watch sandpack.error for bundler errors
  useEffect(() => {
    const err = sandpack.error;
    if (!err?.message || !projectId) return;
    if (lastErrorRef.current === err.message) return;

    lastErrorRef.current = err.message;
    reportRuntimeError(err.message, projectId);
  }, [sandpack.error, projectId, reportRuntimeError]);

  // Listen for runtime console errors from the iframe
  useEffect(() => {
    if (!projectId) return;

    const unsub = listen((msg) => {
      // Console errors (SyntaxError, ReferenceError, TypeError, etc.)
      if (msg.type === 'console' && 'log' in msg) {
        const logEntries = (msg as { log: Array<{ method: string; data: string[] }> }).log;
        for (const entry of logEntries) {
          if (entry.method === 'error') {
            const errorText = entry.data?.join(' ') ?? 'Unknown error';
            if (lastErrorRef.current === errorText) continue;
            lastErrorRef.current = errorText;
            reportRuntimeError(errorText, projectId);
            break;
          }
        }
      }

      // Unhandled runtime errors shown by Sandpack
      if (msg.type === 'action' && 'action' in msg && (msg as { action: string }).action === 'show-error') {
        const errorMsg = (msg as { title?: string; message?: string }).title
          ?? (msg as { message?: string }).message
          ?? 'Runtime error';
        if (lastErrorRef.current === errorMsg) return;
        lastErrorRef.current = errorMsg;
        reportRuntimeError(errorMsg, projectId);
      }
    });

    return unsub;
  }, [projectId, listen, reportRuntimeError]);

  return null;
}

function ErrorOverlay() {
  const runtimeError = usePrototypeStore(s => s.runtimeError);
  const validationErrors = usePrototypeStore(s => s.validationErrors);
  const autoFixInProgress = usePrototypeStore(s => s.autoFixInProgress);
  const clearError = usePrototypeStore(s => s.clearError);

  const errorText = runtimeError
    ?? validationErrors.map(e => `${e.file}:${e.line} ${e.message}`).join('; ');

  if (!errorText) return null;

  const truncated = errorText.length > 300 ? errorText.slice(0, 300) + '...' : errorText;

  return (
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      background: '#dc2626',
      color: '#fff',
      padding: '8px 12px',
      fontFamily: 'monospace',
      fontSize: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      zIndex: 10,
    }}>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {autoFixInProgress ? 'Fixing...' : truncated}
      </span>
      {!autoFixInProgress && (
        <button
          onClick={clearError}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            color: '#fff',
            padding: '2px 8px',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '11px',
            flexShrink: 0,
          }}
        >
          Dismiss
        </button>
      )}
    </div>
  );
}

export function PrototypeViewer() {
  const files = usePrototypeStore(s => s.files);
  const loading = usePrototypeStore(s => s.loading);

  const sandpackFiles: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) {
    sandpackFiles['/' + path.replace(/^prototype\//, '')] = content;
  }

  const hasFiles = Object.keys(sandpackFiles).length > 0;

  if (loading || !hasFiles) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#111', color: '#444',
      }}>{loading ? 'Loading prototype...' : 'No prototype yet. Start chatting!'}</div>
    );
  }

  return (
    <div className="prototype-viewer" style={{ flex: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <SandpackProvider template="static" files={sandpackFiles} theme="dark">
        <SandpackPreview
          showNavigator={false}
          showOpenInCodeSandbox={false}
          showRefreshButton={false}
        />
        <SandpackErrorWatcher />
      </SandpackProvider>
      <ErrorOverlay />
    </div>
  );
}
