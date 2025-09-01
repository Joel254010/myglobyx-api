// src/app.ts
import express, { Application } from "express";
import cors, { CorsOptions } from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { ENV } from "./env";

// Rotas
import authRoutes from "./routes/auth";
import profileRoutes from "./routes/profile";       // ✅ NOVO

const app: Application = express();

// ✅ Confiança no proxy (Render/NGINX) p/ obter IP real no rate-limit
app.set("trust proxy", 1);

// ✅ Helmet (API não precisa de CSP aqui)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  })
);

// ✅ CORS — lista branca
const allowList = new Set<string>([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://my-globyx.netlify.app",
]);

if (ENV.CORS_ORIGIN) {
  // aceita 1 ou várias origens separadas por vírgula
  ENV.CORS_ORIGIN.split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((o) => allowList.add(o));
}

const corsCfg: CorsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // curl/Postman
    // permite qualquer localhost (porta variável)
    if (
      origin.startsWith("http://localhost:") ||
      origin.startsWith("http://127.0.0.1:")
    ) {
      return cb(null, true);
    }
    return cb(null, allowList.has(origin));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsCfg));
// ⚠️ Nada de "*" ou regex no app.options — o CORS middleware já trata preflight

// ✅ Parser seguro
app.use(express.json({ limit: "1mb" }));

// ✅ Healthcheck
app.get("/", (_req, res) => res.type("text/plain").send("MyGlobyX API - OK"));
app.get("/health", (_req, res) => res.json({ ok: true }));

// ✅ Rate limit apenas nas rotas sensíveis (auth)
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 min
  max: 100,                  // 100 req/10min por IP
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/auth", authLimiter);

// ✅ Rotas
app.use(authRoutes);
app.use(profileRoutes);        // ✅ perfil (GET/PUT /api/profile/me)

export default app;
