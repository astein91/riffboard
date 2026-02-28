import { Router, type Request, type Response } from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { projects, userPreferences } from "../db/schema.js";
import { projectDir, protoDir, ensureProjectDir } from "../services/project-paths.js";
import { validateProjectOwnership } from "../middleware/ownership.js";
import { initRepo } from "../services/git.js";
import { sendPrompt, rotateSession, startForProject, type StartOptions } from "../services/opencode.js";
import { distill, type TranscriptMessage } from "../services/distill.js";
import { validatePrototypeFiles, formatFixPrompt, type ValidationError } from "../services/validate.js";
import { getUserApiKey } from "../services/user-keys.js";
import { getAuth } from "../types.js";

const AI_PROVIDERS = ["gemini", "anthropic", "openai", "fireworks"] as const;

/** Resolve which provider/key/model to use for a user */
function resolveAiConfig(userId: string): { apiKey: string; provider: string; model?: string } | null {
  // Load user preferences
  const prefs = db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).get();
  const selectedProvider = prefs?.selectedProvider || "";
  const selectedModel = prefs?.selectedModel || undefined;

  // Try the user's selected provider first
  if (selectedProvider) {
    const key = getUserApiKey(userId, selectedProvider);
    if (key) return { apiKey: key, provider: selectedProvider, model: selectedModel };
  }

  // Fallback: first configured AI provider
  for (const p of AI_PROVIDERS) {
    const key = getUserApiKey(userId, p);
    if (key) return { apiKey: key, provider: p, model: selectedModel };
  }

  return null;
}

const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  <div id="root"></div>
  <script src="./App.jsx"></script>
