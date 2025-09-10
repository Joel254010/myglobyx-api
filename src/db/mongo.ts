import { MongoClient, Db, Collection, ObjectId } from "mongodb";
import { ENV } from "../env";

let client: MongoClient | null = null;
let db: Db | null = null;
let connecting: Promise<Db> | null = null;

/* ================== Tipos ================== */
export type UserDoc = {
  _id?: ObjectId;                // opcional para insertOne sem _id
  name: string;
  email: string;                 // normalizado
  passwordHash: string;
  createdAt: Date;
};

export type ProductDoc = {
  _id?: ObjectId;
  title: string;
  slug: string;
  description?: string;
  mediaUrl?: string;
  thumbnail?: string;      // ✅ novo
  categoria?: string;      // ✅ novo
  subcategoria?: string;   // ✅ novo
  price?: number;
  active: boolean;
  createdAt: Date;
  updatedAt?: Date;
};

export type GrantDoc = {
  _id?: ObjectId;
  email: string;                 // normalizado
  productId: ObjectId;
  createdAt: Date;
  expiresAt?: Date;
};

/* ================== Utils ================== */
export function oid(id: string): ObjectId {
  return new ObjectId(id);
}

function dbNameFromUri(uri: string): string | null {
  try {
    const u = new URL(uri);
    const name = (u.pathname || "").replace(/^\//, "");
    return name || null; // ex.: .../myglobyx -> "myglobyx"
  } catch {
    return null;
  }
}

/* ================== Conexão ================== */
export async function getDb(): Promise<Db> {
  if (db) return db;
  if (connecting) return connecting;
  if (!ENV.MONGODB_URI) throw new Error("MONGODB_URI not set");

  connecting = (async () => {
    client = new MongoClient(ENV.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
    });
    await client.connect();

    const name =
      dbNameFromUri(ENV.MONGODB_URI) ||
      (process.env.MONGO_DB_NAME || "").trim() ||
      "myglobyx";

    const database = client.db(name);
    db = database;

    console.log(`✅ Mongo conectado em "${database.databaseName}"`);
    await ensureIndexes(database);

    connecting = null;
    return database;
  })();

  return connecting;
}

/* ================== Índices ================== */
async function ensureIndexes(_db: Db) {
  try {
    await _db.collection<UserDoc>("users").createIndex({ email: 1 }, { unique: true });
    await _db.collection<ProductDoc>("products").createIndex({ slug: 1 }, { unique: true });
    await _db
      .collection<GrantDoc>("grants")
      .createIndex({ email: 1, productId: 1 }, { unique: true });
  } catch (err) {
    console.error("⚠️ Erro ao criar índices:", err);
  }
}

/* ================== Coleções ================== */
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

/** Compat: permite usar await connectToMongo() */
export async function connectToMongo() {
  await getDb();
}
