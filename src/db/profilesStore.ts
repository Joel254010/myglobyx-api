// src/db/profilesStore.ts
import { Collection, ObjectId, WithId } from "mongodb";
import { getDb } from "./mongo";

/* -------------------- Tipos -------------------- */
export type Address = {
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
};

export type ProfileDoc = {
  _id: ObjectId;
  email: string;       // normalizado (único)
  name: string;
  phone?: string;
  birthdate?: string;  // YYYY-MM-DD
  document?: string;   // CPF
  address?: Address;
  createdAt: Date;
  updatedAt?: Date;
};

export type Profile = {
  email: string;
  name: string;
  phone?: string;
  birthdate?: string;
  document?: string;
  address?: Address;
};

/* -------------------- Helpers -------------------- */
const normalizeEmail = (e: string) => e.trim().toLowerCase();

let ensured = false;
async function profilesCol(): Promise<Collection<ProfileDoc>> {
  const db = await getDb();
  const col = db.collection<ProfileDoc>("profiles");
  if (!ensured) {
    await col.createIndex({ email: 1 }, { unique: true });
    ensured = true;
  }
  return col;
}

function toApi(doc: WithId<ProfileDoc>): Profile {
  return {
    email: doc.email,
    name: doc.name,
    phone: doc.phone,
    birthdate: doc.birthdate,
    document: doc.document,
    address: doc.address,
  };
}

/* -------------------- Operações -------------------- */
export async function getProfileByEmail(email: string): Promise<Profile | null> {
  const col = await profilesCol();
  const doc = await col.findOne({ email: normalizeEmail(email) });
  return doc ? toApi(doc) : null;
}

export type ProfileUpdate = {
  name: string;
  phone?: string;
  birthdate?: string;
  document?: string;
  address?: Address;
};

export async function upsertProfile(
  email: string,
  patch: ProfileUpdate
): Promise<Profile> {
  const col = await profilesCol();
  const now = new Date();
  const emailNorm = normalizeEmail(email);

  // Evita problemas de typing do findOneAndUpdate.value
  await col.updateOne(
    { email: emailNorm },
    {
      $set: { ...patch, updatedAt: now },
      $setOnInsert: { email: emailNorm, createdAt: now, name: patch.name },
    },
    { upsert: true }
  );

  const doc = await col.findOne({ email: emailNorm });
  if (!doc) throw new Error("profile_upsert_failed");
  return toApi(doc);
}
