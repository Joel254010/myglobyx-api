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

// ✅ este router será montado em /api/admin lá no app.ts
//    então aqui dentro usamos caminhos relativos.
router.use(authRequired, adminOnly);

/** sanity/ping */
router.get("/ping", (req: Request, res: Response) => {
  const email = (req as any)?.user?.sub?.toString?.().toLowerCase?.() || undefined;
  return res.json({ ok: true, isAdmin: true, roles: ["admin"], email });
});

/* ============ Usuários ============ */
router.get("/users", async (req, res) => {
  const page = Math.max(parseInt(String(req.query.page || "1"), 10) || 1, 1);
  const rawLimit = parseInt(String(req.query.limit || "25"), 10) || 25;
  const limit = Math.min(Math.max(rawLimit, 1), 100);

  const { total, users } = await listUsersBasic(page, limit);
  return res.json({ total, page, limit, users });
});

/* ============ Produtos ============ */
router.get("/products", async (_req, res) => {
  const items = await allProducts();
  return res.json({ products: items });
});

router.post("/products", async (req, res) => {
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

router.put("/products/:id", async (req, res) => {
  const { id } = req.params;
  const patch = req.body ?? {};
  const updated = await updateProduct(id, patch);
  if (!updated) return res.status(404).json({ error: "product_not_found" });
  return res.json({ product: updated });
});

router.delete("/products/:id", async (req, res) => {
  const ok = await deleteProduct(req.params.id);
  if (!ok) return res.status(404).json({ error: "product_not_found" });
  return res.status(204).end();
});

/* ============ Grants ============ */
router.get("/grants", async (req, res) => {
  const email = (req.query.email as string | undefined)?.trim();
  if (email) return res.json({ grants: await grantsForEmail(email) });
  return res.json({ grants: await allGrants() });
});

router.post("/grants", async (req, res) => {
  const { email, productId, expiresAt } = req.body ?? {};
  if (!email || !productId) return res.status(400).json({ error: "missing_fields" });

  const prod = await findProductById(String(productId));
  if (!prod) return res.status(404).json({ error: "product_not_found" });

  const g = await grantAccess(String(email), String(productId), expiresAt);
  return res.status(201).json({ grant: g });
});

router.delete("/grants", async (req, res) => {
  const { email, productId } = req.query as any;
  if (!email || !productId) return res.status(400).json({ error: "missing_fields" });

  const ok = await revokeAccess(String(email), String(productId));
  if (!ok) return res.status(404).json({ error: "grant_not_found" });
  return res.status(204).end();
});

export default router;
