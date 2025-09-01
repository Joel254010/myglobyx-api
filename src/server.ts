// src/server.ts
import "dotenv/config";
import http from "http";
import app from "./app";
import { ENV } from "./env";

const PORT = Number(process.env.PORT) || ENV.PORT || 5000;
// Em prod/Render, bind em 0.0.0.0. Em dev, 127.0.0.1 é ok.
const isProd = process.env.NODE_ENV === "production" || !!process.env.RENDER;
const HOST = isProd ? "0.0.0.0" : (process.env.HOST || "127.0.0.1");

const server = http.createServer(app);

server.listen(PORT, HOST, () => {
  console.log(`✅ MyGlobyX API up on http://${HOST}:${PORT}`);
});

// Encerramento gracioso
function shutdown() {
  console.log("🛑 Shutting down...");
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Hardening de logs
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});
