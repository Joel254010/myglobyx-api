// src/middlewares/authJwt.ts
import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload, Secret, SignOptions, VerifyOptions } from "jsonwebtoken";
import { ENV } from "../env";

/** Payload do nosso token (email em sub, nome opcional) */
export interface AuthTokenPayload extends JwtPayload {
  sub: string; // email normalizado
  name?: string;
}

const SECRET: Secret = (ENV.JWT_SECRET as Secret) || ("change-me" as Secret);

/** Coage valor para string (não-vazia) ou undefined */
function strOrUndef(v: any): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** Alguns tipos do jsonwebtoken mudam entre versões. Usa tipo cruzado estável. */
type ExpiresType = string | number;

/** Normaliza o expiresIn para string | number | undefined (cross-version safe) */
function resolveExpiresIn(v?: unknown): ExpiresType | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim()) return v.trim();
  return undefined;
}

/** Assina JWT com defaults seguros (HS256 + expiração 7d) */
export function signJwt(payload: AuthTokenPayload, expiresIn?: string | number) {
  const exp = resolveExpiresIn(expiresIn ?? ENV.TOKEN_EXPIRES_IN ?? "7d");

  // Monta options sem expiresIn e injeta depois (evita chiado de tipos em versões antigas)
  const options: SignOptions = {
    algorithm: "HS256",
    issuer: strOrUndef(ENV.JWT_ISSUER),
    audience: strOrUndef(ENV.JWT_AUDIENCE),
  };

  if (exp !== undefined) {
    // forçamos a propriedade de maneira compatível com múltiplas definições de tipo
    (options as any).expiresIn = exp;
  }

  return jwt.sign(payload, SECRET, options);
}

/** Verifica/decodifica JWT aplicando políticas (algoritmo/issuer/audience) */
export function verifyJwt(token: string): AuthTokenPayload {
  const options: VerifyOptions = {
    algorithms: ["HS256"],
    issuer: strOrUndef(ENV.JWT_ISSUER),
    audience: strOrUndef(ENV.JWT_AUDIENCE),
    clockTolerance: 5,
  };
  return jwt.verify(token, SECRET, options) as AuthTokenPayload;
}

/** Middleware: exige Authorization: Bearer <token> */
export function authRequired(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "missing_token" });
  }
  const token = header.slice(7).trim();

  try {
    const decoded = verifyJwt(token);
    (req as any).user = decoded;
    return next();
  } catch (err: any) {
    const error = err?.name === "TokenExpiredError" ? "token_expired" : "invalid_token";
    return res.status(401).json({ error });
  }
}
