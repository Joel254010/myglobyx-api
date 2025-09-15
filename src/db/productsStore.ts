import { Collection, Filter, ObjectId, WithId } from "mongodb";
import { productsCol, ProductDoc, oid } from "./mongo";

/** ===== Helpers ===== */

/** Slugify local (independe de utils/slug) */
function makeSlugLocal(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-");
}

/** Tipo usado nas respostas da API (id string em vez de ObjectId) */
export type Product = {
  id: string;
  title: string;
  slug: string;
  description?: string;
  mediaUrl?: string;
  thumbnail?: string;
  categoria?: string;
  subcategoria?: string;
  price?: number;
  landingPageUrl?: string; // ✅ novo
  active: boolean;
  createdAt: string;
  updatedAt?: string;
};

function toApi(p: WithId<ProductDoc>): Product {
  return {
    id: p._id.toHexString(),
    title: p.title,
    slug: p.slug,
    description: p.description,
    mediaUrl: p.mediaUrl,
    thumbnail: p.thumbnail,
    categoria: p.categoria,
    subcategoria: p.subcategoria,
    price: p.price,
    landingPageUrl: p.landingPageUrl, // ✅ novo
    active: p.active,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt ? p.updatedAt.toISOString() : undefined,
  };
}

/** Garante slug único (append -2, -3, ...) */
async function uniqueSlug(
  base: string,
  col: Collection<ProductDoc>,
  ignoreId?: ObjectId
) {
  const root = makeSlugLocal(base);
  if (!root) throw new Error("invalid_slug");
  let candidate = root;
  let i = 2;

  while (true) {
    const exists = await col.findOne({
      slug: candidate,
      ...(ignoreId ? { _id: { $ne: ignoreId } } : {}),
    } as Filter<ProductDoc>);
    if (!exists) return candidate;
    candidate = `${root}-${i++}`;
  }
}

/** ===== CRUD ===== */

export async function allProducts(): Promise<Product[]> {
  const col = await productsCol();
  const rows = await col.find({}).sort({ createdAt: -1 }).toArray();
  return rows.map(toApi);
}

export async function findProductById(id: string): Promise<Product | null> {
  const col = await productsCol();
  const doc = await col.findOne({ _id: oid(id) });
  return doc ? toApi(doc) : null;
}

export async function createProduct(payload: {
  title: string;
  description?: string;
  mediaUrl?: string;
  thumbnail?: string;
  categoria?: string;
  subcategoria?: string;
  landingPageUrl?: string; // ✅ novo
  price?: number;
  active?: boolean;
}): Promise<Product> {
  const col = await productsCol();

  if (!payload?.title || typeof payload.title !== "string") {
    throw new Error("missing_title");
  }

  const now = new Date();
  const slug = await uniqueSlug(payload.title, col);

  const doc: Omit<ProductDoc, "_id"> = {
    title: payload.title.trim(),
    slug,
    description: payload.description?.trim() || undefined,
    mediaUrl: payload.mediaUrl?.trim() || undefined,
    thumbnail: payload.thumbnail?.trim() || undefined,
    categoria: payload.categoria?.trim() || undefined,
    subcategoria: payload.subcategoria?.trim() || undefined,
    landingPageUrl: payload.landingPageUrl?.trim() || undefined, // ✅ novo
    price:
      typeof payload.price === "number" && Number.isFinite(payload.price)
        ? payload.price
        : undefined,
    active: !!payload.active,
    createdAt: now,
    updatedAt: undefined,
  };

  const res = await col.insertOne(doc as any);
  const saved = await col.findOne({ _id: res.insertedId });
  if (!saved) throw new Error("insert_failed");
  return toApi(saved);
}

export async function updateProduct(
  id: string,
  patch: Partial<{
    title: string;
    description?: string;
    mediaUrl?: string;
    thumbnail?: string;
    categoria?: string;
    subcategoria?: string;
    landingPageUrl?: string; // ✅ novo
    price?: number;
    active?: boolean;
  }>
): Promise<Product | null> {
  const col = await productsCol();
  const _id = oid(id);

  const sets: Partial<ProductDoc> = { updatedAt: new Date() };

  if (typeof patch.title === "string" && patch.title.trim()) {
    const title = patch.title.trim();
    sets.title = title;
    sets.slug = await uniqueSlug(title, col, _id);
  }
  if (patch.description !== undefined) {
    sets.description = patch.description?.trim() || undefined;
  }
  if (patch.mediaUrl !== undefined) {
    sets.mediaUrl = patch.mediaUrl?.trim() || undefined;
  }
  if (patch.thumbnail !== undefined) {
    sets.thumbnail = patch.thumbnail?.trim() || undefined;
  }
  if (patch.categoria !== undefined) {
    sets.categoria = patch.categoria?.trim() || undefined;
  }
  if (patch.subcategoria !== undefined) {
    sets.subcategoria = patch.subcategoria?.trim() || undefined;
  }
  if (patch.landingPageUrl !== undefined) {
    sets.landingPageUrl = patch.landingPageUrl?.trim() || undefined; // ✅ novo
  }
  if (patch.price !== undefined) {
    sets.price =
      typeof patch.price === "number" && Number.isFinite(patch.price)
        ? patch.price
        : undefined;
  }
  if (patch.active !== undefined) {
    sets.active = !!patch.active;
  }

  await col.updateOne({ _id }, { $set: sets });

  const updated = await col.findOne({ _id });
  return updated ? toApi(updated) : null;
}

export async function deleteProduct(id: string): Promise<boolean> {
  const col = await productsCol();
  const res = await col.deleteOne({ _id: oid(id) });
  return res.deletedCount === 1;
}

/** ✅ NOVO: Busca produto por slug */
export async function findProductBySlug(slug: string): Promise<Product | null> {
  const col = await productsCol();
  const doc = await col.findOne({ slug });
  return doc ? toApi(doc) : null;
}
