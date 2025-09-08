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

/** ===== Diagnóstico rápido (sem auth) ===== */
router.get("/__alive", (_req, res) => {
  res.json({ ok: true, router: "admin", mountedAt: "/api/admin", ts: Date.now() });
});

router.get("/__routes", (_req, res) => {
  res.json({
    routes: [
      "GET/POST /ping            (auth admin)",
      "GET       /users          (auth admin)",
      "GET       /products       (auth admin)",
      "POST      /products       (auth admin)",
      "PUT       /products/:id   (auth admin)",
      "DELETE    /products/:id   (auth admin)",
      "GET       /grants         (auth admin)",
      "POST      /grants         (auth admin)",
      "DELETE    /grants         (auth admin)"
    ],
  });
});

/** ===== A partir daqui exige login e permissão admin ===== */
router.use(authRequired, adminOnly);

/** 🔐 Sanity check (ping) — usado pelo frontend para validar sessão admin */
const pingHandler = (req: Request, res: Response) => {
  const user = (req as any).user;
  return res.json({
    ok: true,
    isAdmin: true,
    email: user?.email,
    name: user?.name,
    createdAt: user?.createdAt,
    roles: ["admin"],
  });
};
router.get("/ping", pingHandler);
router.post("/ping", pingHandler);

/** 👥 Lista de usuários */
router.get("/users", async (req, res) => {
  try {
    const page = Math.max(parseInt(String(req.query.page ?? "1"), 10) || 1, 1);
    const rawLimit = parseInt(String(req.query.limit ?? "25"), 10) || 25;
    const limit = Math.min(Math.max(rawLimit, 1), 100);

    const { total, users } = await listUsersBasic(page, limit);
    return res.json({ total, page, limit, users });
  } catch (err: any) {
    return res.status(500).json({ error: "users_list_failed", detail: err?.message });
  }
});

/** 📦 Produtos */
router.get("/products", async (_req, res) => {
  try {
    const items = await allProducts();
    return res.json({ products: items });
  } catch (err: any) {
    return res.status(500).json({ error: "products_list_failed", detail: err?.message });
  }
});

router.post("/products", async (req, res) => {
  const { title, description, mediaUrl, price, active } = req.body ?? {};
  if (!title || typeof title !== "string") {
    return res.status(400).json({ error: "missing_title" });
  }

  try {
    const p = await createProduct({
      title: title.trim(),
      description,
      mediaUrl,
      price: Number.isFinite(Number(price)) ? Number(price) : undefined,
      active: Boolean(active),
    });
    return res.status(201).json({ product: p });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || "create_failed" });
  }
});

router.put("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const patch = req.body ?? {};
    const updated = await updateProduct(id, patch);
    if (!updated) return res.status(404).json({ error: "product_not_found" });
    return res.json({ product: updated });
  } catch (err: any) {
    return res.status(400).json({ error: "update_failed", detail: err?.message });
  }
});

router.delete("/products/:id", async (req, res) => {
  try {
    const ok = await deleteProduct(req.params.id);
    if (!ok) return res.status(404).json({ error: "product_not_found" });
    return res.status(204).end();
  } catch (err: any) {
    return res.status(400).json({ error: "delete_failed", detail: err?.message });
  }
});

/** 🛂 Grants (acessos a produtos) */
router.get("/grants", async (req, res) => {
  try {
    const email = (req.query.email as string | undefined)?.trim();
    if (email) return res.json({ grants: await grantsForEmail(email) });
    return res.json({ grants: await allGrants() });
  } catch (err: any) {
    return res.status(500).json({ error: "grants_list_failed", detail: err?.message });
  }
});

router.post("/grants", async (req, res) => {
  try {
    const { email, productId, expiresAt } = req.body ?? {};
    if (!email || !productId) {
      return res.status(400).json({ error: "missing_fields" });
    }

    const prod = await findProductById(String(productId));
    if (!prod) return res.status(404).json({ error: "product_not_found" });

    const g = await grantAccess(String(email).trim(), String(productId), expiresAt);
    return res.status(201).json({ grant: g });
  } catch (err: any) {
    return res.status(400).json({ error: "grant_create_failed", detail: err?.message });
  }
});

router.delete("/grants", async (req, res) => {
  try {
    const { email, productId } = req.query as any;
    if (!email || !productId) {
      return res.status(400).json({ error: "missing_fields" });
    }

    const ok = await revokeAccess(String(email).trim(), String(productId));
    if (!ok) return res.status(404).json({ error: "grant_not_found" });
    return res.status(204).end();
  } catch (err: any) {
    return res.status(400).json({ error: "grant_delete_failed", detail: err?.message });
  }
});

export default router;
