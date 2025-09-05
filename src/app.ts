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

// ... (helmet, cors, parsers, health, limiter etc.)

app.use(authRoutes);
app.use(profileRoutes);
app.use(bibliotecaRoutes);

// ✅ SEM prefixo aqui, porque as rotas já são absolutas (/api/admin/...)
app.use(adminRoutes);

export default app;
