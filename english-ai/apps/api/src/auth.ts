import type { NextFunction, Request, Response } from "express";
import { createClient, type User } from "@supabase/supabase-js";

export type AuthenticatedRequest = Request & { authUser?: User };

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const authRequired = process.env.AUTH_REQUIRED === "true";

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

export function isAuthRequired() {
  return authRequired;
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!authRequired) return next();
  if (!supabase) return res.status(503).json({ error: "Authentication is not configured" });

  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return res.status(401).json({ error: "Authentication required" });

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return res.status(401).json({ error: "Invalid authentication token" });
    req.authUser = data.user;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid authentication token" });
  }
}

export function requestUserId(req: AuthenticatedRequest, candidate?: string) {
  if (req.authUser?.id) return req.authUser.id;
  return candidate?.trim() || "demo-user";
}
