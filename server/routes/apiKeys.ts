import { Router, type Request, type Response } from "express";
import { getUserApiKey, setUserApiKey, clearUserApiKey, listUserApiKeys } from "../services/user-keys.js";
import { getAuth } from "../types.js";

const router = Router();

// List configured keys (masked)
router.get("/keys/list", (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const keys = listUserApiKeys(userId);
  res.json({
    configured: keys.map(k => k.provider),
    keys: Object.fromEntries(keys.map(k => [k.provider, k.masked])),
  });
});

// Get all keys (masked)
router.get("/keys", (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const keys = listUserApiKeys(userId);
  res.json({ keys: Object.fromEntries(keys.map(k => [k.provider, k.masked])) });
});

// Set an API key
router.post("/keys/set", (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const { service, key } = req.body as { service: string; key: string };

  if (!service || typeof service !== "string") {
    res.status(400).json({ error: 'service is required (e.g., "gemini", "deepgram")' });
    return;
  }
  if (!key || typeof key !== "string") {
    res.status(400).json({ error: "key is required" });
    return;
  }

  setUserApiKey(userId, service.toLowerCase(), key);
  const masked = key.substring(0, 8) + "..." + key.substring(key.length - 4);
  res.json({ success: true, message: `Set ${service} key: ${masked}`, service });
});

// Clear an API key
router.post("/keys/clear", (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const { service } = req.body as { service?: string };

  if (!service || service === "all") {
    const keys = listUserApiKeys(userId);
    for (const k of keys) {
      clearUserApiKey(userId, k.provider);
    }
    res.json({ success: true, message: "All keys cleared" });
    return;
  }

  const cleared = clearUserApiKey(userId, service.toLowerCase());
  if (cleared) {
    res.json({ success: true, message: `Cleared ${service} key` });
  } else {
    res.json({ success: false, message: `No key found for ${service}` });
  }
});

export default router;
