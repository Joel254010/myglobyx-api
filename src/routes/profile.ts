// src/routes/profile.ts
import { Router, Request, Response } from "express";
import { authRequired, AuthTokenPayload } from "../middlewares/authJwt";
import { z } from "zod";
import { findUserByEmail } from "../db/usersStore";

const router = Router();

type Address = {
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
};

export type Profile = {
  name: string;
  email: string; // não editável aqui; vem do token
  phone?: string;
  birthdate?: string; // YYYY-MM-DD
  document?: string;  // CPF
  address?: Address;
};

// store em memória por usuário (email -> profile)
const profiles = new Map<string, Profile>();

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

router.get("/api/profile/me", authRequired, (req, res) => {
  const email = emailFromReq(req);
  const existing = profiles.get(email);

  if (existing) return res.json({ profile: existing });

  // base: pega nome do usuário do "usersStore"
  const u = findUserByEmail(email);
  const base: Profile = {
    name: u?.name ?? "",
    email,
  };
  return res.json({ profile: base });
});

router.put("/api/profile/me", authRequired, (req, res) => {
  const email = emailFromReq(req);

  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "validation_error", issues: parsed.error.flatten() });
  }

  // nunca permitimos trocar e-mail por aqui
  const incoming = parsed.data;
  const current = profiles.get(email) ?? {
    email,
    name: incoming.name,
  };

  const merged: Profile = {
    ...current,
    ...incoming,
    email,
    address: { ...(current.address ?? {}), ...(incoming.address ?? {}) },
  };

  profiles.set(email, merged);
  return res.json({ profile: merged });
});

export default router;
