// src/routes/profile.ts
import { Router } from "express";
import { z } from "zod";
import { authRequired, AuthTokenPayload } from "../middlewares/authJwt";
import { findUserByEmail, updateUserProfile } from "../db/usersStore";

const router = Router();

/** Schemas de validação */
const addressSchema = z
  .object({
    cep: z.string().trim().min(1).optional(),
    street: z.string().trim().min(1).optional(),
    number: z.string().trim().min(1).optional(),
    complement: z.string().trim().optional(),
    district: z.string().trim().optional(),
    city: z.string().trim().optional(),
    state: z.string().trim().optional(),
  })
  .partial();

const profilePatchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().min(8).max(20).optional(),
  birthdate: z.string().trim().optional(), // manter string por enquanto
  document: z.string().trim().optional(),
  address: addressSchema.optional(),
});

/** Helper para extrair email do JWT */
function emailFromReq(req: any): string | null {
  const userJwt = req.user as AuthTokenPayload | undefined;
  const email = (userJwt?.email || userJwt?.sub || "").toString().toLowerCase().trim();
  return email || null;
}

/** ===== GET /profile/me ===== */
router.get("/profile/me", authRequired, async (req, res) => {
  const email = emailFromReq(req);
  if (!email) return res.status(401).json({ error: "unauthenticated" });

  const dbUser = await findUserByEmail(email);
  if (!dbUser) return res.status(404).json({ error: "user_not_found" });

  const profile = {
    name: (dbUser as any).name,
    email: dbUser.email,
    phone: (dbUser as any).phone,
    birthdate: (dbUser as any).birthdate,
    document: (dbUser as any).document,
    address: (dbUser as any).address,
    isVerified: (dbUser as any).isVerified,
    createdAt: dbUser.createdAt,
    updatedAt: (dbUser as any).updatedAt,
  };

  return res.json({ profile });
});

/** ===== PUT /profile/me ===== */
router.put("/profile/me", authRequired, async (req, res) => {
  const email = emailFromReq(req);
  if (!email) return res.status(401).json({ error: "unauthenticated" });

  const parsed = profilePatchSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  }

  const patch = parsed.data as any;

  // Normalização leve
  if (patch.phone) patch.phone = String(patch.phone).replace(/\D/g, "");

  const updated = await updateUserProfile(email, patch);
  if (!updated) return res.status(404).json({ error: "user_not_found" });

  const profile = {
    name: (updated as any).name,
    email: updated.email,
    phone: (updated as any).phone,
    birthdate: (updated as any).birthdate,
    document: (updated as any).document,
    address: (updated as any).address,
    isVerified: (updated as any).isVerified,
    createdAt: updated.createdAt,
    updatedAt: (updated as any).updatedAt,
  };

  return res.json({ profile });
});

export default router;
