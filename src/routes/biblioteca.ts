// src/routes/biblioteca.ts
import { Router } from "express";
import { authRequired } from "../middlewares/authJwt";
import { allProducts, findProductById } from "../db/productsStore";
import { grantsForEmail } from "../db/grantsStore";

const router = Router();

// catálogo público (só ativos)
router.get("/api/public/products", (_req, res) => {
  return res.json({ products: allProducts().filter(p => p.active) });
});

// produtos do usuário logado
router.get("/api/me/products", authRequired, (req, res) => {
  const email = (req as any).user?.sub as string;
  if (!email) return res.status(401).json({ error: "unauthorized" });

  const gs = grantsForEmail(email);
  const items = gs
    .map(g => findProductById(g.productId))
    .filter(Boolean);

  return res.json({ products: items });
});

export default router;
