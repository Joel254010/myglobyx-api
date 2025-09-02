// src/db/productsStore.ts
import { toSlug } from "../utils/slug";

export type Product = {
  id: string;
  title: string;
  slug: string;
  description?: string;
  mediaUrl?: string;  // link/vídeo/pdf
  price?: number;     // opcional nesta fase
  active: boolean;
  createdAt: string;
  updatedAt?: string;
};

const products = new Map<string, Product>();

export function allProducts(): Product[] {
  return Array.from(products.values());
}

export function findProductById(id: string): Product | null {
  return products.get(id) ?? null;
}

export function findProductBySlug(slug: string): Product | null {
  return allProducts().find(p => p.slug === slug) ?? null;
}

export function createProduct(input: Omit<Product, "id" | "slug" | "createdAt" | "updatedAt"> & { slug?: string }): Product {
  const id = (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).toUpperCase();
  const slug = input.slug?.trim() || toSlug(input.title);
  const now = new Date().toISOString();
  const p: Product = {
    id,
    title: input.title.trim(),
    slug,
    description: input.description?.trim(),
    mediaUrl: input.mediaUrl?.trim(),
    price: input.price,
    active: !!input.active,
    createdAt: now,
  };
  products.set(id, p);
  return p;
}

export function updateProduct(id: string, patch: Partial<Omit<Product, "id" | "createdAt">>): Product | null {
  const cur = products.get(id);
  if (!cur) return null;
  const next: Product = {
    ...cur,
    ...patch,
    slug: patch.slug ? toSlug(patch.slug) : (patch.title ? toSlug(patch.title) : cur.slug),
    updatedAt: new Date().toISOString(),
  };
  products.set(id, next);
  return next;
}

export function deleteProduct(id: string): boolean {
  return products.delete(id);
}
