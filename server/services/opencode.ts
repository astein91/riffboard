import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const SESSION_ROTATE_THRESHOLD = 8;

const DEFAULT_MODELS: Record<string, string> = {
  gemini: "google/gemini-2.5-flash",
  anthropic: "anthropic/claude-sonnet-4-5-20250929",
  openai: "openai/gpt-4o",
  fireworks: "fireworks/accounts/fireworks/models/llama4-maverick-instruct-basic",
};

const ENV_KEY_MAP: Record<string, string> = {
  gemini: "GOOGLE_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  fireworks: "FIREWORKS_API_KEY",
};

const PROVIDER_CONFIG_MAP: Record<string, string> = {
  gemini: "google",
  anthropic: "anthropic",
  openai: "openai",
  fireworks: "fireworks",
};

interface OpenCodeInstance {
  process: ChildProcess;
  port: number;
  projectId: string;
  projectDir: string;
  sessionId: string | null;
  messageCount: number;
  provider?: string;
  model?: string;
}

export interface StartOptions {
  apiKey?: string;
  provider?: string; // 'gemini' | 'anthropic' | 'openai' | 'fireworks'
  model?: string;
}

let active: OpenCodeInstance | null = null;
let nextPort = 4096;

function ensureConfig(projectDir: string, opts?: StartOptions): void {
  const configDir = path.join(projectDir, ".opencode");
  fs.mkdirSync(configDir, { recursive: true });

  // Load the base config to get agent definitions
  const srcConfig = path.join(process.cwd(), ".opencode", "opencode.json");
  let baseConfig: Record<string, unknown> = {};
  if (fs.existsSync(srcConfig)) {
    baseConfig = JSON.parse(fs.readFileSync(srcConfig, "utf-8"));
  }

  // Determine provider and model
  const provider = opts?.provider || "gemini";
  const providerKey = PROVIDER_CONFIG_MAP[provider] || "google";
  const model = opts?.model || DEFAULT_MODELS[provider] || DEFAULT_MODELS.gemini;

  // Build config with the right provider
  const config: Record<string, unknown> = {
    ...baseConfig,
    model,
    small_model: model,
    provider: { [providerKey]: {} },
  };

  // Update agent model to match
  if (config.agent && typeof config.agent === "object") {
    const agentConfig = config.agent as Record<string, Record<string, unknown>>;
    for (const agentName of Object.keys(agentConfig)) {
      agentConfig[agentName].model = model;
    }
  }

  const destConfig = path.join(configDir, "opencode.json");
  fs.writeFileSync(destConfig, JSON.stringify(config, null, 2));

  // Clear stale session state
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

export async function startForProject(
  projectId: string,
  projectDir: string,
  opts?: StartOptions,
): Promise<number> {
  const provider = opts?.provider || "gemini";
  const model = opts?.model || DEFAULT_MODELS[provider] || DEFAULT_MODELS.gemini;

  // If same project but provider/model changed, force restart
  if (active?.projectId === projectId) {
    if (active.provider === provider && active.model === model) {
      ensureConfig(projectDir, opts);
      return active.port;
    }
    console.log(`[opencode] provider/model changed (${active.provider}/${active.model} → ${provider}/${model}), restarting`);
    killOpenCode();
  } else if (active) {
    killOpenCode();
  }

  ensureConfig(projectDir, opts);

  const port = nextPort++;
  console.log(`[opencode] starting for project ${projectId} on port ${port} (${provider}/${model})`);

  // Build env with the correct API key env var for the provider
  const env: Record<string, string> = { ...process.env as Record<string, string> };
  if (opts?.apiKey) {
    const envVar = ENV_KEY_MAP[provider] || "GOOGLE_API_KEY";
    env[envVar] = opts.apiKey;
  }

  const child = spawn("opencode", ["serve", "--port", String(port)], {
    cwd: projectDir,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
    env,
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

  active = { process: child, port, projectId, projectDir, sessionId: null, messageCount: 0, provider, model };
  await waitForReady(port);
  return port;
}

async function waitForReady(port: number, timeoutMs = 30000): Promise<void> {
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
