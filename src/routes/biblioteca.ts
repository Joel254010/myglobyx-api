// src/routes/biblioteca.ts
import { Router, Request, Response } from "express";
import { allProducts } from "../db/productsStore";
import type { Product } from "../db/productsStore";
import { authRequired } from "../middlewares/authJwt";
import { grantsForEmail } from "../db/grantsStore";

const router = Router();

/** Produtos públicos (ativos) */
router.get("/api/public/products", async (_req: Request, res: Response) => {
  const items = await allProducts();
  return res.json({ products: items.filter((p: Product) => p.active) });
});

/** Produtos liberados para o usuário logado */
router.get("/api/me/products", authRequired, async (req: Request, res: Response) => {
  const email = (req as any)?.user?.email ?? "";
  const grants = await grantsForEmail(email);
  const allow = new Set(grants.map(g => g.productId));

  const items = await allProducts();
  const mine = items.filter((p: Product) => p.active && allow.has(p.id));

  return res.json({ products: mine });
});

export default router;
