// src/app.ts
import express, { Application } from "express";
import cors, { CorsOptions } from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { ENV } from "./env";

// Rotas
import authRoutes from "./routes/auth";
import profileRoutes from "./routes/profile";
import adminRoutes from "./routes/admin";
import bibliotecaRoutes from "./routes/biblioteca";

const app: Application = express();
app.set("trust proxy", 1);

// Básico
app.use(helmet());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false }));

// ✅ Health check do Render (SEM prefixo e antes de qualquer middleware que possa bloquear)
app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    env: ENV.NODE_ENV,
    ts: Date.now(),
    uptime: process.uptime(),
  });
});

// CORS (múltiplas origens separadas por vírgula)
const origins = (ENV.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const corsOptions: CorsOptions = {
  origin: origins.length ? origins : true, // true = libera tudo (útil em dev)
  credentials: true,
};
app.use(cors(corsOptions));

// Rate limit (v7 usa 'limit', não 'max')
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  })
);

// Prefixo da API (sem barra final)
const API = (ENV.API_PREFIX || "/api").replace(/\/+$/, "");

// ✅ Monte os routers que já definem /auth/*, /profile/*, /biblioteca/* sob o prefixo base
app.use(API, authRoutes);
app.use(API, profileRoutes);
app.use(API, bibliotecaRoutes);

// ✅ Admin em /api/admin
app.use(API, adminRoutes);

// (Opcional) raiz mostra info rápida
app.get("/", (_req, res) => {
  res.json({ ok: true, health: "/health", apiBase: API });
});

export default app;
