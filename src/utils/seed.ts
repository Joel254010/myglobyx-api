// src/utils/seed.ts
import bcrypt from "bcryptjs";
import { ENV } from "../env";
import { usersCol } from "../db/mongo";
import type { OptionalId } from "mongodb";

function toArray(input: unknown): string[] {
  if (!input) return [];
  if (Array.isArray(input)) return input.map(String).map(s => s.trim()).filter(Boolean);
  return String(input).split(",").map(s => s.trim()).filter(Boolean);
}

function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

export async function ensureAdminSeed(): Promise<void> {
  try {
    const auto = /^(1|true|yes|on)$/i.test(String(ENV.AUTO_SEED_ADMIN ?? "true"));
    if (!auto) {
      console.log("🔸 AUTO_SEED_ADMIN desativado — pulando seed de admin.");
      return;
    }

    const emails = toArray(ENV.ADMIN_EMAILS);
    if (!emails.length) {
      console.log("🔸 ADMIN_EMAILS vazio — sem seed de admin.");
      return;
    }

    const password = (ENV.ADMIN_SEED_PASSWORD || "123456").trim();
    const rounds = Number(ENV.BCRYPT_ROUNDS || 10);
    const hash = await bcrypt.hash(password, rounds);

    const col = await usersCol();

    let created = 0;
    for (const raw of emails) {
      const email = normalizeEmail(raw);
      const exists = await col.findOne({ email });
      if (exists) continue;

      const doc: OptionalId<{
        _id?: any;
        name: string;
        email: string;
        passwordHash: string;
        createdAt: Date;
      }> = {
        name: "Admin",
        email,
        passwordHash: hash,
        createdAt: new Date(),
      };

      await col.insertOne(doc);
      created++;
      console.log(`✅ Seed: admin criado para ${email}`);
    }

    if (created === 0) {
      console.log("✅ Seed: nenhum novo admin necessário (todos já existentes).");
    } else {
      console.log(`✅ Seed: ${created} admin(s) criado(s).`);
    }
  } catch (err: any) {
    console.error("⚠️ Falha ao executar ensureAdminSeed:", err?.message || err);
  }
}
