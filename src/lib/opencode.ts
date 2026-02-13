export const SIDECAR_URL = '/api';

export async function sendPrompt(projectId: string, message: string, sessionId?: string | null) {
  const res = await fetch(`${SIDECAR_URL}/projects/${projectId}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId }),
  });
  if (!res.ok) throw new Error(`Prompt failed: ${res.statusText}`);
  return res.json();
}

export async function fetchProjectFiles(projectId: string): Promise<Record<string, string>> {
  const res = await fetch(`${SIDECAR_URL}/projects/${projectId}/files`);
  if (!res.ok) throw new Error(`Failed to fetch files: ${res.statusText}`);
  return res.json();
}
