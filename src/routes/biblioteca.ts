// src/routes/biblioteca.ts
import { Router, Request, Response } from "express";
import { allProducts, Product } from "../db/productsStore";
import { authRequired } from "../middlewares/authJwt";
import { grantsForEmail } from "../db/grantsStore";

const router = Router();

/** Produtos públicos (ativos) */
router.get("/public/products", async (_req: Request, res: Response) => {
  const items = await allProducts();
  return res.json({ products: items.filter((p: Product) => p.active) });
});

/** Produtos liberados para o usuário logado */
router.get("/me/products", authRequired, async (req: Request, res: Response) => {
  const email = (req as any)?.user?.email ?? "";
  const grants = await grantsForEmail(email);
  const allow = new Set(grants.map((g) => g.productId));

  const items = await allProducts();

  // filtra só produtos ativos e concedidos ao usuário
  const mine = items.filter((p: Product) => p.active && allow.has(p.id));

  return res.json({
    products: mine.map((p: Product) => ({
      id: p.id,
      title: p.title,
      desc: p.description || "",
      type: p.tipo || "premium",   // "ebook" | "curso" | "servico"
      thumbnail: p.thumbnail || "",
      mediaUrl: p.mediaUrl || "",  // usado para e-books
      url: p.landingPageUrl || "", // usado para cursos (YouTube) ou LP
      aulas: p.aulas || [],        // ✅ cursos
      instrucoes: p.instrucoes || "" // ✅ serviços
    })),
  });
});

export default router;
