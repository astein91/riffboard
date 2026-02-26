/**
 * API Key Management Routes
 * Allows users to manage API keys via Telegram → OpenClaw → This API
 */

import { Router } from 'express';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const router = Router();

// Storage location
const KEYS_FILE = join(homedir(), '.riffboard-keys.json');

type ApiKeys = {
  gemini?: string;
  deepgram?: string;
  [key: string]: string | undefined;
};

// Initialize keys file if it doesn't exist
if (!existsSync(KEYS_FILE)) {
  writeFileSync(KEYS_FILE, JSON.stringify({ keys: {} }, null, 2));
  console.log(`[api-keys] Created keys file at ${KEYS_FILE}`);
}

// Read keys from file
function readKeys(): ApiKeys {
  try {
    const data = readFileSync(KEYS_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return parsed.keys || {};
  } catch (error) {
    console.error('[api-keys] Error reading keys:', error);
    return {};
  }
}

// Write keys to file
function writeKeys(keys: ApiKeys): void {
  try {
    writeFileSync(KEYS_FILE, JSON.stringify({ keys }, null, 2));
    console.log('[api-keys] Keys updated');
  } catch (error) {
    console.error('[api-keys] Error writing keys:', error);
    throw error;
  }
}

/**
 * GET /api/keys
 * Get all API keys (for Clawcast to fetch)
 */
router.get('/keys', (req, res) => {
  const keys = readKeys();

  // Return keys with sensitive parts masked in logs
  console.log('[api-keys] Keys requested:', Object.keys(keys));

  res.json({ keys });
});

/**
 * POST /api/keys/set
 * Set an API key
 * Body: { service: 'gemini' | 'deepgram', key: 'abc...' }
 */
router.post('/keys/set', (req, res) => {
  try {
    const { service, key } = req.body;

    if (!service || typeof service !== 'string') {
      return res.status(400).json({ error: 'service is required (e.g., "gemini", "deepgram")' });
    }

    if (!key || typeof key !== 'string') {
      return res.status(400).json({ error: 'key is required' });
    }

    const keys = readKeys();
    keys[service.toLowerCase()] = key;
    writeKeys(keys);

    const masked = key.substring(0, 8) + '...' + key.substring(key.length - 4);
    res.json({
      success: true,
      message: `Set ${service} key: ${masked}`,
      service
    });
  } catch (error) {
    console.error('[api-keys] Error setting key:', error);
    res.status(500).json({ error: 'Failed to set key' });
  }
});

/**
 * POST /api/keys/clear
 * Clear an API key or all keys
 * Body: { service?: 'gemini' | 'deepgram' | 'all' }
 */
router.post('/keys/clear', (req, res) => {
  try {
    const { service } = req.body;

    const keys = readKeys();

    if (!service || service === 'all') {
      writeKeys({});
      return res.json({ success: true, message: 'All keys cleared' });
    }

    if (keys[service.toLowerCase()]) {
      delete keys[service.toLowerCase()];
      writeKeys(keys);
      return res.json({ success: true, message: `Cleared ${service} key` });
    }

    res.json({ success: false, message: `No key found for ${service}` });
  } catch (error) {
    console.error('[api-keys] Error clearing key:', error);
    res.status(500).json({ error: 'Failed to clear key' });
  }
});

/**
 * GET /api/keys/list
 * List configured keys (masked)
 */
router.get('/keys/list', (req, res) => {
  const keys = readKeys();

  const masked: Record<string, string> = {};
  for (const [service, key] of Object.entries(keys)) {
    if (key) {
      masked[service] = key.substring(0, 8) + '...' + key.substring(key.length - 4);
    }
  }

  res.json({
    configured: Object.keys(keys),
    keys: masked
  });
});

export default router;
