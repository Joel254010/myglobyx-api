// src/routes/admin.ts
import { Router, Request, Response } from "express";
import { authRequired } from "../middlewares/authJwt";
import { adminOnly } from "../middlewares/adminOnly";

import {
  allProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  findProductById,
} from "../db/productsStore";

import {
  grantAccess,
  revokeAccess,
  grantsForEmail,
  allGrants,
} from "../db/grantsStore";

import { listUsersBasic } from "../db/usersStore";

const router = Router();

// Protege tudo que começar com /api/admin
router.use("/api/admin", authRequired, adminOnly);

/** sanity/ping */
router.get("/api/admin/ping", (req: Request, res: Response) => {
  const email =
    (req as any)?.user?.sub?.toString?.().toLowerCase?.() || undefined;
  return res.json({ ok: true, isAdmin: true, roles: ["admin"], email });
});

/* ============ Usuários (Painel) ============ */
/**
 * GET /api/admin/users?page=1&limit=25
 * Retorna { total, page, limit, users: [{ name, email, phone?, isVerified?, createdAt?, updatedAt? }] }
 */
router.get("/api/admin/users", async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.max(1, Math.min(100, Number(req.query.limit || 25)));

  const data = await listUsersBasic(page, limit);
  return res.json({ page, limit, ...data });
});

/* ============ Produtos ============ */

router.get("/api/admin/products", async (_req, res) => {
  const items = await allProducts();
  return res.json({ products: items });
});

router.post("/api/admin/products", async (req, res) => {
  const { title, description, mediaUrl, price, active } = req.body ?? {};
  if (!title || typeof title !== "string") {
    return res.status(400).json({ error: "missing_title" });
  }
  try {
    const p = await createProduct({
      title,
      description,
      mediaUrl,
      price: Number.isFinite(Number(price)) ? Number(price) : undefined,
      active: !!active,
    });
    return res.status(201).json({ product: p });
  } catch (err: any) {
    const code = err?.message || "create_failed";
    return res.status(400).json({ error: code });
  }
});

router.put("/api/admin/products/:id", async (req, res) => {
  const { id } = req.params;
  const patch = req.body ?? {};
  const updated = await updateProduct(id, patch);
  if (!updated) return res.status(404).json({ error: "product_not_found" });
  return res.json({ product: updated });
});

router.delete("/api/admin/products/:id", async (req, res) => {
  const ok = await deleteProduct(req.params.id);
  if (!ok) return res.status(404).json({ error: "product_not_found" });
  return res.status(204).end();
});

/* ============ Grants ============ */

router.get("/api/admin/grants", async (req, res) => {
  const email = (req.query.email as string | undefined)?.trim();
  if (email) return res.json({ grants: await grantsForEmail(email) });
  return res.json({ grants: await allGrants() });
});

router.post("/api/admin/grants", async (req, res) => {
  const { email, productId, expiresAt } = req.body ?? {};
  if (!email || !productId)
    return res.status(400).json({ error: "missing_fields" });

  const prod = await findProductById(String(productId));
  if (!prod) return res.status(404).json({ error: "product_not_found" });

  const g = await grantAccess(String(email), String(productId), expiresAt);
  return res.status(201).json({ grant: g });
});

router.delete("/api/admin/grants", async (req, res) => {
  const { email, productId } = req.query as any;
  if (!email || !productId)
    return res.status(400).json({ error: "missing_fields" });

  const ok = await revokeAccess(String(email), String(productId));
  if (!ok) return res.status(404).json({ error: "grant_not_found" });
  return res.status(204).end();
});

export default router;
