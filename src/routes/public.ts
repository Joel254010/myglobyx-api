// src/routes/public.ts
import { Router } from "express";
import { findProductBySlug } from "../db/productsStore";

const router = Router();

/** Redireciona por slug para landingPageUrl (se houver) */
router.get("/p/:slug", async (req, res) => {
  const { slug } = req.params;

  try {
    const product = await findProductBySlug(slug);

    if (!product || !product.landingPageUrl) {
      return res.status(404).send("Produto não encontrado ou sem landingPageUrl.");
    }

    // Redireciona para a landing page do produto
    return res.redirect(product.landingPageUrl);
  } catch (err) {
    console.error("Erro ao buscar produto por slug:", err);
    return res.status(500).send("Erro interno.");
  }
});

export default router;
