// src/env.ts
import "dotenv/config";

const toNumber = (v: any, def: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

export const ENV = {
  // Ambiente / servidor
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: toNumber(process.env.PORT, 5000),

  // Auth / JWT
  JWT_SECRET: process.env.JWT_SECRET || "change-me",
  TOKEN_EXPIRES_IN: process.env.TOKEN_EXPIRES_IN || "7d",
  JWT_ISSUER: (process.env.JWT_ISSUER || "").trim(),
  JWT_AUDIENCE: (process.env.JWT_AUDIENCE || "").trim(),

  // Admin (opcional, apenas centralizado)
  ADMIN_EMAILS: (process.env.ADMIN_EMAILS || "").trim(),
  ADMIN_SEED_PASSWORD: process.env.ADMIN_SEED_PASSWORD || "123456",
  AUTO_SEED_ADMIN: (process.env.AUTO_SEED_ADMIN || "true").trim(), // parseado onde for usado

  // CORS
  // Aceita uma ou mais origens separadas por vírgula
  CORS_ORIGIN: (process.env.CORS_ORIGIN || "https://my-globyx.netlify.app").trim(),

  // DB (Atlas)
  MONGODB_URI: (process.env.MONGODB_URI || "").trim(),
  MONGO_DB_NAME: (process.env.MONGO_DB_NAME || "myglobyx").trim(),

  // Crypto
  BCRYPT_ROUNDS: process.env.BCRYPT_ROUNDS || process.env.BCRYPT_SALT_ROUNDS || "10",

  // Compat/legado
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
} as const;
