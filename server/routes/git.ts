import { Router, type Request, type Response } from "express";
import path from "node:path";
import os from "node:os";
import { autoCommit, getLog, revertTo } from "../services/git.js";

const PROJECTS_DIR = path.join(os.homedir(), ".riffboard", "projects");

function projectDir(id: string): string {
  return path.join(PROJECTS_DIR, id);
}

const router = Router();

router.post("/:id/commit", async (req: Request<{ id: string }>, res: Response) => {
  const { message } = req.body as { message: string };

  if (!message) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  try {
    const sha = await autoCommit(projectDir(req.params.id), message);
    res.json({ sha });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error });
  }
});

router.get("/:id/log", async (req: Request<{ id: string }>, res: Response) => {
  try {
    const log = await getLog(projectDir(req.params.id));
    res.json(log);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error });
  }
});

router.post("/:id/revert", async (req: Request<{ id: string }>, res: Response) => {
  const { sha } = req.body as { sha: string };

  if (!sha) {
    res.status(400).json({ error: "sha is required" });
    return;
  }

  try {
    const newSha = await revertTo(projectDir(req.params.id), sha);
    res.json({ sha: newSha });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error });
  }
});

export default router;
