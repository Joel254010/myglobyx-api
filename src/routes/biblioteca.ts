import { Router, Request, Response } from "express";
import { allProducts } from "../db/productsStore";
import type { Product } from "../db/productsStore";
import { authRequired, AuthTokenPayload } from "../middlewares/authJwt";
import { grantsForEmail } from "../db/grantsStore";

const router = Router();

/** Lista pública de produtos (apenas ativos) */
router.get("/api/public/products", async (_req: Request, res: Response) => {
  const items = await allProducts();
  return res.json({ products: items.filter((p: Product) => p.active) });
});

/** Biblioteca do usuário (produtos ativos liberados para o e-mail do token) */
router.get("/api/me/products", authRequired, async (req: Request, res: Response) => {
  const email =
    (req as any)?.user?.sub?.toString?.().toLowerCase?.() ?? "";

  // grants em memória por enquanto
  const grants = grantsForEmail(email);
  const allowed = new Set(grants.map(g => g.productId));

  const items = await allProducts();
  const mine = items.filter((p: Product) => p.active && allowed.has(p.id));

  return res.json({ products: mine });
});

export default router;
