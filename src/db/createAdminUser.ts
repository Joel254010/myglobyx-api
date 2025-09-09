// src/db/createAdminUser.ts
import { connectToMongo } from "./mongo";
import { ENV } from "../env";
import { upsertUserPassword } from "./usersStore";

async function createAdminUser() {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = ENV;

  if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error("❌ Variáveis ADMIN_* não estão definidas no .env");
    process.exit(1);
  }

  await connectToMongo();

  const user = await upsertUserPassword(ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD);

  console.log("✅ Admin criado/atualizado com sucesso:");
  console.log("🧑 Nome:", user.name);
  console.log("📧 Email:", user.email);
  console.log("🛡️ ID:", user._id);
  process.exit(0);
}

createAdminUser().catch((err) => {
  console.error("❌ Erro ao criar admin:", err);
  process.exit(1);
});
