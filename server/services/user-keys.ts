import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { userApiKeys } from "../db/schema.js";
import { encrypt, decrypt } from "./crypto.js";

export function getUserApiKey(userId: string, provider: string): string | null {
  const row = db.select()
    .from(userApiKeys)
    .where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.provider, provider)))
    .get();

  if (!row) return null;
  return decrypt(row.encryptedKey, row.iv, row.authTag);
}

export function setUserApiKey(userId: string, provider: string, plainKey: string): void {
  const { encrypted, iv, authTag } = encrypt(plainKey);
  const now = new Date();

  const existing = db.select({ id: userApiKeys.id })
    .from(userApiKeys)
    .where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.provider, provider)))
    .get();

  if (existing) {
    db.update(userApiKeys)
      .set({ encryptedKey: encrypted, iv, authTag, updatedAt: now })
      .where(eq(userApiKeys.id, existing.id))
      .run();
  } else {
    db.insert(userApiKeys).values({
      userId,
      provider,
      encryptedKey: encrypted,
      iv,
      authTag,
      createdAt: now,
      updatedAt: now,
    }).run();
  }
}

export function clearUserApiKey(userId: string, provider: string): boolean {
  const result = db.delete(userApiKeys)
    .where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.provider, provider)))
    .run();
  return result.changes > 0;
}

export function listUserApiKeys(userId: string): Array<{ provider: string; masked: string }> {
  const rows = db.select({ provider: userApiKeys.provider, encryptedKey: userApiKeys.encryptedKey, iv: userApiKeys.iv, authTag: userApiKeys.authTag })
    .from(userApiKeys)
    .where(eq(userApiKeys.userId, userId))
    .all();

  return rows.map(row => {
    const key = decrypt(row.encryptedKey, row.iv, row.authTag);
    const masked = key.substring(0, 8) + "..." + key.substring(key.length - 4);
    return { provider: row.provider, masked };
  });
}
