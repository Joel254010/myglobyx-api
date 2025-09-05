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

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  })
);

// -------- CORS --------
const baseAllow = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://my-globyx.netlify.app",
];
const allowFromEnv = (ENV.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const allowList = new Set<string>([...baseAllow, ...allowFromEnv]);

function isAllowedOrigin(origin: string) {
  try {
    const u = new URL(origin);
    const host = u.hostname;
    if (allowList.has(origin)) return true;
    if (/\.netlify\.app$/.test(host)) return true;
    if (host === "localhost" || host === "127.0.0.1") return true;
    return false;
  } catch {
    return false;
  }
}

const corsCfg: CorsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (isAllowedOrigin(origin)) return cb(null, true);
    return cb(new Error(`CORS_NOT_ALLOWED: ${origin}`));
  },
  credentials: false,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsCfg));
app.options("*", cors(corsCfg));

app.use(express.json({ limit: "1mb" }));

app.get("/", (_req, res) => res.type("text/plain").send("MyGlobyX API - OK"));
app.get("/health", (_req, res) => res.json({ ok: true }));

const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/auth", authLimiter);

// Rotas
app.use(authRoutes);
app.use(profileRoutes);
app.use(bibliotecaRoutes);
app.use("/api/admin", adminRoutes); // <- ✅ prefixo fixo aqui

export default app;

