import { Router, type Request, type Response } from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { initRepo } from "../services/git.js";
import { sendPrompt, rotateSession, startForProject } from "../services/opencode.js";
import { distill, type TranscriptMessage } from "../services/distill.js";
import { validatePrototypeFiles, formatFixPrompt, type ValidationError } from "../services/validate.js";

const PROJECTS_DIR = path.join(os.homedir(), ".riffboard", "projects");

function ensureProjectsDir(): void {
  fs.mkdirSync(PROJECTS_DIR, { recursive: true });
}

function projectDir(id: string): string {
  return path.join(PROJECTS_DIR, id);
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

interface ProjectSpec {
  name: string;
  description: string;
  version: number;
}

function readSpec(dir: string): ProjectSpec | null {
  const specPath = path.join(dir, "spec.json");
  if (!fs.existsSync(specPath)) return null;

  const raw = fs.readFileSync(specPath, "utf-8");
  return JSON.parse(raw) as ProjectSpec;
}

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
      const nested = await getAllPrototypeFiles(full, root);
      Object.assign(result, nested);
    } else {
      result[relative] = await fs.promises.readFile(full, "utf-8");
    }
  }

  return result;
}

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  ensureProjectsDir();

  const entries = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true });
  const projects = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const spec = readSpec(path.join(PROJECTS_DIR, entry.name));
      if (!spec) return null;
      return { id: entry.name, ...spec };
    })
    .filter(Boolean);

  res.json(projects);
});

router.post("/", async (req: Request, res: Response) => {
  const { name, description } = req.body as {
    name: string;
    description: string;
  };

  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  ensureProjectsDir();

  const id = crypto.randomUUID();
  const dir = projectDir(id);
  const protoDir = path.join(dir, "prototype");

  fs.mkdirSync(protoDir, { recursive: true });

  const spec: ProjectSpec = {
    name,
    description: description || "",
    version: 1,
  };

  fs.writeFileSync(
    path.join(dir, "spec.json"),
    JSON.stringify(spec, null, 2)
  );
  fs.writeFileSync(path.join(protoDir, "index.html"), INDEX_HTML);
  fs.writeFileSync(path.join(protoDir, "App.jsx"), APP_JSX);

  await initRepo(dir);

  res.status(201).json({ id, name, description: spec.description });
});

router.get("/:id", (req: Request<{ id: string }>, res: Response) => {
  const dir = projectDir(req.params.id);
  const spec = readSpec(dir);

  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }

  res.json({ id: req.params.id, ...spec });
});

router.delete("/:id", (req: Request<{ id: string }>, res: Response) => {
  const dir = projectDir(req.params.id);

  if (!fs.existsSync(dir)) {
    res.status(404).json({ error: "project not found" });
    return;
  }

  fs.rmSync(dir, { recursive: true, force: true });
  res.json({ ok: true });
});

router.get("/:id/files", async (req: Request<{ id: string }>, res: Response) => {
  const dir = projectDir(req.params.id);
  const protoDir = path.join(dir, "prototype");

  if (!fs.existsSync(protoDir)) {
    res.status(404).json({ error: "project not found" });
    return;
  }

  const files = await getAllPrototypeFiles(protoDir, dir);
  res.json(files);
});

router.post("/:id/prompt", async (req: Request<{ id: string }>, res: Response) => {
  const { message, transcript } = req.body as {
    message: string;
    transcript?: TranscriptMessage[];
  };

  if (!message) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const dir = projectDir(req.params.id);
  const protoDir = path.join(dir, "prototype");

  if (!fs.existsSync(protoDir)) {
    res.status(404).json({ error: "project not found" });
    return;
  }

  try {
    await startForProject(req.params.id, dir);

    // Get file list for distill context
    const fileList = Object.keys(await getAllPrototypeFiles(protoDir, dir));

    // Distill raw message into a clean coding instruction
    const distilled = await distill(message, transcript ?? [], fileList);

    // Handle NO_ACTION — no coding request detected
    if (distilled === "NO_ACTION") {
      const files = await getAllPrototypeFiles(protoDir, dir);
      res.json({ response: "Got it — no code change needed for that.", files });
      return;
    }

    // Validation loop: try up to 3 attempts (1 original + 2 retries)
    const MAX_ATTEMPTS = 3;
    let response = "";
    let files: Record<string, string> = {};
    let validationErrors: ValidationError[] = [];

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const prompt = attempt === 0 ? distilled : formatFixPrompt({ valid: false, errors: validationErrors });
      response = await sendPrompt(req.params.id, prompt);
      files = await getAllPrototypeFiles(protoDir, dir);

      const validation = await validatePrototypeFiles(files);
      if (validation.valid) {
        res.json({ response, files });
        return;
      }

      validationErrors = validation.errors;
      console.warn(`[validate] attempt ${attempt + 1}/${MAX_ATTEMPTS} found ${validationErrors.length} error(s)`);
    }

    // All attempts exhausted — return with errors so client knows
    res.json({ response, files, validationErrors });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    res.status(502).json({
      error: `OpenCode unavailable: ${error}`,
      hint: "Ensure OpenCode server is running",
    });
  }
});

router.post("/:id/fix", async (req: Request<{ id: string }>, res: Response) => {
  const { errorMessage } = req.body as { errorMessage: string };

  if (!errorMessage) {
    res.status(400).json({ error: "errorMessage is required" });
    return;
  }

  const dir = projectDir(req.params.id);
  const protoDir = path.join(dir, "prototype");

  if (!fs.existsSync(protoDir)) {
    res.status(404).json({ error: "project not found" });
    return;
  }

  try {
    await startForProject(req.params.id, dir);

    const fixPrompt = `The prototype has a runtime error:\n${errorMessage}\n\nFix this error. Make minimal changes — only fix what is broken.`;
    const response = await sendPrompt(req.params.id, fixPrompt);
    const files = await getAllPrototypeFiles(protoDir, dir);

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

router.post("/:id/session/rotate", async (req: Request<{ id: string }>, res: Response) => {
  const dir = projectDir(req.params.id);

  if (!fs.existsSync(dir)) {
    res.status(404).json({ error: "project not found" });
    return;
  }

  try {
    await startForProject(req.params.id, dir);
    rotateSession(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: `Failed to rotate session: ${error}` });
  }
});

export default router;
