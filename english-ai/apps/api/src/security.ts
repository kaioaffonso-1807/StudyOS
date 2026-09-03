import type { NextFunction, Request, Response } from "express";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
const maxRequests = Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 120);
const aiMaxRequests = Number(process.env.AI_RATE_LIMIT_MAX_REQUESTS ?? 30);

function clientKey(req: Request) {
  const forwarded = req.header("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || req.ip || "unknown";
}
function consume(key: string, limit: number) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: Math.max(0, limit - 1), resetAt };
  }
  current.count += 1;
  return { allowed: current.count <= limit, remaining: Math.max(0, limit - current.count), resetAt: current.resetAt };
}
export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), geolocation=(), payment=(), usb=()");
  if (process.env.NODE_ENV === "production") res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
}
export function corsPolicy(req: Request, res: Response, next: NextFunction) {
  const configured = process.env.CORS_ORIGINS?.split(",").map((x) => x.trim()).filter(Boolean) ?? [];
  const origin = req.header("origin");
  if (origin && (configured.includes("*") || configured.includes(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
  }
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
}
export function rateLimit(req: Request, res: Response, next: NextFunction) {
  const result = consume(`general:${clientKey(req)}`, maxRequests);
  res.setHeader("X-RateLimit-Remaining", String(result.remaining));
  if (!result.allowed) {
    res.setHeader("Retry-After", String(Math.ceil((result.resetAt - Date.now()) / 1000)));
    return res.status(429).json({ error: "Too many requests. Please try again shortly." });
  }
  next();
}
export function aiRateLimit(req: Request, res: Response, next: NextFunction) {
  const user = (req as Request & { authUser?: { id?: string } }).authUser?.id;
  const result = consume(user ? `ai:user:${user}` : `ai:ip:${clientKey(req)}`, aiMaxRequests);
  res.setHeader("X-AI-RateLimit-Remaining", String(result.remaining));
  if (!result.allowed) {
    res.setHeader("Retry-After", String(Math.ceil((result.resetAt - Date.now()) / 1000)));
    return res.status(429).json({ error: "AI usage limit reached. Please try again later." });
  }
  next();
}
export function validateText(value: unknown, field: string, maxLength = 4_000) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`${field} is required`);
  if (text.length > maxLength) throw new Error(`${field} is too long`);
  return text;
}
export function validateLevel(value: unknown) {
  const level = String(value ?? "A1").toUpperCase();
  if (!["A1", "A2", "B1", "B2", "C1"].includes(level)) throw new Error("invalid CEFR level");
  return level;
}
export function cleanupRateLimitBuckets() {
  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
}
setInterval(cleanupRateLimitBuckets, Math.max(windowMs, 60_000)).unref();
