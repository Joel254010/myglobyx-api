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

// ✅ Health check do Render (SEM prefixo)
app.get("/health", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({
    ok: true,
    env: ENV.NODE_ENV,
    ts: Date.now(),
    uptime: process.uptime(),
  });
});

// ==================
// 🔐 CORS revisado
// ==================
const defaultOrigins = [
  "http://localhost:5173",    // dev local
  "https://myglobyx.com",     // domínio oficial
  "https://www.myglobyx.com", // com www
];

const envOrigins = (ENV.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const corsOptions: CorsOptions = {
  origin: [...defaultOrigins, ...envOrigins],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));

// ==================
// 🔒 Rate limit
// ==================
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  })
);

// ==================
// 📌 Rotas
// ==================
const API = (ENV.API_PREFIX || "/api").replace(/\/+$/, "");

app.use(API, authRoutes);
app.use(API, profileRoutes);
app.use(API, bibliotecaRoutes);
app.use(`${API}/admin`, adminRoutes);

// ✅ Raiz
app.get("/", (_req, res) => {
  res.json({ ok: true, health: "/health", apiBase: API });
});

export default app;
