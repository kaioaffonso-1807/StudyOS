import type { NextFunction, Request, Response } from "express";
import { consumeUsage, type UsageAction } from "./billing.js";

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

function usageProtected(action: UsageAction, limiter: ReturnType<typeof createRateLimit>) {
  return (req: Request, res: Response, next: NextFunction) => limiter(req, res, async () => {
    const authUserId = (req as AuthenticatedRequestLike).authUser?.id ?? "demo-user";
    try {
      const usage = await consumeUsage(authUserId, action);
      if (!usage.allowed) {
        res.setHeader("Retry-After", "86400");
        return res.status(429).json({
          error: "Daily usage limit reached",
          action: usage.action,
          plan: usage.plan,
          used: usage.used,
          limit: usage.limit,
        });
      }
      return next();
    } catch (error) {
      console.error("Usage protection unavailable", error instanceof Error ? error.message : "unknown error");
      return res.status(503).json({ error: "Usage protection is temporarily unavailable" });
    }
  });
}

export const rateLimit = createRateLimit(120);
export const aiRateLimit = usageProtected("ai_turn", createRateLimit(20));
export const voiceRateLimit = usageProtected("voice_turn", createRateLimit(10));
export const realtimeRateLimit = usageProtected("realtime_call", createRateLimit(10));
