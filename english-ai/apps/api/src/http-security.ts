import type { Request, Response, NextFunction } from "express";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH"]);

export function requireJsonContent(req: Request, res: Response, next: NextFunction) {
  if (!MUTATING_METHODS.has(req.method)) return next();
  if (req.path === "/api/v1/billing/webhook") return next();
  if (req.is("multipart/form-data")) return next();
  if (req.is("application/json")) return next();
  return res.status(415).json({ error: "Content-Type must be application/json" });
}

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("Cache-Control", "no-store");
  next();
}
