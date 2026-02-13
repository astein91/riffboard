import { Router, type Request, type Response } from "express";
import { distillIdeas } from "../services/distill.js";

const router = Router();

router.post("/distill", async (req: Request, res: Response) => {
  const { transcript, existingSuggestions } = req.body;

  if (!transcript || typeof transcript !== "string") {
    res.status(400).json({ error: "transcript is required" });
    return;
  }

  try {
    const ideas = await distillIdeas(transcript, existingSuggestions ?? []);
    res.json({ ideas });
  } catch (err) {
    console.error("[distill] error:", err);
    res.status(500).json({ error: "Failed to distill ideas" });
  }
});

export default router;
