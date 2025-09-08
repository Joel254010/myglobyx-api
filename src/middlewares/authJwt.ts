import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { ENV } from "../env";

export type AuthTokenPayload = JwtPayload & {
  sub: string;         // email principal
  email?: string;      // redundância opcional
  name?: string;       // nome do usuário
  isAdmin?: boolean;   // flag de admin
};

function normalizeEmail(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

/** 🔐 Assina um JWT usando configs do .env */
export function signJwt(
  payload: { sub: string; email?: string } & Record<string, any>,
  opts?: jwt.SignOptions
): string {
  const baseOpts: jwt.SignOptions = {};
  const exp = (ENV.TOKEN_EXPIRES_IN || "7d").trim();
  if (exp) (baseOpts as any).expiresIn = exp;
  if (ENV.JWT_ISSUER) baseOpts.issuer = ENV.JWT_ISSUER;
  if (ENV.JWT_AUDIENCE) baseOpts.audience = ENV.JWT_AUDIENCE;

  const sub = normalizeEmail(payload.sub);
  const email = payload.email ? normalizeEmail(payload.email) : sub;

  return jwt.sign({ ...payload, sub, email }, ENV.JWT_SECRET, {
    ...baseOpts,
    ...(opts || {}),
  });
}

/** 🔍 Verifica o token JWT e retorna payload */
export function verifyJwt(token: string): AuthTokenPayload {
  const vopts: jwt.VerifyOptions = {};
  if (ENV.JWT_ISSUER) vopts.issuer = ENV.JWT_ISSUER;
  if (ENV.JWT_AUDIENCE) vopts.audience = ENV.JWT_AUDIENCE;

  const decoded = jwt.verify(token, ENV.JWT_SECRET, vopts);
  const raw: JwtPayload =
    typeof decoded === "string" ? ({ sub: decoded } as any) : (decoded as JwtPayload);

  const sub = normalizeEmail((raw as any).sub || (raw as any).email);
  const email = normalizeEmail((raw as any).email || sub);

  return { ...(raw as object), sub, email } as AuthTokenPayload;
}

/** ✅ Middleware que exige token JWT e injeta req.user */
export function authRequired(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";

    if (!token) return res.status(401).json({ error: "missing_token" });

    const payload = verifyJwt(token);
    if (!payload?.sub) return res.status(401).json({ error: "invalid_token_no_sub" });

    // 🔽 injeta o payload completo (inclui isAdmin, name, etc.)
    (req as any).user = payload;

    next();
  } catch (err: any) {
    return res.status(401).json({ error: "invalid_token", detail: err?.message });
  }
}
