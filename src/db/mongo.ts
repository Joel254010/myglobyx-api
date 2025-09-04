import { MongoClient, Db, Collection, ObjectId } from "mongodb";
import { ENV } from "../env";

// Cache de cliente/DB para reuso entre requisições
let client: MongoClient | null = null;
let db: Db | null = null;

// Tipos base (vamos reaproveitar nos stores)
export type UserDoc = {
  _id: ObjectId;
  name: string;
  email: string;         // normalizado
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
  email: string;         // normalizado
  productId: ObjectId;
  createdAt: Date;
  expiresAt?: Date;
};

// Helper pra criar ObjectId a partir de string
export function oid(id: string) {
  return new ObjectId(id);
}

// Singleton do DB
export async function getDb(): Promise<Db> {
  if (db) return db;
  if (!ENV.MONGODB_URI) throw new Error("MONGODB_URI not set");

  client = new MongoClient(ENV.MONGODB_URI);
  await client.connect();

  db = client.db(ENV.MONGO_DB_NAME);
  await ensureIndexes(db);
  return db;
}

// Índices obrigatórios (únicos)
async function ensureIndexes(_db: Db) {
  await _db.collection<UserDoc>("users")
    .createIndex({ email: 1 }, { unique: true });

  await _db.collection<ProductDoc>("products")
    .createIndex({ slug: 1 }, { unique: true });

  await _db.collection<GrantDoc>("grants")
    .createIndex({ email: 1, productId: 1 }, { unique: true });
}

// Coleções tipadas
export async function usersCol(): Promise<Collection<UserDoc>> {
  return (await getDb()).collection<UserDoc>("users");
}

export async function productsCol(): Promise<Collection<ProductDoc>> {
  return (await getDb()).collection<ProductDoc>("products");
}

export async function grantsCol(): Promise<Collection<GrantDoc>> {
  return (await getDb()).collection<GrantDoc>("grants");
}
