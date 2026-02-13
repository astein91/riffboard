import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const SESSION_ROTATE_THRESHOLD = 8;

interface OpenCodeInstance {
  process: ChildProcess;
  port: number;
  projectId: string;
  projectDir: string;
  sessionId: string | null;
  messageCount: number;
}

let active: OpenCodeInstance | null = null;
let nextPort = 4096;

// Copy opencode config into the project directory so it picks up our agent + provider settings.
// Always overwrite to ensure latest agent prompt is used.
function ensureConfig(projectDir: string): void {
  const configDir = path.join(projectDir, ".opencode");
  fs.mkdirSync(configDir, { recursive: true });

  const srcConfig = path.join(process.cwd(), ".opencode", "opencode.json");
  const destConfig = path.join(configDir, "opencode.json");

  if (fs.existsSync(srcConfig)) {
    fs.copyFileSync(srcConfig, destConfig);
  }

  // Clear any stale OpenCode session state so each server start is fresh
  const sessionDir = path.join(configDir, "session");
  if (fs.existsSync(sessionDir)) {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  }
}

export function getActivePort(): number | null {
  return active?.port ?? null;
}

export function getActiveProjectId(): string | null {
  return active?.projectId ?? null;
}

export async function startForProject(projectId: string, projectDir: string): Promise<number> {
  // If already running for this project, refresh config on disk and return existing port.
  // Note: the running process still uses whatever config was loaded at spawn time —
  // but a session rotation will pick up the fresh on-disk config for OpenCode impls
  // that re-read config per session.
  if (active?.projectId === projectId) {
    ensureConfig(projectDir);
    return active.port;
  }

  // Kill any existing instance (different project)
  killOpenCode();

  ensureConfig(projectDir);

  const port = nextPort++;
  console.log(`[opencode] starting for project ${projectId} at ${projectDir} on port ${port}`);

  const child = spawn("opencode", ["serve", "--port", String(port)], {
    cwd: projectDir,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });

  child.stdout?.on("data", (data: Buffer) => {
    process.stdout.write(`[opencode:${projectId.slice(0, 8)}] ${data.toString()}`);
  });

  child.stderr?.on("data", (data: Buffer) => {
    process.stderr.write(`[opencode:${projectId.slice(0, 8)}] ${data.toString()}`);
  });

  child.on("exit", (code) => {
    console.log(`[opencode:${projectId.slice(0, 8)}] exited with code ${code}`);
    if (active?.projectId === projectId) active = null;
  });

  child.on("error", (err) => {
    console.error(`[opencode:${projectId.slice(0, 8)}] failed: ${err.message}`);
    if (active?.projectId === projectId) active = null;
  });

  active = { process: child, port, projectId, projectDir, sessionId: null, messageCount: 0 };

  await waitForReady(port);

  return port;
}

async function waitForReady(port: number, timeoutMs = 10000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://localhost:${port}/global/health`);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  console.warn("[opencode] timed out waiting for server to start");
}

// --- Session management (keyed by project, not port) ---

async function createSession(): Promise<string> {
  if (!active) throw new Error("No active OpenCode instance");

  const res = await fetch(`http://localhost:${active.port}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: `Riffboard: ${active.projectId.slice(0, 8)}` }),
  });

  if (!res.ok) {
    throw new Error(`OpenCode session creation failed: ${res.status} ${res.statusText}`);
  }

  const session = (await res.json()) as { id: string };
  active.sessionId = session.id;
  active.messageCount = 0;
  console.log(`[opencode:${active.projectId.slice(0, 8)}] new session ${session.id}`);
  return session.id;
}

async function ensureSession(): Promise<string> {
  if (!active) throw new Error("No active OpenCode instance");

  if (active.sessionId && active.messageCount < SESSION_ROTATE_THRESHOLD) {
    return active.sessionId;
  }

  if (active.sessionId) {
    console.log(`[opencode:${active.projectId.slice(0, 8)}] rotating session after ${active.messageCount} messages`);
  }

  return createSession();
}

export async function sendPrompt(projectId: string, prompt: string): Promise<string> {
  if (!active || active.projectId !== projectId) {
    throw new Error(`OpenCode not running for project ${projectId}`);
  }

  const sid = await ensureSession();

  const res = await fetch(`http://localhost:${active.port}/session/${sid}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agent: "prototype",
      parts: [{ type: "text", text: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenCode message failed: ${res.status} ${res.statusText}`);
  }

  active.messageCount++;

  const data = (await res.json()) as {
    parts: Array<{ type: string; text?: string }>;
  };

  const textParts = data.parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text!);

  return textParts.join("\n") || "Done.";
}

export function rotateSession(projectId: string): void {
  if (active?.projectId === projectId) {
    active.sessionId = null;
    active.messageCount = 0;
    console.log(`[opencode:${projectId.slice(0, 8)}] session rotated`);
  }
}

export function killOpenCode(): void {
  if (!active) return;
  console.log(`[opencode] killing instance for project ${active.projectId.slice(0, 8)}`);
  active.process.kill("SIGTERM");
  active = null;
}
