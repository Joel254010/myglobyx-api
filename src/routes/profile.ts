// src/routes/profile.ts
import { Router, Request, Response } from "express";
import { authRequired, AuthTokenPayload } from "../middlewares/authJwt";
import { z } from "zod";
import { getProfileByEmail, upsertProfile } from "../db/profilesStore";
import { findUserByEmail } from "../db/usersStore"; // só para tentar pré-preencher o nome

const router = Router();

const profileSchema = z.object({
  name: z.string().min(2).max(60),
  phone: z.string().trim().max(20).optional(),
  birthdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  document: z.string().trim().min(11).max(14).optional(),
  address: z.object({
    cep: z.string().trim().max(9).optional(),
    street: z.string().trim().max(100).optional(),
    number: z.string().trim().max(10).optional(),
    complement: z.string().trim().max(60).optional(),
    district: z.string().trim().max(60).optional(),
    city: z.string().trim().max(60).optional(),
    state: z.string().trim().max(2).optional(),
  }).partial().optional(),
});

function emailFromReq(req: Request) {
  const payload = (req as any).user as AuthTokenPayload;
  return String(payload?.sub || "").toLowerCase();
}

/* GET /api/profile/me */
router.get("/api/profile/me", authRequired, async (req: Request, res: Response) => {
  const email = emailFromReq(req);

  // 1) tenta no Atlas
  const dbProfile = await getProfileByEmail(email);
  if (dbProfile) return res.json({ profile: dbProfile });

  // 2) se não existe, tenta pegar o nome do "users" (se existir) só para preencher
  let name = "";
  try {
    const u = await findUserByEmail(email);
    name = u?.name ?? "";
  } catch {
    // silencioso
  }

  return res.json({ profile: { email, name } });
});

/* PUT /api/profile/me */
router.put("/api/profile/me", authRequired, async (req: Request, res: Response) => {
  const email = emailFromReq(req);

  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "validation_error",
      issues: parsed.error.flatten(),
    });
  }

  const updated = await upsertProfile(email, parsed.data);
  return res.json({ profile: updated });
});

export default router;
