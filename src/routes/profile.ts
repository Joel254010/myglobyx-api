import { Router } from "express";
import { authRequired, AuthTokenPayload } from "../middlewares/authJwt";
import { findUserByEmail } from "../db/usersStore";

const router = Router();

/** Perfil do usuário autenticado */
router.get("/profile/me", authRequired, async (req, res) => {
  const userJwt = (req as any).user as AuthTokenPayload;
  const email = userJwt?.email || userJwt?.sub;
  if (!email) return res.status(401).json({ error: "unauthenticated" });

  const dbUser = await findUserByEmail(email);
  if (!dbUser) return res.status(404).json({ error: "user_not_found" });

  return res.json({
    email: dbUser.email,
    name: (dbUser as any).name,
    phone: (dbUser as any).phone,
    isVerified: (dbUser as any).isVerified,
    createdAt: dbUser.createdAt,
    updatedAt: (dbUser as any).updatedAt,
  });
});

export default router;
