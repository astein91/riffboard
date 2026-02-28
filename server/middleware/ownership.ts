import type { Request, Response, NextFunction } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { projects } from "../db/schema.js";
import { getAuth } from "../types.js";

export function validateProjectOwnership(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const projectId = req.params.id as string | undefined;
  if (!projectId) { next(); return; }

  const { userId } = getAuth(req);

  const row = db.select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId as string), eq(projects.userId, userId)))
    .get();

  if (!row) {
    res.status(404).json({ error: "project not found" });
    return;
  }

  next();
}
