import { Request, Response, NextFunction } from "express";

/**
 * Middleware que restringe acesso a usuários com token contendo isAdmin: true
 * Requer que authRequired tenha sido aplicado antes.
 */
export function adminOnly(req: Request, res: Response, next: NextFunction) {
  const user = (req as any)?.user;

  if (!user || !user.email) {
    return res.status(401).json({ error: "unauthenticated" });
  }

  if (!user.isAdmin) {
    return res.status(403).json({
      error: "forbidden_admin_only",
      email: user.email,
    });
  }

  return next();
}
