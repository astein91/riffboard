import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { userPreferences } from "../db/schema.js";
import { getAuth } from "../types.js";

const router = Router();

router.get("/preferences", (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const prefs = db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).get();
  res.json(prefs ?? { userId, selectedModel: null, selectedProvider: null });
});

router.post("/preferences", (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const { selectedModel, selectedProvider } = req.body as {
    selectedModel?: string;
    selectedProvider?: string;
  };

  const existing = db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).get();

  if (existing) {
    db.update(userPreferences)
      .set({
        selectedModel: selectedModel ?? existing.selectedModel,
        selectedProvider: selectedProvider ?? existing.selectedProvider,
      })
      .where(eq(userPreferences.userId, userId))
      .run();
  } else {
    db.insert(userPreferences).values({
      userId,
      selectedModel: selectedModel ?? null,
      selectedProvider: selectedProvider ?? null,
    }).run();
  }

  res.json({ success: true });
});

export default router;
