import "dotenv/config";
import http from "http";
import app from "./app";
import { ENV } from "./env";
import { bootstrap } from "./bootstrap";

// Define porta com fallback: .env → ENV → 5000
const PORT = Number(process.env.PORT) || ENV.PORT || 5000;

// Em produção, bind seguro para nuvem (Render, Heroku etc)
const HOST =
  ENV.NODE_ENV === "production" ? "0.0.0.0" : process.env.HOST || "127.0.0.1";

// Cria o servidor HTTP com o app Express
const server = http.createServer(app);

// Inicia o servidor
server.listen(PORT, HOST, () => {
  console.log(`🚀 MyGlobyX API rodando em: http://${HOST}:${PORT}${ENV.API_PREFIX || ""}`);
  bootstrap(); // Conecta ao banco e faz seed (admin, índices, etc.)
});

/** ===== Encerramento gracioso ===== */
function shutdown() {
  console.log("🛑 Encerrando servidor...");
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

/** ===== Hardening de logs ===== */
process.on("unhandledRejection", (reason) => {
  console.error("⚠️ Unhandled promise rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught exception:", err);
});
