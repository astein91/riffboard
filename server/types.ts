import type { Request } from "express";

export interface AuthenticatedRequest extends Request {
  auth: {
    userId: string;
    sessionId: string;
  };
}

/** Helper to extract auth from an Express request after Clerk middleware */
export function getAuth(req: Request): { userId: string } {
  const auth = (req as any).auth;
  if (!auth?.userId) throw new Error("Unauthorized");
  return { userId: auth.userId };
}
