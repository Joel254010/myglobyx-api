// src/routes/profile.ts
import { Router } from "express";
import { z } from "zod";
import { authRequired, AuthTokenPayload } from "../middlewares/authJwt";
import { findUserByEmail, updateUserProfile } from "../db/usersStore";

const router = Router();

/* ========= Schemas de validação ========= */
const addressSchema = z
  .object({
    cep: z.string().trim().min(1).optional(),
    street: z.string().trim().min(1).optional(),
    number: z.string().trim().min(1).optional(),
    complement: z.string().trim().optional(),
    district: z.string().trim().optional(),
    city: z.string().trim().optional(),
    state: z.string().trim().length(2).optional(), // UF opcional, mas se vier precisa ter 2 chars
  })
  .partial();

const profilePatchSchema = z.object({
    name: z.string().trim().min(2).max(80).optional(),
    phone: z.string().trim().min(8).max(20).optional(),
    birthdate: z.string().trim().optional(), // mantemos string por enquanto
    document: z.string().trim().optional(),
    address: addressSchema.optional(),
});

/* ========= Helpers ========= */
function emailFromReq(req: any): string | null {
  const userJwt = req.user as AuthTokenPayload | undefined;
  const email = (userJwt?.email || userJwt?.sub || "").toString().toLowerCase().trim();
  return email || null;
}

function shapeProfile(u: any) {
  return {
    name: u?.name,
    email: u?.email,
    phone: u?.phone,
    birthdate: u?.birthdate,
    document: u?.document,
    address: u?.address,
    isVerified: u?.isVerified,
    createdAt: u?.createdAt,
    updatedAt: u?.updatedAt,
  };
}

/* ========= GET /profile/me ========= */
router.get("/profile/me", authRequired, async (req, res) => {
  try {
    const email = emailFromReq(req);
    if (!email) return res.status(401).json({ error: "unauthenticated" });

    const dbUser = await findUserByEmail(email);
    if (!dbUser) return res.status(404).json({ error: "user_not_found" });

    return res.json({ profile: shapeProfile(dbUser) });
  } catch (err: any) {
    console.error("GET /profile/me error:", err?.message || err);
    return res.status(500).json({ error: "server_error" });
  }
});

/* ========= PUT /profile/me ========= */
router.put("/profile/me", authRequired, async (req, res) => {
  try {
    const email = emailFromReq(req);
    if (!email) return res.status(401).json({ error: "unauthenticated" });

    const parsed = profilePatchSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "invalid_payload", details: parsed.error.flatten() });
    }

    const patch = parsed.data as any;

    // Normalizações leves antes do update
    if (patch.phone) patch.phone = String(patch.phone).replace(/\D/g, "");
    if (patch.address?.state) {
      patch.address.state = String(patch.address.state).toUpperCase();
    }

    const updated = await updateUserProfile(email, patch);
    if (!updated) return res.status(404).json({ error: "user_not_found" });

    return res.json({ profile: shapeProfile(updated) });
  } catch (err: any) {
    console.error("PUT /profile/me error:", err?.message || err);
    return res.status(500).json({ error: "server_error" });
  }
});

export default router;
