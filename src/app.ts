// src/app.ts
import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { ENV } from "./env";

// Rotas
import authRoutes from "./routes/auth";
import profileRoutes from "./routes/profile";
import adminRoutes from "./routes/admin";
import bibliotecaRoutes from "./routes/biblioteca";

const app: Application = express();

// Middlewares básicos
app.use(helmet());
app.use(express.json({ limit: "2mb" }));

// ✅ CORS (usa array novo com fallback na string antiga)
const allowed = (ENV as any).CORS_ORIGINS ?? [];
const allowedOrigins: string[] =
  Array.isArray(allowed) && allowed.length
    ? allowed
    : String(ENV.CORS_ORIGIN || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        return cb(null, true);
      }
      return cb(new Error("CORS bloqueado: " + origin));
    },
    credentials: true,
  })
);

// Rate limit simples
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Health check (antes das rotas)
app.get("/health", (_req, res) => {
  res.json({ ok: true, env: ENV.NODE_ENV, time: new Date().toISOString() });
});

// ✅ Monte com prefixo para responder em /api/...
app.use(`${ENV.API_PREFIX}/auth`, authRoutes);
app.use(`${ENV.API_PREFIX}/profile`, profileRoutes);
app.use(`${ENV.API_PREFIX}/biblioteca`, bibliotecaRoutes);
app.use(`${ENV.API_PREFIX}/admin`, adminRoutes);

export default app;
