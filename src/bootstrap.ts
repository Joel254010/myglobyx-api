// src/bootstrap.ts
import { getDb } from "./db/mongo";
import { ensureAdminSeed } from "./utils/seed";
import { initializeUserIndexes } from "./db/usersStore"; // ⬅️ adicione isto

export async function bootstrap() {
  try {
    const db = await getDb();
    console.log(`🔌 Bootstrap conectado em "${db.databaseName}"`);

    await initializeUserIndexes(); // ⬅️ e isto
    await ensureAdminSeed();
  } catch (err: any) {
    console.error("⚠️ Bootstrap falhou:", err?.message || err);
  }
}
