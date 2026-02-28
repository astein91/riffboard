import { Router, type Request, type Response } from "express";
import { projectDir } from "../services/project-paths.js";
import { validateProjectOwnership } from "../middleware/ownership.js";
import { autoCommit, getLog, revertTo } from "../services/git.js";
import { getAuth } from "../types.js";

const router = Router();

router.use("/:id", validateProjectOwnership);

router.post("/:id/commit", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const { message } = req.body as { message: string };

  if (!message) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  try {
    const sha = await autoCommit(projectDir(userId, req.params.id as string), message);
    res.json({ sha });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error });
  }
});

router.get("/:id/log", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);

  try {
    const log = await getLog(projectDir(userId, req.params.id as string));
    res.json(log);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error });
  }
});

router.post("/:id/revert", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const { sha } = req.body as { sha: string };

  if (!sha) {
    res.status(400).json({ error: "sha is required" });
    return;
  }

  try {
    const newSha = await revertTo(projectDir(userId, req.params.id as string), sha);
    res.json({ sha: newSha });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error });
  }
});

export default router;
