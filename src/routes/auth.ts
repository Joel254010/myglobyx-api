import { Router } from "express";
import { signJwt, authRequired } from "../middlewares/authJwt";
import {
  createUser,
  findUserByEmail,
  verifyPassword,
  reissueVerification,
  verifyByToken,
  upsertUserPassword,
} from "../db/usersStore";
import { ENV } from "../env";

const router = Router();

// 🔒 Lista de e-mails autorizados como admin
function adminList(): string[] {
  return String(ENV.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
function isAdmin(email: string) {
  return adminList().includes(String(email || "").toLowerCase());
}

/** ======================== LOGIN ======================== */
router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: "missing_credentials" });
  }

  const user = await findUserByEmail(String(email));
  if (!user) return res.status(401).json({ error: "invalid_credentials" });

  const ok = await verifyPassword(user, String(password));
  if (!ok) return res.status(401).json({ error: "invalid_credentials" });

  const token = signJwt({
    sub: user.email,
    email: user.email,
    name: (user as any).name,
    isAdmin: isAdmin(user.email),
  });

  return res.json({
    token,
    user: {
      email: user.email,
      name: (user as any).name,
      isAdmin: isAdmin(user.email),
      isVerified: (user as any).isVerified,
      createdAt: user.createdAt,
      updatedAt: (user as any).updatedAt,
    },
  });
});

/** ======================== REGISTRO ======================== */
router.post("/register", async (req, res) => {
  const { name, email, password, phone } = req.body ?? {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: "missing_fields" });
  }

  try {
    const created = await createUser(String(name), String(email), String(password), phone);
    return res.status(201).json({
      ok: true,
      user: { email: created.email, name: created.name },
      notice:
        "Se SMTP não estiver configurado, o link de verificação aparece no log (dry-run).",
    });
  } catch (err: any) {
    const code = err?.code || err?.message || "create_failed";
    return res.status(400).json({ error: code });
  }
});

/** ======================== REENVIAR VERIFICAÇÃO ======================== */
router.post("/resend", async (req, res) => {
  const { email } = req.body ?? {};
  if (!email) return res.status(400).json({ error: "missing_email" });

  try {
    const { sent, linkDev } = await reissueVerification(String(email));
    return res.json({ ok: true, sent, linkDev });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || "resend_failed" });
  }
});

/** ======================== CONFIRMAR VERIFICAÇÃO ======================== */
router.get("/verify", async (req, res) => {
  const token = String(req.query.token || "");
  if (!token) return res.status(400).json({ error: "missing_token" });

  const ok = await verifyByToken(token);
  if (!ok) return res.status(400).json({ error: "invalid_or_expired_token" });
  return res.json({ ok: true });
});

/** ======================== VALIDAR TOKEN ATUAL ======================== */
router.get("/validate", authRequired, (req, res) => {
  return res.json({ ok: true, user: (req as any).user });
});

/** ======================== DEV: SEED ADMIN VIA HTTP ======================== */
router.post("/dev/seed-admin", async (req, res) => {
  const key = String(process.env.SEED_KEY || "");
  if (!key || req.query.key !== key) return res.status(403).json({ error: "forbidden" });

  const email = String((req.body?.email || "").trim() || "admin@myglobyx.com");
  const password = String((req.body?.password || "").trim() || "123456");
  const user = await upsertUserPassword("Admin", email, password);
  return res.json({ ok: true, user: { email: user.email, name: (user as any).name } });
});

export default router;
