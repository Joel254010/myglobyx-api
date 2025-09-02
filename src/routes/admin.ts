// src/routes/admin.ts
import { Router } from "express";
import { authRequired } from "../middlewares/authJwt";
import { adminOnly } from "../middlewares/adminOnly";
import {
  allProducts, createProduct, updateProduct, deleteProduct,
  findProductById
} from "../db/productsStore";
import {
  grantAccess, revokeAccess, grantsForEmail, allGrants
} from "../db/grantsStore";

const router = Router();

// Protege tudo que começar com /api/admin
router.use("/api/admin", authRequired, adminOnly);

// sanity/ping
router.get("/api/admin/ping", (_req, res) => res.json({ ok: true, role: "admin" }));

// === Produtos ===
router.get("/api/admin/products", (_req, res) => {
  res.json({ products: allProducts() });
});

router.post("/api/admin/products", (req, res) => {
  const { title, description, mediaUrl, price, active } = req.body ?? {};
  if (!title || typeof title !== "string") {
    return res.status(400).json({ error: "missing_title" });
  }
  const p = createProduct({ title, description, mediaUrl, price: Number(price) || undefined, active: !!active });
  res.status(201).json({ product: p });
});

router.put("/api/admin/products/:id", (req, res) => {
  const { id } = req.params;
  const patch = req.body ?? {};
  const updated = updateProduct(id, patch);
  if (!updated) return res.status(404).json({ error: "product_not_found" });
  res.json({ product: updated });
});

router.delete("/api/admin/products/:id", (req, res) => {
  const ok = deleteProduct(req.params.id);
  if (!ok) return res.status(404).json({ error: "product_not_found" });
  res.status(204).end();
});

// === Liberações (grant) ===
router.get("/api/admin/grants", (req, res) => {
  const email = (req.query.email as string | undefined)?.trim();
  if (email) return res.json({ grants: grantsForEmail(email) });
  return res.json({ grants: allGrants() });
});

router.post("/api/admin/grants", (req, res) => {
  const { email, productId, expiresAt } = req.body ?? {};
  if (!email || !productId) return res.status(400).json({ error: "missing_fields" });
  if (!findProductById(productId)) return res.status(404).json({ error: "product_not_found" });
  const g = grantAccess(email, productId, expiresAt);
  res.status(201).json({ grant: g });
});

router.delete("/api/admin/grants", (req, res) => {
  const { email, productId } = req.query as any;
  if (!email || !productId) return res.status(400).json({ error: "missing_fields" });
  const ok = revokeAccess(String(email), String(productId));
  if (!ok) return res.status(404).json({ error: "grant_not_found" });
  res.status(204).end();
});

export default router;
