// src/routes/auth.ts
import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { ENV } from "../env";
import { signJwt, verifyJwt } from "../middlewares/authJwt";
import { createUser, findUserByEmail, upsertUserPassword } from "../db/usersStore";

const router = Router();

/* ----------------------- Schemas ----------------------- */
const signupSchema = z.object({
  name: z.string().min(2).max(60),
  email: z.string().email(),
  password: z.string().min(6).max(72),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(72),
});

/* ---------------------- Helpers ------------------------ */
function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function signToken(user: { email: string; name: string }) {
  return signJwt({ sub: user.email, name: user.name }, ENV.TOKEN_EXPIRES_IN || "7d");
}

/* ---------------------- Handlers ----------------------- */
async function signupHandler(req: Request, res: Response) {
  const parse = signupSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "validation_error", issues: parse.error.flatten() });
  }

  const { name, email, password } = parse.data;
  const emailNorm = normalizeEmail(email);

  const exists = await findUserByEmail(emailNorm);
  if (exists) return res.status(409).json({ error: "email_in_use" });

  const user = await createUser(name, emailNorm, password);
  const token = signToken({ email: user.email, name: user.name });
  return res.status(201).json({ token, user: { name: user.name, email: user.email } });
}

async function loginHandler(req: Request, res: Response) {
  const parse = loginSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "validation_error", issues: parse.error.flatten() });
  }

  const { email, password } = parse.data;
  const emailNorm = normalizeEmail(email);

  const user = await findUserByEmail(emailNorm);
  if (!user) return res.status(401).json({ error: "invalid_credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "invalid_credentials" });

  const token = signToken({ email: user.email, name: user.name });
  return res.json({ token, user: { name: user.name, email: user.email } });
}

function meHandler(req: Request, res: Response) {
  try {
    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ")) return res.status(401).json({ error: "missing_token" });
    const token = auth.slice(7);
    const payload = verifyJwt(token);
    const email = String(payload.sub || "").toLowerCase();
    if (!email) return res.status(401).json({ error: "invalid_token" });
    return res.json({ user: { name: payload.name || "User", email } });
  } catch {
    return res.status(401).json({ error: "invalid_token" });
  }
}

/* ---------------- Dev / Seed / Reset ------------------- */
async function seedAdminHandler(req: Request, res: Response) {
  const key = req.header("x-seed-key");
  if (!key || key !== (process.env.SEED_KEY || ENV.JWT_SECRET)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const adminEmail =
    (process.env.ADMIN_EMAILS || "")
      .split(",").map(s => s.trim().toLowerCase()).filter(Boolean)[0] || "admin@myglobyx.com";
  const pwd = process.env.ADMIN_SEED_PASSWORD || "123456";

  const user = await upsertUserPassword("Admin", adminEmail, pwd);
  return res.json({ ok: true, user: { email: user.email, name: user.name } });
}

async function resetAdminHandler(req: Request, res: Response) {
  const key = req.header("x-seed-key");
  if (!key || key !== (process.env.SEED_KEY || ENV.JWT_SECRET)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const body = (req.body ?? {}) as { email?: string; password?: string; name?: string };
  const email =
    (body.email ||
      (process.env.ADMIN_EMAILS || "")
        .split(",")
        .map(s => s.trim().toLowerCase())
        .filter(Boolean)[0] ||
      "admin@myglobyx.com").trim().toLowerCase();

  const password = String(body.password || process.env.ADMIN_SEED_PASSWORD || "123456");
  const name = String(body.name || "Admin");

  const user = await upsertUserPassword(name, email, password);
  return res.json({ ok: true, action: "updated", user: { email: user.email, name: user.name } });
}

/* ------------------------ Rotas ------------------------- */
router.post("/auth/signup", signupHandler);
router.post("/auth/login", loginHandler);
router.get("/auth/me", meHandler);

// Dev-only
router.post("/auth/dev/seed-admin", seedAdminHandler);
router.post("/auth/dev/reset-admin", resetAdminHandler);

// Aliases de compatibilidade
router.post("/api/users/signup", signupHandler);
router.post("/api/users/login", loginHandler);

export default router;
