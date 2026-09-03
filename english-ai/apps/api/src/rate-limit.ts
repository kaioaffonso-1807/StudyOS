import type { NextFunction, Request, Response } from "express";

type Bucket = { count: number; resetAt: number };
type AuthenticatedRequestLike = Request & { authUser?: { id?: string } };

export function createRateLimit(maxRequests: number, windowMs = 60_000) {
  const buckets = new Map<string, Bucket>();
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const authUserId = (req as AuthenticatedRequestLike).authUser?.id;
    const key = authUserId ? `user:${authUserId}` : `ip:${req.ip || req.socket.remoteAddress || "unknown"}`;
    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    current.count += 1;
    if (current.count > maxRequests) {
      res.setHeader("Retry-After", Math.max(1, Math.ceil((current.resetAt - now) / 1000)));
      return res.status(429).json({ error: "Too many requests. Please try again shortly." });
    }
    if (buckets.size > 10_000) {
      for (const [bucketKey, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
    return next();
  };
}

export const rateLimit = createRateLimit(120);
export const aiRateLimit = createRateLimit(20);
export const voiceRateLimit = createRateLimit(10);
export const realtimeRateLimit = createRateLimit(10);
