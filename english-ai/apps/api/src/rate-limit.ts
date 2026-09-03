import type { NextFunction, Request, Response } from "express";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 120;

export function rateLimit(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }

  current.count += 1;
  if (current.count > MAX_REQUESTS) {
    res.setHeader("Retry-After", Math.ceil((current.resetAt - now) / 1000));
    return res.status(429).json({ error: "Too many requests. Please try again shortly." });
  }

  if (buckets.size > 10_000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
  }

  return next();
}