</body>
</html>`;

const APP_JSX = `function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">Your Prototype</h1>
        <p className="text-gray-500">Describe what you want to build...</p>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));`;

async function getAllPrototypeFiles(
  dir: string,
  root: string = dir
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  if (!fs.existsSync(dir)) return result;
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const relative = path.relative(root, full);
    if (entry.isDirectory()) {
      Object.assign(result, await getAllPrototypeFiles(full, root));
    } else {
      result[relative] = await fs.promises.readFile(full, "utf-8");
    }
  }
  return result;
}

const router = Router();

// List projects for current user
router.get("/", (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const rows = db.select().from(projects).where(eq(projects.userId, userId)).all();
  res.json(rows.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
    version: 1,
  })));
});

// Create project
router.post("/", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const { name, description } = req.body as { name: string; description: string };

  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const id = crypto.randomUUID();
  const dir = ensureProjectDir(userId, id);
  const proto = protoDir(userId, id);

  const specPath = path.join(dir, "spec.json");
  fs.writeFileSync(specPath, JSON.stringify({ name, description: description || "", version: 1 }, null, 2));
  fs.writeFileSync(path.join(proto, "index.html"), INDEX_HTML);
  fs.writeFileSync(path.join(proto, "App.jsx"), APP_JSX);

  await initRepo(dir);

  db.insert(projects).values({
    id,
    userId,
    name,
    description: description || "",
  }).run();

  res.status(201).json({ id, name, description: description || "" });
});

// All /:id routes validate ownership
router.use("/:id", validateProjectOwnership);

// Get project
router.get("/:id", (req: Request, res: Response) => {
  const row = db.select().from(projects).where(eq(projects.id, req.params.id as string)).get();
  if (!row) { res.status(404).json({ error: "project not found" }); return; }
  res.json({ id: row.id, name: row.name, description: row.description, version: 1 });
});

// Delete project
router.delete("/:id", (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const dir = projectDir(userId, req.params.id as string);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  db.delete(projects).where(eq(projects.id, req.params.id as string)).run();
  res.json({ ok: true });
});

// Get prototype files
router.get("/:id/files", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const dir = projectDir(userId, req.params.id as string);
  const proto = protoDir(userId, req.params.id as string);
  if (!fs.existsSync(proto)) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const files = await getAllPrototypeFiles(proto, dir);
  res.json(files);
});

// Send prompt
router.post("/:id/prompt", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const { message, transcript } = req.body as { message: string; transcript?: TranscriptMessage[] };

  if (!message) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const dir = projectDir(userId, req.params.id as string);
  const proto = protoDir(userId, req.params.id as string);

  if (!fs.existsSync(proto)) {
    res.status(404).json({ error: "project not found" });
    return;
  }

  try {
    const aiConfig = resolveAiConfig(userId);
    if (!aiConfig) {
      res.status(400).json({ error: "No AI API key configured. Add one in Settings." });
      return;
    }

    const startOpts: StartOptions = {
      apiKey: aiConfig.apiKey,
      provider: aiConfig.provider,
      model: aiConfig.model,
    };
    await startForProject(req.params.id as string, dir, startOpts);

    const fileList = Object.keys(await getAllPrototypeFiles(proto, dir));
    const distilled = await distill(message, transcript ?? [], fileList, aiConfig.apiKey, aiConfig.provider);

    if (distilled === "NO_ACTION") {
      const files = await getAllPrototypeFiles(proto, dir);
      res.json({ response: "Got it — no code change needed for that.", files });
      return;
    }

    const MAX_ATTEMPTS = 3;
    let response = "";
    let files: Record<string, string> = {};
    let validationErrors: ValidationError[] = [];

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const prompt = attempt === 0 ? distilled : formatFixPrompt({ valid: false, errors: validationErrors });
      response = await sendPrompt(req.params.id as string, prompt);
      files = await getAllPrototypeFiles(proto, dir);

      const validation = await validatePrototypeFiles(files);
      if (validation.valid) {
        res.json({ response, files });
        return;
      }

      validationErrors = validation.errors;
      console.warn(`[validate] attempt ${attempt + 1}/${MAX_ATTEMPTS} found ${validationErrors.length} error(s)`);
    }

    res.json({ response, files, validationErrors });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    res.status(502).json({
      error: `OpenCode unavailable: ${error}`,
      hint: "Ensure OpenCode server is running",
    });
  }
});

// Fix runtime error
router.post("/:id/fix", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const { errorMessage } = req.body as { errorMessage: string };

  if (!errorMessage) {
    res.status(400).json({ error: "errorMessage is required" });
    return;
  }

  const dir = projectDir(userId, req.params.id as string);
  const proto = protoDir(userId, req.params.id as string);

  if (!fs.existsSync(proto)) {
    res.status(404).json({ error: "project not found" });
    return;
  }

  try {
    const aiConfig = resolveAiConfig(userId);
    if (!aiConfig) {
      res.status(400).json({ error: "No AI API key configured. Add one in Settings." });
      return;
    }

    await startForProject(req.params.id as string, dir, {
      apiKey: aiConfig.apiKey,
      provider: aiConfig.provider,
      model: aiConfig.model,
    });

    const fixPrompt = `The prototype has a runtime error:\n${errorMessage}\n\nFix this error. Make minimal changes — only fix what is broken.`;
    const response = await sendPrompt(req.params.id as string, fixPrompt);
    const files = await getAllPrototypeFiles(proto, dir);

    const validation = await validatePrototypeFiles(files);
    res.json({
      response,
      files,
      fixed: validation.valid,
      validationErrors: validation.valid ? undefined : validation.errors,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    res.status(502).json({
      error: `OpenCode unavailable: ${error}`,
      hint: "Ensure OpenCode server is running",
    });
  }
});

// Rotate session
router.post("/:id/session/rotate", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const dir = projectDir(userId, req.params.id as string);

  if (!fs.existsSync(dir)) {
    res.status(404).json({ error: "project not found" });
    return;
  }

  try {
    const aiConfig = resolveAiConfig(userId);
    await startForProject(req.params.id as string, dir, aiConfig ? {
      apiKey: aiConfig.apiKey,
      provider: aiConfig.provider,
      model: aiConfig.model,
    } : undefined);
    rotateSession(req.params.id as string);
    res.json({ ok: true });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: `Failed to rotate session: ${error}` });
  }
});

export default router;
