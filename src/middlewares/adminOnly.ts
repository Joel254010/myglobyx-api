// src/middlewares/adminOnly.ts
import { Request, Response, NextFunction } from "express";

// Lista de e-mails admins via ENV (Render: ADMIN_EMAILS="joel@test.com,outra@empresa.com")
function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function adminOnly(req: Request, res: Response, next: NextFunction) {
  const email = (req as any)?.user?.sub?.toLowerCase?.();
  if (!email) return res.status(401).json({ error: "unauthorized" });
  if (!adminEmails().includes(email)) return res.status(403).json({ error: "forbidden" });
  next();
}
