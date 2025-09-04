import { MongoClient, Db, Collection, ObjectId } from "mongodb";
import { ENV } from "../env";

/* -------------------------------------------------------
   Conexão (singleton)
-------------------------------------------------------- */
let client: MongoClient | null = null;
let db: Db | null = null;

/* -------------------------------------------------------
   Tipos base das coleções
-------------------------------------------------------- */
export type UserDoc = {
  _id: ObjectId;
  name: string;
  email: string;          // normalizado
  passwordHash: string;
  createdAt: Date;
};

export type ProductDoc = {
  _id: ObjectId;
  title: string;
  slug: string;
  description?: string;
  mediaUrl?: string;
  price?: number;
  active: boolean;
  createdAt: Date;
  updatedAt?: Date;
};

export type GrantDoc = {
  _id: ObjectId;
  email: string;          // normalizado
  productId: ObjectId;
  createdAt: Date;
  expiresAt?: Date;
};

/* -------------------------------------------------------
   Helpers
-------------------------------------------------------- */
export function oid(id: string): ObjectId {
  return new ObjectId(id);
}

/** Abre (ou reaproveita) a conexão e garante índices */
export async function getDb(): Promise<Db> {
  if (db) return db;
  if (!ENV.MONGODB_URI) throw new Error("MONGODB_URI not set");

  client = new MongoClient(ENV.MONGODB_URI);
  await client.connect();

  db = client.db(ENV.MONGO_DB_NAME);
  await ensureIndexes(db);
  return db;
}

/** Índices obrigatórios/únicos */
async function ensureIndexes(_db: Db) {
  await _db.collection<UserDoc>("users")
    .createIndex({ email: 1 }, { unique: true });

  await _db.collection<ProductDoc>("products")
    .createIndex({ slug: 1 }, { unique: true });

  await _db.collection<GrantDoc>("grants")
    .createIndex({ email: 1, productId: 1 }, { unique: true });
}

/* -------------------------------------------------------
   Acesso às coleções tipadas
-------------------------------------------------------- */
export async function usersCol(): Promise<Collection<UserDoc>> {
  const database = await getDb();
  return database.collection<UserDoc>("users");
}

export async function productsCol(): Promise<Collection<ProductDoc>> {
  const database = await getDb();
  return database.collection<ProductDoc>("products");
}

export async function grantsCol(): Promise<Collection<GrantDoc>> {
  const database = await getDb();
  return database.collection<GrantDoc>("grants");
}
