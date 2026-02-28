import path from "node:path";
import fs from "node:fs";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");

export function projectDir(userId: string, projectId: string): string {
  return path.join(DATA_DIR, "projects", userId, projectId);
}

export function protoDir(userId: string, projectId: string): string {
  return path.join(projectDir(userId, projectId), "prototype");
}

export function ensureProjectDir(userId: string, projectId: string): string {
  const dir = projectDir(userId, projectId);
  fs.mkdirSync(path.join(dir, "prototype"), { recursive: true });
  return dir;
}
