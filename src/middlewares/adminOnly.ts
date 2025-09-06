import { Request, Response, NextFunction } from "express";
import { ENV } from "../env";

function adminList(): string[] {
  return String((ENV as any).ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function adminOnly(req: Request, res: Response, next: NextFunction) {
  const email = String((req as any)?.user?.email || (req as any)?.user?.sub || "")
    .trim()
    .toLowerCase();

  if (!email) return res.status(401).json({ error: "unauthenticated" });

  const admins = adminList();
  if (!admins.includes(email)) {
    return res.status(403).json({ error: "forbidden_admin_only", email });
  }

  return next();
}
