// src/middlewares/authJwt.ts
import { Request, Response, NextFunction } from "express";
import jwt, {
  JwtPayload,
  Secret,
  SignOptions,
  VerifyOptions,
} from "jsonwebtoken";
import { ENV } from "../env";

/** Payload do nosso token (email em sub, nome opcional) */
export interface AuthTokenPayload extends JwtPayload {
  sub: string; // email normalizado
  name?: string;
}

const SECRET: Secret = (ENV.JWT_SECRET as Secret) || ("change-me" as Secret);

/** Normaliza o expiresIn para o tipo aceito pela lib, independente da versão dos tipos */
function resolveExpiresIn(v?: string | number): SignOptions["expiresIn"] {
  if (v === undefined || v === null) return undefined;
  return v as SignOptions["expiresIn"];
}

/** Assina JWT com defaults seguros (HS256 + expiração 7d) */
export function signJwt(
  payload: AuthTokenPayload,
  expiresIn?: string | number
) {
  const options: SignOptions = {
    algorithm: "HS256",
    expiresIn: resolveExpiresIn(expiresIn ?? ENV.TOKEN_EXPIRES_IN ?? "7d"),
    issuer: ENV.JWT_ISSUER || undefined,
    audience: ENV.JWT_AUDIENCE || undefined,
  };
  return jwt.sign(payload, SECRET, options);
}

/** Verifica/decodifica JWT aplicando políticas (algoritmo/issuer/audience) */
export function verifyJwt(token: string): AuthTokenPayload {
  const options: VerifyOptions = {
    algorithms: ["HS256"],
    issuer: ENV.JWT_ISSUER || undefined,
    audience: ENV.JWT_AUDIENCE || undefined,
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
    const error =
      err?.name === "TokenExpiredError" ? "token_expired" : "invalid_token";
    return res.status(401).json({ error });
  }
}
