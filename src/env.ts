// src/env.ts
import "dotenv/config";

const toNumber = (v: any, def: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const splitCsv = (v: string) =>
  String(v || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export const ENV = {
  // Ambiente / servidor
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: toNumber(process.env.PORT, 5000),

  // ✅ Prefixo base das rotas (usado no log do server)
  API_PREFIX: (process.env.API_PREFIX || "/api").trim(),

  // Auth / JWT
  JWT_SECRET: process.env.JWT_SECRET || "change-me",
  TOKEN_EXPIRES_IN: (process.env.TOKEN_EXPIRES_IN || "7d").trim(),
  JWT_ISSUER: (process.env.JWT_ISSUER || "").trim(),
  JWT_AUDIENCE: (process.env.JWT_AUDIENCE || "").trim(),

  // Admin (SEED do admin via script)
  ADMIN_NAME: (process.env.ADMIN_NAME || "Admin GlobyX").trim(),
  ADMIN_EMAIL: (process.env.ADMIN_EMAIL || "").trim(),
  ADMIN_PASSWORD: (process.env.ADMIN_PASSWORD || "").trim(),
  ADMIN_EMAILS: (process.env.ADMIN_EMAILS || "").trim(),
  ADMIN_SEED_PASSWORD: process.env.ADMIN_SEED_PASSWORD || "123456",
  AUTO_SEED_ADMIN: (process.env.AUTO_SEED_ADMIN || "true").trim(),

  // CORS
  CORS_ORIGIN: (process.env.CORS_ORIGIN || "https://my-globyx.netlify.app").trim(),
  CORS_ORIGINS: splitCsv(
    process.env.CORS_ORIGIN || "https://my-globyx.netlify.app,http://localhost:5173"
  ),

  // DB (Atlas)
  MONGODB_URI: (process.env.MONGODB_URI || "").trim(),
  MONGO_DB_NAME: (process.env.MONGO_DB_NAME || "myglobyx").trim(),

  // Crypto
  BCRYPT_ROUNDS: process.env.BCRYPT_ROUNDS || process.env.BCRYPT_SALT_ROUNDS || "10",

  // Compat/legado
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
} as const;
