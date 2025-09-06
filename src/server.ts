// src/server.ts
import "dotenv/config";
import http from "http";
import app from "./app";
import { ENV } from "./env";
import { bootstrap } from "./bootstrap";

const PORT = Number(process.env.PORT) || ENV.PORT || 5000;
// Em produção, sempre bind em 0.0.0.0 (Render/Heroku/etc)
const HOST =
  ENV.NODE_ENV === "production" ? "0.0.0.0" : process.env.HOST || "127.0.0.1";

const server = http.createServer(app);

server.listen(PORT, HOST, () => {
  console.log(
    `🚀 MyGlobyX API rodando em http://${HOST}:${PORT}${ENV.API_PREFIX || ""}`
  );
  // Dispara bootstrap sem bloquear o servidor (conexão ao Mongo, índices, seed de admin)
  bootstrap();
});

// Encerramento gracioso
function shutdown() {
  console.log("🛑 Encerrando servidor...");
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Hardening de logs
process.on("unhandledRejection", (reason) => {
  console.error("⚠️ Unhandled promise rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught exception:", err);
});
