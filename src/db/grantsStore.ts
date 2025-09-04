// src/db/grantsStore.ts
import { WithId } from "mongodb";
import { grantsCol, GrantDoc, oid } from "./mongo";

/** Tipo exposto pela API */
export type Grant = {
  id: string;
  email: string;
  productId: string;
  createdAt: string;     // ISO
  expiresAt?: string;    // ISO
};

function toApi(g: WithId<GrantDoc>): Grant {
  return {
    id: g._id.toHexString(),
    email: g.email,
    productId: g.productId.toHexString(),
    createdAt: g.createdAt.toISOString(),
    expiresAt: g.expiresAt ? g.expiresAt.toISOString() : undefined,
  };
}

/** Garante índices (email+productId único, e lookup por email) */
async function ensureIndexes() {
  const col = await grantsCol();
  await col.createIndex({ email: 1, productId: 1 }, { unique: true });
  await col.createIndex({ email: 1 });
}
void ensureIndexes();

/** Lista todas as liberações */
export async function allGrants(): Promise<Grant[]> {
  const col = await grantsCol();
  const rows = await col.find({}).sort({ createdAt: -1 }).toArray();
  return rows.map(toApi);
}

/** Lista liberações de um e-mail */
export async function grantsForEmail(email: string): Promise<Grant[]> {
  const col = await grantsCol();
  const rows = await col.find({ email: email.trim().toLowerCase() }).toArray();
  return rows.map(toApi);
}

/** Concede acesso (idempotente por índice único) */
export async function grantAccess(
  email: string,
  productId: string,
  expiresAt?: string
): Promise<Grant> {
  const col = await grantsCol();
  const doc: Omit<GrantDoc, "_id"> = {
    email: email.trim().toLowerCase(),
    productId: oid(productId),
    createdAt: new Date(),
    expiresAt: expiresAt ? new Date(expiresAt) : undefined,
  };

  try {
    const ins = await col.insertOne(doc as any);
    const saved = await col.findOne({ _id: ins.insertedId });
    if (!saved) throw new Error("insert_failed");
    return toApi(saved);
  } catch (err: any) {
    // se já existe (dup key), retorna o existente
    if (err?.code === 11000) {
      const existing = await col.findOne({
        email: doc.email,
        productId: doc.productId,
      });
      if (existing) return toApi(existing);
    }
    throw err;
  }
}

/** Revoga acesso */
export async function revokeAccess(email: string, productId: string): Promise<boolean> {
  const col = await grantsCol();
  const res = await col.deleteOne({
    email: email.trim().toLowerCase(),
    productId: oid(productId),
  });
  return res.deletedCount === 1;
}
