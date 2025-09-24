import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

import { ENV } from "../env";
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

import { listUsersBasic, findUserByEmail } from "../db/usersStore";

const router = Router();

/* -------------------- Helpers -------------------- */
function parseAdminEmails(): Set<string> {
  const list = (ENV.ADMIN_EMAILS || "admin@myglobyx.com")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return new Set(list);
}
const ADMIN_EMAILS = parseAdminEmails();

function isAdminUser(u: any): boolean {
  if (!u) return false;
  if (u.isAdmin === true) return true;
  const email = String(u.email || "").toLowerCase();
  return ADMIN_EMAILS.has(email);
}

/* -------------------- Diagnóstico (sem auth) -------------------- */
router.get("/__alive", (_req, res) => {
  res.json({ ok: true, router: "admin", mountedAt: "/api/admin", ts: Date.now() });
});

router.get("/__routes", (_req, res) => {
  res.json({
    routes: [
      "POST     /login           (public)  ✅",
      "GET/POST /ping            (auth admin)",
      "GET       /users          (auth admin)",
      "GET       /products       (auth admin)",
      "POST      /products       (auth admin)",
      "PUT       /products/:id   (auth admin)",
      "DELETE    /products/:id   (auth admin)",
      "GET       /grants         (auth admin)",
      "POST      /grants         (auth admin)",
      "DELETE    /grants         (auth admin)",
    ],
  });
});

/* -------------------- LOGIN ADMIN (público) -------------------- */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "E-mail e senha são obrigatórios." });
    }

    const user = await findUserByEmail(String(email).toLowerCase());
    if (!user || !user.passwordHash) {
      return res.status(401).json({ message: "Credenciais inválidas." });
    }

    if (!isAdminUser(user)) {
      return res.status(401).json({ message: "Não autorizado (admin)." });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "Credenciais inválidas." });
    }

    const sub = (user as any)?._id?.toString?.() ?? String(user.email);

    const token = jwt.sign(
      {
        sub,
        email: user.email,
        name: user.name || "Admin",
        isAdmin: true,
      },
      ENV.JWT_SECRET || "devsecret",
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      admin: {
        email: user.email,
        name: user.name || "Admin",
        isAdmin: true,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ message: "login_failed", detail: err?.message });
  }
});

/* --------- A partir daqui: exige login + permissão admin --------- */
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
  const {
    title,
    description,
    mediaUrl,
    thumbnail,
    categoria,
    subcategoria,
    landingPageUrl,
    checkoutUrl,   // ✅ Novo campo vindo do body
    price,
    active,
    tipo,
  } = req.body ?? {};

  if (!title || typeof title !== "string") {
    return res.status(400).json({ error: "missing_title" });
  }

  if (!tipo || !["ebook", "curso", "servico"].includes(tipo)) {
    return res.status(400).json({
      error: "invalid_tipo",
      detail: "Tipo obrigatório: ebook | curso | servico",
    });
  }

  try {
    const p = await createProduct({
      title: title.trim(),
      description,
      mediaUrl,
      thumbnail,
      categoria,
      subcategoria,
      landingPageUrl,
      checkoutUrl,  // ✅ salvo no banco
      tipo,
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
