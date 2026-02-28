import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { userPreferences } from "../db/schema.js";
import { distillIdeas } from "../services/distill.js";
import { getUserApiKey } from "../services/user-keys.js";
import { getAuth } from "../types.js";

const AI_PROVIDERS = ["gemini", "anthropic", "openai", "fireworks"] as const;

const router = Router();

router.post("/distill", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const { transcript, existingSuggestions } = req.body;

  if (!transcript || typeof transcript !== "string") {
    res.status(400).json({ error: "transcript is required" });
    return;
  }

  try {
    // Resolve the user's preferred provider + key (distillIdeas only works with Gemini)
    const prefs = db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).get();
    const selectedProvider = prefs?.selectedProvider || "";
    let apiKey: string | undefined;
    let provider: string | undefined;

    if (selectedProvider) {
      apiKey = getUserApiKey(userId, selectedProvider) ?? undefined;
      provider = selectedProvider;
    }
    if (!apiKey) {
      for (const p of AI_PROVIDERS) {
        const k = getUserApiKey(userId, p);
        if (k) { apiKey = k; provider = p; break; }
      }
    }

    const ideas = await distillIdeas(transcript, existingSuggestions ?? [], apiKey, provider);
    res.json({ ideas });
  } catch (err) {
    console.error("[distill] error:", err);
    res.status(500).json({ error: "Failed to distill ideas" });
  }
});

export default router;
