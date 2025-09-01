// src/env.ts
import "dotenv/config";

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number(process.env.PORT) || 5000,

  // Auth / JWT
  JWT_SECRET: process.env.JWT_SECRET || "change-me",
  TOKEN_EXPIRES_IN: process.env.TOKEN_EXPIRES_IN || "7d",
  JWT_ISSUER: process.env.JWT_ISSUER || "",
  JWT_AUDIENCE: process.env.JWT_AUDIENCE || "",

  // CORS
  // Aceita 1 ou várias origens separadas por vírgula (ex.: "https://my-globyx.netlify.app,https://myglobyx.com")
  CORS_ORIGIN: process.env.CORS_ORIGIN || "https://my-globyx.netlify.app",

  // DB (para quando plugarmos o Atlas)
  MONGODB_URI: process.env.MONGODB_URI || "",

  // Crypto
  BCRYPT_ROUNDS: process.env.BCRYPT_ROUNDS || process.env.BCRYPT_SALT_ROUNDS || "10",

  // Opcional: compat legado do front
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
};
